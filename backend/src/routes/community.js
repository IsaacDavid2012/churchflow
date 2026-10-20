const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES, normalizeRole, hasRole } = require('../../../shared/roles');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for direct multipart uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit strictly enforced
});

// Helper to determine media type from extension and mime
function resolveMediaType(fileName, mimeType = '') {
  const ext = (path.extname(fileName || '') || '').toLowerCase().replace('.', '');
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'mov', 'm4v', '3gp', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'video';
  }
  if (ext === 'sbp' || ext === 'sbpbackup') {
    return 'sbp';
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }
  return 'file';
}

// ========================================================
// Media Upload (Photos, Videos, SBP, Documents <= 10MB)
// Supports multipart/form-data OR base64 payload
// ========================================================
router.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit. Please upload files under 10MB.' });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    // 1. Handled via multipart form-data
    if (req.file) {
      const mediaType = resolveMediaType(req.file.originalname, req.file.mimetype);
      return res.json({
        url: `/uploads/${req.file.filename}`,
        name: req.file.originalname,
        type: mediaType,
        size: req.file.size,
        mime: req.file.mimetype,
      });
    }

    // 2. Handled via JSON base64
    const { fileBase64, fileName = 'attachment', fileType } = req.body || {};
    if (!fileBase64) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit. Please upload files under 10MB.' });
    }

    const mediaType = resolveMediaType(fileName, fileType);
    const ext = path.extname(fileName) || '';
    const safeBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const diskFileName = `${uuidv4()}-${safeBase}${ext}`;
    const targetPath = path.join(uploadsDir, diskFileName);

    try {
      await fs.promises.writeFile(targetPath, buffer);
      return res.json({
        url: `/uploads/${diskFileName}`,
        name: fileName,
        type: mediaType,
        size: buffer.length,
        mime: fileType || 'application/octet-stream',
      });
    } catch (writeErr) {
      return next(writeErr);
    }
  });
});

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
        media_url,
        media_type,
        media_name,
        media_size,
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

    const { title, content, is_pinned = false, media_url, media_type, media_name, media_size } = req.body;
    const finalContent = (content || '').trim();
    const finalTitle = (title || '').trim() || (media_name ? `Attachment: ${media_name}` : 'Church Announcement');

    if (!finalContent && !media_url) {
      return res.status(400).json({ error: 'Announcement message text or media attachment is required' });
    }

    const authorName = req.user?.name || req.user?.username || 'Pastor';
    const authorRole = userRole;

    const result = await db.query(`
      INSERT INTO general_announcements (
        author_id, author_name, author_role, title, content, is_pinned,
        media_url, media_type, media_name, media_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
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

    // Also record in notifications log
    try {
      await db.query(`
        INSERT INTO notifications_log (type, message, metadata)
        VALUES ('general_announcement', $1, $2)
      `, [
        `[Church Announcement] ${finalTitle} posted by ${authorName}`,
        JSON.stringify({ announcementId: result.rows[0].id, title: finalTitle })
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
        media_url,
        media_type,
        media_name,
        media_size,
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
    const { message, media_url, media_type, media_name, media_size } = req.body;
    const finalMessage = (message || '').trim();

    if (!finalMessage && !media_url) {
      return res.status(400).json({ error: 'Message cannot be empty without an attachment' });
    }

    const senderName = req.user?.name || req.user?.username || 'Church Member';
    const senderRole = normalizeRole(req.user?.role) || 'member';

    const result = await db.query(`
      INSERT INTO general_chat_messages (
        user_id, sender_name, sender_role, message,
        media_url, media_type, media_name, media_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      req.user?.id || null,
      senderName,
      senderRole,
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
