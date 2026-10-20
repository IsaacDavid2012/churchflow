const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ROLES, normalizeRole, hasRole } = require('../../../shared/roles');

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

// POST /api/musicians/households - Create a household (Admin, Pastor, Manager only)
router.post('/households', requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]), async (req, res) => {
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
        m.roles[1] AS primary_instrument,
        ('Worship Leader' = ANY(m.roles)) AS can_lead_worship,
        m.ministry,
        COALESCE(u.role, m.role, 'member') AS role,
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
      LEFT JOIN users u ON u.id = m.user_id OR (m.email IS NOT NULL AND LOWER(u.email) = LOWER(m.email))
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
      GROUP BY m.id, m.name, m.email, m.phone, m.roles, m.ministry, m.status, m.household_id, m.household_role, m.birthday, m.gender, m.address, m.notes, m.active, m.created_at, h.name, u.role, m.role
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

// POST /api/musicians - Create a person (Admin, Pastor, Manager only)
router.post('/', requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]), async (req, res) => {
  const { name, email, phone, roles, primary_instrument, ministry, status, household_id, household_role, birthday, gender, address, notes, active } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const rolesArray = Array.isArray(roles)
      ? roles
      : primary_instrument && String(primary_instrument).trim()
        ? [String(primary_instrument).trim()]
        : [];
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
        ministry || 'Media Team',
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

    const createdMusician = result.rows[0];

    // Auto-Enroll into corresponding ministries based on selected positions
    await syncMusicianMinistries(createdMusician.id, rolesArray);

    const refetched = await db.query('SELECT * FROM musicians WHERE id = $1', [createdMusician.id]);
    res.status(201).json(refetched.rows[0] || createdMusician);
  } catch (err) {
    console.error('Create person error:', err);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// PUT /api/musicians/:id - Update person (Self-service for members, or Admin/Pastor/Manager)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, roles, ministry, status, household_id, household_role, birthday, gender, address, notes, active, role } = req.body;

  try {
    const check = await db.query('SELECT id, role, email, user_id FROM musicians WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const target = check.rows[0];
    const userRole = normalizeRole(req.user?.role);
    const isSelf = (target.user_id && target.user_id === req.user?.id) || 
                   (target.email && req.user?.email && target.email.toLowerCase() === req.user.email.toLowerCase());
    const isLeaderOrHigher = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER, ROLES.LEADER]);

    // Non-leaders can only edit their own profile
    if (!isLeaderOrHigher && !isSelf) {
      return res.status(403).json({ error: 'Permission denied. You can only update your own profile.' });
    }

    // Members updating themselves cannot modify privileged fields
    if (!isLeaderOrHigher && isSelf) {
      if (role !== undefined || status !== undefined || active !== undefined || notes !== undefined) {
        return res.status(403).json({ error: 'Permission denied. Members cannot modify role, status, active state, or leader notes.' });
      }
    }

    // Role changes are strictly restricted to Admin ("only admin can change roles")
    if (role !== undefined && normalizeRole(role) !== normalizeRole(target.role)) {
      if (!hasRole(userRole, ROLES.ADMIN)) {
        return res.status(403).json({ error: 'Permission denied. Only Admins can change user roles.' });
      }
      const normRole = normalizeRole(role);
      await db.query('UPDATE musicians SET role = $1 WHERE id = $2', [normRole, id]);
      await db.query(`
        UPDATE users u
        SET role = $1, updated_at = NOW()
        FROM musicians m
        WHERE m.id = $2 AND (u.id = m.user_id OR (m.email IS NOT NULL AND LOWER(u.email) = LOWER(m.email)))
      `, [normRole, id]);
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

    // Auto-Sync Ministry Memberships based on updated positions
    if (rolesArray !== undefined) {
      await syncMusicianMinistries(id, rolesArray);
    }

    const refetched = await db.query('SELECT * FROM musicians WHERE id = $1', [id]);
    res.json(refetched.rows[0] || result.rows[0]);
  } catch (err) {
    console.error('Update person error:', err);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// DELETE /api/musicians/:id (Admin and Pastor only - Managers and Members cannot delete members)
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res) => {
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

/**
 * Automatically syncs a musician's ministry memberships based on their assigned positions.
 * - Selecting positions in a ministry automatically enrolls them into that ministry's group & chat.
 * - Removing all positions under a ministry automatically unenrolls them from that ministry (protecting managers).
 */
async function syncMusicianMinistries(musicianId, roles = []) {
  if (!musicianId) return;
  const rolesArray = Array.isArray(roles) ? roles.map(r => String(r).trim()).filter(Boolean) : [];

  try {
    // 1. Fetch current ministry memberships for this musician
    const curRes = await db.query(
      'SELECT id, ministry_id, role FROM ministry_members WHERE musician_id = $1',
      [musicianId]
    );
    const currentMemberships = curRes.rows;
    const currentMinistryIds = new Set(currentMemberships.map(m => m.ministry_id));

    // 2. If roles array is empty, unenroll member roles and update ministry to 'None'
    if (rolesArray.length === 0) {
      // Delete regular member entries (preserve managers/leaders)
      await db.query(
        "DELETE FROM ministry_members WHERE musician_id = $1 AND role != 'manager'",
        [musicianId]
      );

      // Update remaining member counts
      for (const mId of currentMinistryIds) {
        await updateMinistryMemberCount(mId);
      }

      // Check if they remain in any ministry as manager
      const remRes = await db.query(`
        SELECT g.name FROM ministry_members mm
        JOIN groups g ON g.id = mm.ministry_id
        WHERE mm.musician_id = $1
      `, [musicianId]);

      const finalMinistry = remRes.rows.length > 0
        ? remRes.rows.map(r => r.name).join(', ')
        : 'None';

      await db.query('UPDATE musicians SET ministry = $1, updated_at = NOW() WHERE id = $2', [finalMinistry, musicianId]);
      return;
    }

    // 3. Find matching positions_template rows
    const posRes = await db.query(
      'SELECT id, name, ministry, ministry_id FROM positions_template WHERE LOWER(name) = ANY($1::text[])',
      [rolesArray.map(r => r.toLowerCase())]
    );

    // 4. Resolve target ministry group IDs
    const targetGroupIds = new Set();
    const unmatchedMinistryNames = new Set();

    for (const pos of posRes.rows) {
      if (pos.ministry_id) {
        targetGroupIds.add(pos.ministry_id);
      } else if (pos.ministry && pos.ministry.trim()) {
        unmatchedMinistryNames.add(pos.ministry.trim().toLowerCase());
      }
    }

    if (unmatchedMinistryNames.size > 0) {
      const gRes = await db.query(
        'SELECT id FROM groups WHERE active = true AND (LOWER(name) = ANY($1::text[]) OR LOWER(category) = ANY($1::text[]))',
        [Array.from(unmatchedMinistryNames)]
      );
      for (const g of gRes.rows) {
        targetGroupIds.add(g.id);
      }
    }

    // 5. Auto-Enroll into target ministries
    for (const groupId of targetGroupIds) {
      if (!currentMinistryIds.has(groupId)) {
        await db.query(`
          INSERT INTO ministry_members (ministry_id, musician_id, role, joined_at)
          VALUES ($1, $2, 'member', NOW())
          ON CONFLICT (ministry_id, musician_id) DO NOTHING
        `, [groupId, musicianId]);
        await updateMinistryMemberCount(groupId);
      }
    }

    // 6. Clean Auto-Unenroll from ministries where they hold 0 positions (protect managers)
    for (const membership of currentMemberships) {
      if (!targetGroupIds.has(membership.ministry_id)) {
        // Only unenroll regular members; do not kick designated managers
        if (membership.role !== 'manager') {
          await db.query(
            'DELETE FROM ministry_members WHERE id = $1',
            [membership.id]
          );
          await updateMinistryMemberCount(membership.ministry_id);
        }
      }
    }

    // 7. Update musicians.ministry with current active enrolled ministry names
    const activeMinsRes = await db.query(`
      SELECT DISTINCT g.name FROM ministry_members mm
      JOIN groups g ON g.id = mm.ministry_id
      WHERE mm.musician_id = $1 AND g.active = true
      ORDER BY g.name ASC
    `, [musicianId]);

    const finalMinistryStr = activeMinsRes.rows.length > 0
      ? activeMinsRes.rows.map(r => r.name).join(', ')
      : 'None';

    await db.query(
      'UPDATE musicians SET ministry = $1, updated_at = NOW() WHERE id = $2',
      [finalMinistryStr, musicianId]
    );

  } catch (err) {
    console.error(`Error in syncMusicianMinistries for musician ${musicianId}:`, err);
  }
}

async function updateMinistryMemberCount(groupId) {
  if (!groupId) return;
  try {
    const countRes = await db.query(
      'SELECT COUNT(*) FROM ministry_members WHERE ministry_id = $1',
      [groupId]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    await db.query(
      'UPDATE groups SET member_count = $1, updated_at = NOW() WHERE id = $2',
      [count, groupId]
    );
  } catch (e) {
    console.error('Failed to update ministry member count:', e);
  }
}

module.exports = router;
