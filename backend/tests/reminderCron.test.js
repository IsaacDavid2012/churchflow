const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { runPendingReminderJob } = require('../src/services/cronService');
const whatsappService = require('../src/services/whatsappService');

describe('ServeSync 24h Automated WhatsApp Reminder Cron', () => {
  let dbClient;
  let sentMessages = [];

  beforeEach(async () => {
    sentMessages = [];
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
      .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '');

    memDb.public.none(sanitizedSql);
    const adapter = memDb.adapters.createPg();
    dbClient = new adapter.Pool();

    // Mock whatsappService.sendMessage
    whatsappService.sendMessage = async (to, text) => {
      sentMessages.push({ to, text });
      return { success: true };
    };
  });

  test('sendVolunteerReminderNudge constructs a warm, personalized 24h nudge', async () => {
    const res = await whatsappService.sendVolunteerReminderNudge({
      musician: { id: 'm1', name: 'Isaac David', phone: '+60176001484' },
      service: {
        token: 'test-token-123',
        service_date: '2026-10-25',
        service_time: '10:00 AM',
        service_type: 'Sunday Morning Celebration',
      },
      positionName: 'Worship Leader',
      hoursRemaining: 18,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].to, '+60176001484');
    assert.ok(sentMessages[0].text.includes('Isaac David'));
    assert.ok(sentMessages[0].text.includes('Worship Leader'));
    assert.ok(sentMessages[0].text.includes('18h remaining'));
    assert.ok(sentMessages[0].text.includes('test-token-123'));
  });

  test('runPendingReminderJob dispatches reminder to pending primary volunteers within 24 hours', async () => {
    // 1. Insert position
    const posRes = await dbClient.query(`
      INSERT INTO positions_template (id, name, ministry, sort_order)
      VALUES ('${uuidv4()}', 'Electric Guitar', 'Band', 1)
      RETURNING id
    `);
    const posId = posRes.rows[0].id;

    // 2. Insert musician with phone
    const musRes = await dbClient.query(`
      INSERT INTO musicians (id, name, email, phone, role)
      VALUES ('${uuidv4()}', 'Sarah Tan', 'sarah@example.com', '+60123456789', 'Electric Guitar')
      RETURNING id
    `);
    const musId = musRes.rows[0].id;

    // 3. Insert service happening tomorrow (e.g. today + 1 day)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const svcRes = await dbClient.query(`
      INSERT INTO services (id, service_date, service_time, service_type, theme, token, status)
      VALUES ('${uuidv4()}', '${dateStr}', '10:00 AM', 'Sunday Celebration', 'Hope', 'svc-token-abc', 'rostered')
      RETURNING id
    `);
    const svcId = svcRes.rows[0].id;

    // 4. Assign Sarah as pending primary
    await dbClient.query(`
      INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status)
      VALUES ('${svcId}', '${posId}', '${musId}', 'primary', 'pending')
    `);

    // 5. Run reminder job
    await runPendingReminderJob(dbClient);

    // Assert that Sarah received a reminder
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].to, '+60123456789');
    assert.ok(sentMessages[0].text.includes('Sarah Tan'));
    assert.ok(sentMessages[0].text.includes('Electric Guitar'));

    // Assert audit logged in notifications_log
    const logRes = await dbClient.query(`
      SELECT * FROM notifications_log WHERE service_id = '${svcId}' AND type = 'whatsapp_24h_reminder'
    `);
    assert.strictEqual(logRes.rows.length, 1);
    assert.strictEqual(logRes.rows[0].metadata.musician_name, 'Sarah Tan');

    // 6. Run reminder job again immediately -> deduplication prevents second send
    await runPendingReminderJob(dbClient);
    assert.strictEqual(sentMessages.length, 1, 'Should NOT send duplicate reminder within 24h');
  });

  test('does not remind volunteers who have already confirmed', async () => {
    const posRes = await dbClient.query(`
      INSERT INTO positions_template (name, ministry, sort_order)
      VALUES ('Drums', 'Band', 2)
      RETURNING id
    `);
    const posId = posRes.rows[0].id;

    const musRes = await dbClient.query(`
      INSERT INTO musicians (name, email, phone, role)
      VALUES ('John Doe', 'john@example.com', '+60111111111', 'Drums')
      RETURNING id
    `);
    const musId = musRes.rows[0].id;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const svcRes = await dbClient.query(`
      INSERT INTO services (service_date, service_time, service_type, theme, token, status)
      VALUES ('${dateStr}', '10:00 AM', 'Sunday Celebration', 'Grace', 'svc-token-xyz', 'rostered')
      RETURNING id
    `);
    const svcId = svcRes.rows[0].id;

    // Assigned as confirmed
    await dbClient.query(`
      INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status)
      VALUES ('${svcId}', '${posId}', '${musId}', 'primary', 'confirmed')
    `);

    await runPendingReminderJob(dbClient);
    assert.strictEqual(sentMessages.length, 0, 'Confirmed volunteer should not receive reminder');
  });
});
