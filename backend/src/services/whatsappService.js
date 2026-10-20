const http = require('http');

const WA_GATEWAY_HOST = process.env.WA_GATEWAY_HOST || '192.168.192.1';
const WA_GATEWAY_PORT = parseInt(process.env.WA_GATEWAY_PORT || '8001', 10);
const WA_INTERNAL_TOKEN = process.env.WA_INTERNAL_TOKEN || 'jarvis_internal_token_v2_994821a8c';
const PUBLIC_BASE_URL = process.env.COOLIFY_URL || 'https://serve.creativeclicks.art';

/**
 * Format raw phone number into clean WhatsApp JID
 * E.g., "+60 17-600 1484" -> "60176001484@c.us"
 */
function formatWhatsAppJid(phone) {
  if (!phone) return null;
  const str = String(phone).trim();
  if (str.includes('@')) return str; // Already a JID (e.g. group @g.us or user @c.us)
  const digits = str.replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@c.us`;
}

/**
 * Generic HTTP Request to WhatsApp Gateway
 */
function makeGatewayRequest(path, method = 'GET', payload = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const options = {
      hostname: WA_GATEWAY_HOST,
      port: WA_GATEWAY_PORT,
      path,
      method,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${WA_INTERNAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, data: parsed });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed.error || body });
          }
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: body });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Gateway request timed out' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    if (data) req.write(data);
    req.end();
  });
}

/**
 * Check if the WhatsApp Gateway is connected and authenticated
 */
async function isReady() {
  const res = await makeGatewayRequest('/health', 'GET');
  return res.success && res.data?.ready === true;
}

/**
 * Send a raw text message to a specific phone number or group JID
 */
async function sendMessage(to, text) {
  const targetJid = formatWhatsAppJid(to);
  if (!targetJid) {
    return { success: false, error: 'Invalid phone number or JID' };
  }

  const res = await makeGatewayRequest('/send', 'POST', { to: targetJid, text });
  if (res.success) {
    console.log(`[WhatsApp] Sent message to ${targetJid}`);
  } else {
    console.warn(`[WhatsApp] Failed sending to ${targetJid}:`, res.error);
  }
  return res;
}

/**
 * Send an RSVP Attendance Invitation to a scheduled volunteer
 */
async function sendVolunteerRsvpInvite({ musician, service, positionName }) {
  if (!musician || !musician.phone) {
    return { success: false, error: 'Volunteer has no phone number on record' };
  }

  const token = service.token;
  const link = `${PUBLIC_BASE_URL}/avail/${token}`;
  const sDate = service.service_date || 'Sunday';
  const sTime = service.service_time || '10:00 AM';
  const sType = service.service_type || 'Sunday Celebration';

  const text = `🕊️ *ChurchFlow Sunday Roster Alert*

Hi *${musician.name}*, you have been scheduled to serve for:
🗓️ *${sType}*
⏰ *${sDate} at ${sTime}*
🎸 Role: *${positionName || 'Team Member'}*
${service.theme ? `🎯 Theme: "${service.theme}"\n` : ''}
Please confirm your attendance in 1 tap (secured with 4-digit PIN):
👉 ${link}

_Jesus My Rock Church Management Ecosystem_`;

  return module.exports.sendMessage(musician.phone, text);
}

/**
 * Send a 24h Deadline WhatsApp Reminder to a volunteer who hasn't confirmed yet
 */
async function sendVolunteerReminderNudge({ musician, service, positionName, hoursRemaining = 24 }) {
  if (!musician || !musician.phone) {
    return { success: false, error: 'Volunteer has no phone number on record' };
  }

  const token = service.token;
  const link = `${PUBLIC_BASE_URL}/avail/${token}`;
  const sDate = service.service_date || 'upcoming service';
  const sTime = service.service_time || '10:00 AM';
  const sType = service.service_type || 'Upcoming Service';

  const text = `⏰ *ChurchFlow Serving Reminder*

Hi *${musician.name}*, just a friendly reminder regarding your roster:
🗓️ *${sType}*
⏰ *${sDate} at ${sTime}*
🎸 Role: *${positionName || 'Team Member'}*
⏳ *${hoursRemaining}h remaining* until service deadline

You are currently marked as *Pending*. Please tap below to confirm or decline with your 4-digit PIN:
👉 ${link}

Thank you for serving with gladness! 🙏
_Jesus My Rock Church_`;

  return module.exports.sendMessage(musician.phone, text);
}

/**
 * Send an Instant Emergency Backup Promotion Alert
 */
async function sendEmergencyPromotionAlert({ musician, service, positionName, declinedByName }) {
  if (!musician || !musician.phone) {
    return { success: false, error: 'Promoted volunteer has no phone number on record' };
  }

  const token = service.token;
  const link = `${PUBLIC_BASE_URL}/avail/${token}`;
  const sDate = service.service_date || 'this Sunday';
  const declinedText = declinedByName ? ` (${declinedByName} cannot make it)` : '';

  const text = `🚨 *ChurchFlow Urgent: Roster Promotion*

Hi *${musician.name}*! A serving slot has opened up${declinedText}:
🗓️ Service: *${service.service_type || 'Sunday Service'}* (*${sDate}*)
🎸 Position: *${positionName}*

You have been automatically promoted to serve as *Primary*!
Please tap below to confirm if you can make it:
👉 ${link}

Thank you for standing in the gap! 🙏`;

  return module.exports.sendMessage(musician.phone, text);
}

/**
 * Alert Worship Leader / Admin that all backups declined or no volunteers are left
 */
async function sendLeaderUnfilledSlotAlert({ leaderPhone, leaderName, service, positionName, declinedByName }) {
  if (!leaderPhone) return { success: false, error: 'Leader has no phone number' };

  const sDate = service.service_date || 'this Sunday';
  const text = `⚠️ *ChurchFlow Roster Alert: Unfilled Slot*

Hi *${leaderName || 'Leader'}*,
${declinedByName ? `${declinedByName} declined ` : ''}*${positionName}* for *${sDate}*, and *NO backup volunteers are available*.

The slot is currently vacant. Please check the lineup and assign a replacement:
👉 ${PUBLIC_BASE_URL}/services/${service.id || ''}`;

  return module.exports.sendMessage(leaderPhone, text);
}

/**
 * Broadcast the full Sunday Order of Service & Lineup to the Church WhatsApp Group
 */
async function broadcastServiceRunSheet({ groupId, service, lineup = [], planItems = [] }) {
  if (!groupId) return { success: false, error: 'No group JID specified' };

  const sDate = service.service_date || 'Sunday';
  const sTime = service.service_time || '10:00 AM';
  const sType = service.service_type || 'Sunday Celebration';

  let msg = `🔥 *${sType.toUpperCase()}*
🗓️ *${sDate} | ${sTime}*
${service.campus_name ? `🏛️ Campus: ${service.campus_name}\n` : ''}${service.theme ? `🎯 Theme: "${service.theme}"\n` : ''}
───────────────────────
👥 *SERVING LINEUP:*
`;

  if (lineup.length > 0) {
    lineup.forEach((item) => {
      const pos = item.positionName || 'Role';
      const person = item.primary?.name || 'Unassigned';
      const statusIcon = item.primary?.status === 'confirmed' ? '✅' : '⏳';
      msg += `${statusIcon} *${pos}*: ${person}\n`;
    });
  } else {
    msg += `_Lineup pending confirmation_\n`;
  }

  if (planItems.length > 0) {
    msg += `\n───────────────────────\n📋 *ORDER OF SERVICE:*\n`;
    planItems.forEach((p, idx) => {
      const duration = p.duration_minutes ? ` (${p.duration_minutes}m)` : '';
      const songDetails = p.song_title ? ` [${p.song_title}${p.song_key ? ` in ${p.song_key}` : ''}]` : '';
      msg += `${idx + 1}. *${p.title}*${duration}${songDetails}\n`;
    });
  }

  msg += `\n───────────────────────\n🔗 View dynamic live run-sheet:\n${PUBLIC_BASE_URL}/avail/${service.token || ''}`;

  return module.exports.sendMessage(groupId, msg);
}

module.exports = {
  isReady,
  sendMessage,
  sendVolunteerRsvpInvite,
  sendVolunteerReminderNudge,
  sendEmergencyPromotionAlert,
  sendLeaderUnfilledSlotAlert,
  broadcastServiceRunSheet,
};
