/**
 * Returns the Monday of the week containing `date`.
 * Returns a Date object at midnight local time.
 */
export function getMondayOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as "YYYY-MM-DD" */
export function toISO(date) {
  return date.toISOString().split('T')[0];
}

/** Format Monday date as readable label e.g. "Jul 21 – Jul 27, 2026" */
export function weekLabel(mondayDate) {
  const monday = new Date(mondayDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Get short day label for today e.g. "Mon" */
export function todayShort() {
  return DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
}

/** Format duration in minutes to "Xh Ym" */
export function fmtDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Get period label options for horizon level */
export function getPeriodOptions(level) {
  const year = new Date().getFullYear();
  const years = [year - 1, year, year + 1].map(String);

  if (level === 'year') return years;

  if (level === 'quarter') {
    const options = [];
    for (const y of [year, year + 1]) {
      for (let q = 1; q <= 4; q++) options.push(`Q${q} ${y}`);
    }
    return options;
  }

  if (level === 'month') {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const options = [];
    for (const y of [year, year + 1]) {
      for (const m of months) options.push(`${m} ${y}`);
    }
    return options;
  }

  return [];
}
