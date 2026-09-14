/**
 * Firebase Cloud Messaging (FCM) Push Notification Service
 * Supports FCM push delivery for roster assignments, deadline reminders, and promotions.
 */

const https = require('https');
const db = require('../config/db');

/**
 * Send push notification to a device token or list of tokens.
 * Handles both production FCM token delivery and dev-mode fallback logging.
 *
 * @param {object} payload
 * @param {string|string[]} payload.tokens - Device token or array of device tokens
 * @param {string} payload.title - Notification title
 * @param {string} payload.body - Notification body message
 * @param {object} payload.data - Custom payload (serviceId, token, screen, type)
 * @returns {Promise<object>}
 */
async function sendPushNotification({ tokens, title, body, data = {} }) {
  const tokenList = Array.isArray(tokens) ? tokens : [tokens].filter(Boolean);

  if (tokenList.length === 0) {
    return { success: true, deliveredCount: 0, reason: 'No valid device tokens provided' };
  }

  // If FIREBASE_SERVER_KEY or FIREBASE_SERVICE_ACCOUNT is present, we can dispatch to FCM HTTP endpoint
  const serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;

  if (!serverKey) {
    // Dev/Offline Mode: Log structured push notification for inspection
    console.log(`[FCM Mock Dispatch] To: [${tokenList.join(', ')}] | Title: "${title}" | Body: "${body}" | Data:`, data);
    return {
      success: true,
      mode: 'mock',
      deliveredCount: tokenList.length,
      title,
      body,
      data,
    };
  }

  // Production FCM Legacy / HTTP v1 Dispatch
  const postData = JSON.stringify({
    registration_ids: tokenList,
    notification: {
      title,
      body,
      sound: 'default',
    },
    data,
    priority: 'high',
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'fcm.googleapis.com',
      port: 443,
      path: '/fcm/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', (chunk) => {
        resData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resData);
          resolve({ success: true, mode: 'fcm', response: parsed, deliveredCount: parsed.success || 0 });
        } catch (e) {
          resolve({ success: false, mode: 'fcm', raw: resData });
        }
      });
    });

    req.on('error', (err) => {
      console.error('FCM HTTP Request Error:', err);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Notify volunteer of new roster assignment
 */
async function notifyRosterAssignment(dbClient, { musicianId, serviceId, positionName, roleSlot, serviceDate }) {
  try {
    // Fetch musician device tokens
    const tokenRes = await dbClient.query('SELECT token FROM device_tokens WHERE musician_id = $1', [musicianId]);
    const tokens = tokenRes.rows.map((r) => r.token);

    const title = 'ServeSync — New Roster Assignment';
    const body = `You have been scheduled as ${positionName} (${roleSlot}) for ${serviceDate}. Please tap to confirm your availability.`;

    // Fetch service token for confirmation link
    const sRes = await dbClient.query('SELECT token FROM services WHERE id = $1', [serviceId]);
    const serviceToken = sRes.rows[0]?.token || '';

    const pushResult = await sendPushNotification({
      tokens,
      title,
      body,
      data: {
        serviceId,
        serviceToken,
        positionName,
        roleSlot,
        type: 'roster_assignment',
      },
    });

    return pushResult;
  } catch (err) {
    console.error('Notify roster assignment error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Notify volunteer of backup auto-promotion
 */
async function notifyBackupPromotion(dbClient, { musicianId, serviceId, positionName, serviceDate }) {
  try {
    const tokenRes = await dbClient.query('SELECT token FROM device_tokens WHERE musician_id = $1', [musicianId]);
    const tokens = tokenRes.rows.map((r) => r.token);

    const title = 'ServeSync — You have been Promoted to Primary';
    const body = `You have been stepped up to Primary ${positionName} for ${serviceDate}. Tap to view run sheet and details.`;

    const sRes = await dbClient.query('SELECT token FROM services WHERE id = $1', [serviceId]);
    const serviceToken = sRes.rows[0]?.token || '';

    return await sendPushNotification({
      tokens,
      title,
      body,
      data: {
        serviceId,
        serviceToken,
        positionName,
        type: 'backup_promotion',
      },
    });
  } catch (err) {
    console.error('Notify promotion error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendPushNotification,
  notifyRosterAssignment,
  notifyBackupPromotion,
};
