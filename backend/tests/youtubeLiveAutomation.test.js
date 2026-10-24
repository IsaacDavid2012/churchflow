const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const {
  parseYouTubeVideoId,
  syncLiveStreamJob,
  manualTriggerGoLive,
  manualEndLive,
} = require('../src/services/youtubeLiveService');
const fcmService = require('../src/services/fcmService');

describe('YouTube Live Stream Detection, Auto-Posting & Member Notifications', () => {
  let dbClient;
  let adminUser;

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

    // Seed church profile
    await dbClient.query(`
      INSERT INTO church_profile (
        name, tagline, youtube_channel_id, youtube_channel_handle, youtube_auto_post_live
      ) VALUES (
        'Jesus My Rock Church', 'Solid Rock', 'UCkgenI4IULye4vDjrGRo-aA', '@jesusmyrockchurchkl', true
      )
    `);

    // Seed admin user
    const adminRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('pastor_joseph', 'hash', 'admin', 'Pastor Joseph', 'joseph@jesusmyrock.org')
      RETURNING id, username, role, name
    `);
    adminUser = adminRes.rows[0];

    // Seed a member with a registered mobile device token
    const memberRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('member_mary', 'hash', 'member', 'Mary Tan', 'mary@gmail.com')
      RETURNING id
    `);
    await dbClient.query(`
      INSERT INTO device_tokens (user_id, token, platform)
      VALUES ($1, 'fcm_token_mary_android_12345', 'android')
    `, [memberRes.rows[0].id]);
  });

  describe('1. YouTube Video ID Parsing', () => {
    test('Correctly extracts ID from standard watch URL', () => {
      const id = parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.strictEqual(id, 'dQw4w9WgXcQ');
    });

    test('Correctly extracts ID from short youtu.be URL', () => {
      const id = parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ');
      assert.strictEqual(id, 'dQw4w9WgXcQ');
    });

    test('Correctly extracts ID from live URL format', () => {
      const id = parseYouTubeVideoId('https://www.youtube.com/live/abcdef12345?feature=share');
      assert.strictEqual(id, 'abcdef12345');
    });

    test('Correctly extracts ID from embed URL format', () => {
      const id = parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ');
      assert.strictEqual(id, 'dQw4w9WgXcQ');
    });

    test('Accepts raw 11-char video ID directly', () => {
      const id = parseYouTubeVideoId('dQw4w9WgXcQ');
      assert.strictEqual(id, 'dQw4w9WgXcQ');
    });

    test('Returns null for invalid URLs or strings', () => {
      assert.strictEqual(parseYouTubeVideoId(''), null);
      assert.strictEqual(parseYouTubeVideoId(null), null);
      assert.strictEqual(parseYouTubeVideoId('https://google.com'), null);
      assert.strictEqual(parseYouTubeVideoId('https://youtube.com/@jesusmyrockchurchkl'), null);
    });
  });

  describe('2. Manual Go Live & Feed Auto-Posting', () => {
    test('manualTriggerGoLive pins post authored strictly by "Jesus My Rock"', async () => {
      const result = await manualTriggerGoLive(dbClient, {
        urlOrVideoId: 'https://www.youtube.com/watch?v=LIVESVC2026',
        customTitle: 'Sunday Worship Service & Prophetic Word',
        dbUser: adminUser,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.videoId, 'LIVESVC2026');

      // Verify post in database
      const postRes = await dbClient.query('SELECT * FROM feed_posts WHERE media_name = $1', ['LIVESVC2026']);
      assert.strictEqual(postRes.rows.length, 1);
      const post = postRes.rows[0];

      // CRITICAL REQUIREMENT: Author must strictly be 'Jesus My Rock'
      assert.strictEqual(post.author_name, 'Jesus My Rock');
      assert.strictEqual(post.post_type, 'live_stream');
      assert.strictEqual(post.media_type, 'youtube_live');
      assert.strictEqual(post.is_pinned, true);
      assert.match(post.title, /Sunday Worship Service/);
      assert.strictEqual(post.destination, 'home');

      // Verify church_profile updated
      const profileRes = await dbClient.query('SELECT * FROM church_profile LIMIT 1');
      assert.strictEqual(profileRes.rows[0].youtube_is_live, true);
      assert.strictEqual(profileRes.rows[0].youtube_current_live_video_id, 'LIVESVC2026');
    });

    test('manualTriggerGoLive called again for existing video updates post rather than duplicate', async () => {
      await manualTriggerGoLive(dbClient, {
        urlOrVideoId: 'LIVESVC2026',
        customTitle: 'First Broadcast',
        dbUser: adminUser,
      });

      // Second trigger with same video ID
      await manualTriggerGoLive(dbClient, {
        urlOrVideoId: 'LIVESVC2026',
        customTitle: 'Broadcast Reconnect',
        dbUser: adminUser,
      });

      const postRes = await dbClient.query('SELECT * FROM feed_posts WHERE media_name = $1', ['LIVESVC2026']);
      assert.strictEqual(postRes.rows.length, 1, 'Should not duplicate live feed post');
      assert.strictEqual(postRes.rows[0].is_pinned, true);
    });

    test('manualEndLive unpins post but keeps replay available in feed', async () => {
      await manualTriggerGoLive(dbClient, {
        urlOrVideoId: 'LIVESVC2026',
        customTitle: 'Sunday Service',
        dbUser: adminUser,
      });

      const endResult = await manualEndLive(dbClient);
      assert.strictEqual(endResult.success, true);

      // Verify church_profile is offline
      const profileRes = await dbClient.query('SELECT * FROM church_profile LIMIT 1');
      assert.strictEqual(profileRes.rows[0].youtube_is_live, false);
      assert.strictEqual(profileRes.rows[0].youtube_current_live_video_id, null);

      // Post should still exist for church members to watch replay, but unpinned
      const postRes = await dbClient.query('SELECT * FROM feed_posts WHERE media_name = $1', ['LIVESVC2026']);
      assert.strictEqual(postRes.rows.length, 1);
      assert.strictEqual(postRes.rows[0].is_pinned, false);
    });
  });

  describe('3. Phone Notification (FCM) Integration', () => {
    test('notifyChurchLiveStream logs notification and targets device tokens', async () => {
      const fcmResult = await fcmService.notifyChurchLiveStream(dbClient, {
        videoId: 'LIVESVC2026',
        title: 'Miracle Sunday Live',
      });

      assert.strictEqual(fcmResult.success, true);
      assert.strictEqual(fcmResult.recipientCount, 1);

      // Verify audit log entry
      const logRes = await dbClient.query(
        "SELECT * FROM notifications_log WHERE type = 'youtube_live_broadcast' ORDER BY created_at DESC LIMIT 1"
      );
      assert.strictEqual(logRes.rows.length, 1);
      assert.match(logRes.rows[0].message, /Miracle Sunday Live/);
      const rawMeta = logRes.rows[0].metadata;
      const metadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      assert.strictEqual(metadata.videoId, 'LIVESVC2026');
    });
  });

  describe('4. Comments & Interactive Engagement on Live Posts', () => {
    test('Registered church members can post live comments on the live stream post', async () => {
      // Create live post
      const liveRes = await manualTriggerGoLive(dbClient, {
        urlOrVideoId: 'LIVESVC2026',
        customTitle: 'Sunday Service',
        dbUser: adminUser,
      });

      const postId = liveRes.post.id;

      // Add a live comment from a member
      const commentRes = await dbClient.query(`
        INSERT INTO feed_post_comments (post_id, user_id, user_name, user_role, content)
        VALUES ($1, $2, 'Pastor Joseph', 'admin', 'Hallelujah! Watching with family from home!')
        RETURNING *
      `, [postId, adminUser.id]);

      assert.strictEqual(commentRes.rows.length, 1);
      assert.strictEqual(commentRes.rows[0].post_id, postId);
      assert.strictEqual(commentRes.rows[0].content, 'Hallelujah! Watching with family from home!');

      // Verify comments query
      const allComments = await dbClient.query(
        'SELECT * FROM feed_post_comments WHERE post_id = $1 ORDER BY created_at ASC',
        [postId]
      );
      assert.strictEqual(allComments.rows.length, 1);
    });
  });
});
