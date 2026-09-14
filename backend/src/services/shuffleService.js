const { v4: uuidv4 } = require('uuid');

/**
 * Checks if a musician's tagged roles match a given position name.
 * Robust synonym matching for worship and sound team positions.
 */
function matchesRole(positionName, musicianRoles) {
  if (!musicianRoles || !Array.isArray(musicianRoles)) return false;
  const p = (positionName || '').toLowerCase().trim();

  return musicianRoles.some((role) => {
    const r = (role || '').toLowerCase().trim();
    if (r === p) return true;

    // Drums
    if (p.includes('drum') && r.includes('drum')) return true;

    // Bass
    if (p.includes('bass') && r.includes('bass')) return true;

    // Guitar (Acoustic, Electric, Second Guitar, Backup Guitar)
    if ((p.includes('guitar') || p === 'guitar') && (r.includes('guitar') || r.includes('acoustic') || r.includes('electric'))) return true;

    // Keyboard / Keys / Piano (Lead Keyboard, Second Keyboard, Piano)
    if ((p.includes('key') || p.includes('piano')) && (r.includes('key') || r.includes('piano'))) return true;

    // Vocals / Backup / Backing Vocalist
    if (
      (p.includes('vocal') || p.includes('backup') || p.includes('voice') || p.includes('singer')) &&
      (r.includes('vocal') || r.includes('backup') || r.includes('voice') || r.includes('singer'))
    ) return true;

    // Worship Leader
    if (p.includes('worship leader') && (r.includes('worship leader') || r.includes('worship lead'))) return true;

    // Sound / Audio / FOH
    if (
      (p.includes('sound') || p.includes('audio') || p.includes('foh')) &&
      (r.includes('sound') || r.includes('audio') || r.includes('foh'))
    ) return true;

    return p.includes(r) || r.includes(p);
  });
}

/**
 * Computes fairness rankings for musicians as of a given service date.
 * Rule: Musician who has gone the longest (by calendar time) since their most
 * recent confirmed assignment OVERALL (across all positions) ranks first.
 * Never-served musicians rank first (NULLS FIRST).
 * 
 * @param {object} dbClient - PostgreSQL client or pool
 * @param {string} serviceDate - YYYY-MM-DD
 * @returns {Promise<Array>} List of musicians with last_served_date and fairness rank
 */
async function computeFairnessRankings(dbClient, serviceDate = new Date().toISOString().split('T')[0]) {
  const query = `
    SELECT 
      m.id,
      m.name,
      m.email,
      m.phone,
      m.roles,
      m.active,
      MAX(s.service_date) AS last_served_date,
      COUNT(a.id) FILTER (WHERE a.status = 'confirmed') AS total_confirmed_serves
    FROM musicians m
    LEFT JOIN assignments a ON a.musician_id = m.id AND a.status = 'confirmed'
    LEFT JOIN services s ON s.id = a.service_id AND s.service_date < $1
    WHERE m.active = true
    GROUP BY m.id, m.name, m.email, m.phone, m.roles, m.active
    ORDER BY 
      last_served_date ASC NULLS FIRST,
      total_confirmed_serves ASC,
      m.name ASC
  `;

  const result = await dbClient.query(query, [serviceDate]);
  return result.rows;
}

/**
 * Filter and rank candidates for a specific position.
 */
