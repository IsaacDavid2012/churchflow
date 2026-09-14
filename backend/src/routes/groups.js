const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/groups
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM groups WHERE active = true';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR leader_name ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/groups/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/groups
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, category, leader_name, leader_id, meeting_day, meeting_time, location, description, member_count } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const result = await db.query(`
      INSERT INTO groups (name, category, leader_name, leader_id, meeting_day, meeting_time, location, description, member_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      name,
      category || 'Life Group',
      leader_name || '',
      leader_id || null,
      meeting_day || 'Wednesday',
      meeting_time || '7:00 PM',
      location || 'Fellowship Hall',
      description || '',
      member_count ? parseInt(member_count, 10) : 0
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/groups/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, category, leader_name, leader_id, meeting_day, meeting_time, location, description, member_count } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const result = await db.query(`
      UPDATE groups
      SET 
        name = $1,
        category = $2,
        leader_name = $3,
        leader_id = $4,
        meeting_day = $5,
        meeting_time = $6,
        location = $7,
        description = $8,
        member_count = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      name,
      category || 'Life Group',
      leader_name || '',
      leader_id || null,
      meeting_day || 'Wednesday',
      meeting_time || '7:00 PM',
      location || 'Fellowship Hall',
      description || '',
      member_count ? parseInt(member_count, 10) : 0,
      req.params.id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/groups/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('UPDATE groups SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
