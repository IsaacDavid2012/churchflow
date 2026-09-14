/**
 * Safely parses any date string (ISO timestamp, YYYY-MM-DD, or Date object)
 * into a local Date object without timezone shift bugs.
 */
export function parseLocalDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  
  const str = String(dateVal).trim();
  const cleanDateStr = str.includes('T') ? str.split('T')[0] : str;
  const d = new Date(`${cleanDateStr}T00:00:00`);
  
  if (!isNaN(d.getTime())) return d;
  
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function formatServiceDate(dateVal, options = {}) {
  const d = parseLocalDate(dateVal);
  if (!d) return 'No Date';
  return d.toLocaleDateString(undefined, {
    weekday: options.weekday !== undefined ? options.weekday : 'short',
    month: options.month !== undefined ? options.month : 'short',
    day: options.day !== undefined ? options.day : 'numeric',
    year: options.year !== undefined ? options.year : 'numeric',
    ...options,
  });
}

export function formatMonthShort(dateVal) {
  const d = parseLocalDate(dateVal);
  if (!d) return '---';
  return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

export function formatDayNumber(dateVal) {
  const d = parseLocalDate(dateVal);
  if (!d) return '--';
  return d.getDate();
}

export function formatLastServed(dateVal) {
  if (!dateVal) return 'Never served (Highest priority)';
  const d = parseLocalDate(dateVal);
  if (!d) return 'Never served';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
