/**
 * ServeSync Background Cron / Interval Service
 * Regularly checks service deadlines and executes auto-promotions for unconfirmed primary slots.
 */

const db = require('../config/db');
const { checkDeadlineAndAutoPromote } = require('./shuffleService');

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
 * Start the deadline monitoring background job (runs every 15 minutes by default)
 */
function startDeadlineMonitor(intervalMinutes = 15) {
  if (cronInterval) clearInterval(cronInterval);

  console.log(`[Cron] Starting ServeSync deadline monitor (interval: ${intervalMinutes}m)...`);
  
  // Run once on startup
  runDeadlineCheckJob();

  cronInterval = setInterval(runDeadlineCheckJob, intervalMinutes * 60 * 1000);
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
  startDeadlineMonitor,
  stopDeadlineMonitor,
};
