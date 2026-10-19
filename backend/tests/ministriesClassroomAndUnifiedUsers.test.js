const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ROLES, normalizeRole, hasRole } = require('../../shared/roles');
const { getMinistryAssistantReply } = require('../src/services/ministryAiService');

describe('Ministry Classroom, Manager Assignment & Unified Users RBAC', () => {
  let dbClient;

  beforeEach(async () => {
    const memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => uuidv4(),
    });

    const schemaSql = fs.readFileSync(
      path.join(__dirname, '../src/db/schema.sql'),
      'utf8'
    );
    const sanitizedSql = schemaSql
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '')
      .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '');

    memDb.public.none(sanitizedSql);
    dbClient = memDb.adapters.createPg().Client;
    const client = new dbClient();
    await client.connect();
    dbClient = client;
  });

  test('Classroom Announcements RBAC: Only Managers, Pastors, and Admins can post announcements', () => {
    const canPostAnnouncement = (role, isMinistryManager = false) => {
      const normalized = normalizeRole(role);
      if (hasRole(normalized, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER])) return true;
      return isMinistryManager;
    };

    assert.strictEqual(canPostAnnouncement('admin'), true);
    assert.strictEqual(canPostAnnouncement('pastor'), true);
    assert.strictEqual(canPostAnnouncement('manager'), true);
    assert.strictEqual(canPostAnnouncement('member', true), true); // designated ministry manager
    assert.strictEqual(canPostAnnouncement('member', false), false); // regular member blocked
    assert.strictEqual(canPostAnnouncement('volunteer', false), false);
  });

  test('Manager Assignment RBAC: Managers will be assigned strictly by Pastors and Admins', () => {
    const canAssignManager = (role) => {
      const normalized = normalizeRole(role);
      return hasRole(normalized, [ROLES.ADMIN, ROLES.PASTOR]);
    };

    assert.strictEqual(canAssignManager('admin'), true);
    assert.strictEqual(canAssignManager('pastor'), true);
    assert.strictEqual(canAssignManager('manager'), false); // manager cannot assign other managers
    assert.strictEqual(canAssignManager('member'), false);
  });

  test('Unified Role Switching RBAC: Only Admin can change user roles', () => {
    const canChangeUserRole = (requesterRole) => {
      const normalized = normalizeRole(requesterRole);
      return hasRole(normalized, ROLES.ADMIN);
    };

    assert.strictEqual(canChangeUserRole('admin'), true);
    assert.strictEqual(canChangeUserRole('pastor'), false);
    assert.strictEqual(canChangeUserRole('manager'), false);
    assert.strictEqual(canChangeUserRole('member'), false);
  });

  test('Classroom Database Ops: Inserts announcements, assigns members, and saves chat history', async () => {
    // 1. Create a Ministry
    const minRes = await dbClient.query(`
      INSERT INTO groups (name, category, leader_name, active)
      VALUES ('Worship Ministry', 'Worship & Music', 'Isaac David', true)
      RETURNING id
    `);
    const ministryId = minRes.rows[0].id;

    // 2. Create a Musician / Person
    const musRes = await dbClient.query(`
      INSERT INTO musicians (name, email, phone, role, active)
      VALUES ('Josh', 'josh@example.com', '+60123456789', 'member', true)
      RETURNING id
    `);
    const musicianId = musRes.rows[0].id;

    // 3. Assign person to Ministry
    const assignRes = await dbClient.query(`
      INSERT INTO ministry_members (ministry_id, musician_id, role)
      VALUES ($1, $2, 'manager')
      RETURNING *
    `, [ministryId, musicianId]);
    assert.strictEqual(assignRes.rows.length, 1);
    assert.strictEqual(assignRes.rows[0].role, 'manager');

    // 4. Post an Announcement in the Classroom Stream
    const annRes = await dbClient.query(`
      INSERT INTO ministry_announcements (ministry_id, author_name, author_role, title, content, is_pinned)
      VALUES ($1, 'Josh', 'manager', 'Rehearsal Tonight @ 8PM', 'Please review Firm Foundation and Goodness of God in Key D.', true)
      RETURNING *
    `, [ministryId]);
    assert.strictEqual(annRes.rows.length, 1);
    assert.strictEqual(annRes.rows[0].title, 'Rehearsal Tonight @ 8PM');
    assert.strictEqual(annRes.rows[0].is_pinned, true);

    // 5. Query Announcements (Pinned first)
    const listRes = await dbClient.query(`
      SELECT * FROM ministry_announcements WHERE ministry_id = $1 ORDER BY is_pinned DESC, created_at DESC
    `, [ministryId]);
    assert.strictEqual(listRes.rows.length, 1);

    // 6. Test Ministry AI Chatbot response
    const botReply = await getMinistryAssistantReply(
      { name: 'Worship Ministry', category: 'Worship & Music' },
      'Suggest 3 songs for next Sunday'
    );
    assert.ok(botReply.length > 20);
    assert.ok(botReply.includes('Worship') || botReply.includes('Setlist') || botReply.includes('Firm Foundation'));
  });
});
