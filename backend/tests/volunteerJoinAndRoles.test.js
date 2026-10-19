const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ROLES, normalizeRole, ROLE_HIERARCHY } = require('../../shared/roles');

describe('Volunteer Self-Onboarding & 4-Tier Staff RBAC', () => {
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

  test('Roles Normalization maps legacy aliases to standard 4 roles', () => {
    assert.strictEqual(normalizeRole('admin'), ROLES.ADMIN);
    assert.strictEqual(normalizeRole('ADMIN'), ROLES.ADMIN);
    assert.strictEqual(normalizeRole('pastor'), ROLES.PASTOR);
    assert.strictEqual(normalizeRole('manager'), ROLES.MANAGER);
    assert.strictEqual(normalizeRole('leader'), ROLES.MANAGER);
    assert.strictEqual(normalizeRole('worship_leader'), ROLES.MANAGER);
    assert.strictEqual(normalizeRole('member'), ROLES.MEMBER);
    assert.strictEqual(normalizeRole('volunteer'), ROLES.MEMBER);
  });

  test('Role Hierarchy orders Admin > Pastor > Manager > Member', () => {
    assert.ok(ROLE_HIERARCHY[ROLES.ADMIN] > ROLE_HIERARCHY[ROLES.PASTOR]);
    assert.ok(ROLE_HIERARCHY[ROLES.PASTOR] > ROLE_HIERARCHY[ROLES.MANAGER]);
    assert.ok(ROLE_HIERARCHY[ROLES.MANAGER] > ROLE_HIERARCHY[ROLES.MEMBER]);
  });

  test('Public Volunteer Onboarding inserts member with toggled roles', async () => {
    const sampleVolunteer = {
      name: 'Deborah Lim',
      email: 'deborah@example.com',
      phone: '+60123456789',
      roles: ['Visuals (ProPresenter)', 'Sound Engineer', 'Photographer'],
      notes: 'Available on Sunday mornings',
    };

    const insertQuery = `
      INSERT INTO musicians (name, phone, email, roles, ministry, status, notes, active)
      VALUES ($1, $2, $3, $4, 'Worship & Media Team', 'member', $5, true)
      RETURNING id, name, email, phone, roles, ministry, status, active, notes
    `;

    const res = await dbClient.query(insertQuery, [
      sampleVolunteer.name,
      sampleVolunteer.phone,
      sampleVolunteer.email,
      sampleVolunteer.roles,
      sampleVolunteer.notes,
    ]);

    assert.strictEqual(res.rows.length, 1);
    const row = res.rows[0];
    assert.strictEqual(row.name, 'Deborah Lim');
    assert.strictEqual(row.status, 'member');
    assert.strictEqual(row.active, true);
    assert.strictEqual(row.ministry, 'Worship & Media Team');
    assert.deepStrictEqual(row.roles, [
      'Visuals (ProPresenter)',
      'Sound Engineer',
      'Photographer',
    ]);
  });

  test('Service Deletion Permission allows Admin & Pastor, blocks Manager & Member', () => {
    const canDeleteService = (role) => {
      const normalized = normalizeRole(role);
      return [ROLES.ADMIN, ROLES.PASTOR].includes(normalized);
    };

    assert.strictEqual(canDeleteService('admin'), true);
    assert.strictEqual(canDeleteService('pastor'), true);
    assert.strictEqual(canDeleteService('manager'), false);
    assert.strictEqual(canDeleteService('leader'), false);
    assert.strictEqual(canDeleteService('member'), false);
    assert.strictEqual(canDeleteService('volunteer'), false);
  });
});
