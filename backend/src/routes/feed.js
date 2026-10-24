const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, authMiddleware } = require('../middleware/auth');
const { ROLES, normalizeRole, hasRole } = require('../../../shared/roles');

// Helper to extract authenticated user if token present (optional auth for public/unregistered fallback)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authMiddleware(req, res, () => next());
}

// ========================================================
// GET /api/feed - Retrieve Church Social Timeline
// Query params:
//   - destination: 'all' | 'home' | 'ministry' (default: 'all' for home feed showing home & both)
//   - ministry_id: UUID (optional filter for specific ministry classroom)
//   - limit: number (default 50)
//   - offset: number (default 0)
// ========================================================
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { destination = 'all', ministry_id, limit = 50, offset = 0 } = req.query;
    const currentUserId = req.user?.id || null;

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    // Filter by destination
    if (destination === 'home') {
      whereClauses.push(`(p.destination = 'home' OR p.destination = 'both')`);
    } else if (destination === 'ministry') {
      if (ministry_id) {
        whereClauses.push(`(p.destination = 'ministry' OR p.destination = 'both') AND p.ministry_id = $${paramIndex}`);
        params.push(ministry_id);
        paramIndex++;
      } else {
        whereClauses.push(`(p.destination = 'ministry' OR p.destination = 'both')`);
      }
    } else if (destination === 'all') {
      if (ministry_id) {
        whereClauses.push(`(p.destination = 'home' OR p.ministry_id = $${paramIndex})`);
        params.push(ministry_id);
        paramIndex++;
      } else {
        whereClauses.push(`(p.destination = 'home' OR p.destination = 'both')`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    params.push(currentUserId);
    const userParamIndex = paramIndex;
    paramIndex++;

    params.push(Math.min(parseInt(limit, 10) || 50, 100));
    const limitIndex = paramIndex;
    paramIndex++;

    params.push(parseInt(offset, 10) || 0);
    const offsetIndex = paramIndex;

    const query = `
      SELECT 
        p.id,
        p.author_id,
        p.author_name,
        p.author_role,
        p.post_type,
        p.title,
        p.content,
        p.event_date,
        p.event_location,
        p.destination,
        p.ministry_id,
        g.name as ministry_name,
        p.media_url,
        p.media_type,
        p.media_name,
        p.media_size,
        COALESCE(p.media_attachments, '[]'::jsonb) as media_attachments,
        p.is_pinned,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN $${userParamIndex}::uuid IS NOT NULL THEN
            EXISTS(SELECT 1 FROM feed_post_likes l WHERE l.post_id = p.id AND l.user_id = $${userParamIndex}::uuid)
          ELSE false
        END as has_liked
      FROM feed_posts p
      LEFT JOIN groups g ON g.id = p.ministry_id
      ${whereSql}
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ========================================================
// POST /api/feed - Create Post (Pastor, Admin, & Managers ONLY)
// Members are strictly blocked with 403 Forbidden
// ========================================================
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (!hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER])) {
      return res.status(403).json({
        error: 'Permission denied. Only Pastors, Admins, and Managers can create posts.',
      });
    }

    const {
      title,
      content,
      post_type = 'announcement',
      event_date,
      event_location,
      destination = 'home',
      ministry_id,
      media_url,
      media_type,
      media_name,
      media_size,
      media_attachments,
      is_pinned = false,
    } = req.body;

    const finalContent = (content || '').trim();
    const finalTitle = (title || '').trim() || (media_name ? `Attachment: ${media_name}` : 'Church Update');

    if (!finalContent && !media_url && (!Array.isArray(media_attachments) || media_attachments.length === 0)) {
      return res.status(400).json({ error: 'Post title, text content, or media attachment is required.' });
    }

    // Validate destination
    if ((destination === 'ministry' || destination === 'both') && !ministry_id) {
      return res.status(400).json({ error: 'A valid ministry must be selected for ministry hub or cross-posting.' });
    }

    // Format media attachments array (up to 10 items, <= 20MB each)
    let processedAttachments = [];
    if (Array.isArray(media_attachments) && media_attachments.length > 0) {
      if (media_attachments.length > 10) {
        return res.status(400).json({ error: 'Maximum of 10 media attachments allowed per post.' });
      }

      for (const item of media_attachments) {
        if (item.size && item.size > 20 * 1024 * 1024) {
          return res.status(400).json({ error: `File "${item.name || 'attachment'}" exceeds 20MB limit.` });
        }
        processedAttachments.push({
          url: item.url,
          type: item.type || 'image',
          name: item.name || 'attachment',
          size: item.size || 0,
        });
      }
    } else if (media_url) {
      if (media_size && media_size > 20 * 1024 * 1024) {
        return res.status(400).json({ error: 'File exceeds 20MB limit. Please upload files under 20MB.' });
      }
      processedAttachments.push({
        url: media_url,
        type: media_type || 'image',
        name: media_name || 'attachment',
        size: media_size || 0,
      });
    }

    const authorName = req.user?.name || req.user?.username || 'Church Leader';
    const authorRole = userRole;

    const primaryMediaUrl = processedAttachments[0]?.url || media_url || null;
    const primaryMediaType = processedAttachments[0]?.type || media_type || null;
    const primaryMediaName = processedAttachments[0]?.name || media_name || null;
    const primaryMediaSize = processedAttachments[0]?.size || media_size || null;

    const insertResult = await db.query(`
      INSERT INTO feed_posts (
        author_id, author_name, author_role, post_type, title, content,
        event_date, event_location, destination, ministry_id,
        media_url, media_type, media_name, media_size, media_attachments, is_pinned
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      req.user?.id || null,
      authorName,
      authorRole,
      post_type,
      finalTitle,
      finalContent,
      event_date ? new Date(event_date) : null,
      event_location || null,
      destination,
      ministry_id || null,
      primaryMediaUrl,
      primaryMediaType,
      primaryMediaName,
      primaryMediaSize,
      JSON.stringify(processedAttachments),
      !!is_pinned,
    ]);

    const createdPost = insertResult.rows[0];

    // If cross-posted to ministry or both, sync with ministry_announcements for legacy classroom listeners
    if ((destination === 'both' || destination === 'ministry') && ministry_id) {
      try {
        await db.query(`
          INSERT INTO ministry_announcements (
            ministry_id, author_id, author_name, author_role, title, content,
            media_url, media_type, media_name, media_size, is_pinned
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          ministry_id,
          req.user?.id || null,
          authorName,
          authorRole,
          finalTitle,
          finalContent,
          primaryMediaUrl,
          primaryMediaType,
          primaryMediaName,
          primaryMediaSize,
          !!is_pinned,
        ]);
      } catch (syncErr) {
        console.warn('Sync to ministry_announcements warning:', syncErr.message);
      }
    }

    // Also record audit log
    try {
      await db.query(`
        INSERT INTO notifications_log (type, message, metadata)
        VALUES ('feed_post', $1, $2)
      `, [
        `[${destination.toUpperCase()}] ${finalTitle} posted by ${authorName}`,
        JSON.stringify({ postId: createdPost.id, postType: post_type, destination }),
      ]);
    } catch (e) {}

    res.status(201).json(createdPost);
  } catch (err) {
    next(err);
  }
});

// ========================================================
// DELETE /api/feed/:id - Delete Post (Author, Pastor, Admin, or Manager)
// ========================================================
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    const postRes = await db.query('SELECT author_id, destination, ministry_id FROM feed_posts WHERE id = $1', [req.params.id]);

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postRes.rows[0];
    const isAuthor = post.author_id === req.user?.id;
    const isAdminOrPastor = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]);
    const isManager = userRole === ROLES.MANAGER;

    if (!isAuthor && !isAdminOrPastor && !isManager) {
      return res.status(403).json({ error: 'Permission denied. You cannot delete this post.' });
    }

    await db.query('DELETE FROM feed_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ========================================================
// POST /api/feed/:id/like - Toggle Like (All Registered Members)
// ========================================================
router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username || 'Member';

    // Check if like exists
    const checkRes = await db.query(
      'SELECT id FROM feed_post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (checkRes.rows.length > 0) {
      // Unlike: Delete row and decrement count
      await db.query('DELETE FROM feed_post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      const updateRes = await db.query(
        'UPDATE feed_posts SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW() WHERE id = $1 RETURNING likes_count',
        [postId]
      );
      return res.json({
        liked: false,
        likes_count: updateRes.rows[0]?.likes_count || 0,
      });
    } else {
      // Like: Insert row and increment count
      await db.query(
        'INSERT INTO feed_post_likes (post_id, user_id, user_name) VALUES ($1, $2, $3)',
        [postId, userId, userName]
      );
      const updateRes = await db.query(
        'UPDATE feed_posts SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1 RETURNING likes_count',
        [postId]
      );
      return res.json({
        liked: true,
        likes_count: updateRes.rows[0]?.likes_count || 1,
      });
    }
  } catch (err) {
    next(err);
  }
});

// ========================================================
// GET /api/feed/:id/likes - Retrieve List of Likers
// ========================================================
router.get('/:id/likes', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT l.id, l.user_id, l.user_name, l.created_at, u.role as user_role
       FROM feed_post_likes l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.post_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ========================================================
// GET /api/feed/:id/comments - Retrieve Comments Thread
// ========================================================
router.get('/:id/comments', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.user_name,
        c.user_role,
        c.content,
        c.created_at,
        c.updated_at
       FROM feed_post_comments c
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ========================================================
// POST /api/feed/:id/comments - Add Comment (All Registered Members)
// ========================================================
router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body;
    const cleanContent = (content || '').trim();

    if (!cleanContent) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const userName = req.user.name || req.user.username || 'Member';
    const userRole = normalizeRole(req.user.role);

    const insertRes = await db.query(
      `INSERT INTO feed_post_comments (post_id, user_id, user_name, user_role, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, req.user.id, userName, userRole, cleanContent]
    );

    // Increment comments_count
    await db.query(
      'UPDATE feed_posts SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ========================================================
// DELETE /api/feed/:id/comments/:commentId - Delete Comment
// Allowed for comment author, Pastor, Admin, or Manager
// ========================================================
router.delete('/:id/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    const commentRes = await db.query(
      'SELECT id, user_id FROM feed_post_comments WHERE id = $1 AND post_id = $2',
      [req.params.commentId, req.params.id]
    );

    if (commentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isAuthor = commentRes.rows[0].user_id === req.user?.id;
    const canModerate = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);

    if (!isAuthor && !canModerate) {
      return res.status(403).json({ error: 'Permission denied. You can only delete your own comments.' });
    }

    await db.query('DELETE FROM feed_post_comments WHERE id = $1', [req.params.commentId]);
    await db.query(
      'UPDATE feed_posts SET comments_count = GREATEST(0, comments_count - 1), updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
