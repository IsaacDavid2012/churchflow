const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding comprehensive Jesus My Rock Church dataset (Planning Center Core)...');
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Clean tables for fresh seed
    await client.query(`
      TRUNCATE 
        service_plan_items,
        assignments,
        availability,
        notifications_log,
        services,
        songs,
        groups,
        musicians,
        households,
        positions_template,
        ministries,
        campuses,
        church_profile,
        users 
      CASCADE;
    `);

    // 1. Seed Church Profile
    await client.query(`
      INSERT INTO church_profile (name, tagline, lead_pastor, email, phone, address, website, primary_color)
      VALUES (
        'Jesus My Rock Church',
        'Standing Firm on Christ the Solid Rock',
        'Pastor David & Sarah Mitchell',
        'office@jesusmyrock.org',
        '+1 (555) 762-5762',
        '1200 Rock Boulevard, Suite 100, Austin, TX',
        'https://serve.creativeclicks.art',
        '#4f46e5'
      )
    `);

    // 2. Seed Campuses
    const campusesData = [
      { name: 'Main Sanctuary (Downtown)', address: '1200 Rock Boulevard, Austin, TX', is_main: true },
      { name: 'North Campus', address: '4500 Stone Creek Pkwy, Round Rock, TX', is_main: false },
      { name: 'Online & Broadcast Campus', address: 'online.jesusmyrock.org', is_main: false },
    ];

    const campusMap = {};
    for (const c of campusesData) {
      const res = await client.query(`
        INSERT INTO campuses (name, address, is_main)
        VALUES ($1, $2, $3)
        RETURNING id, name
      `, [c.name, c.address, c.is_main]);
      campusMap[c.name] = res.rows[0].id;
    }

    // 3. Seed Ministries
    const ministriesData = [
      { name: 'Worship Team', description: 'Musicians, vocalists, and worship leaders leading prophetic praise.', icon: 'Music', color: 'indigo', sort_order: 1 },
      { name: 'Production & Tech', description: 'Audio engineers, livestream operators, ProPresenter slides, and lighting.', icon: 'Video', color: 'blue', sort_order: 2 },
      { name: 'Ushers & Greeters', description: 'Welcoming guests, seating congregation, offering collection, and communion.', icon: 'HeartHandshake', color: 'emerald', sort_order: 3 },
      { name: 'Kids Rock Ministry', description: 'Nursery, toddlers, and elementary age discipleship in a safe space.', icon: 'Baby', color: 'amber', sort_order: 4 },
      { name: 'Prayer & Altar Team', description: 'Intercessory prayer and altar ministry during response times.', icon: 'Flame', color: 'rose', sort_order: 5 },
    ];

    for (const m of ministriesData) {
      await client.query(`
        INSERT INTO ministries (name, description, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `, [m.name, m.description, m.icon, m.color, m.sort_order]);
    }

    // 4. Seed Main Admin User from Environment Variables (.env)
    const adminUser = process.env.ADMIN_USERNAME || 'Isaac';
    const adminPass = process.env.ADMIN_PASSWORD || 'IDC-201Two';
    const adminEmail = process.env.ADMIN_EMAIL || 'isaac@jesusmyrock.org';
    const isaacHash = await bcrypt.hash(adminPass, 10);

    await client.query(`
      INSERT INTO users (username, email, password_hash, role, name, status)
      VALUES 
        ($1, $2, $3, 'admin', $1, 'active'),
        (LOWER($1), $2, $3, 'admin', $1, 'active')
      ON CONFLICT (username) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        name = EXCLUDED.name,
        status = 'active'
    `, [adminUser, adminEmail, isaacHash]);

    // 5. Seed Positions for Jesus My Rock Worship & Sound Teams
    const defaultPositions = [
      { name: 'Worship Leader', ministry: 'Worship Team', sort_order: 1 },
      { name: 'Guitar', ministry: 'Worship Team', sort_order: 2 },
      { name: 'Second Guitar', ministry: 'Worship Team', sort_order: 3 },
      { name: 'Bass', ministry: 'Worship Team', sort_order: 4 },
      { name: 'Lead Keyboard', ministry: 'Worship Team', sort_order: 5 },
      { name: 'Second Keyboard', ministry: 'Worship Team', sort_order: 6 },
      { name: 'Drums', ministry: 'Worship Team', sort_order: 7 },
      { name: 'Vocals', ministry: 'Worship Team', sort_order: 8 },
      { name: 'Sound (FOH)', ministry: 'Production & Tech', sort_order: 9 },
    ];

    const posMap = {};
    for (const pos of defaultPositions) {
      const pRes = await client.query(`
        INSERT INTO positions_template (name, ministry, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET 
          sort_order = EXCLUDED.sort_order,
          ministry = EXCLUDED.ministry
        RETURNING id, name
      `, [pos.name, pos.ministry, pos.sort_order]);
      posMap[pos.name] = pRes.rows[0].id;
    }

    // 6. Seed Real Jesus My Rock Church Worship & Sound Team Members
    const peopleList = [
      // Worship Team & Production
      { name: 'Isaac', email: 'isaac@jesusmyrock.org', phone: '+1 (555) 762-0101', roles: ['Drums', 'Bass', 'Keyboard', 'Sound', 'Sound (FOH)', 'Production'], ministry: 'Worship Team', status: 'leader' },
      { name: 'Josh', email: 'josh@jesusmyrock.org', phone: '+1 (555) 762-0102', roles: ['Guitar', 'Worship Leader', 'Vocals', 'Backup', 'Bass'], ministry: 'Worship Team', status: 'leader' },
      { name: 'Shayne', email: 'shayne@jesusmyrock.org', phone: '+1 (555) 762-0103', roles: ['Drums', 'Guitar', 'Vocals', 'Backup'], ministry: 'Worship Team', status: 'member' },
      { name: 'Risshaal', email: 'risshaal@jesusmyrock.org', phone: '+1 (555) 762-0104', roles: ['Worship Leader', 'Vocals', 'Backup', 'Keyboard', 'Second Keyboard'], ministry: 'Worship Team', status: 'leader' },
      { name: 'Alvin Anne', email: 'alvin@jesusmyrock.org', phone: '+1 (555) 762-0105', roles: ['Bass', 'Guitar', 'Backup Guitar'], ministry: 'Worship Team', status: 'member' },
      { name: 'Sharon', email: 'sharon@jesusmyrock.org', phone: '+1 (555) 762-0106', roles: ['Keyboard', 'Lead Keyboard'], ministry: 'Worship Team', status: 'member' },
      { name: 'Alisha', email: 'alisha@jesusmyrock.org', phone: '+1 (555) 762-0107', roles: ['Worship Leader', 'Vocals', 'Backup'], ministry: 'Worship Team', status: 'leader' },
      { name: 'Ashley', email: 'ashley@jesusmyrock.org', phone: '+1 (555) 762-0108', roles: ['Keyboard', 'Lead Keyboard', 'Worship Leader', 'Vocals', 'Backup'], ministry: 'Worship Team', status: 'leader' },
      { name: 'Cynthia', email: 'cynthia@jesusmyrock.org', phone: '+1 (555) 762-0109', roles: ['Bass', 'Vocals', 'Backup', 'Keyboard', 'Second Keyboard'], ministry: 'Worship Team', status: 'member' },
      { name: 'Esther', email: 'esther@jesusmyrock.org', phone: '+1 (555) 762-0110', roles: ['Vocals', 'Backup', 'Keyboard', 'Second Keyboard'], ministry: 'Worship Team', status: 'member' },
      { name: 'Joanna', email: 'joanna@jesusmyrock.org', phone: '+1 (555) 762-0111', roles: ['Vocals', 'Backup', 'Keyboard', 'Second Keyboard'], ministry: 'Worship Team', status: 'member' },
      { name: 'Joel', email: 'joel@jesusmyrock.org', phone: '+1 (555) 762-0112', roles: ['Keyboard', 'Second Keyboard'], ministry: 'Worship Team', status: 'member' },
      { name: 'Yovaan', email: 'yovaan@jesusmyrock.org', phone: '+1 (555) 762-0113', roles: ['Guitar', 'Second Guitar'], ministry: 'Worship Team', status: 'member' },

      // Sound Team YOF / Production
      { name: 'Tushaal', email: 'tushaal@jesusmyrock.org', phone: '+1 (555) 762-0114', roles: ['Sound', 'Sound (FOH)', 'Production'], ministry: 'Production & Tech', status: 'member' },
      { name: 'Daniel Anne', email: 'daniel.a@jesusmyrock.org', phone: '+1 (555) 762-0115', roles: ['Sound', 'Sound (FOH)', 'Production', 'Worship'], ministry: 'Production & Tech', status: 'member' },
    ];

    const peopleMap = {};
    for (const p of peopleList) {
      const res = await client.query(`
        INSERT INTO musicians (name, email, phone, roles, ministry, status, active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, name
      `, [p.name, p.email, p.phone, p.roles, p.ministry, p.status]);
      peopleMap[p.name] = res.rows[0].id;
    }

    // 8. Seed Planning Center Songs Library
    const songsData = [
      {
        title: 'Goodness of God',
        artist: 'Bethel Music / Jenn Johnson',
        default_key: 'Ab',
        bpm: 69,
        time_signature: '4/4',
        ccli_number: '7117726',
        lyrics_preview: 'I love You, Lord, for Your mercy never fails me / All my days, I\'ve been held in Your hands...',
        chart_url: 'https://praisecharts.com/goodness-of-god',
        youtube_url: 'https://www.youtube.com/watch?v=-f4MUKEWRTQ'
      },
      {
        title: 'Firm Foundation (He Won\'t)',
        artist: 'Cody Carnes / Maverick City',
        default_key: 'Bb',
        bpm: 75,
        time_signature: '6/8',
        ccli_number: '7188203',
        lyrics_preview: 'Christ is my firm foundation, the rock on which I stand / When everything around me is shaken, I\'ve never been more glad...',
        chart_url: 'https://praisecharts.com/firm-foundation',
        youtube_url: 'https://www.youtube.com/watch?v=x3gKG_u_Vfg'
      },
      {
        title: 'Way Maker',
        artist: 'Sinach / Leeland',
        default_key: 'E',
        bpm: 68,
        time_signature: '4/4',
        ccli_number: '7115744',
        lyrics_preview: 'You are here, moving in our midst, I worship You, I worship You / You are Way Maker, Miracle Worker, Promise Keeper...',
        chart_url: 'https://praisecharts.com/way-maker',
        youtube_url: 'https://www.youtube.com/watch?v=iJCV_2H9xD0'
      },
      {
        title: 'Graves Into Gardens',
        artist: 'Elevation Worship / Brandon Lake',
        default_key: 'B',
        bpm: 70,
        time_signature: '6/8',
        ccli_number: '7138219',
        lyrics_preview: 'I searched the world, but it couldn\'t fill me / A man of empty praise and treasures that fade...',
        chart_url: 'https://praisecharts.com/graves-into-gardens',
        youtube_url: 'https://www.youtube.com/watch?v=KwX1f2gYKZ4'
      },
      {
        title: 'Gratitude',
        artist: 'Brandon Lake',
        default_key: 'B',
        bpm: 78,
        time_signature: '6/8',
        ccli_number: '7158414',
        lyrics_preview: 'All my words fall short, I got nothing new / How could I express all my gratitude...',
        chart_url: 'https://praisecharts.com/gratitude',
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      },
      {
        title: 'Build My Life',
        artist: 'Housefires / Pat Barrett',
        default_key: 'G',
        bpm: 68,
        time_signature: '4/4',
        ccli_number: '7070345',
        lyrics_preview: 'Worthy of every song we could ever sing / Worthy of all the praise we could ever bring...',
        chart_url: 'https://praisecharts.com/build-my-life',
        youtube_url: 'https://www.youtube.com/watch?v=Z32HiSuUY8o'
      },
      {
        title: 'The Blessing',
        artist: 'Kari Jobe, Cody Carnes, Elevation',
        default_key: 'A',
        bpm: 70,
        time_signature: '4/4',
        ccli_number: '7147007',
        lyrics_preview: 'The Lord bless you and keep you / Make His face shine upon you and be gracious to you...',
        chart_url: 'https://praisecharts.com/the-blessing',
        youtube_url: 'https://www.youtube.com/watch?v=Zp6aygmvzM4'
      }
    ];

    const songMap = {};
    for (const s of songsData) {
      const sRes = await client.query(`
        INSERT INTO songs (title, artist, default_key, bpm, time_signature, ccli_number, lyrics_preview, chart_url, youtube_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title
      `, [s.title, s.artist, s.default_key, s.bpm, s.time_signature, s.ccli_number, s.lyrics_preview, s.chart_url, s.youtube_url]);
      songMap[s.title] = sRes.rows[0].id;
    }

    // 9. Seed Small Groups (Life Groups)
    const groupsData = [
      { name: 'Rock Solid Men\'s Fellowship', category: 'Men\'s Group', leader_name: 'David Mitchell', leader_id: peopleMap['Pastor David Mitchell'], meeting_day: 'Tuesday', meeting_time: '6:30 AM', location: 'Fellowship Hall Room 101', description: 'Weekly prayer, Bible study, and brotherhood for men.', member_count: 18 },
      { name: 'Grace & Truth Women\'s Circle', category: 'Women\'s Group', leader_name: 'Sarah Mitchell', leader_id: peopleMap['Sarah Mitchell'], meeting_day: 'Thursday', meeting_time: '7:00 PM', location: 'Sanctuary Lounge', description: 'Deep dive into spiritual disciplines and sisterhood.', member_count: 24 },
      { name: 'Young Adults & University (Ignite)', category: 'Young Adults', leader_name: 'James Wilson', leader_id: peopleMap['James Wilson'], meeting_day: 'Friday', meeting_time: '7:30 PM', location: 'Youth Center & Cafe', description: 'Community, worship, and discipleship for 18-30s.', member_count: 32 },
      { name: 'North Austin Community Life Group', category: 'Couples & Families', leader_name: 'John Doe', leader_id: peopleMap['John Doe'], meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'North Campus Room 204', description: 'Family dinner, fellowship, and sermon discussion.', member_count: 15 },
    ];

    for (const g of groupsData) {
      await client.query(`
        INSERT INTO groups (name, category, leader_name, leader_id, meeting_day, meeting_time, location, description, member_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [g.name, g.category, g.leader_name, g.leader_id, g.meeting_day, g.meeting_time, g.location, g.description, g.member_count]);
    }

    // 10. Seed Upcoming & Past Services
    const upcomingServiceToken = 'jesus-my-rock-sun-10am';
    const mainCampusId = campusMap['Main Sanctuary (Downtown)'];

    // Upcoming Sunday
    const sRes = await client.query(`
      INSERT INTO services (service_date, service_time, service_type, campus_id, theme, token, worship_leader_id, notes, status, deadline_hours_before)
      VALUES (
        '2026-09-20',
        '10:00 AM',
        'Sunday Morning Celebration',
        $1,
        'Firm Foundation: Standing Unshaken in Christ',
        $2,
        $3,
        'Joint campus service. Communion preparation after praise set. Baptism following service.',
        'availability_open',
        48
      )
      RETURNING id
    `, [mainCampusId, upcomingServiceToken, peopleMap['Josh']]);

    const upcomingServiceId = sRes.rows[0].id;

    // Seed Order of Service / Run Sheet for upcoming service
    const planItems = [
      { order: 1, type: 'media', title: '5-Minute Countdown & Intro Video', duration: 5, leader: 'Sound & Media', notes: 'Dim sanctuary house lights at 2 min mark.' },
      { order: 2, type: 'song', title: 'Firm Foundation (He Won\'t)', duration: 6, leader: 'Josh', song_id: songMap['Firm Foundation (He Won\'t)'], song_key: 'Bb', notes: 'Opener with high energy, transition straight to song 2.' },
      { order: 3, type: 'song', title: 'Graves Into Gardens', duration: 7, leader: 'Alisha', song_id: songMap['Graves Into Gardens'], song_key: 'B', notes: 'Bridge builds into spontaneous praise.' },
      { order: 4, type: 'song', title: 'Goodness of God', duration: 8, leader: 'Josh', song_id: songMap['Goodness of God'], song_key: 'Ab', notes: 'Intimate acoustic transition.' },
      { order: 5, type: 'prayer', title: 'Pastoral Welcome & Church Announcements', duration: 5, leader: 'Pastor', notes: 'Highlight upcoming Life Groups launch.' },
      { order: 6, type: 'offering', title: 'Tithes, Offerings & Praise Report', duration: 5, leader: 'Usher Team', notes: 'Soft pads on keys during prayer.' },
      { order: 7, type: 'sermon', title: 'Sermon: Built Upon The Rock (Matt 7:24)', duration: 35, leader: 'Pastor David Mitchell', notes: 'Scripture slides 1-14 queued on ProPresenter.' },
      { order: 8, type: 'song', title: 'Build My Life (Ministry / Altar Response)', duration: 8, leader: 'Josh', song_id: songMap['Build My Life'], song_key: 'G', notes: 'Altar team available for personal ministry.' },
      { order: 9, type: 'item', title: 'Benediction & Dismissal', duration: 2, leader: 'Pastor David Mitchell', notes: 'Fellowship coffee in lobby.' },
    ];

    for (const item of planItems) {
      await client.query(`
        INSERT INTO service_plan_items (service_id, item_order, item_type, title, duration_minutes, leader, song_id, song_key, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [upcomingServiceId, item.order, item.type, item.title, item.duration, item.leader, item.song_id || null, item.song_key || null, item.notes]);
    }

    // Seed initial assignments for upcoming service (1 person per position, no backup)
    if (posMap['Drums'] && peopleMap['Isaac']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Drums'], peopleMap['Isaac']]);
    if (posMap['Bass'] && peopleMap['Alvin Anne']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Bass'], peopleMap['Alvin Anne']]);
    if (posMap['Lead Keyboard'] && peopleMap['Sharon']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Lead Keyboard'], peopleMap['Sharon']]);
    if (posMap['Guitar'] && peopleMap['Yovaan']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Guitar'], peopleMap['Yovaan']]);
    if (posMap['Vocals'] && peopleMap['Alisha']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Vocals'], peopleMap['Alisha']]);
    if (posMap['Sound (FOH)'] && peopleMap['Tushaal']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'pending') ON CONFLICT DO NOTHING", [upcomingServiceId, posMap['Sound (FOH)'], peopleMap['Tushaal']]);

    // 11. Seed Historical Confirmed Services
    const pastServices = [
      { date: '2026-07-05', note: 'Sunday Celebration - Grace Abounding' },
      { date: '2026-08-02', note: 'Sunday Celebration - The Power of Faith' },
      { date: '2026-08-23', note: 'Sunday Celebration - Walking in Victory' },
      { date: '2026-09-06', note: 'Sunday Celebration - Living Hope' },
    ];

    for (const ps of pastServices) {
      const pastRes = await client.query(`
        INSERT INTO services (service_date, service_time, service_type, campus_id, token, notes, status, deadline_hours_before)
        VALUES ($1, '10:00 AM', 'Sunday Morning Celebration', $2, $3, $4, 'confirmed', 48)
        RETURNING id
      `, [ps.date, mainCampusId, uuidv4(), ps.note]);

      const pId = pastRes.rows[0].id;
      if (ps.date === '2026-07-05') {
        if (peopleMap['Isaac'] && posMap['Drums']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed') ON CONFLICT DO NOTHING", [pId, posMap['Drums'], peopleMap['Isaac']]);
        if (peopleMap['Alvin Anne'] && posMap['Bass']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed') ON CONFLICT DO NOTHING", [pId, posMap['Bass'], peopleMap['Alvin Anne']]);
      } else if (ps.date === '2026-08-02') {
        if (peopleMap['Shayne'] && posMap['Drums']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed') ON CONFLICT DO NOTHING", [pId, posMap['Drums'], peopleMap['Shayne']]);
        if (peopleMap['Sharon'] && posMap['Lead Keyboard']) await client.query("INSERT INTO assignments (service_id, position_id, musician_id, role_slot, status) VALUES ($1, $2, $3, 'primary', 'confirmed') ON CONFLICT DO NOTHING", [pId, posMap['Lead Keyboard'], peopleMap['Sharon']]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seeded complete Jesus My Rock Church dataset: Profile, Campuses, Ministries, People, Songs, Service Plans, and Groups!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
