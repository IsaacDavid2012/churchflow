/**
 * YouTube Live Stream Detection & Auto-Posting Service
 * Connects to Jesus My Rock Church's YouTube channel (@jesusmyrockchurchkl / UCkgenI4IULye4vDjrGRo-aA).
 * Detects live broadcasts, auto-posts to the Church Home Feed from 'Jesus My Rock',
 * and dispatches FCM phone notifications to all church members.
 */

const https = require('https');
const db = require('../config/db');
const { notifyChurchLiveStream } = require('./fcmService');

const DEFAULT_CHANNEL_ID = 'UCkgenI4IULye4vDjrGRo-aA';
const DEFAULT_CHANNEL_HANDLE = '@jesusmyrockchurchkl';

/**
 * Extracts standard 11-character YouTube video ID from various formats.
 */
function parseYouTubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  // If already pure 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // Matches watch?v=, youtu.be/, /live/, /embed/
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * HTTP helper to fetch text with redirect following & browser user-agent.
 */
function fetchHttpText(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return resolve({ status: 500, data: '' });

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };

    https.get(targetUrl, options, (res) => {
      // Follow redirects (YouTube /live redirects to /watch?v=VIDEO_ID)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `https://www.youtube.com${redirectUrl}`;
        }
        return resolve(fetchHttpText(redirectUrl, maxRedirects - 1));
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data, finalUrl: targetUrl });
      });
    }).on('error', (err) => {
      resolve({ status: 500, error: err.message, data: '' });
    });
  });
}

/**
 * Checks whether the configured YouTube channel is currently broadcasting live.
 */
async function checkChannelLiveStatus({ channelId = DEFAULT_CHANNEL_ID, channelHandle = DEFAULT_CHANNEL_HANDLE, apiKey = null } = {}) {
  const handleOrId = channelHandle.startsWith('@') ? channelHandle : `@${channelHandle}`;

  // 1. Direct Canonical URL Check (Zero-API-Key)
  // When live, https://www.youtube.com/@handle/live redirects or canonicalizes to /watch?v=VIDEO_ID with isLive: true
  const liveUrl = `https://www.youtube.com/${handleOrId}/live`;
  const response = await fetchHttpText(liveUrl);

  if (response.data) {
    const html = response.data;
    
    // Check if canonical URL points to a specific video
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
    const videoIdMatch = canonicalMatch ? canonicalMatch[1] : null;

    // Check live indicators
    const isLive = (
      html.includes('"isLive":true') ||
      html.includes('"isLiveBroadcast":true') ||
      html.includes('"style":"LIVE"') ||
      html.includes('"liveStreamability"')
    );

    if (videoIdMatch && isLive) {
      // Extract title
      const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/) ||
                         html.match(/<title>([^<]+)<\/title>/);
      let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Jesus My Rock Live Service';

      return {
        isLive: true,
        videoId: videoIdMatch,
        title,
        source: 'youtube_live_canonical',
      };
    }
  }

  // 2. Optional: YouTube Data API v3 check if API key is provided
  if (apiKey && channelId) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
      const apiRes = await fetchHttpText(apiUrl);
      if (apiRes.status === 200 && apiRes.data) {
        const parsed = JSON.parse(apiRes.data);
        if (parsed.items && parsed.items.length > 0) {
          const item = parsed.items[0];
          return {
            isLive: true,
            videoId: item.id?.videoId,
            title: item.snippet?.title || 'Jesus My Rock Live Service',
            source: 'youtube_data_api',
          };
        }
      }
    } catch (e) {
      console.warn('YouTube Data API check warning:', e.message);
    }
  }

  return {
    isLive: false,
    videoId: null,
    title: null,
    source: 'offline',
  };
}

/**
 * Main Background Sync Job
 * Checks live status, creates feed post from 'Jesus My Rock', unpins when finished, and triggers FCM phone notifications.
 */
