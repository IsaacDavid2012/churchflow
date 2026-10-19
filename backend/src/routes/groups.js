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

    const { title, content, is_pinned = false } = req.body;
    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const authorName = req.user?.name || req.user?.username || 'Ministry Leader';
    const authorRole = userRole;

    const result = await db.query(`
      INSERT INTO ministry_announcements (ministry_id, author_id, author_name, author_role, title, content, is_pinned)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.params.id, req.user?.id || null, authorName, authorRole, title.trim(), content.trim(), !!is_pinned]);

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
// AI Ministry Assistant (Chatbot) Routes
// ----------------------------------------------------
const { getMinistryAssistantReply } = require('../services/ministryAiService');

// GET /api/ministries/:id/chat - Get chat history
router.get('/:id/chat', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, sender, sender_name, message, created_at
      FROM ministry_chat_messages
      WHERE ministry_id = $1
      ORDER BY created_at ASC
      LIMIT 50
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/ministries/:id/chat - Send message to AI Chatbot
router.post('/:id/chat', requireAuth, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Get ministry details
    const minRes = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (minRes.rows.length === 0) return res.status(404).json({ error: 'Ministry not found' });
    const ministry = minRes.rows[0];

    const senderName = req.user?.name || req.user?.username || 'Member';

    // Store user message
    const userMsg = await db.query(`
      INSERT INTO ministry_chat_messages (ministry_id, user_id, sender, sender_name, message)
      VALUES ($1, $2, 'user', $3, $4)
      RETURNING *
    `, [req.params.id, req.user?.id || null, senderName, message.trim()]);

    // Generate AI response
    const aiReplyText = await getMinistryAssistantReply(ministry, message.trim());

    // Store AI reply
    const aiMsg = await db.query(`
      INSERT INTO ministry_chat_messages (ministry_id, user_id, sender, sender_name, message)
      VALUES ($1, NULL, 'assistant', 'Ministry AI Assistant', $2)
      RETURNING *
    `, [req.params.id, aiReplyText]);

    res.json({
      userMessage: userMsg.rows[0],
      reply: aiMsg.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
