const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ROLES } = require('../../../shared/roles');

// GET /api/service-types - List all service types (open to authenticated users)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, default_time, sort_order, created_at, updated_at
      FROM service_types
      ORDER BY sort_order ASC, name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch service types error:', err);
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

// POST /api/service-types - Create a new service type (Admin & Pastor only)
router.post('/', authMiddleware, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res) => {
  const { name, description, default_time, sort_order } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Service type name is required' });
  }

  try {
    const existing = await db.query('SELECT id FROM service_types WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A service type with this name already exists' });
    }

    const maxSort = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM service_types');
    const sortVal = sort_order !== undefined ? parseInt(sort_order, 10) : maxSort.rows[0].next_sort;

    const result = await db.query(
      `
      INSERT INTO service_types (name, description, default_time, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        name.trim(),
        description ? description.trim() : null,
        default_time ? default_time.trim() : '10:00 AM',
        sortVal,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create service type error:', err);
    res.status(500).json({ error: 'Failed to create service type' });
  }
});

// DELETE /api/service-types/:id - Delete a service type (Admin & Pastor only)
router.delete('/:id', authMiddleware, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res) => {
  const { id } = req.params;

  try {
    const countResult = await db.query('SELECT COUNT(*) AS total FROM service_types');
    if (parseInt(countResult.rows[0].total, 10) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining service type' });
    }

    const result = await db.query('DELETE FROM service_types WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service type not found' });
    }

    res.json({ success: true, message: 'Service type deleted successfully', service_type: result.rows[0] });
  } catch (err) {
    console.error('Delete service type error:', err);
    res.status(500).json({ error: 'Failed to delete service type' });
  }
});

module.exports = router;