async function syncLiveStreamJob(dbClient = db) {
  try {
    // 1. Get church profile
    const profileRes = await dbClient.query('SELECT * FROM church_profile LIMIT 1');
    const profile = profileRes.rows[0] || {};

    const channelId = profile.youtube_channel_id || DEFAULT_CHANNEL_ID;
    const channelHandle = profile.youtube_channel_handle || DEFAULT_CHANNEL_HANDLE;
    const apiKey = profile.youtube_api_key || null;

    // 2. Check live status
    const liveStatus = await checkChannelLiveStatus({ channelId, channelHandle, apiKey });

    // 3. Process Live State
    if (liveStatus.isLive && liveStatus.videoId) {
      const videoId = liveStatus.videoId;
      const title = liveStatus.title || 'Sunday Worship Service';

      // Update church profile
      await dbClient.query(`
        UPDATE church_profile
        SET 
          youtube_is_live = true,
          youtube_current_live_video_id = $1,
          youtube_current_live_title = $2,
          youtube_last_checked_at = NOW()
        WHERE id = $3
      `, [videoId, title, profile.id]);

      // If auto-post enabled (default true)
      if (profile.youtube_auto_post_live !== false) {
        // Check if feed post already created for this live video
        const existingPost = await dbClient.query(
          `SELECT id FROM feed_posts WHERE media_name = $1 OR media_url LIKE $2`,
          [videoId, `%${videoId}%`]
        );

        if (existingPost.rows.length === 0) {
          // Author strictly set to 'Jesus My Rock' as requested
          const postTitle = `🔴 LIVE: ${title}`;
          const postContent = `We are LIVE on YouTube right now! Join us for worship and the Word. Watch the live stream below and participate in live comments.`;
          const mediaUrl = `https://www.youtube.com/watch?v=${videoId}`;

          const newPost = await dbClient.query(`
            INSERT INTO feed_posts (
              author_name, author_role, post_type, title, content,
              destination, media_url, media_type, media_name, is_pinned
            )
            VALUES ($1, 'pastor', 'live_stream', $2, $3, 'home', $4, 'youtube_live', $5, true)
            RETURNING *
          `, ['Jesus My Rock', postTitle, postContent, mediaUrl, videoId]);

          console.log(`[YouTube Live] Auto-posted live stream to feed: "${postTitle}" (Video: ${videoId})`);

          // Dispatch FCM Push Notification to all church mobile devices
          try {
            await notifyChurchLiveStream(dbClient, { videoId, title });
            console.log(`[FCM] Dispatched live stream push notification to church phones for video: ${videoId}`);
          } catch (fcmErr) {
            console.warn('[FCM] Live stream notification dispatch warning:', fcmErr.message);
          }

          return { live: true, posted: true, post: newPost.rows[0] };
        }
      }

      return { live: true, posted: false, videoId };
    } else {
      // Channel is OFFLINE
      if (profile.youtube_is_live) {
        // Stream just ended: Mark offline and unpin feed posts while preserving replay
        await dbClient.query(`
          UPDATE church_profile
          SET 
            youtube_is_live = false,
            youtube_current_live_video_id = NULL,
            youtube_last_checked_at = NOW()
          WHERE id = $1
        `, [profile.id]);

        await dbClient.query(`
          UPDATE feed_posts
          SET is_pinned = false
          WHERE post_type = 'live_stream' AND is_pinned = true
        `);

        console.log('[YouTube Live] Live stream ended. Unpinned live posts from top of feed.');
      } else {
        // Just update timestamp
        await dbClient.query(`
          UPDATE church_profile
          SET youtube_last_checked_at = NOW()
          WHERE id = $1
        `, [profile.id]);
      }

      return { live: false };
    }
  } catch (err) {
    console.error('[YouTube Live] Error in syncLiveStreamJob:', err);
    return { error: err.message };
  }
}

/**
 * Manual Go Live Trigger (Admins & Pastors can trigger live stream anytime with link or ID)
 */
async function manualTriggerGoLive(dbClient, { urlOrVideoId, customTitle, dbUser }) {
  const videoId = parseYouTubeVideoId(urlOrVideoId);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or Video ID. Please provide a valid YouTube link.');
  }

  const title = (customTitle || '').trim() || 'Sunday Celebration Service';
  const postTitle = `🔴 LIVE: ${title}`;
  const postContent = `We are LIVE on YouTube right now! Join us for worship and the Word. Watch the live stream below and participate in live comments.`;
  const mediaUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Update church profile
  await dbClient.query(`
    UPDATE church_profile
    SET 
      youtube_is_live = true,
      youtube_current_live_video_id = $1,
      youtube_current_live_title = $2,
      youtube_last_checked_at = NOW()
  `, [videoId, title]);

  // Insert or pin feed post authored strictly as 'Jesus My Rock'
  const checkPost = await dbClient.query(
    'SELECT id FROM feed_posts WHERE media_name = $1 OR media_url LIKE $2',
    [videoId, `%${videoId}%`]
  );

  let post;
  if (checkPost.rows.length === 0) {
    const insertRes = await dbClient.query(`
      INSERT INTO feed_posts (
        author_name, author_role, post_type, title, content,
        destination, media_url, media_type, media_name, is_pinned
      )
      VALUES ($1, 'pastor', 'live_stream', $2, $3, 'home', $4, 'youtube_live', $5, true)
      RETURNING *
    `, ['Jesus My Rock', postTitle, postContent, mediaUrl, videoId]);
    post = insertRes.rows[0];
  } else {
    const updateRes = await dbClient.query(`
      UPDATE feed_posts
      SET is_pinned = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [checkPost.rows[0].id]);
    post = updateRes.rows[0];
  }

  // Trigger Phone Notification
  try {
    await notifyChurchLiveStream(dbClient, { videoId, title });
  } catch (e) {
    console.warn('[FCM] Notification warning:', e.message);
  }

  return { success: true, post, videoId };
}

/**
 * Manual End Live Stream Trigger
 */
async function manualEndLive(dbClient) {
  await dbClient.query(`
    UPDATE church_profile
    SET 
      youtube_is_live = false,
      youtube_current_live_video_id = NULL,
      youtube_last_checked_at = NOW()
  `);

  await dbClient.query(`
    UPDATE feed_posts
    SET is_pinned = false
    WHERE post_type = 'live_stream' AND is_pinned = true
  `);

  return { success: true, message: 'Live stream marked as ended' };
}

module.exports = {
  DEFAULT_CHANNEL_ID,
  DEFAULT_CHANNEL_HANDLE,
  parseYouTubeVideoId,
  checkChannelLiveStatus,
  syncLiveStreamJob,
  manualTriggerGoLive,
  manualEndLive,
};
