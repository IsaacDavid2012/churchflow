/**
 * ServeSync Background Cron / Interval Service
 * Regularly checks service deadlines, executes auto-promotions,
 * and sends automated 24h WhatsApp reminder nudges to pending volunteers.
 */

const db = require('../config/db');
const { checkDeadlineAndAutoPromote, parseServiceDateTime } = require('./shuffleService');
const whatsappService = require('./whatsappService');

let cronInterval = null;

async function runDeadlineCheckJob() {
  try {
    // Find all services in 'rostered' or 'availability_open' status scheduled in the future or today
    const servicesRes = await db.query(
      `SELECT id, service_date, service_time, deadline_hours_before, theme 
       FROM services 
       WHERE status IN ('rostered', 'availability_open') 
       AND service_date >= CURRENT_DATE - INTERVAL '1 day'`
    );

    for (const service of servicesRes.rows) {
      const result = await checkDeadlineAndAutoPromote(db, service.id);
      if (result.promotions && result.promotions.length > 0) {
        console.log(`[Cron] Executed ${result.promotions.length} auto-promotion(s) for service ${service.id} (${service.service_date})`);
      }
    }
  } catch (err) {
    console.error('[Cron] Error in deadline check job:', err);
  }
}

/**
 * Scans upcoming services (within next 24 hours) for pending primary volunteers
 * and sends automated WhatsApp reminder nudges. Avoids duplicate reminders within 24 hours.
 */
async function runPendingReminderJob(dbClient = db) {
  try {
    const servicesRes = await dbClient.query(
      `SELECT id, service_date, service_time, service_type, theme, token, status
       FROM services
       WHERE status IN ('rostered', 'availability_open', 'draft', 'confirmed')
         AND service_date >= CURRENT_DATE
         AND service_date <= CURRENT_DATE + INTERVAL '2 days'`
    );

    const now = new Date();

    for (const service of servicesRes.rows) {
      const serviceDateTime = parseServiceDateTime(service.service_date, service.service_time);
      const msUntilService = serviceDateTime.getTime() - now.getTime();
      const hoursUntilService = msUntilService / (1000 * 60 * 60);

      // We only remind if the service is within the next 24 hours (and hasn't already started)
      if (hoursUntilService <= 0 || hoursUntilService > 24) {
        continue;
      }

      // Query all pending primary assignments with valid phone numbers
      const pendingRes = await dbClient.query(
        `SELECT a.id, a.musician_id, a.position_id, a.status,
                m.name AS musician_name, m.phone AS musician_phone,
                p.name AS position_name
         FROM assignments a
         JOIN musicians m ON a.musician_id = m.id
         JOIN positions_template p ON a.position_id = p.id
         WHERE a.service_id = $1
           AND a.role_slot = 'primary'
           AND a.status = 'pending'
           AND m.phone IS NOT NULL
           AND m.phone != ''`,
        [service.id]
      );

      for (const row of pendingRes.rows) {
        // Check if reminder was already dispatched in the last 24h
        const checkLog = await dbClient.query(
          `SELECT id FROM notifications_log
           WHERE service_id = $1
             AND type = 'whatsapp_24h_reminder'
             AND (metadata->>'musician_id' = $2 OR message LIKE $3)
             AND created_at >= NOW() - INTERVAL '24 hours'`,
          [service.id, row.musician_id, `%${row.musician_name}%`]
        );

        if (checkLog.rows.length > 0) {
          // Already sent a reminder within the last 24h, skip
          continue;
        }

        // Dispatch reminder via WhatsApp
        const sendRes = await whatsappService.sendVolunteerReminderNudge({
          musician: {
            id: row.musician_id,
            name: row.musician_name,
            phone: row.musician_phone,
          },
          service,
          positionName: row.position_name,
          hoursRemaining: Math.max(1, Math.round(hoursUntilService)),
        });

        if (sendRes.success) {
          // Log into notifications_log
          await dbClient.query(
            `INSERT INTO notifications_log (service_id, type, message, metadata)
             VALUES ($1, 'whatsapp_24h_reminder', $2, $3)`,
            [
              service.id,
              `Sent 24h reminder to ${row.musician_name} for ${row.position_name}`,
              JSON.stringify({
                musician_id: row.musician_id,
                musician_name: row.musician_name,
                phone: row.musician_phone,
                position_id: row.position_id,
                position_name: row.position_name,
                hours_until_service: Math.round(hoursUntilService),
              }),
            ]
          );
          console.log(`[Cron] Sent 24h reminder to ${row.musician_name} (${row.musician_phone}) for service ${service.id}`);
        }
      }
    }
  } catch (err) {
    console.error('[Cron] Error in runPendingReminderJob:', err);
  }
}

async function runAllCronJobs() {
  await runDeadlineCheckJob();
  await runPendingReminderJob();
}

/**
 * Start the deadline & reminder monitoring background job (runs every 15 minutes by default)
 */
function startDeadlineMonitor(intervalMinutes = 15) {
  if (cronInterval) clearInterval(cronInterval);

  console.log(`[Cron] Starting ServeSync deadline & reminder monitor (interval: ${intervalMinutes}m)...`);
  
  // Run once on startup
  runAllCronJobs();

  cronInterval = setInterval(runAllCronJobs, intervalMinutes * 60 * 1000);
  return cronInterval;
}

function stopDeadlineMonitor() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}

module.exports = {
  runDeadlineCheckJob,
  runPendingReminderJob,
  runAllCronJobs,
  startDeadlineMonitor,
  stopDeadlineMonitor,
};
