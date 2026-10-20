const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ROLES } = require('../../../shared/roles');

router.use(authMiddleware);

// GET /api/positions
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id, 
        p.name, 
        p.sort_order, 
        p.created_at, 
        COALESCE(g.name, p.ministry, 'Media Team') AS ministry, 
        p.ministry_id, 
        COALESCE(g.name, p.ministry, 'Media Team') AS ministry_name 
      FROM positions_template p 
      LEFT JOIN groups g ON g.id = p.ministry_id 
      ORDER BY p.sort_order ASC, p.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch positions error:', err);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// POST /api/positions (Admin, Pastor, Manager only)
router.post('/', requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]), async (req, res) => {
  const { name, ministry, ministry_id, sort_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Position name is required' });
  }

  try {
    let finalMinistryName = ministry ? ministry.trim() : 'Media Team';
    let finalMinistryId = ministry_id || null;

    if (finalMinistryId) {
      const gRes = await db.query('SELECT id, name FROM groups WHERE id = $1 AND active = true', [finalMinistryId]);
      if (gRes.rows.length > 0) {
        finalMinistryName = gRes.rows[0].name;
      }
    } else if (finalMinistryName) {
      const gRes = await db.query('SELECT id, name FROM groups WHERE active = true AND (LOWER(name) = LOWER($1) OR LOWER(category) = LOWER($1)) LIMIT 1', [finalMinistryName]);
      if (gRes.rows.length > 0) {
        finalMinistryId = gRes.rows[0].id;
        finalMinistryName = gRes.rows[0].name;
      }
    }

    const result = await db.query(
      `
      INSERT INTO positions_template (name, ministry, ministry_id, sort_order)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO UPDATE SET
        ministry = COALESCE(EXCLUDED.ministry, positions_template.ministry),
        ministry_id = COALESCE(EXCLUDED.ministry_id, positions_template.ministry_id),
        sort_order = COALESCE(EXCLUDED.sort_order, positions_template.sort_order)
      RETURNING *
    `,
      [name.trim(), finalMinistryName, finalMinistryId, parseInt(sort_order || '0', 10)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create position error:', err);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// PUT /api/positions/:id (Admin, Pastor, Manager only)
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]), async (req, res) => {
  const { id } = req.params;
  const { name, ministry, ministry_id, sort_order } = req.body;

  try {
    let finalMinistryName = ministry ? ministry.trim() : undefined;
    let finalMinistryId = ministry_id !== undefined ? ministry_id : undefined;

    if (finalMinistryId) {
      const gRes = await db.query('SELECT id, name FROM groups WHERE id = $1 AND active = true', [finalMinistryId]);
      if (gRes.rows.length > 0) {
        finalMinistryName = gRes.rows[0].name;
      }
    } else if (finalMinistryName && finalMinistryId === undefined) {
      const gRes = await db.query('SELECT id, name FROM groups WHERE active = true AND (LOWER(name) = LOWER($1) OR LOWER(category) = LOWER($1)) LIMIT 1', [finalMinistryName]);
      if (gRes.rows.length > 0) {
        finalMinistryId = gRes.rows[0].id;
        finalMinistryName = gRes.rows[0].name;
      }
    }

    const result = await db.query(
      `
      UPDATE positions_template
      SET 
        name = COALESCE($1, name),
        ministry = COALESCE($2, ministry),
        ministry_id = COALESCE($3, ministry_id),
        sort_order = COALESCE($4, sort_order)
      WHERE id = $5
      RETURNING *
    `,
      [
        name ? name.trim() : null, 
        finalMinistryName !== undefined ? finalMinistryName : null, 
        finalMinistryId !== undefined ? finalMinistryId : null,
        sort_order !== undefined ? parseInt(sort_order, 10) : null, 
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update position error:', err);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// DELETE /api/positions/:id (Admin and Pastor only - Managers and Members cannot delete positions)
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM positions_template WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json({ message: 'Position deleted successfully' });
  } catch (err) {
    console.error('Delete position error:', err);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

module.exports = router;
