import { formatServiceDate } from './date';

/**
 * Cross-browser clipboard copy helper that works over HTTP, HTTPS,
 * IP addresses, localhost, and mobile web browsers with fallback.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  // Method 1: Modern navigator.clipboard API (HTTPS or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard failed, attempting fallback...', err);
    }
  }

  // Method 2: Fallback using hidden textarea & document.execCommand('copy') (Works over HTTP & IP addresses)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

/**
 * Formats the confirmed final lineup with Date, Time, and Lineup for WhatsApp.
 */
export function formatFinalLineupForWhatsApp(service, lineup = []) {
  if (!service) return '';

  const dateStr = formatServiceDate(service.service_date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = service.service_time || '10:00 AM';

  const lineupLines = [];
  const includeLeader = typeof window !== 'undefined' && localStorage.getItem('servesync_auto_fill_rest') === 'true';
  const wlName = includeLeader ? service.worship_leader_name : null;

  (lineup || []).forEach((pos) => {
    const posName = pos.positionName || pos.position_name || pos.name || 'Position';
    const musicianName = pos.primary?.name || pos.primary_musician_name || pos.primary_musician?.name;
    if (!includeLeader && posName.toLowerCase().includes('worship leader')) {
      return;
    }
    if (musicianName) {
      lineupLines.push(`• ${posName}: ${musicianName}`);
    } else if (wlName && posName.toLowerCase().includes('worship leader')) {
      lineupLines.push(`• ${posName}: ${wlName}`);
    }
  });

  const serviceTypeStr = service.service_type || 'Sunday Service';
  const lines = [
    `⛪ *Jesus My Rock Church — ${serviceTypeStr}*`,
    `📅 *Date:* ${dateStr}`,
    `⏰ *Time:* ${timeStr}`,
    service.campus_name ? `📍 *Campus:* ${service.campus_name}` : '',
    service.theme ? `📖 *Theme:* "${service.theme}"` : '',
    '',
    `👥 *Final Lineup:*`,
    ...(lineupLines.length > 0 ? lineupLines : ['• No assignments yet']),
  ].filter(Boolean);

  return lines.join('\n');
}
