const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const {
  autoShuffleService,
  manualOverrideSlot,
  checkDeadlineAndAutoPromote,
  computeFairnessRankings,
  getEligibleCandidatesForPosition,
  matchesRole,
} = require('../services/shuffleService');

router.use(authMiddleware);

// GET /api/services - List all services
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.service_date::text AS service_date,
        s.service_time,
        s.service_type,
        s.campus_id,
        c.name AS campus_name,
        s.theme,
        s.token,
        s.worship_leader_id,
        s.notes,
        s.status,
        s.deadline_hours_before,
        s.created_at,
        s.updated_at,
        wl.name AS worship_leader_name,
        (SELECT COUNT(*) FROM service_plan_items spi WHERE spi.service_id = s.id) AS plan_items_count,
        COUNT(DISTINCT a.musician_id) FILTER (WHERE a.status = 'available') AS available_count,
        COUNT(DISTINCT a.musician_id) FILTER (WHERE a.status = 'declined') AS declined_count,
        COUNT(DISTINCT asg.id) FILTER (WHERE asg.musician_id IS NOT NULL AND asg.status = 'confirmed') AS confirmed_assignments_count,
        COUNT(DISTINCT asg.id) FILTER (WHERE asg.musician_id IS NOT NULL) AS total_assignments_count
      FROM services s
      LEFT JOIN campuses c ON c.id = s.campus_id
      LEFT JOIN musicians wl ON wl.id = s.worship_leader_id
      LEFT JOIN availability a ON a.service_id = s.id
      LEFT JOIN assignments asg ON asg.service_id = s.id
      GROUP BY s.id, c.name, wl.name
      ORDER BY s.service_date DESC
    `;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/services - Create a new service
router.post('/', async (req, res) => {
  const { service_date, service_time, service_type, campus_id, theme, notes, deadline_hours_before } = req.body;
  if (!service_date) {
    return res.status(400).json({ error: 'Service date is required' });
  }

  try {
    const token = uuidv4();
    const result = await db.query(
      `
      INSERT INTO services (service_date, service_time, service_type, campus_id, theme, token, notes, status, deadline_hours_before)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'availability_open', $8)
      RETURNING *
    `,
      [
        service_date,
        service_time || '10:00 AM',
        service_type || 'Sunday Morning Celebration',
        campus_id || null,
        theme || '',
        token,
        notes || '',
        parseInt(deadline_hours_before || '48', 10),
      ]
    );

    const service = result.rows[0];

    // Log notification
    await db.query(
      `
      INSERT INTO notifications_log (service_id, type, message, metadata)
      VALUES ($1, 'service_created', $2, $3)
    `,
      [
        service.id,
        `New service created for ${service.service_date}`,
        JSON.stringify({ createdBy: req.user.name, serviceDate: service.service_date }),
      ]
    );

    res.status(201).json(service);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/services/:id - Update service details
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { service_date, service_time, service_type, campus_id, theme, notes, deadline_hours_before, status } = req.body;

  try {
    const result = await db.query(
      `
      UPDATE services
      SET 
        service_date = COALESCE($1, service_date),
        service_time = COALESCE($2, service_time),
        service_type = COALESCE($3, service_type),
        campus_id = $4,
        theme = COALESCE($5, theme),
        notes = COALESCE($6, notes),
        deadline_hours_before = COALESCE($7, deadline_hours_before),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `,
      [
        service_date,
        service_time,
        service_type,
        campus_id !== undefined ? campus_id : null,
        theme,
        notes,
        deadline_hours_before !== undefined ? parseInt(deadline_hours_before, 10) : undefined,
        status,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id - Delete a service and cascade delete plan items/assignments
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted successfully', service: result.rows[0] });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// GET /api/services/:id - Get full service details & current lineup
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch service info
    const serviceRes = await db.query(
      `
      SELECT 
        s.id,
        s.service_date::text AS service_date,
        s.service_time,
        s.service_type,
        s.campus_id,
        c.name AS campus_name,
        s.theme,
        s.token,
        s.worship_leader_id,
        s.notes,
        s.status,
        s.deadline_hours_before,
        s.created_at,
        s.updated_at,
        wl.name AS worship_leader_name,
        wl.email AS worship_leader_email,
        wl.phone AS worship_leader_phone
      FROM services s
      LEFT JOIN campuses c ON c.id = s.campus_id
      LEFT JOIN musicians wl ON wl.id = s.worship_leader_id
      WHERE s.id = $1
    `,
      [id]
    );

    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRes.rows[0];

    // 2. Fetch all positions
    const posRes = await db.query('SELECT * FROM positions_template ORDER BY sort_order ASC, name ASC');
    const positions = posRes.rows;

    // 3. Fetch assignments with musician details
    const assignmentsRes = await db.query(
      `
      SELECT 
        a.id AS assignment_id,
        a.position_id,
        a.musician_id,
        a.role_slot,
        a.status AS assignment_status,
        a.notes,
        a.assigned_at,
        m.name AS musician_name,
        m.email AS musician_email,
        m.phone AS musician_phone,
        m.roles AS musician_roles
      FROM assignments a
      LEFT JOIN musicians m ON m.id = a.musician_id
      WHERE a.service_id = $1
    `,
      [id]
    );

    // Compute fairness ranking to show last served date for each assigned musician
    const fairnessScores = await computeFairnessRankings(db, service.service_date);
    const scoreMap = new Map();
    fairnessScores.forEach((m) => {
      scoreMap.set(m.id, {
        lastServedDate: m.last_served_date,
        daysSinceLastServed: m.days_since_last_served,
        totalConfirmedServes: m.total_confirmed_serves,
      });
    });

    // 4. Fetch availability counts
    const availRes = await db.query(
      `
      SELECT 
        av.status,
        COUNT(av.id) AS count,
        json_agg(
          json_build_object(
            'musician_id', m.id,
            'name', m.name,
            'roles', m.roles,
            'phone', m.phone,
            'responded_at', av.responded_at
          )
        ) AS responders
      FROM availability av
      JOIN musicians m ON m.id = av.musician_id
      WHERE av.service_id = $1
      GROUP BY av.status
    `,
      [id]
    );

    const availabilitySummary = {
      available: [],
      declined: [],
    };

    availRes.rows.forEach((row) => {
      if (row.status === 'available') {
        availabilitySummary.available = row.responders || [];
      } else if (row.status === 'declined') {
        availabilitySummary.declined = row.responders || [];
      }
    });

    // Structure lineup by position
    const lineup = positions.map((pos) => {
      const posAssignments = assignmentsRes.rows.filter((a) => a.position_id === pos.id);
      const primary = posAssignments.find((a) => a.role_slot === 'primary') || null;
      const backup = posAssignments.find((a) => a.role_slot === 'backup') || null;

      const enrichMusician = (asg) => {
        if (!asg || !asg.musician_id) return null;
        const score = scoreMap.get(asg.musician_id) || {};
        return {
          assignmentId: asg.assignment_id,
          musicianId: asg.musician_id,
          name: asg.musician_name,
          email: asg.musician_email,
          phone: asg.musician_phone,
          roles: asg.musician_roles,
          status: asg.assignment_status,
          notes: asg.notes,
          assignedAt: asg.assigned_at,
          lastServedDate: score.lastServedDate || null,
          daysSinceLastServed: score.daysSinceLastServed ?? null,
          totalConfirmedServes: score.totalConfirmedServes || 0,
        };
      };

      return {
        positionId: pos.id,
        positionName: pos.name,
        ministry: pos.ministry || 'Worship Team',
        sortOrder: pos.sort_order,
        primary: enrichMusician(primary),
        backup: enrichMusician(backup),
      };
    });

    // 5. Fetch Service Plan / Order of Service items
    const planRes = await db.query(
      `
      SELECT 
        spi.*,
        sng.title AS song_title,
        sng.artist AS song_artist,
        sng.bpm AS song_bpm,
        sng.time_signature AS song_time_signature,
        sng.ccli_number AS song_ccli,
        sng.chart_url AS song_chart_url,
        sng.youtube_url AS song_youtube_url
      FROM service_plan_items spi
      LEFT JOIN songs sng ON sng.id = spi.song_id
      WHERE spi.service_id = $1
      ORDER BY spi.item_order ASC, spi.created_at ASC
    `,
      [id]
    );

    res.json({
      service,
      lineup,
      planItems: planRes.rows,
      availability: availabilitySummary,
    });
  } catch (err) {
    console.error('Fetch service detail error:', err);
    res.status(500).json({ error: 'Failed to fetch service detail' });
  }
});

// GET /api/services/:id/plan - Get Order of Service items
router.get('/:id/plan', async (req, res) => {
  const { id } = req.params;
  try {
    const planRes = await db.query(
      `
      SELECT 
        spi.*,
        sng.title AS song_title,
        sng.artist AS song_artist,
        sng.bpm AS song_bpm,
        sng.time_signature AS song_time_signature,
        sng.chart_url AS song_chart_url,
        sng.youtube_url AS song_youtube_url
      FROM service_plan_items spi
      LEFT JOIN songs sng ON sng.id = spi.song_id
      WHERE spi.service_id = $1
      ORDER BY spi.item_order ASC
    `,
      [id]
    );
    res.json(planRes.rows);
  } catch (err) {
    console.error('Fetch plan error:', err);
    res.status(500).json({ error: 'Failed to fetch service plan' });
  }
});

// POST /api/services/:id/plan - Add an item to Order of Service
router.post('/:id/plan', async (req, res) => {
  const { id } = req.params;
  const { item_type, title, duration_minutes, leader, song_id, song_key, notes } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Item title is required' });
  }

  try {
    const maxOrderRes = await db.query('SELECT MAX(item_order) as max_order FROM service_plan_items WHERE service_id = $1', [id]);
    const nextOrder = (maxOrderRes.rows[0].max_order || 0) + 1;

    const result = await db.query(
      `
      INSERT INTO service_plan_items (
        service_id, item_order, item_type, title, duration_minutes, leader, song_id, song_key, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        id,
        nextOrder,
        item_type || 'item',
        title.trim(),
        duration_minutes ? parseInt(duration_minutes, 10) : 5,
        leader || '',
        song_id || null,
        song_key || null,
        notes || ''
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add plan item error:', err);
    res.status(500).json({ error: 'Failed to add plan item' });
  }
});

