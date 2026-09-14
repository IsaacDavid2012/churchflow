const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  computeFairnessRankings,
  getEligibleCandidatesForPosition,
  autoShuffleService,
  handleMusicianDeclined,
  checkDeadlineAndAutoPromote,
} = require('../src/services/shuffleService');

const {
  generateAccessToken,
  generateRefreshToken,
  requireRole,
} = require('../src/middleware/auth');
const { ROLES, hasRole } = require('../../shared/roles');

describe('ServeSync Auto-Shuffle & Fairness Engine', () => {
  let dbClient;

  beforeEach(async () => {
    const memDb = newDb();
    
    // Register gen_random_uuid in pg-mem as impure so each invocation generates a new UUID
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => uuidv4(),
    });

    const schemaSql = fs.readFileSync(
      path.join(__dirname, '../src/db/schema.sql'),
      'utf8'
    );
    
    // Clean schema for pg-mem
    const sanitizedSql = schemaSql
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '');

    memDb.public.none(sanitizedSql);

    const adapter = memDb.adapters.createPg();
    dbClient = new adapter.Pool();
  });

  test('Fairness Ranking: never-served musicians rank before recently served musicians', async () => {
    // Insert 3 drummers
    const d1 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Alice NeverServed', ARRAY['Drums'], true) RETURNING id");
    const d2 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Bob ServedRecent', ARRAY['Drums'], true) RETURNING id");
    const d3 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Charlie ServedLongAgo', ARRAY['Drums'], true) RETURNING id");

    const p1 = await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Drums', 1) RETURNING id");

    // Past services
    const sOld = await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-01-01', 'tok-1', 'confirmed') RETURNING id");
    const sRecent = await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-08-01', 'tok-2', 'confirmed') RETURNING id");

    // Charlie served on 2026-01-01
    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed')", [sOld.rows[0].id, p1.rows[0].id, d3.rows[0].id]);
    // Bob served on 2026-08-01
    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed')", [sRecent.rows[0].id, p1.rows[0].id, d2.rows[0].id]);

    const rankings = await computeFairnessRankings(dbClient, '2026-09-01');

    assert.strictEqual(rankings.length, 3);
    // 1st: Alice (never served, last_served_date is null)
    assert.strictEqual(rankings[0].name, 'Alice NeverServed');
    assert.strictEqual(rankings[0].last_served_date, null);

    // 2nd: Charlie (served on 2026-01-01)
    assert.strictEqual(rankings[1].name, 'Charlie ServedLongAgo');
    assert.strictEqual(new Date(rankings[1].last_served_date).toISOString().split('T')[0], '2026-01-01');

    // 3rd: Bob (served on 2026-08-01)
    assert.strictEqual(rankings[2].name, 'Bob ServedRecent');
    assert.strictEqual(new Date(rankings[2].last_served_date).toISOString().split('T')[0], '2026-08-01');
  });

  test('Tie-breaking: Equal days-since-served breaks ties by confirmed count then alphabetical', async () => {
    // 2 musicians who served on the exact same date
    const m1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Zara Drummer', ARRAY['Drums'], true) RETURNING id")).rows[0].id;
    const m2 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Aaron Drummer', ARRAY['Drums'], true) RETURNING id")).rows[0].id;

    const p1 = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Drums', 1) RETURNING id")).rows[0].id;
    const sOld = (await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-05-01', 'tok-tie', 'confirmed') RETURNING id")).rows[0].id;

    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed')", [sOld, p1, m1]);
    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'backup', 'confirmed')", [sOld, p1, m2]);

    const rankings = await computeFairnessRankings(dbClient, '2026-09-01');

    // Since both served on same date and both have 1 confirmed serve, Aaron should rank before Zara alphabetically
    assert.strictEqual(rankings[0].name, 'Aaron Drummer');
    assert.strictEqual(rankings[1].name, 'Zara Drummer');
  });

  test('Empty Eligible Pool Handling: Handles positions with zero qualified musicians gracefully', async () => {
    // No musicians with 'Harp' role
    const posHarp = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Harp', 1) RETURNING id")).rows[0].id;
    const s = (await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-09-20', 'token-empty-pool', 'availability_open') RETURNING id")).rows[0].id;

    const result = await autoShuffleService(dbClient, s, { includeBackup: true });
    assert.strictEqual(result.success, true);

    const harpAssignments = await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2", [s, posHarp]);
    assert.strictEqual(harpAssignments.rows.length, 2);
    assert.strictEqual(harpAssignments.rows[0].musician_id, null, 'Primary harp should remain null');
    assert.strictEqual(harpAssignments.rows[1].musician_id, null, 'Backup harp should remain null');
  });

  test('Auto-Shuffle: Assigns Primary and Backup accurately and avoids double-booking', async () => {
    const mDrums1 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Dave Drummer 1', ARRAY['Drums'], true) RETURNING id");
    const mDrums2 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Dan Drummer 2', ARRAY['Drums'], true) RETURNING id");
    const mDrums3 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Doug Drummer 3', ARRAY['Drums'], true) RETURNING id");

    const mBass1 = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Ben Bassist 1', ARRAY['Bass'], true) RETURNING id");
    const mMulti = await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Sam MultiRole', ARRAY['Bass', 'Drums'], true) RETURNING id");

    const posDrums = await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Drums', 1) RETURNING id");
    const posBass = await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Bass', 2) RETURNING id");

    const targetService = await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-09-20', 'token-target', 'availability_open') RETURNING id");
    const serviceId = targetService.rows[0].id;

    const musicianIds = [mDrums1.rows[0].id, mDrums2.rows[0].id, mDrums3.rows[0].id, mBass1.rows[0].id, mMulti.rows[0].id];
    for (const mid of musicianIds) {
      await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [mid, serviceId]);
    }

    const result = await autoShuffleService(dbClient, serviceId, { includeBackup: true });
    assert.strictEqual(result.success, true);

    const assignments = await dbClient.query("SELECT a.*, p.name as pos_name FROM assignments a JOIN positions_template p ON p.id = a.position_id WHERE a.service_id = $1", [serviceId]);

    const drumsPrimary = assignments.rows.find(a => a.pos_name === 'Drums' && a.role_slot === 'primary');
    const drumsBackup = assignments.rows.find(a => a.pos_name === 'Drums' && a.role_slot === 'backup');
    const bassPrimary = assignments.rows.find(a => a.pos_name === 'Bass' && a.role_slot === 'primary');

    assert.ok(drumsPrimary.musician_id, 'Drums primary should be assigned');
    assert.ok(drumsBackup.musician_id, 'Drums backup should be assigned');
    assert.ok(bassPrimary.musician_id, 'Bass primary should be assigned');

    const assignedIds = assignments.rows.filter(a => a.musician_id).map(a => a.musician_id);
    const uniqueIds = new Set(assignedIds);
    assert.strictEqual(assignedIds.length, uniqueIds.size, 'No musician should be assigned multiple slots in the same service');
  });

  test('Live Re-shuffle / Backup Auto-Promotion: Primary decline promotes backup and selects new backup', async () => {
    const d1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Drummer John', ARRAY['Drums'], true) RETURNING id")).rows[0].id;
    const d2 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Drummer Mike', ARRAY['Drums'], true) RETURNING id")).rows[0].id;
    const d3 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Drummer Alex', ARRAY['Drums'], true) RETURNING id")).rows[0].id;

    const posDrums = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Drums', 1) RETURNING id")).rows[0].id;
    const serviceId = (await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-09-20', 'token-promote', 'rostered') RETURNING id")).rows[0].id;

    await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [d1, serviceId]);
    await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [d2, serviceId]);
    await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [d3, serviceId]);

    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed')", [serviceId, posDrums, d1]);
    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'backup', 'pending')", [serviceId, posDrums, d2]);

    const declineResult = await handleMusicianDeclined(dbClient, serviceId, d1);
    assert.strictEqual(declineResult.modified, true);

    const primarySlot = await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'", [serviceId, posDrums]);
    assert.strictEqual(primarySlot.rows[0].musician_id, d2, 'Mike should now be Primary');
    assert.strictEqual(primarySlot.rows[0].status, 'promoted');

    const backupSlot = await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'backup'", [serviceId, posDrums]);
    assert.strictEqual(backupSlot.rows[0].musician_id, d3, 'Alex should be assigned as new Backup');
  });

  test('Concurrent Availability Writes: Row-level safety test', async () => {
    const m1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('User 1', ARRAY['Vocals'], true) RETURNING id")).rows[0].id;
    const m2 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('User 2', ARRAY['Vocals'], true) RETURNING id")).rows[0].id;
    const serviceId = (await dbClient.query("INSERT INTO services (service_date, token, status) VALUES ('2026-09-20', 'token-concurrent', 'availability_open') RETURNING id")).rows[0].id;

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        dbClient.query(
          "INSERT INTO availability (musician_id, service_id, status, responded_at) VALUES ($1, $2, 'available', NOW()) ON CONFLICT (musician_id, service_id) DO UPDATE SET status = EXCLUDED.status, responded_at = NOW()",
          [m1, serviceId]
        )
      );
      promises.push(
        dbClient.query(
          "INSERT INTO availability (musician_id, service_id, status, responded_at) VALUES ($1, $2, 'declined', NOW()) ON CONFLICT (musician_id, service_id) DO UPDATE SET status = EXCLUDED.status, responded_at = NOW()",
          [m2, serviceId]
        )
      );
    }

    await Promise.all(promises);

    const rows = await dbClient.query("SELECT * FROM availability WHERE service_id = $1", [serviceId]);
    assert.strictEqual(rows.rows.length, 2, 'Should have exactly 2 distinct rows without race condition duplicates');
  });

  test('Worship Leader Exclusion: Worship leader is not auto-assigned to instrument positions', async () => {
    const wl = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Pastor James', ARRAY['Keys', 'Vocals'], true) RETURNING id")).rows[0].id;
    const k1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Keys Player Ken', ARRAY['Keys'], true) RETURNING id")).rows[0].id;
    const posKeys = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Keys', 1) RETURNING id")).rows[0].id;

    const s = await dbClient.query("INSERT INTO services (service_date, token, worship_leader_id, status) VALUES ('2026-09-20', 'token-wl', $1, 'availability_open') RETURNING id", [wl]);
    const serviceId = s.rows[0].id;

    await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [wl, serviceId]);
    await dbClient.query("INSERT INTO availability (musician_id, service_id, status) VALUES ($1, $2, 'available')", [k1, serviceId]);

    await autoShuffleService(dbClient, serviceId);

    const assign = await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'", [serviceId, posKeys]);
    assert.strictEqual(assign.rows[0].musician_id, k1, 'Keys player should be assigned, not the worship leader');
  });

  test('Deadline & Timezone Handling: Accurately checks hours threshold and auto-promotes', async () => {
    const p1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Primary John', ARRAY['Bass'], true) RETURNING id")).rows[0].id;
    const b1 = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Backup Bob', ARRAY['Bass'], true) RETURNING id")).rows[0].id;
    const posBass = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Bass', 1) RETURNING id")).rows[0].id;

    const s = await dbClient.query("INSERT INTO services (service_date, service_time, deadline_hours_before, token, status) VALUES ('2026-01-01', '10:00:00', 48, 'token-deadline', 'rostered') RETURNING id");
    const serviceId = s.rows[0].id;

    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending')", [serviceId, posBass, p1]);
    await dbClient.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'backup', 'pending')", [serviceId, posBass, b1]);

    const result = await checkDeadlineAndAutoPromote(dbClient, serviceId);
    assert.strictEqual(result.pastDeadline, true);
    assert.strictEqual(result.promotions.length, 1);

    const pri = await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'", [serviceId, posBass]);
    assert.strictEqual(pri.rows[0].musician_id, b1, 'Backup Bob should be promoted to primary');
    assert.strictEqual(pri.rows[0].status, 'promoted');
  });

  test('Jesus My Rock Church Roster: Auto-schedules 1 person per slot & automatically replaces on decline', async () => {
    // Insert real team members from Josh
    const isaac = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Isaac', ARRAY['Drums', 'Bass', 'Keyboard', 'Sound'], true) RETURNING id")).rows[0].id;
    const josh = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Josh', ARRAY['Guitar', 'Worship Leader', 'Vocals', 'Backup', 'Bass'], true) RETURNING id")).rows[0].id;
    const shayne = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Shayne', ARRAY['Drums', 'Guitar', 'Vocals', 'Backup'], true) RETURNING id")).rows[0].id;
    const alvin = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Alvin Anne', ARRAY['Bass', 'Guitar'], true) RETURNING id")).rows[0].id;
    const sharon = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Sharon', ARRAY['Keyboard'], true) RETURNING id")).rows[0].id;
    const yovaan = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Yovaan', ARRAY['Guitar'], true) RETURNING id")).rows[0].id;
    const tushaal = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Tushaal', ARRAY['Sound', 'Sound (FOH)'], true) RETURNING id")).rows[0].id;

    // Create positions
    const posDrums = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Drums', 1) RETURNING id")).rows[0].id;
    const posBass = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Bass', 2) RETURNING id")).rows[0].id;
    const posKeys = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Keyboard', 3) RETURNING id")).rows[0].id;
    const posGuitar = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Guitar', 4) RETURNING id")).rows[0].id;
    const posSound = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Sound (FOH)', 5) RETURNING id")).rows[0].id;

    // Service with Josh as Worship Leader
    const s = (await dbClient.query("INSERT INTO services (service_date, token, worship_leader_id, status) VALUES ('2026-09-20', 'token-jmr', $1, 'availability_open') RETURNING id", [josh])).rows[0].id;

    // Auto-schedule (single slot only, no backup)
    const shuffleRes = await autoShuffleService(dbClient, s, { includeBackup: false });
    assert.strictEqual(shuffleRes.success, true);

    // Verify each position is filled with 1 person and Josh is excluded from instrument slots
    const assigns = await dbClient.query("SELECT a.*, p.name as pos_name FROM assignments a JOIN positions_template p ON p.id = a.position_id WHERE a.service_id = $1", [s]);
    assert.strictEqual(assigns.rows.length, 5);
    for (const a of assigns.rows) {
      assert.ok(a.musician_id, `Position ${a.pos_name} should be assigned`);
      assert.notStrictEqual(a.musician_id, josh, `Worship leader Josh should not be auto-assigned to ${a.pos_name}`);
    }

    // Identify who got Drums
    const drumsAssign = assigns.rows.find(a => a.pos_name === 'Drums');
    const firstDrummerId = drumsAssign.musician_id;

    // First drummer declines!
    const declineRes = await handleMusicianDeclined(dbClient, s, firstDrummerId);
    assert.strictEqual(declineRes.modified, true);

    // Verify Drums position was automatically re-assigned to the next available qualified drummer (e.g. Shayne if Isaac was first)
    const updatedDrums = (await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'", [s, posDrums])).rows[0];
    assert.ok(updatedDrums.musician_id, 'Drums should be automatically re-assigned');
    assert.notStrictEqual(updatedDrums.musician_id, firstDrummerId, 'Declined drummer should be replaced');
  });

  test('Worship Leader Lineup Sync: Chosen worship leader automatically populates Worship Leader lineup position without duplicate', async () => {
    const josh = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Josh', ARRAY['Worship Leader', 'Guitar', 'Vocals'], true) RETURNING id")).rows[0].id;
    const alisha = (await dbClient.query("INSERT INTO musicians (name, roles, active) VALUES ('Alisha', ARRAY['Worship Leader', 'Vocals'], true) RETURNING id")).rows[0].id;
    const posWL = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Worship Leader', 1) RETURNING id")).rows[0].id;
    const posGuitar = (await dbClient.query("INSERT INTO positions_template (name, sort_order) VALUES ('Guitar', 2) RETURNING id")).rows[0].id;

    // Service created with Josh as chosen Worship Leader
    const s = (await dbClient.query("INSERT INTO services (service_date, token, worship_leader_id, status) VALUES ('2026-09-27', 'token-wl-sync', $1, 'availability_open') RETURNING id", [josh])).rows[0].id;

    await autoShuffleService(dbClient, s, { includeBackup: false });

    // Worship Leader position in lineup should be Josh (confirmed), not Alisha or duplicate
    const wlAssign = (await dbClient.query("SELECT * FROM assignments WHERE service_id = $1 AND position_id = $2 AND role_slot = 'primary'", [s, posWL])).rows[0];
    assert.strictEqual(wlAssign.musician_id, josh, 'Worship Leader position in lineup must be assigned to chosen leader Josh');
    assert.strictEqual(wlAssign.status, 'confirmed', 'Worship Leader position should be confirmed');
  });
});