function getEligibleCandidatesForPosition(
  fairnessRankings,
  positionName,
  availableMusicianIds,
  declinedMusicianIdsOrAlreadyAssigned,
  alreadyAssignedIdsOrWorshipLeader,
  worshipLeaderIdOrRequireAvailable = null,
  requireAvailableFlag = true
) {
  let declinedMusicianIds = new Set();
  let assignedIds = new Set();
  let worshipLeader = null;
  let requireAvailable = true;

  if (declinedMusicianIdsOrAlreadyAssigned instanceof Set && alreadyAssignedIdsOrWorshipLeader instanceof Set) {
    declinedMusicianIds = declinedMusicianIdsOrAlreadyAssigned;
    assignedIds = alreadyAssignedIdsOrWorshipLeader;
    worshipLeader = typeof worshipLeaderIdOrRequireAvailable === 'string' ? worshipLeaderIdOrRequireAvailable : null;
    requireAvailable = typeof worshipLeaderIdOrRequireAvailable === 'boolean' ? worshipLeaderIdOrRequireAvailable : (typeof requireAvailableFlag === 'boolean' ? requireAvailableFlag : true);
  } else {
    assignedIds = declinedMusicianIdsOrAlreadyAssigned instanceof Set ? declinedMusicianIdsOrAlreadyAssigned : new Set();
    worshipLeader = typeof alreadyAssignedIdsOrWorshipLeader === 'string' ? alreadyAssignedIdsOrWorshipLeader : null;
    requireAvailable = typeof worshipLeaderIdOrRequireAvailable === 'boolean' ? worshipLeaderIdOrRequireAvailable : true;
  }

  return fairnessRankings.filter((m) => {
    // 1. Availability check
    if (requireAvailable) {
      if (availableMusicianIds && !availableMusicianIds.has(m.id)) return false;
    } else {
      if (declinedMusicianIds && declinedMusicianIds.has(m.id)) return false;
    }

    // 2. Must not be the worship leader
    if (worshipLeader && m.id === worshipLeader) return false;

    // 3. Must not already be assigned in this service
    if (assignedIds && assignedIds.has(m.id)) return false;

    // 4. Must be tagged with the position/role
    return matchesRole(positionName, m.roles);
  });
}

/**
 * Automatically shuffles and generates a full lineup for a service.
 * Supports single-slot mode (Primary only, no backup).
 * 
 * @param {object} dbClient - PostgreSQL client or pool
 * @param {string} serviceId - UUID of the service
 * @param {object} options - Shuffle options (e.g. { pool: 'auto', includeBackup: false })
 * @returns {Promise<object>} Result containing assignments and notification log
 */
