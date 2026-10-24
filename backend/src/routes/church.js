const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../../../shared/roles');

// GET /api/church - Get church profile and overview stats
router.get('/', async (req, res, next) => {
  try {
    const profileRes = await db.query('SELECT * FROM church_profile LIMIT 1');
    const profile = profileRes.rows[0] || {
      name: 'Jesus My Rock Church',
      tagline: 'Standing Firm on Christ the Solid Rock',
      lead_pastor: 'Pastor Joseph',
      email: 'jesusmyrockchurch@gmail.com',
      phone: '+60 3-7722 1484',
      address: '18-3, Jalan PJU 8/5G, Damansara Perdana, 47820 Petaling Jaya, Selangor, Malaysia',
      website: 'https://www.instagram.com/jesusmyrockchurch/',
    };

    // Aggregate key church metrics
    const peopleCount = await db.query('SELECT COUNT(*) FROM musicians WHERE active = true');
    const servicesCount = await db.query('SELECT COUNT(*) FROM services');
    const songsCount = await db.query('SELECT COUNT(*) FROM songs');
    const groupsCount = await db.query('SELECT COUNT(*) FROM groups WHERE active = true');
    const campusesCount = await db.query('SELECT COUNT(*) FROM campuses');

    res.json({
      profile,
      stats: {
        totalPeople: parseInt(peopleCount.rows[0].count, 10),
        totalServices: parseInt(servicesCount.rows[0].count, 10),
        totalSongs: parseInt(songsCount.rows[0].count, 10),
        totalGroups: parseInt(groupsCount.rows[0].count, 10),
        totalCampuses: parseInt(campusesCount.rows[0].count, 10),
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/church - Update church profile (Admin and Pastor only)
router.put('/', requireAuth, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res, next) => {
  try {
    const {
      name, tagline, lead_pastor, email, phone, address, website, primary_color,
      youtube_channel_id, youtube_channel_handle, youtube_auto_post_live, youtube_api_key
    } = req.body;
    
    // Check if exists
    const check = await db.query('SELECT id FROM church_profile LIMIT 1');
    let updated;
    if (check.rows.length === 0) {
      updated = await db.query(`
        INSERT INTO church_profile (
          name, tagline, lead_pastor, email, phone, address, website, primary_color,
          youtube_channel_id, youtube_channel_handle, youtube_auto_post_live, youtube_api_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        name, tagline, lead_pastor, email, phone, address, website, primary_color,
        youtube_channel_id || 'UCkgenI4IULye4vDjrGRo-aA',
        youtube_channel_handle || '@jesusmyrockchurchkl',
        youtube_auto_post_live !== undefined ? youtube_auto_post_live : true,
        youtube_api_key || null
      ]);
    } else {
      updated = await db.query(`
        UPDATE church_profile 
        SET 
          name = COALESCE($1, name),
          tagline = COALESCE($2, tagline),
          lead_pastor = COALESCE($3, lead_pastor),
          email = COALESCE($4, email),
          phone = COALESCE($5, phone),
          address = COALESCE($6, address),
          website = COALESCE($7, website),
          primary_color = COALESCE($8, primary_color),
          youtube_channel_id = COALESCE($9, youtube_channel_id),
          youtube_channel_handle = COALESCE($10, youtube_channel_handle),
          youtube_auto_post_live = COALESCE($11, youtube_auto_post_live),
          youtube_api_key = COALESCE($12, youtube_api_key),
          updated_at = NOW()
        WHERE id = $13
        RETURNING *
      `, [
        name, tagline, lead_pastor, email, phone, address, website, primary_color,
        youtube_channel_id, youtube_channel_handle, youtube_auto_post_live, youtube_api_key,
        check.rows[0].id
      ]);
    }

    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/church/youtube/live - Get current live stream status and channel configuration
router.get('/youtube/live', async (req, res, next) => {
  try {
    const profileRes = await db.query('SELECT * FROM church_profile LIMIT 1');
    const profile = profileRes.rows[0] || {};

    const livePostRes = await db.query(`
      SELECT * FROM feed_posts
      WHERE (post_type = 'live_stream' OR media_type = 'youtube_live')
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 1
    `);

    res.json({
      isLive: !!profile.youtube_is_live,
      videoId: profile.youtube_current_live_video_id,
      title: profile.youtube_current_live_title,
      channelId: profile.youtube_channel_id || 'UCkgenI4IULye4vDjrGRo-aA',
      channelHandle: profile.youtube_channel_handle || '@jesusmyrockchurchkl',
      autoPostLive: profile.youtube_auto_post_live !== false,
      lastCheckedAt: profile.youtube_last_checked_at,
      activePost: livePostRes.rows[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/church/youtube/check-now - Trigger immediate YouTube live detection
router.post('/youtube/check-now', requireAuth, async (req, res, next) => {
  try {
    const { syncLiveStreamJob } = require('../services/youtubeLiveService');
    const result = await syncLiveStreamJob(db);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/church/youtube/manual-live - Manually trigger live stream (Admin, Pastor, Manager)
router.post('/youtube/manual-live', requireAuth, requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]), async (req, res, next) => {
  try {
    const { urlOrVideoId, customTitle } = req.body;
    if (!urlOrVideoId) {
      return res.status(400).json({ error: 'Please provide a YouTube URL or Video ID' });
    }
    const { manualTriggerGoLive } = require('../services/youtubeLiveService');
    const result = await manualTriggerGoLive(db, { urlOrVideoId, customTitle, dbUser: req.user });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/church/youtube/end-live - Manually mark live stream as ended (Admin, Pastor, Manager)
router.post('/youtube/end-live', requireAuth, requireRole([ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]), async (req, res, next) => {
  try {
    const { manualEndLive } = require('../services/youtubeLiveService');
    const result = await manualEndLive(db);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/church/campuses
router.get('/campuses', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM campuses ORDER BY is_main DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/church/campuses (Admin and Pastor only)
router.post('/campuses', requireAuth, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res, next) => {
  try {
    const { name, address, is_main } = req.body;
    if (!name) return res.status(400).json({ error: 'Campus name is required' });

    const result = await db.query(`
      INSERT INTO campuses (name, address, is_main)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, address || '', !!is_main]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/church/ministries
router.get('/ministries', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM musicians WHERE active = true AND (m.name = ANY(roles) OR ministry = m.name)) as member_count
      FROM ministries m
      ORDER BY m.sort_order ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/church/ministries (Admin and Pastor only)
router.post('/ministries', requireAuth, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res, next) => {
  try {
    const { name, description, icon, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Ministry name is required' });

    const result = await db.query(`
      INSERT INTO ministries (name, description, icon, color, sort_order)
      VALUES ($1, $2, $3, $4, COALESCE($5, 0))
      RETURNING *
    `, [name, description, icon || 'Users', color || 'indigo', sort_order]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
