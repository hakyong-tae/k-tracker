/** "4:00" | "3:29:50" | "45:00"(m:ss when <=2 parts and first<10?) → seconds. Two parts are read as H:MM. */
export function parseDuration(s: string): number | null {
  const p = s.trim().split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x) || x < 0)) return null;
  if (p.length === 2) return p[0] * 3600 + p[1] * 60;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}
export function fmtDuration(sec: number, withSec = true): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return withSec ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${h}:${String(m).padStart(2, '0')}`;
}
export function fmtPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** "HH:MM" + seconds → "HH:MM" wall clock (wraps at 24h). */
export function addClock(hhmm: string, sec: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.round((h * 3600 + m * 60 + sec) / 60) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** UTC offset (minutes) of an IANA zone at a given instant. */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Absolute start instant of a race from its local date/time and zone. */
export function raceStartInstant(date: string, startTime: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = startTime.split(':').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const off = tzOffsetMinutes(timeZone, guess);
  return new Date(guess.getTime() - off * 60000);
}

/** Today's date string (YYYY-MM-DD) in a zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Calendar-day difference: race date minus today's date in the race's zone. */
export function daysUntil(date: string, timeZone: string, now = new Date()): number {
  const a = Date.parse(todayIn(timeZone, now) + 'T00:00:00Z');
  const b = Date.parse(date + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
