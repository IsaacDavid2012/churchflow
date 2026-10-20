const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
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
        s.position_ids,
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
    const activePositionIds = Array.isArray(service.position_ids) && service.position_ids.length > 0 ? service.position_ids : null;

    // Check expiration (past service date or finalized)
    const today = new Date().toISOString().split('T')[0];
    const isPast = Boolean(service.service_date && service.service_date < today);
    const isCompleted = ['completed', 'cancelled', 'archived'].includes(service.status);
    const isExpired = isPast || isCompleted;

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
        (m.phone IS NOT NULL AND TRIM(m.phone) != '' AND LENGTH(REGEXP_REPLACE(m.phone, '\\D', '', 'g')) >= 4) AS has_phone,
        a.status,
        a.notes
      FROM positions_template p
      LEFT JOIN assignments a ON a.position_id = p.id AND a.service_id = $1
      LEFT JOIN musicians m ON m.id = a.musician_id
      WHERE ($2::uuid[] IS NULL OR p.id = ANY($2::uuid[]))
      ORDER BY p.sort_order ASC, a.role_slot ASC
    `,
      [service.id, activePositionIds]
    );

    // 3. Fetch all active musicians with their current availability for this service
    const musiciansRes = await db.query(
      `
      SELECT 
        m.id,
        m.name,
        m.roles,
        (m.phone IS NOT NULL AND TRIM(m.phone) != '' AND LENGTH(REGEXP_REPLACE(m.phone, '\\D', '', 'g')) >= 4) AS has_phone,
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
      is_expired: isExpired,
      assignments: assignRes.rows,
      musicians: musiciansRes.rows,
      church,
    });
  } catch (err) {
    console.error('Public service fetch error:', err);
    res.status(500).json({ error: 'Failed to load service data' });
  }
});

