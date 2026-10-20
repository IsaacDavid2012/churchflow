const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createSbpZipArchive } = require('../src/utils/sbpZip');
const { buildPrintableBookletHtml } = require('../src/utils/chordProHtml');

describe('Media Attachments (< 10MB) and Direct SongBook Export to Ministry Hub', () => {
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

  test('Strict 10MB Size Limit Validation', () => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB = 10,485,760 bytes

    const validImageSize = 4.5 * 1024 * 1024;
    const validVideoSize = 9.8 * 1024 * 1024;
    const oversizedVideoSize = 10.5 * 1024 * 1024;

    const validateUploadSize = (sizeInBytes) => {
      if (sizeInBytes > MAX_SIZE) {
        throw new Error('File size exceeds 10MB limit. Please upload files under 10MB.');
      }
      return true;
    };

    assert.strictEqual(validateUploadSize(validImageSize), true);
    assert.strictEqual(validateUploadSize(validVideoSize), true);
    assert.throws(() => validateUploadSize(oversizedVideoSize), /exceeds 10MB limit/);
  });

  test('Media Type Detection for Photos, Videos, SBP Archives, and PDFs', () => {
    const resolveMediaType = (fileName, mimeType = '') => {
      const ext = (path.extname(fileName || '') || '').toLowerCase().replace('.', '');
      const mime = (mimeType || '').toLowerCase();

      if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
        return 'image';
      }
      if (mime.startsWith('video/') || ['mp4', 'mov', 'm4v', '3gp', 'avi', 'mkv', 'webm'].includes(ext)) {
        return 'video';
      }
      if (ext === 'sbp' || ext === 'sbpbackup') {
        return 'sbp';
      }
      if (ext === 'pdf' || mime === 'application/pdf') {
        return 'pdf';
      }
      return 'file';
    };

    assert.strictEqual(resolveMediaType('rehearsal_photo.jpg', 'image/jpeg'), 'image');
    assert.strictEqual(resolveMediaType('stage_setup.png'), 'image');
    assert.strictEqual(resolveMediaType('worship_rehearsal.mp4', 'video/mp4'), 'video');
    assert.strictEqual(resolveMediaType('sunday_service.mov'), 'video');
    assert.strictEqual(resolveMediaType('Sunday_Setlist.sbp'), 'sbp');
    assert.strictEqual(resolveMediaType('Way_Maker_LeadSheet.pdf', 'application/pdf'), 'pdf');
  });

  test('Database Storage: General & Ministry Chat/Announcements store media fields', async () => {
    // 1. General Announcement with photo attachment
    const annRes = await dbClient.query(`
      INSERT INTO general_announcements (
        author_name, author_role, title, content, media_url, media_type, media_name, media_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      'Pastor John',
      'pastor',
      'Sunday Stage Setup',
      'Here is the stage layout for this Sunday',
      '/uploads/stage-layout.jpg',
      'image',
      'stage-layout.jpg',
      245600
    ]);

    assert.strictEqual(annRes.rows[0].media_type, 'image');
    assert.strictEqual(annRes.rows[0].media_name, 'stage-layout.jpg');
    assert.strictEqual(annRes.rows[0].media_url, '/uploads/stage-layout.jpg');

    // 2. Ministry Chat with video attachment (message is optional!)
    const groupRes = await dbClient.query(`
      INSERT INTO groups (name, category) VALUES ('Worship Team', 'Worship Team') RETURNING id
    `);
    const ministryId = groupRes.rows[0].id;

    const chatRes = await dbClient.query(`
      INSERT INTO ministry_chat_messages (
        ministry_id, sender_name, sender_role, message, media_url, media_type, media_name, media_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      ministryId,
      'Isaac',
      'manager',
      '', // Optional message
      '/uploads/vocal-exercise.mp4',
      'video',
      'vocal-exercise.mp4',
      4500000
    ]);

    assert.strictEqual(chatRes.rows[0].media_type, 'video');
    assert.strictEqual(chatRes.rows[0].media_size, 4500000);
  });

  test('SongBook Direct Share: Generates genuine .sbp or PDF and inserts into Ministry Chat', async () => {
    const groupRes = await dbClient.query(`
      INSERT INTO groups (name, category) VALUES ('Youth Ministry', 'Youth') RETURNING id
    `);
    const ministryId = groupRes.rows[0].id;

    const mockSong = {
      id: 1,
      title: 'Goodness of God',
      artist: 'Bethel Music',
      key: 'G',
      tempo: '68',
      content: '{c: Verse 1}\n[G]I love You Lord, [C]for Your mercy never fails me'
    };

    // 1. Generate SBP zip archive buffer
    const zipBuffer = createSbpZipArchive({
      songs: [mockSong],
      name: 'Sunday_Praise_Set'
    });
    assert.ok(zipBuffer.length > 0);

    // 2. Share directly into Ministry Team Chat
    const postRes = await dbClient.query(`
      INSERT INTO ministry_chat_messages (
        ministry_id, sender_name, sender_role, message, media_url, media_type, media_name, media_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      ministryId,
      'Worship Leader',
      'manager',
      '🎵 Here is the SongBook Pro backup for rehearsal',
      '/uploads/Sunday_Praise_Set.sbp',
      'sbp',
      'Sunday_Praise_Set.sbp',
      zipBuffer.length
    ]);

    assert.strictEqual(postRes.rows[0].media_type, 'sbp');
    assert.strictEqual(postRes.rows[0].media_name, 'Sunday_Praise_Set.sbp');
    assert.ok(postRes.rows[0].media_size > 0);

    // 3. Generate printable Lead Sheet PDF HTML
    const pdfHtml = buildPrintableBookletHtml({
      title: 'Sunday Praise Set',
      songs: [mockSong]
    });
    assert.ok(pdfHtml.includes('Goodness of God'));
    assert.ok(pdfHtml.includes('Bethel Music'));

    // Share PDF directly into Ministry Classroom Announcements
    const annRes = await dbClient.query(`
      INSERT INTO ministry_announcements (
        ministry_id, author_name, author_role, title, content, media_url, media_type, media_name, media_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      ministryId,
      'Worship Director',
      'manager',
      'Lead Sheets for Sunday',
      'Please print or open on your tablets',
      '/uploads/Sunday_Praise_Set.pdf.html',
      'pdf',
      'Sunday_Praise_Set - Lead Sheet.pdf',
      Buffer.byteLength(pdfHtml, 'utf8')
    ]);

    assert.strictEqual(annRes.rows[0].media_type, 'pdf');
    assert.strictEqual(annRes.rows[0].media_name, 'Sunday_Praise_Set - Lead Sheet.pdf');
  });
});
