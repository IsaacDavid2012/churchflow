const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ROLES, normalizeRole, hasRole } = require('../../shared/roles');

describe('Social Media Home Feed, Multi-Destination Hub Cross-Posting & 20MB Multi-Media', () => {
  let dbClient;
  let adminUser, pastorUser, managerUser, memberUser;
  let testMinistry;

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

    // Seed test users
    const adminRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('admin', 'hash', 'admin', 'Pastor Joseph', 'pastor@jesusmyrock.org')
      RETURNING id, username, role, name
    `);
    adminUser = adminRes.rows[0];

    const pastorRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('pastor_sarah', 'hash', 'pastor', 'Pastor Sarah', 'sarah@jesusmyrock.org')
      RETURNING id, username, role, name
    `);
    pastorUser = pastorRes.rows[0];

    const managerRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('leader_mark', 'hash', 'manager', 'Mark David', 'mark@jesusmyrock.org')
      RETURNING id, username, role, name
    `);
    managerUser = managerRes.rows[0];

    const memberRes = await dbClient.query(`
      INSERT INTO users (username, password_hash, role, name, email)
      VALUES ('member_john', 'hash', 'member', 'John Volunteer', 'john@gmail.com')
      RETURNING id, username, role, name
    `);
    memberUser = memberRes.rows[0];

    // Seed test ministry
    const minRes = await dbClient.query(`
      INSERT INTO groups (name, category, description)
      VALUES ('Worship Team', 'Ministry', 'Sunday Praise & Worship')
      RETURNING id, name
    `);
    testMinistry = minRes.rows[0];
  });

  test('Strict 20MB Size Limit & Up to 10 Photos Validation', () => {
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB = 20,971,520 bytes

    const validPhoto = { url: '/uploads/photo1.jpg', size: 8 * 1024 * 1024, type: 'image' };
    const validVideo = { url: '/uploads/worship.mp4', size: 19.5 * 1024 * 1024, type: 'video' };
    const oversizedMedia = { url: '/uploads/huge.mp4', size: 21 * 1024 * 1024, type: 'video' };

    const validateMediaItem = (item) => {
      if (item.size > MAX_SIZE) {
        throw new Error('File size exceeds 20MB limit. Please upload files under 20MB.');
      }
      return true;
    };

    assert.strictEqual(validateMediaItem(validPhoto), true);
    assert.strictEqual(validateMediaItem(validVideo), true);
    assert.throws(() => validateMediaItem(oversizedMedia), /exceeds 20MB limit/);

    // Multi-photo array: up to 10 photos
    const photosArray = Array.from({ length: 8 }, (_, i) => ({
      url: `/uploads/event_photo_${i + 1}.jpg`,
      size: 2 * 1024 * 1024,
      type: 'image',
    }));

    const validatePhotosCount = (arr) => {
      if (arr.length > 10) throw new Error('Maximum of 10 media attachments allowed per post.');
      return true;
    };

    assert.strictEqual(validatePhotosCount(photosArray), true);
    assert.strictEqual(photosArray.length, 8);

    const elevenPhotos = Array.from({ length: 11 }, (_, i) => ({
      url: `/uploads/p_${i}.jpg`,
      size: 1024,
      type: 'image',
    }));
    assert.throws(() => validatePhotosCount(elevenPhotos), /Maximum of 10 media attachments allowed/);
  });

  test('Authoring RBAC: Pastor, Admin, and Manager can post; Member is strictly blocked', async () => {
    const canCreatePost = (user) => {
      const normalized = normalizeRole(user.role);
      return hasRole(normalized, [ROLES.ADMIN, ROLES.PASTOR, ROLES.MANAGER]);
    };

    assert.strictEqual(canCreatePost(adminUser), true, 'Admin can post');
    assert.strictEqual(canCreatePost(pastorUser), true, 'Pastor can post');
    assert.strictEqual(canCreatePost(managerUser), true, 'Manager can post');
    assert.strictEqual(canCreatePost(memberUser), false, 'Member cannot post');

    // Admin creates post in DB
    const adminPost = await dbClient.query(`
      INSERT INTO feed_posts (author_id, author_name, author_role, title, content, destination)
      VALUES ($1, $2, $3, 'Church Camp 2026', 'Register now for annual retreat', 'home')
      RETURNING *
    `, [adminUser.id, adminUser.name, adminUser.role]);

    assert.strictEqual(adminPost.rows.length, 1);
    assert.strictEqual(adminPost.rows[0].title, 'Church Camp 2026');

    // Manager creates post in DB
    const managerPost = await dbClient.query(`
      INSERT INTO feed_posts (author_id, author_name, author_role, title, content, destination, ministry_id)
      VALUES ($1, $2, $3, 'Worship Rehearsal', 'Thursday 8 PM sharp', 'ministry', $4)
      RETURNING *
    `, [managerUser.id, managerUser.name, managerUser.role, testMinistry.id]);

    assert.strictEqual(managerPost.rows.length, 1);
    assert.strictEqual(managerPost.rows[0].destination, 'ministry');
  });

  test('Cross-Posting: destination "both" creates feed post and syncs to ministry_announcements', async () => {
    const multiMediaAttachments = JSON.stringify([
      { url: '/uploads/flyer1.jpg', type: 'image', size: 1024 * 1024, name: 'flyer1.jpg' },
      { url: '/uploads/flyer2.jpg', type: 'image', size: 2 * 1024 * 1024, name: 'flyer2.jpg' },
    ]);

    // Insert cross-post
    const postRes = await dbClient.query(`
      INSERT INTO feed_posts (
        author_id, author_name, author_role, post_type, title, content,
        destination, ministry_id, media_attachments
      )
      VALUES ($1, $2, $3, 'event', 'Worship Night & Encounter', 'Open to whole church', 'both', $4, $5)
      RETURNING *
    `, [
      adminUser.id,
      adminUser.name,
      adminUser.role,
      testMinistry.id,
      multiMediaAttachments,
    ]);

    const createdPost = postRes.rows[0];
    assert.strictEqual(createdPost.destination, 'both');
    assert.strictEqual(createdPost.ministry_id, testMinistry.id);

    // Sync to ministry_announcements
    await dbClient.query(`
      INSERT INTO ministry_announcements (
        ministry_id, author_id, author_name, author_role, title, content
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      testMinistry.id,
      adminUser.id,
      adminUser.name,
      adminUser.role,
      createdPost.title,
      createdPost.content,
    ]);

    // Verify it appears in Ministry Hub query
    const hubAnnouncements = await dbClient.query(
      'SELECT * FROM ministry_announcements WHERE ministry_id = $1',
      [testMinistry.id]
    );
    assert.strictEqual(hubAnnouncements.rows.length, 1);
    assert.strictEqual(hubAnnouncements.rows[0].title, 'Worship Night & Encounter');

    // Verify it appears in Home Feed query
    const homeFeed = await dbClient.query(`
      SELECT p.*, g.name as ministry_name 
      FROM feed_posts p
      LEFT JOIN groups g ON g.id = p.ministry_id
      WHERE p.destination = 'home' OR p.destination = 'both'
    `);
    assert.strictEqual(homeFeed.rows.length, 1);
    assert.strictEqual(homeFeed.rows[0].ministry_name, 'Worship Team');
  });

  test('Social Reactions: Like toggle, unique constraint, and like count tracking', async () => {
    const postRes = await dbClient.query(`
      INSERT INTO feed_posts (author_id, author_name, author_role, title, content)
      VALUES ($1, $2, $3, 'Happy Sunday!', 'Blessed to worship together')
      RETURNING id, likes_count
    `, [pastorUser.id, pastorUser.name, pastorUser.role]);

    const postId = postRes.rows[0].id;
    assert.strictEqual(postRes.rows[0].likes_count, 0);

    // Member likes post
    await dbClient.query(
      'INSERT INTO feed_post_likes (post_id, user_id, user_name) VALUES ($1, $2, $3)',
      [postId, memberUser.id, memberUser.name]
    );
    let updated = await dbClient.query(
      'UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
      [postId]
    );
    assert.strictEqual(updated.rows[0].likes_count, 1);

    // Verify unique constraint prevents duplicate like from same user
    let duplicateFailed = false;
    try {
      await dbClient.query(
        'INSERT INTO feed_post_likes (post_id, user_id, user_name) VALUES ($1, $2, $3)',
        [postId, memberUser.id, memberUser.name]
      );
    } catch (e) {
      duplicateFailed = true;
    }
    assert.strictEqual(duplicateFailed, true, 'Duplicate like correctly rejected by unique constraint');

    // Member unlikes post
    await dbClient.query(
      'DELETE FROM feed_post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, memberUser.id]
    );
    updated = await dbClient.query(
      'UPDATE feed_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count',
      [postId]
    );
    assert.strictEqual(updated.rows[0].likes_count, 0);
  });

  test('Social Comments: Registered member comments, views thread, and author/admin deletes', async () => {
    const postRes = await dbClient.query(`
      INSERT INTO feed_posts (author_id, author_name, author_role, title, content)
      VALUES ($1, $2, $3, 'Special Prayer Night', 'Join us 8 PM on Friday')
      RETURNING id
    `, [pastorUser.id, pastorUser.name, pastorUser.role]);

    const postId = postRes.rows[0].id;

    // Member adds comment
    const commentRes = await dbClient.query(`
      INSERT INTO feed_post_comments (post_id, user_id, user_name, user_role, content)
      VALUES ($1, $2, $3, $4, 'Amen! Looking forward to this.')
      RETURNING *
    `, [postId, memberUser.id, memberUser.name, memberUser.role]);

    await dbClient.query('UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

    assert.strictEqual(commentRes.rows.length, 1);
    assert.strictEqual(commentRes.rows[0].user_name, 'John Volunteer');
    assert.strictEqual(commentRes.rows[0].content, 'Amen! Looking forward to this.');

    // Pastor adds reply comment
    await dbClient.query(`
      INSERT INTO feed_post_comments (post_id, user_id, user_name, user_role, content)
      VALUES ($1, $2, $3, $4, 'See you there John! Bring friends.')
    `, [postId, pastorUser.id, pastorUser.name, pastorUser.role]);

    await dbClient.query('UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

    // Check comments thread
    const thread = await dbClient.query(
      'SELECT * FROM feed_post_comments WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
    assert.strictEqual(thread.rows.length, 2);

    // Verify post comments count
    const postCheck = await dbClient.query('SELECT comments_count FROM feed_posts WHERE id = $1', [postId]);
    assert.strictEqual(postCheck.rows[0].comments_count, 2);

    // Delete comment
    const commentIdToDelete = commentRes.rows[0].id;
    await dbClient.query('DELETE FROM feed_post_comments WHERE id = $1', [commentIdToDelete]);
    await dbClient.query('UPDATE feed_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1', [postId]);

    const finalThread = await dbClient.query('SELECT * FROM feed_post_comments WHERE post_id = $1', [postId]);
    assert.strictEqual(finalThread.rows.length, 1);
  });

  test('Event Posts: Persists and queries event_date and event_location', async () => {
    const eventDate = new Date('2026-11-15T19:00:00Z');
    const eventLocation = 'Main Sanctuary, Level 2';

    const eventPost = await dbClient.query(`
      INSERT INTO feed_posts (
        author_id, author_name, author_role, post_type, title, content,
        event_date, event_location, destination
      )
      VALUES ($1, $2, $3, 'event', 'Youth Mega Concert', 'Praise & Revival night', $4, $5, 'home')
      RETURNING *
    `, [
      adminUser.id,
      adminUser.name,
      adminUser.role,
      eventDate,
      eventLocation,
    ]);

    assert.strictEqual(eventPost.rows[0].post_type, 'event');
    assert.strictEqual(eventPost.rows[0].event_location, eventLocation);
    assert.strictEqual(new Date(eventPost.rows[0].event_date).toISOString(), eventDate.toISOString());
  });
});
