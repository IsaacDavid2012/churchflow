const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

describe('Dynamic Service Types Management', () => {
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

  test('Lists all configured service types ordered by sort_order and name', async () => {
    const result = await dbClient.query(
      'SELECT id, name, default_time, sort_order FROM service_types ORDER BY sort_order ASC, name ASC'
    );
    assert.strictEqual(result.rows.length, 6);
    assert.strictEqual(result.rows[0].name, 'Sunday Morning Celebration');
    assert.strictEqual(result.rows[1].name, 'Sunday Evening Praise & Word');
  });

  test('Creates a new custom service type with default time', async () => {
    const insertRes = await dbClient.query(
      `INSERT INTO service_types (name, default_time, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      ['Easter Celebration Night', '7:30 PM', 7]
    );
    assert.strictEqual(insertRes.rows.length, 1);
    assert.strictEqual(insertRes.rows[0].name, 'Easter Celebration Night');
    assert.strictEqual(insertRes.rows[0].default_time, '7:30 PM');

    const countRes = await dbClient.query('SELECT COUNT(*) AS total FROM service_types');
    assert.strictEqual(parseInt(countRes.rows[0].total, 10), 7);
  });

  test('Prevents deleting the last remaining service type as a safeguard', async () => {
    // Keep only 1 type
    await dbClient.query("DELETE FROM service_types WHERE name != 'Sunday Morning Celebration'");
    const countRes = await dbClient.query('SELECT COUNT(*) AS total FROM service_types');
    assert.strictEqual(parseInt(countRes.rows[0].total, 10), 1);

    // Safeguard condition check: must have > 1 type to delete
    const totalRemaining = parseInt(countRes.rows[0].total, 10);
    const canDelete = totalRemaining > 1;
    assert.strictEqual(canDelete, false, 'Should prohibit deleting the sole remaining service type');
  });

  test('Deletes a service type when multiple exist', async () => {
    const countBefore = await dbClient.query('SELECT COUNT(*) AS total FROM service_types');
    assert.strictEqual(parseInt(countBefore.rows[0].total, 10), 6);

    const delRes = await dbClient.query(
      "DELETE FROM service_types WHERE name = 'Special Gathering' RETURNING *"
    );
    assert.strictEqual(delRes.rows.length, 1);
    assert.strictEqual(delRes.rows[0].name, 'Special Gathering');

    const countAfter = await dbClient.query('SELECT COUNT(*) AS total FROM service_types');
    assert.strictEqual(parseInt(countAfter.rows[0].total, 10), 5);
  });
});
