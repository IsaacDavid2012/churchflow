const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb, DataType } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

function normalizeMalaysianPhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('600')) {
    digits = '60' + digits.substring(3);
  } else if (digits.startsWith('60')) {
    // already starts with 60
  } else if (digits.startsWith('0')) {
    digits = '60' + digits.substring(1);
  } else if (digits.startsWith('1')) {
    digits = '60' + digits;
  } else {
    digits = '60' + digits;
  }
  return '+' + digits;
}

describe('Volunteer Onboarding, Username Creation & Malaysian Phone (+60)', () => {
  let dbClient;

  beforeEach(async () => {
    const memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => uuidv4(),
    });
    memDb.public.registerFunction({
      name: 'regexp_replace',
      args: [DataType.text, DataType.text, DataType.text, DataType.text],
      returns: DataType.text,
      implementation: (str, pattern, replacement, flags) => {
        if (str === null || str === undefined) return null;
        const re = new RegExp(pattern, flags || '');
        return String(str).replace(re, replacement);
      },
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

  test('Malaysian Phone Normalization handles all local formats seamlessly to +60', () => {
    // Standard domestic 01X
    assert.strictEqual(normalizeMalaysianPhone('0163151671'), '+60163151671');
    assert.strictEqual(normalizeMalaysianPhone('016-315 1671'), '+60163151671');
    assert.strictEqual(normalizeMalaysianPhone('017 600 1484'), '+60176001484');

    // Input without leading 0 (when UI prefix +60 is separate)
    assert.strictEqual(normalizeMalaysianPhone('16 315 1671'), '+60163151671');
    assert.strictEqual(normalizeMalaysianPhone('176001484'), '+60176001484');

    // Already with +60 or 60
    assert.strictEqual(normalizeMalaysianPhone('+60163151671'), '+60163151671');
    assert.strictEqual(normalizeMalaysianPhone('+60 16-315 1671'), '+60163151671');

    // Double prefix mistake (+60 016...)
    assert.strictEqual(normalizeMalaysianPhone('+600163151671'), '+60163151671');

    // 011 prefix (11-digit numbers)
    assert.strictEqual(normalizeMalaysianPhone('011 1234 5678'), '+601112345678');
  });

  test('Volunteer sets explicit username during onboarding and stores +60 normalized phone', async () => {
    const rawPass = 'DanielPass2026!';
    const passwordHash = await bcrypt.hash(rawPass, 10);
    const chosenUsername = 'danielraj';
    const rawPhone = '016 315 1671';
    const normalizedPhone = normalizeMalaysianPhone(rawPhone);

    // 1. Insert user with explicit chosen username
    const userRes = await dbClient.query(`
      INSERT INTO users (username, email, password_hash, role, name, status)
      VALUES ($1, $2, $3, 'member', $4, 'active')
      RETURNING id, username, name, role
    `, [chosenUsername, 'daniel@example.com', passwordHash, 'Daniel Raj']);

    const user = userRes.rows[0];
    assert.strictEqual(user.username, 'danielraj');
    assert.strictEqual(user.name, 'Daniel Raj');

    // 2. Insert musician with +60 normalized phone
    const musRes = await dbClient.query(`
      INSERT INTO musicians (user_id, name, phone, email, roles, status, active)
      VALUES ($1, $2, $3, $4, ARRAY['Vocal (Lead)', 'Acoustic Guitar'], 'member', true)
      RETURNING id, name, phone, user_id
    `, [user.id, user.name, normalizedPhone, 'daniel@example.com']);

    const musician = musRes.rows[0];
    assert.strictEqual(musician.phone, '+60163151671');
    assert.strictEqual(musician.user_id, user.id);
  });

  test('Login flexibility: User can authenticate via Username, First Name, Full Name, or Phone', async () => {
    const rawPass = 'DanielPass2026!';
    const passwordHash = await bcrypt.hash(rawPass, 10);
    const chosenUsername = 'danielraj';
    const fullName = 'Daniel Raj';
    const phone = '+60163151671';

    const uRes = await dbClient.query(`
      INSERT INTO users (username, name, email, password_hash, role, status)
      VALUES ($1, $2, 'daniel@example.com', $3, 'member', 'active')
      RETURNING id
    `, [chosenUsername, fullName, passwordHash]);
    const userId = uRes.rows[0].id;

    await dbClient.query(`
      INSERT INTO musicians (user_id, name, phone, email, roles, status, active)
      VALUES ($1, $2, $3, 'daniel@example.com', ARRAY['Keyboard'], 'member', true)
    `, [userId, fullName, phone]);

    // Helper simulated login query from auth.js
    async function tryLogin(inputIdentifier, inputPass) {
      const identifier = inputIdentifier.trim().toLowerCase();
      const phoneDigits = inputIdentifier.replace(/\D/g, '');

      let queryParams = [identifier];
      let phoneCondition = 'FALSE';
      if (phoneDigits.length >= 7) {
        const coreDigits = phoneDigits.replace(/^(60|0)/, '');
        let normDigits = phoneDigits;
        if (normDigits.startsWith('600')) normDigits = '60' + normDigits.slice(3);
        else if (normDigits.startsWith('60')) { /* already 60 */ }
        else if (normDigits.startsWith('0')) normDigits = '60' + normDigits.slice(1);
        else if (normDigits.startsWith('1')) normDigits = '60' + normDigits;

        const p1 = queryParams.length + 1;
        const p2 = queryParams.length + 2;
        queryParams.push(normDigits, coreDigits);

        phoneCondition = `u.id IN (
          SELECT user_id FROM musicians 
          WHERE user_id IS NOT NULL 
            AND (
              REGEXP_REPLACE(phone, '\\D', '', 'g') = $${p1}
              OR REGEXP_REPLACE(phone, '\\D', '', 'g') LIKE '%' || $${p2}
            )
        )`;
      }

      const res = await dbClient.query(
        `SELECT u.id, u.username, u.name, u.password_hash 
         FROM users u
         WHERE LOWER(u.username) = $1
            OR (u.email IS NOT NULL AND LOWER(u.email) = $1)
            OR LOWER(u.name) = $1
            OR LOWER(u.name) LIKE $1 || ' %'
            OR ${phoneCondition}`,
        queryParams
      );

      for (const candidate of res.rows) {
        if (await bcrypt.compare(inputPass, candidate.password_hash)) {
          return candidate;
        }
      }
      return null;
    }

    // A. Login via explicit Username
    const loginUser = await tryLogin('danielraj', rawPass);
    assert.ok(loginUser, 'Login with username should succeed');
    assert.strictEqual(loginUser.username, 'danielraj');

    // B. Login via First Name
    const loginFirst = await tryLogin('Daniel', rawPass);
    assert.ok(loginFirst, 'Login with first name should succeed');
    assert.strictEqual(loginFirst.name, 'Daniel Raj');

    // C. Login via Full Name
    const loginFull = await tryLogin('Daniel Raj', rawPass);
    assert.ok(loginFull, 'Login with full name should succeed');

    // D. Login via Phone number (domestic format 0163151671)
    const loginPhoneDomestic = await tryLogin('0163151671', rawPass);
    assert.ok(loginPhoneDomestic, 'Login with domestic phone should succeed');

    // E. Login via Phone number (international format +60163151671)
    const loginPhoneIntl = await tryLogin('+60163151671', rawPass);
    assert.ok(loginPhoneIntl, 'Login with +60 intl phone should succeed');

    // F. Wrong password fails
    const loginWrongPass = await tryLogin('danielraj', 'wrongpassword');
    assert.strictEqual(loginWrongPass, null);
  });
});
