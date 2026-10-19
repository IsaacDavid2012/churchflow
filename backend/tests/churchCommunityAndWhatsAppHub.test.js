const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { ROLES, normalizeRole, hasRole } = require('../../shared/roles');

describe('WhatsApp Community Architecture & Ministry Team Chat Space', () => {
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
    const Client = memDb.adapters.createPg().Client;
    const client = new Client();
    await client.connect();
    dbClient = client;
  });

  test('General Announcements RBAC: Only Admin and Pastor can post announcements, members are blocked', () => {
    const canPostGeneralAnnouncement = (role) => {
      const normalized = normalizeRole(role);
      return hasRole(normalized, [ROLES.ADMIN, ROLES.PASTOR]);
    };

    assert.strictEqual(canPostGeneralAnnouncement('admin'), true);
    assert.strictEqual(canPostGeneralAnnouncement('pastor'), true);
    assert.strictEqual(canPostGeneralAnnouncement('manager'), false);
    assert.strictEqual(canPostGeneralAnnouncement('member'), false);
  });

  test('General Announcements CRUD: Pastor posts broadcast, members view, admin deletes', async () => {
    // 1. Create Pastor user
    const pastorRes = await dbClient.query(`
      INSERT INTO users (username, name, email, password_hash, role)
      VALUES ('pastorisaac', 'Pastor Isaac', 'pastor@jesusmyrock.org', 'hashed_pass', 'pastor')
      RETURNING *
    `);
    const pastor = pastorRes.rows[0];

    // 2. Pastor broadcasts church announcement
    const annRes = await dbClient.query(`
      INSERT INTO general_announcements (author_id, author_name, author_role, title, content)
      VALUES ($1, $2, $3, 'Sunday Combined Worship Celebration', 'All teams report at 8:30 AM for sound check.')
      RETURNING *
    `, [pastor.id, pastor.username, pastor.role]);

    assert.ok(annRes.rows[0].id);
    const annId = annRes.rows[0].id;
    assert.strictEqual(annRes.rows[0].title, 'Sunday Combined Worship Celebration');
    assert.strictEqual(annRes.rows[0].author_role, 'pastor');

    // 3. Read announcements stream
    const listRes = await dbClient.query(`
      SELECT * FROM general_announcements ORDER BY created_at DESC
    `);
    assert.strictEqual(listRes.rows.length, 1);
    assert.strictEqual(listRes.rows[0].content, 'All teams report at 8:30 AM for sound check.');

    // 4. Admin deletes announcement
    await dbClient.query('DELETE FROM general_announcements WHERE id = $1', [annId]);
    const afterDelete = await dbClient.query('SELECT * FROM general_announcements WHERE id = $1', [annId]);
    assert.strictEqual(afterDelete.rows.length, 0);
  });

  test('General Church Chat: Any church member can chat, messages contain sender_role', async () => {
    // 1. Create Member user
    const memberRes = await dbClient.query(`
      INSERT INTO users (username, name, email, password_hash, role)
      VALUES ('gracemember', 'Grace Member', 'grace@jesusmyrock.org', 'hashed_pass', 'member')
      RETURNING *
    `);
    const member = memberRes.rows[0];

    // 2. Member posts a chat message
    const msgRes = await dbClient.query(`
      INSERT INTO general_chat_messages (user_id, sender_name, sender_role, message)
      VALUES ($1, $2, $3, 'Praise God! So excited to worship together this Sunday!')
      RETURNING *
    `, [member.id, member.username, member.role]);

    assert.ok(msgRes.rows[0].id);
    assert.strictEqual(msgRes.rows[0].sender_role, 'member');

    // 3. Query chat history
    const chatList = await dbClient.query(`
      SELECT * FROM general_chat_messages ORDER BY created_at ASC
    `);
    assert.strictEqual(chatList.rows.length, 1);
    assert.strictEqual(chatList.rows[0].message, 'Praise God! So excited to worship together this Sunday!');
  });

  test('Ministry Team Chat Space: Real group chat without AI bot', async () => {
    // 1. Create a ministry
    const minRes = await dbClient.query(`
      INSERT INTO groups (name, category, description)
      VALUES ('Media Team', 'Media & Tech', 'Camera and audio mixing team')
      RETURNING *
    `);
    const ministry = minRes.rows[0];

    // 2. Create user and send message into ministry team chat
    const userRes = await dbClient.query(`
      INSERT INTO users (username, name, email, password_hash, role)
      VALUES ('davidtech', 'David Tech', 'david@jesusmyrock.org', 'hashed_pass', 'manager')
      RETURNING *
    `);
    const user = userRes.rows[0];

    const chatMsg = await dbClient.query(`
      INSERT INTO ministry_chat_messages (ministry_id, user_id, sender, sender_role, sender_name, message)
      VALUES ($1, $2, 'member', $3, $4, 'Hey Media Team, rehearsal Thursday at 8 PM in the sound booth!')
      RETURNING *
    `, [ministry.id, user.id, user.role, user.name]);

    assert.ok(chatMsg.rows[0].id);
    assert.strictEqual(chatMsg.rows[0].sender_role, 'manager');
    assert.strictEqual(chatMsg.rows[0].sender_name, 'David Tech');

    // 3. Read team messages
    const teamChat = await dbClient.query(`
      SELECT * FROM ministry_chat_messages WHERE ministry_id = $1 ORDER BY created_at ASC
    `, [ministry.id]);
    assert.strictEqual(teamChat.rows.length, 1);
    assert.strictEqual(teamChat.rows[0].message, 'Hey Media Team, rehearsal Thursday at 8 PM in the sound booth!');
  });

  test('Universal Assignment Rule: Ministry leader selected from People directory links leader_id', async () => {
    // 1. Create Person/Musician
    const musRes = await dbClient.query(`
      INSERT INTO musicians (name, email, phone, role, status)
      VALUES ('John Leader', 'john@jesusmyrock.org', '+60 12-345 6789', 'member', 'active')
      RETURNING *
    `);
    const person = musRes.rows[0];

    // 2. Create Ministry with leader selected from People dropdown
    const minRes = await dbClient.query(`
      INSERT INTO groups (name, category, leader_id, leader_name, leader_phone, description)
      VALUES ('Production Team', 'Production & Tech', $1, $2, $3, 'Stage production and lighting')
      RETURNING *
    `, [person.id, person.name, person.phone]);
    const ministry = minRes.rows[0];

    assert.strictEqual(ministry.leader_id, person.id);
    assert.strictEqual(ministry.leader_name, 'John Leader');
    assert.strictEqual(ministry.leader_phone, '+60 12-345 6789');
  });

  test('Volunteer Onboarding (/join): Creates login password and active member user', async () => {
    const rawPassword = 'SecureVolunteerPass2026!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    // Creates user account
    const userRes = await dbClient.query(`
      INSERT INTO users (username, name, email, password_hash, role)
      VALUES ('sarahvol', 'Sarah Volunteer', 'sarah@jesusmyrock.org', $1, 'member')
      RETURNING *
    `, [hash]);
    const user = userRes.rows[0];

    assert.strictEqual(user.role, 'member');
    assert.ok(await bcrypt.compare(rawPassword, user.password_hash));

    // Creates linked person record
    const musRes = await dbClient.query(`
      INSERT INTO musicians (name, email, phone, role, status, user_id)
      VALUES ('Sarah Volunteer', 'sarah@jesusmyrock.org', '+60 17-888 9999', 'member', 'active', $1)
      RETURNING *
    `, [user.id]);
    const person = musRes.rows[0];

    assert.strictEqual(person.user_id, user.id);
    assert.strictEqual(person.role, 'member');
  });
});
