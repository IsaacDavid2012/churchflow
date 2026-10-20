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
      SELECT 
        g.id,
        g.name,
        g.category,
        g.leader_name,
        g.leader_id,
        g.meeting_day,
        g.meeting_time,
        g.location,
        g.description,
        g.active,
        g.created_at,
        g.updated_at,
        COALESCE(g.leader_phone, m.phone) AS leader_phone,
        (
          SELECT COUNT(DISTINCT mm.musician_id)::int
          FROM ministry_members mm
          JOIN musicians mus ON mus.id = mm.musician_id
          WHERE mm.ministry_id = g.id AND mus.active = true
        ) AS member_count
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
      `SELECT 
         g.id,
         g.name,
         g.category,
         g.leader_name,
         g.leader_id,
         g.meeting_day,
         g.meeting_time,
         g.location,
         g.description,
         g.active,
         g.created_at,
         g.updated_at,
         COALESCE(g.leader_phone, m.phone) AS leader_phone,
         (
           SELECT COUNT(DISTINCT mm.musician_id)::int
           FROM ministry_members mm
           JOIN musicians mus ON mus.id = mm.musician_id
           WHERE mm.ministry_id = g.id AND mus.active = true
         ) AS member_count
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

    const { name, leader_id, description, leader_name, leader_phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Ministry name is required' });

    let finalLeaderName = leader_name ? leader_name.trim() : '';
    let finalLeaderPhone = leader_phone ? leader_phone.trim() : null;
    let finalLeaderId = leader_id || null;

    if (leader_id) {
      const leaderRes = await db.query('SELECT id, name, phone FROM musicians WHERE id = $1', [leader_id]);
      if (leaderRes.rows.length > 0) {
        finalLeaderName = leaderRes.rows[0].name;
        finalLeaderPhone = leaderRes.rows[0].phone || finalLeaderPhone;
      }
    }

    const result = await db.query(`
      INSERT INTO groups (name, category, leader_name, leader_id, leader_phone, description, active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [
      name.trim(),
      name.trim(), // Ministry is the team/department itself
      finalLeaderName,
      finalLeaderId,
      finalLeaderPhone,
      description ? description.trim() : ''
    ]);

    const createdMinistry = result.rows[0];

    // If leader selected from People dropdown, automatically assign as manager in ministry_members
    if (finalLeaderId) {
      await db.query(`
        INSERT INTO ministry_members (ministry_id, musician_id, role, assigned_by)
        VALUES ($1, $2, 'manager', $3)
        ON CONFLICT (ministry_id, musician_id)
        DO UPDATE SET role = 'manager'
      `, [createdMinistry.id, finalLeaderId, req.user?.id || null]);

      // Promote to manager if role was member
      await db.query(`
        UPDATE musicians SET role = 'manager' WHERE id = $1 AND role = 'member'
      `, [finalLeaderId]);
    }

    res.status(201).json(createdMinistry);
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

    const { name, leader_id, description, leader_name, leader_phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Ministry name is required' });

    let finalLeaderName = leader_name ? leader_name.trim() : '';
    let finalLeaderPhone = leader_phone ? leader_phone.trim() : null;
    let finalLeaderId = leader_id || null;

    if (leader_id) {
      const leaderRes = await db.query('SELECT id, name, phone FROM musicians WHERE id = $1', [leader_id]);
      if (leaderRes.rows.length > 0) {
        finalLeaderName = leaderRes.rows[0].name;
        finalLeaderPhone = leaderRes.rows[0].phone || finalLeaderPhone;
      }
    }

    const result = await db.query(`
      UPDATE groups
      SET 
        name = $1,
        category = $2,
        leader_name = $3,
        leader_id = $4,
        leader_phone = $5,
        description = $6,
        updated_at = NOW()
      WHERE id = $7 AND active = true
      RETURNING *
    `, [
      name.trim(),
      name.trim(),
      finalLeaderName,
      finalLeaderId,
      finalLeaderPhone,
      description ? description.trim() : '',
      req.params.id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });
    const updatedMinistry = result.rows[0];

    // If leader selected from People dropdown, ensure they are in ministry_members as manager
    if (finalLeaderId) {
      await db.query(`
        INSERT INTO ministry_members (ministry_id, musician_id, role, assigned_by)
        VALUES ($1, $2, 'manager', $3)
        ON CONFLICT (ministry_id, musician_id)
        DO UPDATE SET role = 'manager'
      `, [req.params.id, finalLeaderId, req.user?.id || null]);
    }

    res.json(updatedMinistry);
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

// Helper: Check if a user is a designated manager of a ministry
async function isUserMinistryManager(userId, userEmail, ministryId) {
  try {
    const res = await db.query(`
      SELECT 1 FROM ministry_members mm
      JOIN musicians m ON m.id = mm.musician_id
      WHERE mm.ministry_id = $1 AND mm.role = 'manager'
        AND (m.user_id = $2 OR (m.email IS NOT NULL AND LOWER(m.email) = LOWER($3)))
      LIMIT 1
    `, [ministryId, userId, userEmail || '']);
    return res.rows.length > 0;
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------
// Google Classroom: Announcements Stream Routes
// ----------------------------------------------------

// GET /api/ministries/:id/announcements
router.get('/:id/announcements', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.ministry_id,
        a.author_id,
        a.author_name,
        a.author_role,
        a.title,
        a.content,
        a.is_pinned,
        a.media_url,
        a.media_type,
        a.media_name,
        a.media_size,
        a.created_at,
        a.updated_at
      FROM ministry_announcements a
      WHERE a.ministry_id = $1
      ORDER BY a.is_pinned DESC, a.created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/ministries/:id/announcements - Managers, Pastors, Admins only
router.post('/:id/announcements', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    let canPost = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);
    if (!canPost) {
      canPost = await isUserMinistryManager(req.user?.id, req.user?.email, req.params.id);
    }

    if (!canPost) {
      return res.status(403).json({ 
        error: 'Permission denied. Only ministry managers, pastors, and admins can post announcements.' 
      });
    }

    const { title, content, is_pinned = false, media_url, media_type, media_name, media_size } = req.body;
    const finalContent = (content || '').trim();
    const finalTitle = (title || '').trim() || (media_name ? `Attachment: ${media_name}` : 'Ministry Announcement');

    if (!finalContent && !media_url) {
      return res.status(400).json({ error: 'Announcement message text or media attachment is required' });
    }

    const authorName = req.user?.name || req.user?.username || 'Ministry Leader';
    const authorRole = userRole;

    const result = await db.query(`
      INSERT INTO ministry_announcements (
        ministry_id, author_id, author_name, author_role, title, content, is_pinned,
        media_url, media_type, media_name, media_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.params.id,
      req.user?.id || null,
      authorName,
      authorRole,
      finalTitle,
      finalContent,
      !!is_pinned,
      media_url || null,
      media_type || null,
      media_name || null,
      media_size || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ministries/:id/announcements/:announcementId
router.delete('/:id/announcements/:announcementId', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    const isAdminOrPastor = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]);

    let query = 'DELETE FROM ministry_announcements WHERE id = $1 AND ministry_id = $2';
    const params = [req.params.announcementId, req.params.id];

    if (!isAdminOrPastor) {
      // Authors or managers only
      query += ' AND (author_id = $3 OR author_name = $4)';
      params.push(req.user?.id, req.user?.name);
    }

    const result = await db.query(query, params);
    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Could not delete announcement (not authorized or not found)' });
    }

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------
// Google Classroom: Ministry People & Member Assignment
// ----------------------------------------------------

// GET /api/ministries/:id/members
router.get('/:id/members', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        mm.id AS membership_id,
        mm.role AS ministry_role,
        mm.joined_at,
        m.id AS musician_id,
        m.name,
        m.email,
        m.phone,
        m.roles,
        COALESCE(m.role, 'member') AS system_role,
        m.active,
        m.user_id
      FROM ministry_members mm
      JOIN musicians m ON m.id = mm.musician_id
      WHERE mm.ministry_id = $1
      ORDER BY (CASE WHEN mm.role = 'manager' THEN 0 ELSE 1 END), m.name ASC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/ministries/:id/members - Assign person to ministry (Admin, Pastor, Manager)
router.post('/:id/members', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    let canManage = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);
    if (!canManage) {
      canManage = await isUserMinistryManager(req.user?.id, req.user?.email, req.params.id);
    }

    if (!canManage) {
      return res.status(403).json({ error: 'Permission denied. Members cannot assign people.' });
    }

    const { musician_id, role = 'member' } = req.body;
    if (!musician_id) return res.status(400).json({ error: 'musician_id is required' });

    // "managers will be assigned by pastors and admins."
    const assignedRole = (role === 'manager' && !hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]))
      ? 'member'
      : role;

    const result = await db.query(`
      INSERT INTO ministry_members (ministry_id, musician_id, role, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ministry_id, musician_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `, [req.params.id, musician_id, assignedRole, req.user?.id || null]);

    // Update member count in groups
    await db.query(`
      UPDATE groups 
      SET member_count = (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = $1)
      WHERE id = $1
    `, [req.params.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ministries/:id/members/:musicianId - Remove person from ministry
router.delete('/:id/members/:musicianId', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    let canManage = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);
    if (!canManage) {
      canManage = await isUserMinistryManager(req.user?.id, req.user?.email, req.params.id);
    }

    if (!canManage) {
      return res.status(403).json({ error: 'Permission denied. Members cannot remove people.' });
    }

    await db.query(`
      DELETE FROM ministry_members
      WHERE ministry_id = $1 AND musician_id = $2
    `, [req.params.id, req.params.musicianId]);

    // Update member count in groups
    await db.query(`
      UPDATE groups 
      SET member_count = (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = $1)
      WHERE id = $1
    `, [req.params.id]);

    res.json({ success: true, message: 'Person removed from ministry' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ministries/:id/members/:musicianId/role - Admin and Pastor ONLY ("managers will be assigned by pastors and admins")
router.put('/:id/members/:musicianId/role', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (!hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR])) {
      return res.status(403).json({ error: 'Permission denied. Only Pastors and Admins can assign managers.' });
    }

    const { role } = req.body;
    if (!role || !['manager', 'member'].includes(role)) {
      return res.status(400).json({ error: "Role must be 'manager' or 'member'" });
    }

    const result = await db.query(`
      UPDATE ministry_members
      SET role = $1
      WHERE ministry_id = $2 AND musician_id = $3
      RETURNING *
    `, [role, req.params.id, req.params.musicianId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this ministry' });
    }

    // Also update system role if promoted to manager
    if (role === 'manager') {
      await db.query(`
        UPDATE musicians 
        SET role = 'manager' 
        WHERE id = $1 AND role = 'member'
      `, [req.params.musicianId]);

      await db.query(`
        UPDATE users u
        SET role = 'manager'
        FROM musicians m
        WHERE m.id = $1 AND (u.id = m.user_id OR LOWER(u.email) = LOWER(m.email))
          AND u.role = 'member'
      `, [req.params.musicianId]);
    }

    res.json({ success: true, member: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------
// Ministry Team Chat Space (Real Group Chat for Team)
// ----------------------------------------------------

// GET /api/ministries/:id/chat - Get team chat messages
router.get('/:id/chat', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        ministry_id, 
        user_id, 
        sender, 
        sender_role, 
        sender_name, 
        message, 
        media_url, 
        media_type, 
        media_name, 
        media_size, 
        created_at
      FROM ministry_chat_messages
      WHERE ministry_id = $1
      ORDER BY created_at ASC
      LIMIT 150
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/ministries/:id/chat - Send message to ministry team chat
router.post('/:id/chat', requireAuth, async (req, res, next) => {
  try {
    const { message, media_url, media_type, media_name, media_size } = req.body;
    const finalMessage = (message || '').trim();

    if (!finalMessage && !media_url) {
      return res.status(400).json({ error: 'Message cannot be empty without an attachment' });
    }

    // Verify ministry exists
    const minRes = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (minRes.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });

    const userRole = normalizeRole(req.user?.role) || 'member';
    const senderName = req.user?.name || req.user?.username || 'Team Member';

    // Store team message
    const result = await db.query(`
      INSERT INTO ministry_chat_messages (
        ministry_id, user_id, sender, sender_role, sender_name, message,
        media_url, media_type, media_name, media_size
      )
      VALUES ($1, $2, 'member', $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.params.id,
      req.user?.id || null,
      userRole,
      senderName,
      finalMessage,
      media_url || null,
      media_type || null,
      media_name || null,
      media_size || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ministries/:id/chat/:messageId - Delete a team chat message
router.delete('/:id/chat/:messageId', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    const userId = req.user?.id;

    // Check message existence and author
    const msgRes = await db.query('SELECT * FROM ministry_chat_messages WHERE id = $1 AND ministry_id = $2', [req.params.messageId, req.params.id]);
    if (msgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = msgRes.rows[0];
    const isAuthor = userId && message.user_id && message.user_id === userId;
    const canDelete = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]) || isAuthor;

    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied. Only authors, Pastors, and Admins can delete messages.' });
    }

    await db.query('DELETE FROM ministry_chat_messages WHERE id = $1', [req.params.messageId]);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
