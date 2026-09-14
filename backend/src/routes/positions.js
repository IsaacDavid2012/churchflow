const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/positions
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM positions_template ORDER BY sort_order ASC, name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch positions error:', err);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// POST /api/positions
router.post('/', async (req, res) => {
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Position name is required' });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO positions_template (name, sort_order)
      VALUES ($1, $2)
      RETURNING *
    `,
      [name.trim(), parseInt(sort_order || '0', 10)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create position error:', err);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// PUT /api/positions/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, sort_order } = req.body;

  try {
    const result = await db.query(
      `
      UPDATE positions_template
      SET 
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order)
      WHERE id = $3
      RETURNING *
    `,
      [name ? name.trim() : null, sort_order !== undefined ? parseInt(sort_order, 10) : null, id]
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

// DELETE /api/positions/:id
router.delete('/:id', async (req, res) => {
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