// PUT /api/services/:id/plan/:itemId - Update an Order of Service item
router.put('/:id/plan/:itemId', async (req, res) => {
  const { id, itemId } = req.params;
  const { item_type, title, duration_minutes, leader, song_id, song_key, notes, item_order } = req.body;

  try {
    const result = await db.query(
      `
      UPDATE service_plan_items
      SET 
        item_type = COALESCE($1, item_type),
        title = COALESCE($2, title),
        duration_minutes = COALESCE($3, duration_minutes),
        leader = COALESCE($4, leader),
        song_id = $5,
        song_key = $6,
        notes = COALESCE($7, notes),
        item_order = COALESCE($8, item_order)
      WHERE id = $9 AND service_id = $10
      RETURNING *
    `,
      [
        item_type,
        title ? title.trim() : undefined,
        duration_minutes !== undefined ? parseInt(duration_minutes, 10) : undefined,
        leader,
        song_id || null,
        song_key || null,
        notes,
        item_order !== undefined ? parseInt(item_order, 10) : undefined,
        itemId,
        id
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update plan item error:', err);
    res.status(500).json({ error: 'Failed to update plan item' });
  }
});

// DELETE /api/services/:id/plan/:itemId - Delete an Order of Service item
router.delete('/:id/plan/:itemId', async (req, res) => {
  const { id, itemId } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM service_plan_items WHERE id = $1 AND service_id = $2 RETURNING id',
      [itemId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan item not found' });
    res.json({ message: 'Plan item deleted' });
  } catch (err) {
    console.error('Delete plan item error:', err);
    res.status(500).json({ error: 'Failed to delete plan item' });
  }
});

// POST /api/services/:id/select-worship-leader or /:id/worship-leader
router.post(['/:id/select-worship-leader', '/:id/worship-leader'], async (req, res) => {
  const { id } = req.params;
  const { worship_leader_id, auto_roster = true } = req.body;

  try {
    const sRes = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    if (sRes.rows.length === 0) return res.status(404).json({ error: 'Service not found' });

    let wlName = 'None';
    if (worship_leader_id) {
      const mRes = await db.query('SELECT name FROM musicians WHERE id = $1', [worship_leader_id]);
      if (mRes.rows.length > 0) wlName = mRes.rows[0].name;
    }

    await db.query('UPDATE services SET worship_leader_id = $1, updated_at = NOW() WHERE id = $2', [
      worship_leader_id || null,
      id,
    ]);

    const wlPosRes = await db.query("SELECT id FROM positions_template WHERE LOWER(name) LIKE '%worship leader%' LIMIT 1");
    if (wlPosRes.rows.length > 0) {
      const wlPosId = wlPosRes.rows[0].id;
      if (worship_leader_id) {
        await db.query(
          `INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status, assigned_at)
           VALUES ($1, $2, $3, 'primary', 'confirmed', NOW())
           ON CONFLICT (service_id, position_id, role_slot)
           DO UPDATE SET musician_id = EXCLUDED.musician_id, status = 'confirmed', assigned_at = NOW()`,
          [id, wlPosId, worship_leader_id]
        );
      } else {
        await db.query(
          `UPDATE assignments SET musician_id = NULL, status = 'pending', assigned_at = NOW()
           WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'`,
          [id, wlPosId]
        );
      }
    }

    let shuffleResult = null;
    if (worship_leader_id && auto_roster) {
      // Automatically draft lineup: 1 person per instrument/position, no backup required
      shuffleResult = await autoShuffleService(db, id, { includeBackup: false });
    }

    const msg = `Worship Leader set to ${wlName} by ${req.user.name}${shuffleResult ? ' and team auto-scheduled (1 person per slot).' : '.'}`;
    await db.query(
      'INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, $2, $3, $4)',
      [id, 'worship_leader_selected', msg, JSON.stringify({ worshipLeaderId: worship_leader_id, updatedBy: req.user.name, shuffleResult })]
    );

    res.json({ success: true, message: msg, worship_leader_id, shuffleResult });
  } catch (err) {
    console.error('Select worship leader error:', err);
    res.status(500).json({ error: 'Failed to update worship leader' });
  }
});

// POST /api/services/:id/shuffle - Trigger auto-shuffle algorithm
router.post('/:id/shuffle', async (req, res) => {
  const { id } = req.params;
  const { pool = 'auto' } = req.body;
  try {
    const result = await autoShuffleService(db, id, { pool, includeBackup: false });

    await db.query(
      'INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, $2, $3, $4)',
      [
        id,
        'reshuffle',
        `Auto-shuffle executed by ${req.user.name}: ${result.assignedCount} slots rostered.`,
        JSON.stringify({ triggeredBy: req.user.name, result }),
      ]
    );

    res.json(result);
  } catch (err) {
    console.error('Auto-shuffle error:', err);
    res.status(500).json({ error: err.message || 'Auto-shuffle failed' });
  }
});

// POST /api/services/:id/override or /:id/assignments/override
router.post(['/:id/override', '/:id/assignments/override'], async (req, res) => {
  const { id } = req.params;
  const { position_id, role_slot, musician_id } = req.body;

  if (!position_id || !role_slot) {
    return res.status(400).json({ error: 'position_id and role_slot are required' });
  }

  try {
    const result = await manualOverrideSlot(db, id, position_id, role_slot, musician_id || null);

    const posRes = await db.query('SELECT name FROM positions_template WHERE id = $1', [position_id]);
    const posName = posRes.rows[0]?.name || 'Position';
    let musName = 'Unassigned';
    if (musician_id) {
      const mRes = await db.query('SELECT name FROM musicians WHERE id = $1', [musician_id]);
      musName = mRes.rows[0]?.name || 'Musician';
    }

    const msg = `Manual override: ${posName} (${role_slot}) set to ${musName} by ${req.user.name}`;
    await db.query(
      'INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, $2, $3, $4)',
      [
        id,
        'manual_override',
        msg,
        JSON.stringify({ positionId: position_id, roleSlot: role_slot, musicianId: musician_id, updatedBy: req.user.name }),
      ]
    );

    res.json({ success: true, message: msg, assignment: result });
  } catch (err) {
    console.error('Manual override error:', err);
    res.status(500).json({ error: err.message || 'Manual override failed' });
  }
});

// POST /api/services/:id/confirm or /:id/assignments/confirm
router.post(['/:id/confirm', '/:id/assignments/confirm'], async (req, res) => {
  const { id } = req.params;
  try {
    const sRes = await db.query(
      "UPDATE services SET status = 'confirmed', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    if (sRes.rows.length === 0) return res.status(404).json({ error: 'Service not found' });

    await db.query(
      "UPDATE assignments SET status = 'confirmed' WHERE service_id = $1 AND role_slot = 'primary' AND musician_id IS NOT NULL AND status != 'declined'",
      [id]
    );

    const msg = `Service lineup for ${sRes.rows[0].service_date} confirmed by ${req.user.name}`;
    await db.query(
      'INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, $2, $3, $4)',
      [id, 'lineup_confirmed', msg, JSON.stringify({ confirmedBy: req.user.name })]
    );

    res.json({ success: true, message: msg, service: sRes.rows[0] });
  } catch (err) {
    console.error('Confirm lineup error:', err);
    res.status(500).json({ error: 'Failed to confirm lineup' });
  }
});

// POST /api/services/:id/check-deadline
router.post('/:id/check-deadline', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await checkDeadlineAndAutoPromote(db, id);
    res.json(result);
  } catch (err) {
    console.error('Deadline check error:', err);
    res.status(500).json({ error: 'Failed to check deadline' });
  }
});

// GET /api/services/:id/candidates/:positionId
router.get('/:id/candidates/:positionId', async (req, res) => {
  const { id, positionId } = req.params;
  const { only_matching } = req.query;

  try {
    const sRes = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    if (sRes.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    const service = sRes.rows[0];

    const posRes = await db.query('SELECT * FROM positions_template WHERE id = $1', [positionId]);
    if (posRes.rows.length === 0) return res.status(404).json({ error: 'Position not found' });
    const pos = posRes.rows[0];

    const musiciansRes = await db.query(
      `
      SELECT 
        m.id,
        m.name,
        m.roles,
        m.active,
        COALESCE(av.status, 'no_response') AS availability_status,
        MAX(s_prev.service_date) AS last_served_date,
        COUNT(a_prev.id) FILTER (WHERE a_prev.status = 'confirmed') AS total_confirmed_serves
      FROM musicians m
      LEFT JOIN availability av ON av.musician_id = m.id AND av.service_id = $1
      LEFT JOIN assignments a_prev ON a_prev.musician_id = m.id AND a_prev.status = 'confirmed'
      LEFT JOIN services s_prev ON s_prev.id = a_prev.service_id AND s_prev.service_date < $2
      WHERE m.active = true
      GROUP BY m.id, m.name, m.roles, m.active, av.status
      ORDER BY 
        (av.status = 'available') DESC,
        last_served_date ASC NULLS FIRST,
        total_confirmed_serves ASC,
        m.name ASC
    `,
      [id, service.service_date]
    );

    const currentAssignments = await db.query(
      'SELECT musician_id, role_slot, p.name as position_name FROM assignments a JOIN positions_template p ON p.id = a.position_id WHERE a.service_id = $1 AND a.musician_id IS NOT NULL AND a.status != $2',
      [id, 'declined']
    );

    const assignMap = new Map();
    currentAssignments.rows.forEach((a) => {
      assignMap.set(a.musician_id, `${a.position_name} (${a.role_slot})`);
    });

    let candidates = musiciansRes.rows.map((m) => {
      const hasRole = matchesRole(pos.name, m.roles);

      return {
        ...m,
        has_role: hasRole,
        is_worship_leader: service.worship_leader_id === m.id,
        currently_assigned_as: assignMap.get(m.id) || null,
      };
    });

    // If only_matching is true or requested, filter candidates to those who play this instrument
    if (only_matching === 'true') {
      candidates = candidates.filter((c) => c.has_role);
    }

    res.json({
      position: pos,
      candidates,
    });
  } catch (err) {
    console.error('Candidate fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch candidate list' });
  }
});

module.exports = router;