describe('ServeSync RBAC & Auth Foundation', () => {
  test('Role permission helper: Admin has global access, others checked strictly', () => {
    assert.strictEqual(hasRole(ROLES.ADMIN, [ROLES.LEADER]), true);
    assert.strictEqual(hasRole(ROLES.PASTOR, [ROLES.PASTOR, ROLES.ADMIN]), true);
    assert.strictEqual(hasRole(ROLES.VOLUNTEER, [ROLES.LEADER, ROLES.PASTOR]), false);
    assert.strictEqual(hasRole(ROLES.LEADER, [ROLES.LEADER]), true);
  });

  test('JWT Token Generation & Verification: Access and Refresh tokens work with claims', () => {
    const user = {
      id: 'test-user-uuid',
      email: 'pastor@jesusmyrock.org',
      username: 'pastordavid',
      role: ROLES.PASTOR,
      name: 'Pastor David',
    };

    const token = generateAccessToken(user);
    const decoded = jwt.decode(token);

    assert.strictEqual(decoded.id, user.id);
    assert.strictEqual(decoded.email, user.email);
    assert.strictEqual(decoded.role, ROLES.PASTOR);

    const refreshToken = generateRefreshToken(user);
    const decodedRefresh = jwt.decode(refreshToken);
    assert.strictEqual(decodedRefresh.id, user.id);
    assert.strictEqual(decodedRefresh.tokenType, 'refresh');
  });
});