async function autoShuffleService(dbClient, serviceId, options = {}) {
  const { pool = 'auto', includeBackup = false } = options;

  // 1. Fetch service details
  const serviceRes = await dbClient.query(
    'SELECT * FROM services WHERE id = $1',
    [serviceId]
  );
  if (serviceRes.rows.length === 0) {
    throw new Error(`Service not found: ${serviceId}`);
  }
  const service = serviceRes.rows[0];

  // 2. Fetch all positions ordered by sort_order
  const positionsRes = await dbClient.query(
    'SELECT * FROM positions_template ORDER BY sort_order ASC, name ASC'
  );
  const positions = positionsRes.rows;

  // 3. Fetch availability for this service
  const availRes = await dbClient.query(
    'SELECT musician_id, status FROM availability WHERE service_id = $1',
    [serviceId]
  );
  const availableMusicianIds = new Set(
    availRes.rows.filter((r) => r.status === 'available').map((r) => r.musician_id)
  );
  const declinedMusicianIds = new Set(
    availRes.rows.filter((r) => r.status === 'declined').map((r) => r.musician_id)
  );

  let requireAvailable = true;
  let sourceDesc = '';

  if (pool === 'all') {
    requireAvailable = false;
    sourceDesc = 'from all active roster members';
  } else if (pool === 'available') {
    requireAvailable = true;
    sourceDesc = `from ${availableMusicianIds.size} available musician(s)`;
  } else {
    // 'auto' mode: if we have available responses, use them; if 0 responses, use all active musicians
    if (availableMusicianIds.size > 0) {
      requireAvailable = true;
      sourceDesc = `from ${availableMusicianIds.size} available musician(s)`;
    } else {
      requireAvailable = false;
      sourceDesc = 'from all active roster members (no availability responses recorded yet)';
    }
  }

  // 4. Compute fairness rankings fresh
  const fairnessRankings = await computeFairnessRankings(dbClient, service.service_date);

  // Purge any legacy backup rows when running in single-lineup mode
  if (!includeBackup) {
    await dbClient.query("DELETE FROM assignments WHERE service_id = $1 AND role_slot = 'backup'", [serviceId]);
  }

  // 1. Identify / assign Worship Leader
  let chosenWorshipLeaderId = service.worship_leader_id;
  const wlPos = positions.find((p) => p.name.toLowerCase().includes('worship leader'));

  if (!chosenWorshipLeaderId && wlPos) {
    let wlCandidates = getEligibleCandidatesForPosition(
      fairnessRankings,
      wlPos.name,
      availableMusicianIds,
      declinedMusicianIds,
      new Set(),
      null,
      requireAvailable
    );
    if (wlCandidates.length === 0) {
      wlCandidates = getEligibleCandidatesForPosition(
        fairnessRankings,
        wlPos.name,
        availableMusicianIds,
        declinedMusicianIds,
        new Set(),
        null,
        false
      );
    }
    if (wlCandidates.length > 0) {
      chosenWorshipLeaderId = wlCandidates[0].id;
      await dbClient.query('UPDATE services SET worship_leader_id = $1, updated_at = NOW() WHERE id = $2', [
        chosenWorshipLeaderId,
        serviceId,
      ]);
      service.worship_leader_id = chosenWorshipLeaderId;
    }
  }

  // 2. Candidate finder helper with fallback to active roster
  function getCandidatesForPos(posName, assignedSet) {
    let list = getEligibleCandidatesForPosition(
      fairnessRankings,
      posName,
      availableMusicianIds,
      declinedMusicianIds,
      assignedSet,
      chosenWorshipLeaderId,
      requireAvailable
    );
    if (list.length === 0) {
      list = getEligibleCandidatesForPosition(
        fairnessRankings,
        posName,
        availableMusicianIds,
        declinedMusicianIds,
        assignedSet,
        chosenWorshipLeaderId,
        false
      );
    }
    return list;
  }

  // 3. Backtracking optimal matching for all remaining positions
  const otherPositions = positions.filter((p) => !p.name.toLowerCase().includes('worship leader'));

  // Sort positions by candidate scarcity (fewest candidates first) to prevent bottlenecks
  const sortedPositions = [...otherPositions].sort((a, b) => {
    const countA = getCandidatesForPos(a.name, new Set()).length;
    const countB = getCandidatesForPos(b.name, new Set()).length;
    return countA - countB;
  });

  function solveMatch(idx, assignedSet, currentMap) {
    if (idx === sortedPositions.length) return currentMap;
    const pos = sortedPositions[idx];
    const cands = getCandidatesForPos(pos.name, assignedSet);
    for (const cand of cands) {
      const nextSet = new Set(assignedSet);
      nextSet.add(cand.id);
      const nextMap = new Map(currentMap);
      nextMap.set(pos.id, cand);
      const res = solveMatch(idx + 1, nextSet, nextMap);
      if (res) return res;
    }
    return null;
  }

  const initialAssigned = new Set();
  if (chosenWorshipLeaderId) initialAssigned.add(chosenWorshipLeaderId);
  let matchedMap = solveMatch(0, initialAssigned, new Map());

  // Greedy fallback if full combination is constrained
  if (!matchedMap) {
    matchedMap = new Map();
    const greedyAssigned = new Set(initialAssigned);
    for (const pos of otherPositions) {
      const cands = getCandidatesForPos(pos.name, greedyAssigned);
      if (cands.length > 0) {
        matchedMap.set(pos.id, cands[0]);
        greedyAssigned.add(cands[0].id);
      }
    }
  }

  const assignmentsToSave = [];
  const lineupSummary = [];

  // 4. Build assignments for each position in original sort_order
  for (const pos of positions) {
    const isWorshipLeaderPos = pos.name.toLowerCase().includes('worship leader');
    let primaryCandidate = null;
    let backupCandidate = null;

    if (isWorshipLeaderPos) {
      if (chosenWorshipLeaderId) {
        primaryCandidate = fairnessRankings.find((m) => m.id === chosenWorshipLeaderId) || {
          id: chosenWorshipLeaderId,
          name: 'Worship Leader',
        };
      }
    } else {
      primaryCandidate = matchedMap.get(pos.id) || null;
    }

    if (primaryCandidate) {
      assignmentsToSave.push({
        position_id: pos.id,
        musician_id: primaryCandidate.id,
        role_slot: 'primary',
        status: isWorshipLeaderPos && chosenWorshipLeaderId ? 'confirmed' : 'pending',
      });
    } else {
      assignmentsToSave.push({
        position_id: pos.id,
        musician_id: null,
        role_slot: 'primary',
        status: 'pending',
      });
    }

    if (includeBackup) {
      const backupAssigned = new Set(initialAssigned);
      for (const [_, cand] of matchedMap.entries()) {
        if (cand?.id) backupAssigned.add(cand.id);
      }
      if (primaryCandidate?.id) backupAssigned.add(primaryCandidate.id);
      const backupCands = getCandidatesForPos(pos.name, backupAssigned);
      backupCandidate = backupCands[0] || null;

      assignmentsToSave.push({
        position_id: pos.id,
        musician_id: backupCandidate ? backupCandidate.id : null,
        role_slot: 'backup',
        status: 'pending',
      });
    }

    lineupSummary.push({
      position_id: pos.id,
      position_name: pos.name,
      primary: primaryCandidate ? { id: primaryCandidate.id, name: primaryCandidate.name, last_served_date: primaryCandidate.last_served_date } : null,
      backup: backupCandidate ? { id: backupCandidate.id, name: backupCandidate.name, last_served_date: backupCandidate.last_served_date } : null,
      available_candidates_count: primaryCandidate ? 1 : 0,
    });
  }

  // 6. Persist assignments into DB
  for (const item of assignmentsToSave) {
    await dbClient.query(
      `
      INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status, assigned_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (service_id, position_id, role_slot)
      DO UPDATE SET 
        musician_id = EXCLUDED.musician_id,
        status = EXCLUDED.status,
        assigned_at = NOW()
    `,
      [serviceId, item.position_id, item.musician_id, item.role_slot, item.status]
    );
  }

  // 7. Update service status to 'rostered' if draft or open
  if (service.status === 'draft' || service.status === 'availability_open') {
    await dbClient.query(
      "UPDATE services SET status = 'rostered', updated_at = NOW() WHERE id = $1",
      [serviceId]
    );
  }

  const assignedCount = assignmentsToSave.filter((a) => a.musician_id).length;

  // 8. Log notification
  const logMessage = `Auto-scheduled lineup for service on ${service.service_date}. Generated ${assignedCount} slot assignment(s) ${sourceDesc}.`;
  await dbClient.query(
    `
    INSERT INTO notifications_log (service_id, type, message, metadata)
    VALUES ($1, 'reshuffle', $2, $3)
  `,
    [
      serviceId,
      logMessage,
      JSON.stringify({ lineup: lineupSummary, assignedCount, pool, timestamp: new Date().toISOString() }),
    ]
  );

  return {
    success: true,
    message: logMessage,
    assignedCount,
    lineup: lineupSummary,
  };
}

