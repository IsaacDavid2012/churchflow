const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { handleMusicianDeclined } = require('../services/shuffleService');

// GET /api/public/avail/:token - Musician view data
router.get('/avail/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // 1. Find service by token
    const serviceRes = await db.query(
      `
      SELECT 
        s.id,
        s.service_date::text AS service_date,
        s.service_time,
        s.service_type,
        s.theme,
        s.notes,
        s.status,
        s.deadline_hours_before,
        c.name AS campus_name,
        wl.name AS worship_leader_name,
        wl.id AS worship_leader_id
      FROM services s
      LEFT JOIN musicians wl ON wl.id = s.worship_leader_id
      LEFT JOIN campuses c ON c.id = s.campus_id
      WHERE s.token = $1
    `,
      [token]
    );

    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired service link' });
    }

    const service = serviceRes.rows[0];

    // 2. Fetch current drafted assignments for this service
    const assignRes = await db.query(
      `
      SELECT 
        a.id,
        a.position_id,
        p.name AS position_name,
        p.ministry,
        p.sort_order,
        a.role_slot,
        a.musician_id,
        m.name AS musician_name,
        a.status,
        a.notes
      FROM positions_template p
      LEFT JOIN assignments a ON a.position_id = p.id AND a.service_id = $1
      LEFT JOIN musicians m ON m.id = a.musician_id
      ORDER BY p.sort_order ASC, a.role_slot ASC
    `,
      [service.id]
    );

    // 3. Fetch all active musicians with their current availability for this service
    const musiciansRes = await db.query(
      `
      SELECT 
        m.id,
        m.name,
        m.roles,
        COALESCE(av.status, 'no_response') AS current_status,
        av.responded_at
      FROM musicians m
      LEFT JOIN availability av ON av.musician_id = m.id AND av.service_id = $1
      WHERE m.active = true
      ORDER BY m.name ASC
    `,
      [service.id]
    );

    // 4. Church profile
    let church = null;
    try {
      const churchRes = await db.query('SELECT name, name AS church_name, tagline, lead_pastor, email, email AS contact_email, phone, phone AS contact_phone, address, website, website AS website_url, primary_color FROM church_profile LIMIT 1');
      if (churchRes.rows.length > 0) {
        church = churchRes.rows[0];
      }
    } catch (e) {
      // church_profile table might be optional in tests
    }

    res.json({
      service,
      assignments: assignRes.rows,
      musicians: musiciansRes.rows,
      church,
    });
  } catch (err) {
    console.error('Public service fetch error:', err);
    res.status(500).json({ error: 'Failed to load service data' });
  }
});

// POST /api/public/avail/:token - Musician marks availability
router.post('/avail/:token', async (req, res) => {
  const { token } = req.params;
  const { musician_id, status } = req.body;

  if (!musician_id || !status) {
    return res.status(400).json({ error: 'musician_id and status (available/declined) are required' });
  }

  if (!['available', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "available" or "declined"' });
  }

  try {
    // 1. Validate service token
    const serviceRes = await db.query('SELECT id, service_date FROM services WHERE token = $1', [token]);
    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired service link' });
    }
    const service = serviceRes.rows[0];

    // 2. Check musician exists and is active
    const musicianRes = await db.query('SELECT id, name FROM musicians WHERE id = $1 AND active = true', [musician_id]);
    if (musicianRes.rows.length === 0) {
      return res.status(404).json({ error: 'Musician not found or inactive' });
    }
    const musician = musicianRes.rows[0];

    // 3. Row-level upsert in availability table (Safe against concurrent requests!)
    const upsertRes = await db.query(
      `
      INSERT INTO availability (musician_id, service_id, status, responded_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (musician_id, service_id)
      DO UPDATE SET 
        status = EXCLUDED.status,
        responded_at = NOW()
      RETURNING *
    `,
      [musician_id, service.id, status]
    );

    let reShuffleResult = null;

    // 4. If musician declined, trigger live auto-promotion / re-shuffle if they were assigned
    if (status === 'declined') {
      reShuffleResult = await handleMusicianDeclined(db, service.id, musician_id);
    }

    res.json({
      success: true,
      message: `Thank you, ${musician.name}! Your status has been recorded as: ${status}.`,
      availability: upsertRes.rows[0],
      reShuffle: reShuffleResult,
    });
  } catch (err) {
    console.error('Availability submit error:', err);
    res.status(500).json({ error: 'Failed to record availability' });
  }
});

module.exports = router;