// POST /api/public/avail/:token/verify-pin - Verify 4-digit phone PIN and issue claim token
router.post('/avail/:token/verify-pin', async (req, res) => {
  const { token } = req.params;
  const { musician_id, pin } = req.body;

  if (!musician_id) {
    return res.status(400).json({ error: 'musician_id is required' });
  }

  try {
    const serviceRes = await db.query('SELECT id, service_date, status FROM services WHERE token = $1', [token]);
    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired service link' });
    }
    const service = serviceRes.rows[0];

    const today = new Date().toISOString().split('T')[0];
    if (service.service_date && service.service_date < today) {
      return res.status(400).json({ error: 'This service date has passed. Attendance can no longer be updated.' });
    }

    const musicianRes = await db.query('SELECT id, name, phone, active FROM musicians WHERE id = $1 AND active = true', [musician_id]);
    if (musicianRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found or inactive' });
    }
    const musician = musicianRes.rows[0];

    const rawPhone = (musician.phone || '').trim();
    const phoneDigits = rawPhone.replace(/\D/g, '');

    // Requirement: "Message showing you are not registered pls contact admin"
    if (!rawPhone || phoneDigits.length < 4) {
      return res.status(400).json({
        error: 'You are not registered with a mobile number. Please contact your church administrator to register your phone.',
        not_registered: true,
      });
    }

    if (!pin || pin.toString().trim().length < 4) {
      return res.status(400).json({ error: 'Please enter the 4-digit PIN (last 4 digits of your phone).' });
    }

    const inputDigits = pin.toString().replace(/\D/g, '');
    const expectedLast4 = phoneDigits.slice(-4);

    if (inputDigits !== expectedLast4 && inputDigits.slice(-4) !== expectedLast4) {
      return res.status(400).json({ error: 'Incorrect PIN. Please enter the last 4 digits of your registered phone number.' });
    }

    // Success! Generate a signed claim token
    const claimToken = jwt.sign(
      {
        service_id: service.id,
        musician_id: musician.id,
        type: 'avail_claim',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      musician_id: musician.id,
      musician_name: musician.name,
      claim_token: claimToken,
    });
  } catch (err) {
    console.error('Verify PIN error:', err);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// POST /api/public/avail/:token - Musician marks availability (requires claim token or valid PIN)
router.post('/avail/:token', async (req, res) => {
  const { token } = req.params;
  const { musician_id, status, claim_token, pin } = req.body;

  if (!musician_id || !status) {
    return res.status(400).json({ error: 'musician_id and status (available/declined) are required' });
  }

  if (!['available', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "available" or "declined"' });
  }

  try {
    // 1. Validate service token
    const serviceRes = await db.query('SELECT id, service_date, status FROM services WHERE token = $1', [token]);
    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired service link' });
    }
    const service = serviceRes.rows[0];

    // Check expiration
    const today = new Date().toISOString().split('T')[0];
    if (service.service_date && service.service_date < today) {
      return res.status(400).json({ error: 'This service date has passed. Attendance can no longer be updated.' });
    }

    // 2. Check musician exists and is active
    const musicianRes = await db.query('SELECT id, name, phone FROM musicians WHERE id = $1 AND active = true', [musician_id]);
    if (musicianRes.rows.length === 0) {
      return res.status(404).json({ error: 'Musician not found or inactive' });
    }
    const musician = musicianRes.rows[0];

    // 3. Security Verification: Validate Claim Token or PIN
    let verified = false;

    if (claim_token) {
      try {
        const decoded = jwt.verify(claim_token, JWT_SECRET);
        if (decoded.service_id === service.id && decoded.musician_id === musician_id) {
          verified = true;
        }
      } catch (e) {
        // Token expired or invalid
      }
    }

    if (!verified && pin) {
      const rawPhone = (musician.phone || '').trim();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      if (phoneDigits.length >= 4) {
        const inputDigits = pin.toString().replace(/\D/g, '');
        const expectedLast4 = phoneDigits.slice(-4);
        if (inputDigits === expectedLast4 || inputDigits.slice(-4) === expectedLast4) {
          verified = true;
        }
      }
    }

    if (!verified) {
      return res.status(401).json({
        error: 'Identity verification required. Please verify your PIN before confirming attendance.',
        requires_pin: true,
      });
    }

    // 4. Row-level upsert in availability table (Safe against concurrent requests!)
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

    // 5. If musician confirmed available, mark their active assignment(s) for this service as 'confirmed'
    if (status === 'available') {
      const confirmRes = await db.query(
        `
        UPDATE assignments
        SET status = 'confirmed'
        WHERE service_id = $1 AND musician_id = $2 AND status IN ('pending', 'promoted')
        RETURNING id, position_id, role_slot
      `,
        [service.id, musician_id]
      );

      if (confirmRes.rows.length > 0) {
        await db.query(
          `
          INSERT INTO notifications_log (service_id, type, message, metadata)
          VALUES ($1, 'availability_change', $2, $3)
        `,
          [
            service.id,
            `[Confirmed] ${musician.name} confirmed availability for the service lineup.`,
            JSON.stringify({ musicianId: musician_id, musicianName: musician.name, status: 'confirmed' }),
          ]
        );
      }
    } else if (status === 'declined') {
      // If musician declined, trigger live auto-promotion / re-shuffle if they were assigned
      reShuffleResult = await handleMusicianDeclined(db, service.id, musician_id);
    }

    res.json({
      success: true,
      message: `Thank you, ${musician.name}! Your status has been recorded as: ${status === 'available' ? 'Serving' : 'Declined'}.`,
      availability: upsertRes.rows[0],
      reShuffle: reShuffleResult,
    });
  } catch (err) {
    console.error('Availability submit error:', err);
    res.status(500).json({ error: 'Failed to record availability' });
  }
});

// GET /api/public/join - Get positions template and church info for volunteer onboarding
router.get('/join', async (req, res) => {
  try {
    const posRes = await db.query(`
      SELECT id, name, ministry, sort_order 
      FROM positions_template 
      ORDER BY sort_order ASC, name ASC
    `);

    let church = null;
    try {
      const churchRes = await db.query('SELECT name, tagline, email, phone, website FROM church_profile LIMIT 1');
      if (churchRes.rows.length > 0) {
        church = churchRes.rows[0];
      }
    } catch (e) {}

    res.json({
      church: church || { name: 'Jesus My Rock Church' },
      positions: posRes.rows,
    });
  } catch (err) {
    console.error('Fetch join data error:', err);
    res.status(500).json({ error: 'Failed to load onboarding positions' });
  }
});

const bcrypt = require('bcryptjs');

// POST /api/public/join - Public volunteer sign-up / team registration with password creation
router.post('/join', async (req, res) => {
  const { name, phone, email, password, roles, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number / WhatsApp contact is required' });
  }

  const selectedRoles = Array.isArray(roles) && roles.length > 0 ? roles : [];
  if (selectedRoles.length === 0) {
    return res.status(400).json({ error: 'Please toggle at least one position you serve in' });
  }

  try {
    let createdUserId = null;
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    // If password provided, create unified User login account
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const passwordHash = await bcrypt.hash(password.trim(), 10);
      let baseUsername = cleanEmail ? cleanEmail.split('@')[0] : cleanPhone.replace(/[^0-9]/g, '');
      baseUsername = baseUsername.slice(0, 50).toLowerCase();

      // Check if user already exists
      let existingUser = null;
      if (cleanEmail) {
        const userCheck = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
        if (userCheck.rows.length > 0) existingUser = userCheck.rows[0];
      }

      if (existingUser) {
        // Update existing user password
        await db.query(`
          UPDATE users 
          SET password_hash = $1, name = $2, updated_at = NOW()
          WHERE id = $3
        `, [passwordHash, cleanName, existingUser.id]);
        createdUserId = existingUser.id;
      } else {
        // Generate unique username
        let uniqueUsername = baseUsername || 'volunteer';
        let suffix = 1;
        while (true) {
          const uCheck = await db.query('SELECT id FROM users WHERE LOWER(username) = $1', [uniqueUsername.toLowerCase()]);
          if (uCheck.rows.length === 0) break;
          uniqueUsername = `${baseUsername}${suffix++}`;
        }

        const newUserRes = await db.query(`
          INSERT INTO users (username, email, password_hash, role, name, status)
          VALUES ($1, $2, $3, 'member', $4, 'active')
          RETURNING id
        `, [uniqueUsername, cleanEmail, passwordHash, cleanName]);
        createdUserId = newUserRes.rows[0].id;
      }
    }

    const insertRes = await db.query(
      `
      INSERT INTO musicians (user_id, name, phone, email, roles, ministry, status, role, notes, active)
      VALUES ($1, $2, $3, $4, $5, 'Media Team', 'member', 'member', $6, true)
      RETURNING id, name, phone, email, roles, status, role, active, created_at
      `,
      [
        createdUserId,
        cleanName,
        cleanPhone,
        cleanEmail,
        selectedRoles,
        notes && notes.trim() ? notes.trim() : null,
      ]
    );

    const newMusician = insertRes.rows[0];

    // Auto-enroll into ministries based on selected positions
    try {
      const posRes = await db.query(
        'SELECT ministry, ministry_id FROM positions_template WHERE LOWER(name) = ANY($1::text[])',
        [selectedRoles.map(r => r.toLowerCase())]
      );
      const targetGroupIds = new Set();
      const unmatched = new Set();
      for (const pos of posRes.rows) {
        if (pos.ministry_id) targetGroupIds.add(pos.ministry_id);
        else if (pos.ministry) unmatched.add(pos.ministry.trim().toLowerCase());
      }
      if (unmatched.size > 0) {
        const gRes = await db.query(
          'SELECT id FROM groups WHERE active = true AND (LOWER(name) = ANY($1::text[]) OR LOWER(category) = ANY($1::text[]))',
          [Array.from(unmatched)]
        );
        for (const g of gRes.rows) targetGroupIds.add(g.id);
      }
      for (const gId of targetGroupIds) {
        await db.query(`
          INSERT INTO ministry_members (ministry_id, musician_id, role, joined_at)
          VALUES ($1, $2, 'member', NOW())
          ON CONFLICT (ministry_id, musician_id) DO NOTHING
        `, [gId, newMusician.id]);
        await db.query(`
          UPDATE groups SET member_count = (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = $1), updated_at = NOW() WHERE id = $1
        `, [gId]);
      }
      const minNamesRes = await db.query(
        'SELECT name FROM groups WHERE id = ANY($1::uuid[]) ORDER BY name ASC',
        [Array.from(targetGroupIds)]
      );
      if (minNamesRes.rows.length > 0) {
        await db.query('UPDATE musicians SET ministry = $1 WHERE id = $2', [minNamesRes.rows.map(r => r.name).join(', '), newMusician.id]);
      }
    } catch (e) {
      console.error('Error auto-enrolling in join route:', e);
    }

    // Log notification for admins
    try {
      await db.query(
        `
        INSERT INTO notifications_log (type, message, metadata)
        VALUES ('volunteer_registered', $1, $2)
        `,
        [
          `[New Volunteer] ${newMusician.name} (${newMusician.phone}) registered via onboarding link for: ${selectedRoles.join(', ')}`,
          JSON.stringify({ musicianId: newMusician.id, roles: selectedRoles }),
        ]
      );
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Welcome to the team, ${newMusician.name}! Your volunteer registration and account have been created.`,
      member: newMusician,
      hasAccount: !!createdUserId,
    });
  } catch (err) {
    console.error('Volunteer registration error:', err);
    res.status(500).json({ error: 'Failed to submit volunteer registration' });
  }
});

module.exports = router;
