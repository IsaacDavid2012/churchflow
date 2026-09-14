const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendPushNotification } = require('../services/fcmService');

router.use(authMiddleware);

// GET /api/notifications - List all recent notifications across services
router.get('/', async (req, res) => {
  try {
    const { service_id, limit = 50 } = req.query;
    let query = `
      SELECT 
        n.*,
        s.service_date,
        s.service_time,
        s.theme
      FROM notifications_log n
      LEFT JOIN services s ON s.id = n.service_id
    `;
    const params = [];

    if (service_id) {
      params.push(service_id);
      query += ` WHERE n.service_id = $${params.length}`;
    }

    params.push(parseInt(limit, 10));
    query += ` ORDER BY n.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/register-device - Register mobile or web FCM push token
router.post('/register-device', async (req, res) => {
  const { token, platform = 'android', musician_id } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Device token is required' });
  }

  try {
    const userId = req.user.id;
    // If musician_id is not passed, find if user is linked to a musician profile
    let musicianId = musician_id || null;
    if (!musicianId) {
      const mRes = await db.query('SELECT id FROM musicians WHERE user_id = $1 OR email = $2 LIMIT 1', [
        userId,
        req.user.email || '',
      ]);
      if (mRes.rows.length > 0) {
        musicianId = mRes.rows[0].id;
      }
    }

    await db.query(
      `
      INSERT INTO device_tokens (user_id, musician_id, token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        musician_id = EXCLUDED.musician_id,
        platform = EXCLUDED.platform,
        updated_at = NOW()
    `,
      [userId, musicianId, token, platform]
    );

    res.json({ success: true, message: 'Device token registered successfully' });
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

// POST /api/notifications/test-push - Send a test push notification
router.post('/test-push', async (req, res) => {
  const { token, title, body } = req.body;
  try {
    let targetTokens = [];
    if (token) {
      targetTokens = [token];
    } else {
      const userTokens = await db.query('SELECT token FROM device_tokens WHERE user_id = $1', [req.user.id]);
      targetTokens = userTokens.rows.map((r) => r.token);
    }

    if (targetTokens.length === 0) {
      return res.status(400).json({ error: 'No device token found for this user. Please register a device first.' });
    }

    const pushRes = await sendPushNotification({
      tokens: targetTokens,
      title: title || 'ServeSync Test Notification',
      body: body || 'Jesus My Rock Church notification system is online!',
      data: { type: 'test' },
    });

    res.json({ success: true, result: pushRes });
  } catch (err) {
    console.error('Test push error:', err);
    res.status(500).json({ error: 'Failed to send test push' });
  }
});

module.exports = router;
