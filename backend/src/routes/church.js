const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/church - Get church profile and overview stats
router.get('/', async (req, res, next) => {
  try {
    const profileRes = await db.query('SELECT * FROM church_profile LIMIT 1');
    const profile = profileRes.rows[0] || {
      name: 'Jesus My Rock Church',
      tagline: 'Standing Firm on Christ the Solid Rock',
      lead_pastor: 'Pastor David & Sarah Mitchell',
      email: 'office@jesusmyrock.org',
      phone: '+1 (555) 762-5762',
      address: '1200 Rock Boulevard, Suite 100, Austin, TX',
      website: 'https://serve.creativeclicks.art',
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

// PUT /api/church - Update church profile
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { name, tagline, lead_pastor, email, phone, address, website, primary_color } = req.body;
    
    // Check if exists
    const check = await db.query('SELECT id FROM church_profile LIMIT 1');
    let updated;
    if (check.rows.length === 0) {
      updated = await db.query(`
        INSERT INTO church_profile (name, tagline, lead_pastor, email, phone, address, website, primary_color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [name, tagline, lead_pastor, email, phone, address, website, primary_color]);
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
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [name, tagline, lead_pastor, email, phone, address, website, primary_color, check.rows[0].id]);
    }

    res.json(updated.rows[0]);
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

// POST /api/church/campuses
router.post('/campuses', requireAuth, async (req, res, next) => {
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

// POST /api/church/ministries
router.post('/ministries', requireAuth, async (req, res, next) => {
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
