const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ROLES, normalizeRole, hasRole } = require('../../shared/roles');

describe('Ministries Management & Member Read-Only RBAC', () => {
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

  test('RBAC Rule: Members are strictly read-only for Ministries', () => {
    const canCreateOrEditMinistry = (role) => {
      const normalized = normalizeRole(role);
      return normalized !== ROLES.MEMBER;
    };

    assert.strictEqual(canCreateOrEditMinistry('admin'), true);
    assert.strictEqual(canCreateOrEditMinistry('pastor'), true);
    assert.strictEqual(canCreateOrEditMinistry('manager'), true);
    assert.strictEqual(canCreateOrEditMinistry('member'), false);
    assert.strictEqual(canCreateOrEditMinistry('volunteer'), false);
  });

  test('RBAC Rule: Only Admin & Pastor can delete Ministries (Managers & Members blocked)', () => {
    const canDeleteMinistry = (role) => {
      return hasRole(role, [ROLES.ADMIN, ROLES.PASTOR]);
    };

    assert.strictEqual(canDeleteMinistry('admin'), true);
    assert.strictEqual(canDeleteMinistry('pastor'), true);
    assert.strictEqual(canDeleteMinistry('manager'), false);
    assert.strictEqual(canDeleteMinistry('leader'), false);
    assert.strictEqual(canDeleteMinistry('member'), false);
    assert.strictEqual(canDeleteMinistry('volunteer'), false);
  });

  test('Ministries CRUD: Creates, updates, queries with leader_phone, and soft deletes', async () => {
    // 1. Insert Ministry
    const insertRes = await dbClient.query(`
      INSERT INTO groups (name, category, leader_name, leader_phone, meeting_day, meeting_time, location, description, member_count, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      'Worship Ministry',
      'Worship & Music',
      'Isaac David',
      '+60176001484',
      'Thursday',
      '8:00 PM',
      'Main Sanctuary',
      'Band, vocalists, and worship leaders for Sunday services',
      14
    ]);

    assert.strictEqual(insertRes.rows.length, 1);
    const ministryId = insertRes.rows[0].id;
    assert.strictEqual(insertRes.rows[0].name, 'Worship Ministry');
    assert.strictEqual(insertRes.rows[0].leader_phone, '+60176001484');

    // 2. Query Active Ministries
    const listRes = await dbClient.query(`
      SELECT * FROM groups WHERE active = true ORDER BY name ASC
    `);
    assert.strictEqual(listRes.rows.length, 1);
    assert.strictEqual(listRes.rows[0].name, 'Worship Ministry');

    // 3. Update Ministry
    const updateRes = await dbClient.query(`
      UPDATE groups
      SET member_count = $1, description = $2, updated_at = NOW()
      WHERE id = $3 AND active = true
      RETURNING *
    `, [16, 'Updated description for Jesus My Rock worship team', ministryId]);
    assert.strictEqual(updateRes.rows[0].member_count, 16);

    // 4. Soft Delete Ministry
    const deleteRes = await dbClient.query(`
      UPDATE groups SET active = false WHERE id = $1 RETURNING id
    `, [ministryId]);
    assert.strictEqual(deleteRes.rows.length, 1);

    // 5. Verify no active ministries returned
    const emptyRes = await dbClient.query(`
      SELECT * FROM groups WHERE active = true
    `);
    assert.strictEqual(emptyRes.rows.length, 0);
  });
});