/**
 * Handles live re-shuffle / instant replacement when a musician declines.
 * If Primary declines and no backup exists, automatically finds and puts in the next fairest candidate!
 * 
 * @param {object} dbClient - PostgreSQL client or pool
 * @param {string} serviceId - UUID of service
 * @param {string} musicianId - UUID of declining musician
 * @returns {Promise<object>} Summary of actions taken and notifications
 */
async function handleMusicianDeclined(dbClient, serviceId, musicianId) {
  // 1. Get musician details
  const musicianRes = await dbClient.query('SELECT * FROM musicians WHERE id = $1', [musicianId]);
  if (musicianRes.rows.length === 0) return { modified: false };
  const musician = musicianRes.rows[0];

  // 2. Get service details
  const serviceRes = await dbClient.query('SELECT * FROM services WHERE id = $1', [serviceId]);
  if (serviceRes.rows.length === 0) return { modified: false };
  const service = serviceRes.rows[0];

  // 3. Find any active assignments for this musician in this service
  const assignRes = await dbClient.query(
    `
    SELECT a.id, a.service_id, a.position_id, a.musician_id, a.role_slot, a.status, p.name AS position_name 
    FROM assignments a
    JOIN positions_template p ON p.id = a.position_id
    WHERE a.service_id = $1 AND a.musician_id = $2 AND a.status != 'declined'
  `,
    [serviceId, musicianId]
  );

  if (assignRes.rows.length === 0) {
    // Check if musician was worship leader
    if (service.worship_leader_id === musicianId) {
      await dbClient.query('UPDATE services SET worship_leader_id = NULL, updated_at = NOW() WHERE id = $1', [serviceId]);
      const msg = `Worship Leader ${musician.name} declined for service on ${service.service_date}. Worship Leader is now vacant.`;
      await dbClient.query(
        'INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, $2, $3, $4)',
        [serviceId, 'availability_change', msg, JSON.stringify({ declined: musician.name, role: 'Worship Leader' })]
      );
      return { modified: true, message: msg, notifications: [msg] };
    }
    return { modified: false, message: `${musician.name} declined with no active assignments.` };
  }

  // 4. Load availability and current assigned musicians to avoid double booking
  const allAvailRes = await dbClient.query(
    "SELECT musician_id, status FROM availability WHERE service_id = $1",
    [serviceId]
  );
  const availableMusicianIds = new Set(allAvailRes.rows.filter((r) => r.status === 'available').map((r) => r.musician_id));
  const declinedMusicianIds = new Set(allAvailRes.rows.filter((r) => r.status === 'declined').map((r) => r.musician_id));
  declinedMusicianIds.add(musicianId);

  // Compute fresh fairness rankings
  const fairnessRankings = await computeFairnessRankings(dbClient, service.service_date);

  // Helper to find replacement candidates: attempts available first, falls back to active roster
  function findReplacementCandidates(posName, assignedIds) {
    let list = getEligibleCandidatesForPosition(
      fairnessRankings,
      posName,
      availableMusicianIds,
      declinedMusicianIds,
      assignedIds,
      service.worship_leader_id,
      true
    );
    if (list.length === 0) {
      list = getEligibleCandidatesForPosition(
        fairnessRankings,
        posName,
        availableMusicianIds,
        declinedMusicianIds,
        assignedIds,
        service.worship_leader_id,
        false
      );
    }
    return list;
  }

  const notifications = [];

  for (const currentAssign of assignRes.rows) {
    const positionId = currentAssign.position_id;
    const positionName = currentAssign.position_name;

    if (currentAssign.role_slot === 'primary') {
      // 1. Check if an active non-declined backup exists for this position
      const backupRes = await dbClient.query(
        `
        SELECT id, service_id, position_id, musician_id, role_slot, status
        FROM assignments
        WHERE service_id = $1 AND position_id = $2 AND role_slot = 'backup' AND status != 'declined' AND musician_id IS NOT NULL
      `,
        [serviceId, positionId]
      );

      let promotedMusician = null;
      const validBackupRow = backupRes.rows.find((r) => r.musician_id && r.musician_id !== musicianId);

      if (validBackupRow) {
        const backupSlot = validBackupRow;
        const mInfo = await dbClient.query('SELECT id, name FROM musicians WHERE id = $1', [backupSlot.musician_id]);
        const mName = mInfo.rows[0]?.name || 'Backup';
        promotedMusician = { id: backupSlot.musician_id, name: mName };

        // Promote backup into the primary slot
        await dbClient.query(
          "UPDATE assignments SET musician_id = $1, status = 'promoted', assigned_at = NOW() WHERE service_id = $2 AND position_id = $3 AND role_slot = 'primary'",
          [promotedMusician.id, serviceId, positionId]
        );

        // Clear old backup slot
        await dbClient.query(
          "UPDATE assignments SET musician_id = NULL, status = 'pending' WHERE service_id = $1 AND position_id = $2 AND role_slot = 'backup'",
          [serviceId, positionId]
        );
      }

      // 2. Find replacement
      const activeAssignments = await dbClient.query(
        `
        SELECT musician_id FROM assignments 
        WHERE service_id = $1 AND musician_id IS NOT NULL AND status != 'declined'
      `,
        [serviceId]
      );
      const currentlyAssignedIds = new Set(activeAssignments.rows.map((r) => r.musician_id));
      currentlyAssignedIds.add(musicianId);
      if (service.worship_leader_id) currentlyAssignedIds.add(service.worship_leader_id);

      const candidateList = findReplacementCandidates(positionName, currentlyAssignedIds);

      if (promotedMusician) {
        let newBackup = null;
        if (candidateList.length > 0) {
          newBackup = candidateList[0];
          await dbClient.query(
            `
            INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status, assigned_at)
            VALUES ($1, $2, $3, 'backup', 'pending', NOW())
            ON CONFLICT (service_id, position_id, role_slot)
            DO UPDATE SET musician_id = EXCLUDED.musician_id, status = 'pending', assigned_at = NOW()
          `,
            [serviceId, positionId, newBackup.id]
          );
        }

        const msg = `${positionName}: ${musician.name} declined, ${promotedMusician.name} now filling in as Primary${newBackup ? ', ' + newBackup.name + ' is new backup' : ''}.`;
        notifications.push(msg);

        await dbClient.query(
          `INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, 'promotion', $2, $3)`,
          [serviceId, msg, JSON.stringify({ position: positionName, declined: musician.name, promoted: promotedMusician.name, newBackup: newBackup ? newBackup.name : null })]
        );
      } else {
        // No backup existed: Automatically put in the next fairest candidate into Primary!
        if (candidateList.length > 0) {
          const newPrimary = candidateList[0];
          await dbClient.query(
            `
            INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status, assigned_at)
            VALUES ($1, $2, $3, 'primary', 'pending', NOW())
            ON CONFLICT (service_id, position_id, role_slot)
            DO UPDATE SET musician_id = EXCLUDED.musician_id, status = 'pending', assigned_at = NOW()
          `,
            [serviceId, positionId, newPrimary.id]
          );

          const msg = `${positionName}: ${musician.name} declined. ${newPrimary.name} automatically scheduled as replacement Primary.`;
          notifications.push(msg);

          await dbClient.query(
            `INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, 'reshuffle', $2, $3)`,
            [serviceId, msg, JSON.stringify({ position: positionName, declined: musician.name, newPrimary: newPrimary.name })]
          );
        } else {
          // No one else available for this role
          await dbClient.query(
            "UPDATE assignments SET musician_id = NULL, status = 'declined', assigned_at = NOW() WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'",
            [serviceId, positionId]
          );
          const msg = `${positionName}: ${musician.name} declined. Position is now vacant (no other qualified musicians available).`;
          notifications.push(msg);

          await dbClient.query(
            `INSERT INTO notifications_log (service_id, type, message, metadata) VALUES ($1, 'reshuffle', $2, $3)`,
            [serviceId, msg, JSON.stringify({ position: positionName, declined: musician.name, vacant: true })]
          );
        }
      }
    } else if (currentAssign.role_slot === 'backup') {
      // Clear backup slot
      await dbClient.query(
        "UPDATE assignments SET musician_id = NULL, status = 'declined', assigned_at = NOW() WHERE service_id = $1 AND position_id = $2 AND role_slot = 'backup'",
        [serviceId, positionId]
      );
      const msg = `${positionName} backup ${musician.name} declined.`;
      notifications.push(msg);
    }
  }

  return {
    modified: true,
    notifications,
  };
}

