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
          ALTER TABLE musicians ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'member';
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positions_template') THEN
          ALTER TABLE positions_template ADD COLUMN IF NOT EXISTS ministry VARCHAR(100) DEFAULT 'Worship Team';
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
          ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'Sunday Morning Celebration';
          ALTER TABLE services ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;
          ALTER TABLE services ADD COLUMN IF NOT EXISTS theme VARCHAR(255);
          ALTER TABLE services ADD COLUMN IF NOT EXISTS deadline_hours_before INT DEFAULT 48;
          ALTER TABLE services ADD COLUMN IF NOT EXISTS position_ids UUID[] DEFAULT NULL;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'groups') THEN
          ALTER TABLE groups ADD COLUMN IF NOT EXISTS leader_phone VARCHAR(50);
        END IF;
      END $$;
    `);

    // Ensure Classroom tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ministry_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        musician_id UUID NOT NULL REFERENCES musicians(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_ministry_musician UNIQUE (ministry_id, musician_id)
      );

      CREATE TABLE IF NOT EXISTS ministry_announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        author_name VARCHAR(255) NOT NULL,
        author_role VARCHAR(50) NOT NULL DEFAULT 'manager',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ministry_chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        sender VARCHAR(50) NOT NULL DEFAULT 'member',
        sender_role VARCHAR(50) NOT NULL DEFAULT 'member',
        sender_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS general_announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        author_name VARCHAR(255) NOT NULL,
        author_role VARCHAR(50) NOT NULL DEFAULT 'pastor',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS general_chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) NOT NULL DEFAULT 'member',
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Run core schema
    await client.query(sql);

    // Seed default church ministries if none active
    const activeGroupsCount = await client.query('SELECT COUNT(*) FROM groups WHERE active = true');
    if (parseInt(activeGroupsCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO groups (name, category, leader_name, leader_phone, meeting_day, meeting_time, location, description, member_count, active)
        VALUES 
          ('Worship Ministry', 'Worship & Music', 'Isaac David', '+60 17-600 1484', 'Thursday', '8:00 PM', 'Main Sanctuary', 'Vocalists, band musicians, and worship leaders leading the congregation into God''s presence each Sunday.', 12, true),
          ('Production & Tech Ministry', 'Production & Tech', 'Alvin & Tech Team', '+60 12-345 6789', 'Sunday', '8:30 AM', 'FOH Sound Booth & Control Center', 'Audio engineering (FOH), live-stream broadcasting, lighting, ProPresenter lyrics, and camera operations.', 6, true),
          ('Media & Communications', 'Media & Tech', 'Media Lead', '+60 16-987 6543', 'Sunday', '9:00 AM', 'Media Suite', 'Photography, videography, social media, and digital church communications.', 5, true),
          ('Hospitality & Ushering', 'Hospitality & Welcome', 'Sharon & Ushering Team', '+60 11-234 5678', 'Sunday', '9:15 AM', 'Church Foyer & Welcome Desk', 'Welcoming newcomers, greeting church members, ushering, and coordinating refreshments.', 8, true),
          ('Prayer & Intercession', 'Prayer & Pastoral Care', 'Prayer Team', '+60 18-765 4321', 'Wednesday', '8:00 PM', 'Prayer Room / Sanctuary', 'Pre-service intercession, weekly prayer encounter meetings, and prophetic altar ministry.', 10, true),
          ('Rock Kids & NextGen', 'NextGen & Children', 'Kids Director', '+60 19-876 5432', 'Sunday', '10:00 AM', 'Kids Sanctuary Room 2', 'Sunday school curriculum, worship, games, and discipleship for toddlers to youth.', 7, true)
        ON CONFLICT DO NOTHING;
      `);
      console.log('Seeded default Church Ministries into groups table.');
    }

    // Sync roles between users and musicians
    await client.query(`
      UPDATE musicians m
      SET role = u.role, user_id = u.id
      FROM users u
      WHERE (m.user_id = u.id OR LOWER(m.email) = LOWER(u.email) OR LOWER(m.name) = LOWER(u.name))
        AND m.role != u.role;
    `);

    // Seed sample announcements if none exist
    const announcementsCount = await client.query('SELECT COUNT(*) FROM ministry_announcements');
    if (parseInt(announcementsCount.rows[0].count, 10) === 0) {
      const worshipGroup = await client.query("SELECT id FROM groups WHERE name ILIKE '%Worship%' LIMIT 1");
      const prodGroup = await client.query("SELECT id FROM groups WHERE name ILIKE '%Production%' LIMIT 1");

      if (worshipGroup.rows.length > 0) {
        await client.query(`
          INSERT INTO ministry_announcements (ministry_id, author_name, author_role, title, content, is_pinned)
          VALUES 
            ($1, 'Isaac David', 'admin', 'Welcome to the Worship Ministry Classroom! 🎵', 'Praise God team! This is our dedicated ministry stream for song charts, setlists, and rehearsal briefings. Thursday rehearsals start promptly at 8:00 PM. Please review your charts beforehand!', true),
            ($1, 'Josh', 'manager', 'Sunday Morning Celebration Songlist Update', 'This Sunday we will be singing: 1. Firm Foundation (He Won''t) [Key D], 2. Goodness of God [Key G], 3. Holy Forever [Key A]. Let''s come with prepared hearts!', false)
        `, [worshipGroup.rows[0].id]);
      }

      if (prodGroup.rows.length > 0) {
        await client.query(`
          INSERT INTO ministry_announcements (ministry_id, author_name, author_role, title, content, is_pinned)
          VALUES 
            ($1, 'Alvin & Tech Team', 'manager', 'FOH Sound & OBS Livestream Checklist', 'Team, please ensure all wireless mic battery levels are checked at 8:30 AM before pre-service prayer. The new Behringer X32 scene has been saved under "Sunday Main".', true)
        `, [prodGroup.rows[0].id]);
      }
      console.log('Seeded initial Ministry Classroom announcements.');
    }

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
