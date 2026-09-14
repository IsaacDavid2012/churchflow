const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  console.log('Running database migrations...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  let client = null;
  let retries = 10;
  while (retries > 0) {
    try {
      client = await db.getClient();
      break;
    } catch (err) {
      retries--;
      console.log(`Database not ready yet, retrying in 2s (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (!client) {
    throw new Error('Could not connect to database after multiple retries.');
  }

  try {
    await client.query('BEGIN');
    
    // Enable extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // Ensure dependent tables exist before adding foreign keys
    await client.query(`
      CREATE TABLE IF NOT EXISTS households (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        primary_phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT,
        is_main BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Apply incremental column updates if tables existed previously
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT false;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'musicians') THEN
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS ministry VARCHAR(100) DEFAULT 'Worship Team';
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'member';
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS household_role VARCHAR(50) DEFAULT 'head';
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS birthday DATE;
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS address TEXT;
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS notes TEXT;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positions_template') THEN
          ALTER TABLE positions_template ADD COLUMN IF NOT EXISTS ministry VARCHAR(100) DEFAULT 'Worship Team';
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
          ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'Sunday Morning Celebration';
          ALTER TABLE services ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;
          ALTER TABLE services ADD COLUMN IF NOT EXISTS theme VARCHAR(255);
          ALTER TABLE services ADD COLUMN IF NOT EXISTS deadline_hours_before INT DEFAULT 48;
        END IF;
      END $$;
    `);

    // Run core schema
    await client.query(sql);

    await client.query('COMMIT');
    console.log('Migrations executed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