/**
 * Manually overrides an assignment slot for a position.
 */
async function manualOverrideSlot(dbClient, serviceId, positionId, roleSlot, musicianId, notes = '') {
  const posRes = await dbClient.query('SELECT name FROM positions_template WHERE id = $1', [positionId]);
  const posName = posRes.rows[0]?.name || 'Position';

  let musicianName = 'Vacant';
  if (musicianId) {
    const mRes = await dbClient.query('SELECT name FROM musicians WHERE id = $1', [musicianId]);
    musicianName = mRes.rows[0]?.name || 'Unknown Musician';

    // Prevent double booking in the same service: clear any other slot assigned to this musician
    await dbClient.query(
      `UPDATE assignments SET musician_id = NULL, status = 'pending', assigned_at = NOW() 
       WHERE service_id = $1 AND musician_id = $2 AND (position_id != $3 OR role_slot != $4)`,
      [serviceId, musicianId, positionId, roleSlot]
    );
  }

  await dbClient.query(
    `
    INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status, notes, assigned_at)
    VALUES ($1, $2, $3, $4, 'confirmed', $5, NOW())
    ON CONFLICT (service_id, position_id, role_slot)
    DO UPDATE SET 
      musician_id = EXCLUDED.musician_id,
      status = 'confirmed',
      notes = EXCLUDED.notes,
      assigned_at = NOW()
  `,
    [serviceId, positionId, musicianId || null, roleSlot, notes]
  );

  if (posName.toLowerCase().includes('worship leader') && roleSlot === 'primary') {
    await dbClient.query('UPDATE services SET worship_leader_id = $1, updated_at = NOW() WHERE id = $2', [
      musicianId || null,
      serviceId,
    ]);
  }

  const msg = `${posName} (${roleSlot}) set to ${musicianName}.`;
  await dbClient.query(
    `
    INSERT INTO notifications_log (service_id, type, message, metadata)
    VALUES ($1, 'manual_override', $2, $3)
  `,
    [
      serviceId,
      msg,
      JSON.stringify({ position: posName, roleSlot, musicianId, musicianName }),
    ]
  );

  return { success: true, message: msg };
}

