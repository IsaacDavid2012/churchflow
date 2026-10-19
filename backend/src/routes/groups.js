const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES, normalizeRole, hasRole } = require('../../../shared/roles');

// GET /api/ministries (or /api/groups)
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT g.*, COALESCE(g.leader_phone, m.phone) AS leader_phone
      FROM groups g
      LEFT JOIN musicians m ON m.id = g.leader_id
      WHERE g.active = true
    `;
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND g.category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (g.name ILIKE $${params.length} OR g.leader_name ILIKE $${params.length} OR g.location ILIKE $${params.length} OR g.category ILIKE $${params.length})`;
    }

    query += ' ORDER BY g.name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/ministries/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT g.*, COALESCE(g.leader_phone, m.phone) AS leader_phone 
       FROM groups g 
       LEFT JOIN musicians m ON m.id = g.leader_id 
       WHERE g.id = $1 AND g.active = true`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/ministries - Admin, Pastor, Manager only (Members strictly read-only)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (userRole === ROLES.MEMBER) {
      return res.status(403).json({ error: 'Permission denied. Members have read-only access to ministries.' });
    }

    const { name, category, leader_name, leader_id, leader_phone, meeting_day, meeting_time, location, description, member_count } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Ministry name is required' });

    const result = await db.query(`
      INSERT INTO groups (name, category, leader_name, leader_id, leader_phone, meeting_day, meeting_time, location, description, member_count, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *
    `, [
      name.trim(),
      category || 'Worship & Music',
      leader_name ? leader_name.trim() : '',
      leader_id || null,
      leader_phone ? leader_phone.trim() : null,
      meeting_day || 'Sunday',
      meeting_time || '10:00 AM',
      location ? location.trim() : 'Main Sanctuary',
      description ? description.trim() : '',
      member_count ? parseInt(member_count, 10) : 0
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/ministries/:id - Admin, Pastor, Manager only (Members strictly read-only)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (userRole === ROLES.MEMBER) {
      return res.status(403).json({ error: 'Permission denied. Members have read-only access to ministries.' });
    }

    const { name, category, leader_name, leader_id, leader_phone, meeting_day, meeting_time, location, description, member_count } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Ministry name is required' });

    const result = await db.query(`
      UPDATE groups
      SET 
        name = $1,
        category = $2,
        leader_name = $3,
        leader_id = $4,
        leader_phone = $5,
        meeting_day = $6,
        meeting_time = $7,
        location = $8,
        description = $9,
        member_count = $10,
        updated_at = NOW()
      WHERE id = $11 AND active = true
      RETURNING *
    `, [
      name.trim(),
      category || 'Worship & Music',
      leader_name ? leader_name.trim() : '',
      leader_id || null,
      leader_phone ? leader_phone.trim() : null,
      meeting_day || 'Sunday',
      meeting_time || '10:00 AM',
      location ? location.trim() : 'Main Sanctuary',
      description ? description.trim() : '',
      member_count ? parseInt(member_count, 10) : 0,
      req.params.id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ministries/:id - Admin and Pastor only (Manager & Member strictly no deletion)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!hasRole(req.user?.role, [ROLES.ADMIN, ROLES.PASTOR])) {
      return res.status(403).json({ error: 'Permission denied. Only Admins and Pastors can delete ministries.' });
    }

    const result = await db.query('UPDATE groups SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });
    res.json({ message: 'Ministry deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
