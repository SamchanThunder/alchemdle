const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function isoToUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function localTodayUtcDay(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

/** Today's puzzle number (local time). */
export function todayPuzzleNumber(startDate: string, count: number, now = new Date()): number {
  const n = localTodayUtcDay(now) - isoToUtcDay(startDate) + 1;
  return Math.min(Math.max(1, Math.round(n)), count);
}

/** "NOV 17, 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function msUntilLocalMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