/**
 * Checks deadline for a service: if primary has not confirmed and deadline has passed,
 * auto-promote backup to primary (or auto-reschedule if no backup).
 */
async function checkDeadlineAndAutoPromote(dbClient, serviceId) {
  const serviceRes = await dbClient.query('SELECT * FROM services WHERE id = $1', [serviceId]);
  if (serviceRes.rows.length === 0) return { checked: false };
  const service = serviceRes.rows[0];

  const serviceDateTime = new Date(`${service.service_date}T${service.service_time || '10:00:00'}`);
  const deadlineMs = (service.deadline_hours_before || 48) * 60 * 60 * 1000;
  const deadlineThreshold = new Date(serviceDateTime.getTime() - deadlineMs);

  const now = new Date();
  if (now < deadlineThreshold) {
    return { checked: true, pastDeadline: false, promotions: [] };
  }

  const pendingPrimaries = await dbClient.query(
    `
    SELECT 
      p_assign.id AS primary_assign_id,
      p_assign.musician_id AS primary_musician_id,
      p_assign.position_id,
      pos.name AS position_name,
      m_pri.name AS primary_musician_name,
      b_assign.id AS backup_assign_id,
      b_assign.musician_id AS backup_musician_id,
      m_bak.name AS backup_musician_name
    FROM assignments p_assign
    JOIN positions_template pos ON pos.id = p_assign.position_id
    LEFT JOIN musicians m_pri ON m_pri.id = p_assign.musician_id
    LEFT JOIN assignments b_assign ON b_assign.service_id = p_assign.service_id 
         AND b_assign.position_id = p_assign.position_id 
         AND b_assign.role_slot = 'backup'
         AND b_assign.musician_id IS NOT NULL
         AND b_assign.status != 'declined'
    LEFT JOIN musicians m_bak ON m_bak.id = b_assign.musician_id
    WHERE p_assign.service_id = $1 
      AND p_assign.role_slot = 'primary'
      AND p_assign.status = 'pending'
      AND b_assign.musician_id IS NOT NULL
  `,
    [serviceId]
  );

  const promotions = [];

  for (const row of pendingPrimaries.rows) {
    if (row.backup_musician_id) {
      await dbClient.query(
        "UPDATE assignments SET musician_id = $1, status = 'promoted', assigned_at = NOW() WHERE id = $2",
        [row.backup_musician_id, row.primary_assign_id]
      );

      await dbClient.query(
        "UPDATE assignments SET musician_id = NULL, status = 'pending' WHERE id = $1",
        [row.backup_assign_id]
      );

      const msg = `[Deadline Auto-Promotion] ${row.position_name}: ${row.primary_musician_name || 'Primary'} did not confirm. Backup ${row.backup_musician_name} promoted to Primary.`;
      promotions.push(msg);

      await dbClient.query(
        `
        INSERT INTO notifications_log (service_id, type, message, metadata)
        VALUES ($1, 'promotion', $2, $3)
      `,
        [
          serviceId,
          msg,
          JSON.stringify({
            position: row.position_name,
            oldPrimary: row.primary_musician_name,
            promotedBackup: row.backup_musician_name,
            reason: 'deadline_unconfirmed',
          }),
        ]
      );
    }
  }

  return { checked: true, pastDeadline: true, promotions };
}

module.exports = {
  matchesRole,
  computeFairnessRankings,
  getEligibleCandidatesForPosition,
  autoShuffleService,
  handleMusicianDeclined,
  manualOverrideSlot,
  checkDeadlineAndAutoPromote,
};
