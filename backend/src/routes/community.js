const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES, normalizeRole, hasRole } = require('../../../shared/roles');

// ========================================================
// General Church Announcements (WhatsApp Community Broadcast)
// Pastors & Admins only can post / delete
// All church members can view
// ========================================================

// GET /api/community/announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        author_id,
        author_name,
        author_role,
        title,
        content,
        is_pinned,
        created_at,
        updated_at
      FROM general_announcements
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/community/announcements (Pastor & Admin ONLY)
router.post('/announcements', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (!hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR])) {
      return res.status(403).json({ 
        error: 'Permission denied. Only Pastors and Admins can post church-wide general announcements.' 
      });
    }

    const { title, content, is_pinned = false } = req.body;
    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ error: 'Announcement title and content are required' });
    }

    const authorName = req.user?.name || req.user?.username || 'Pastor';
    const authorRole = userRole;

    const result = await db.query(`
      INSERT INTO general_announcements (author_id, author_name, author_role, title, content, is_pinned)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user?.id || null, authorName, authorRole, title.trim(), content.trim(), !!is_pinned]);

    // Also record in notifications log
    try {
      await db.query(`
        INSERT INTO notifications_log (type, message, metadata)
        VALUES ('general_announcement', $1, $2)
      `, [
        `[Church Announcement] ${title.trim()} posted by ${authorName}`,
        JSON.stringify({ announcementId: result.rows[0].id, title: title.trim() })
      ]);
    } catch (e) {}

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/community/announcements/:id (Pastor & Admin ONLY)
router.delete('/announcements/:id', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (!hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR])) {
      return res.status(403).json({ 
        error: 'Permission denied. Only Pastors and Admins can delete general church announcements.' 
      });
    }

    const result = await db.query('DELETE FROM general_announcements WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ success: true, message: 'General announcement deleted' });
  } catch (err) {
    next(err);
  }
});

// ========================================================
// General Church Chat (WhatsApp Community General Chat)
// All church members can chat with each other
// ========================================================

// GET /api/community/chat - Get general church chat messages
router.get('/chat', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        user_id,
        sender_name,
        sender_role,
        message,
        created_at
      FROM general_chat_messages
      ORDER BY created_at ASC
      LIMIT 150
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/community/chat - Send message in general church chat
router.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const senderName = req.user?.name || req.user?.username || 'Church Member';
    const senderRole = normalizeRole(req.user?.role) || 'member';

    const result = await db.query(`
      INSERT INTO general_chat_messages (user_id, sender_name, sender_role, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.user?.id || null, senderName, senderRole, message.trim()]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/community/chat/:id (Admin, Pastor, or message sender)
router.delete('/chat/:id', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    const isAdminOrPastor = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]);

    let query = 'DELETE FROM general_chat_messages WHERE id = $1';
    const params = [req.params.id];

    if (!isAdminOrPastor) {
      query += ' AND user_id = $2';
      params.push(req.user?.id);
    }

    const result = await db.query(query, params);
    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Could not delete message (not authorized or not found)' });
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
