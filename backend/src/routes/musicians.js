const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/musicians/households - List all households with family members
router.get('/households', async (req, res) => {
  try {
    const householdsRes = await db.query(`
      SELECT 
        h.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'name', m.name,
              'role', m.household_role,
              'email', m.email,
              'phone', m.phone,
              'status', m.status
            )
          ) FILTER (WHERE m.id IS NOT NULL), '[]'
        ) AS members
      FROM households h
      LEFT JOIN musicians m ON m.household_id = h.id AND m.active = true
      GROUP BY h.id
      ORDER BY h.name ASC
    `);
    res.json(householdsRes.rows);
  } catch (err) {
    console.error('Fetch households error:', err);
    res.status(500).json({ error: 'Failed to fetch households' });
  }
});

// POST /api/musicians/households - Create a household
router.post('/households', async (req, res) => {
  const { name, primary_phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Household name is required' });

  try {
    const result = await db.query(`
      INSERT INTO households (name, primary_phone, address)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name.trim(), primary_phone || '', address || '']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create household error:', err);
    res.status(500).json({ error: 'Failed to create household' });
  }
});

// GET /api/musicians - List all people with rich filters (Planning Center People Directory)
router.get('/', async (req, res) => {
  try {
    const { active, search, ministry, status } = req.query;
    let query = `
      SELECT 
        m.id,
        m.name,
        m.email,
        m.phone,
        m.roles,
        m.ministry,
        m.status,
        m.household_id,
        m.household_role,
        m.birthday,
        m.gender,
        m.address,
        m.notes,
        m.active,
        m.created_at,
        h.name AS household_name,
        MAX(s.service_date) AS last_served_date,
        COUNT(a.id) FILTER (WHERE a.status = 'confirmed') AS total_confirmed_serves
      FROM musicians m
      LEFT JOIN households h ON h.id = m.household_id
      LEFT JOIN assignments a ON a.musician_id = m.id AND a.status = 'confirmed'
      LEFT JOIN services s ON s.id = a.service_id
    `;

    const whereClauses = [];
    const params = [];

    if (active !== undefined) {
      params.push(active === 'true');
      whereClauses.push(`m.active = $${params.length}`);
    }

    if (ministry) {
      params.push(`%${ministry.trim()}%`);
      whereClauses.push(`(m.ministry ILIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(m.roles) r WHERE r ILIKE $${params.length}))`);
    }

    if (status) {
      params.push(status.trim());
      whereClauses.push(`m.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(m.name ILIKE $${params.length} OR m.email ILIKE $${params.length} OR m.phone ILIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(m.roles) r WHERE r ILIKE $${params.length}))`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += `
      GROUP BY m.id, m.name, m.email, m.phone, m.roles, m.ministry, m.status, m.household_id, m.household_role, m.birthday, m.gender, m.address, m.notes, m.active, m.created_at, h.name
      ORDER BY m.name ASC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch musicians error:', err);
    res.status(500).json({ error: 'Failed to fetch people directory' });
  }
});

// GET /api/musicians/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const musicianRes = await db.query(`
      SELECT 
        m.*,
        h.name AS household_name,
        h.address AS household_address
      FROM musicians m
      LEFT JOIN households h ON h.id = m.household_id
      WHERE m.id = $1
    `, [id]);

    if (musicianRes.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // Get serving history
    const historyRes = await db.query(
      `
      SELECT 
        a.id AS assignment_id,
        a.role_slot,
        a.status,
        a.assigned_at,
        s.id AS service_id,
        s.service_date,
        s.service_time,
        p.name AS position_name
      FROM assignments a
      JOIN services s ON s.id = a.service_id
      JOIN positions_template p ON p.id = a.position_id
      WHERE a.musician_id = $1
      ORDER BY s.service_date DESC
      LIMIT 20
    `,
      [id]
    );

    res.json({
      musician: musicianRes.rows[0],
      history: historyRes.rows,
    });
  } catch (err) {
    console.error('Fetch person detail error:', err);
    res.status(500).json({ error: 'Failed to fetch person detail' });
  }
});

// POST /api/musicians
router.post('/', async (req, res) => {
  const { name, email, phone, roles, ministry, status, household_id, household_role, birthday, gender, address, notes, active } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const rolesArray = Array.isArray(roles) ? roles : [];
    const result = await db.query(
      `
      INSERT INTO musicians (
        name, email, phone, roles, ministry, status, household_id, household_role, birthday, gender, address, notes, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
      [
        name.trim(),
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        rolesArray,
        ministry || 'Worship Team',
        status || 'member',
        household_id || null,
        household_role || 'individual',
        birthday || null,
        gender || null,
        address || null,
        notes || null,
        active !== false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create person error:', err);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// PUT /api/musicians/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, roles, ministry, status, household_id, household_role, birthday, gender, address, notes, active } = req.body;

  try {
    const check = await db.query('SELECT id FROM musicians WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const rolesArray = Array.isArray(roles) ? roles : undefined;
    const result = await db.query(
      `
      UPDATE musicians
      SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        roles = COALESCE($4, roles),
        ministry = COALESCE($5, ministry),
        status = COALESCE($6, status),
        household_id = COALESCE($7, household_id),
        household_role = COALESCE($8, household_role),
        birthday = COALESCE($9, birthday),
        gender = COALESCE($10, gender),
        address = COALESCE($11, address),
        notes = COALESCE($12, notes),
        active = COALESCE($13, active),
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `,
      [
        name ? name.trim() : null,
        email !== undefined ? (email ? email.trim() : null) : null,
        phone !== undefined ? (phone ? phone.trim() : null) : null,
        rolesArray,
        ministry,
        status,
        household_id,
        household_role,
        birthday || null,
        gender,
        address,
        notes,
        active,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update person error:', err);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// DELETE /api/musicians/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE musicians SET active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json({ message: 'Person deactivated successfully', musician: result.rows[0] });
  } catch (err) {
    console.error('Delete person error:', err);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

module.exports = router;
