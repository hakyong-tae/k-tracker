/** Estimate where a runner is now from their latest timing splits. Pure functions, shared by tracker and race pages. */

export interface Checkpoint { name: string; km: number }
export interface Split { section: string; checkpointTime: string }
export interface Estimate {
  startSec: number | null;   // clock seconds of day when the runner crossed the start
  lastKm: number;            // last checkpoint with a known distance
  lastSec: number | null;
  lastName: string;
  paceSec: number | null;    // seconds per km so far
  estKm: number | null;      // estimated distance now
  nextKm: number | null;
  finishSec: number | null;  // projected (or actual) finish clock, seconds of day
  finished: boolean;
}

/** First hh:mm:ss in a string, as seconds of day. */
export function clockSec(s: string | null | undefined): number | null {
  const m = (s ?? '').match(/(\d{1,2}):(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
export function fmtClock(sec: number): string {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

const START = /^(출발|start|스타트)$/i;
const FINISH = /^(도착|골인|피니시|finish|goal)$/i;

/** Distance of a timing section name in km, using the event's checkpoint table first. */
export function sectionKm(name: string, checkpoints: Checkpoint[], totalKm: number): number | null {
  const n = name.trim();
  const hit = checkpoints.find((c) => c.name.trim() === n);
  if (hit) return FINISH.test(n) ? totalKm : hit.km;
  if (START.test(n)) return 0;
  if (FINISH.test(n)) return totalKm;
  if (/^(half|하프)$/i.test(n)) return 21.0975;
  const k = n.match(/^(\d+(?:\.\d+)?)\s*k(?:m)?$/i);
  return k ? Number(k[1]) : null;
}

/** Course distance from a category label like "M HALF", "마스터스 풀코스", "10K". */
export function categoryKm(label: string): number | null {
  const s = label.toLowerCase();
  if (/full|풀/.test(s)) return 42.195;
  if (/half|하프/.test(s)) return 21.0975;
  const k = s.match(/(\d+(?:\.\d+)?)\s*k/);
  return k ? Number(k[1]) : null;
}

export function estimate(splits: Split[], opts: { totalKm: number; checkpoints?: Checkpoint[]; nowSec: number; gunSec?: number | null }): Estimate {
  const cps = opts.checkpoints ?? [];
  const known = splits
    .map((s) => ({ name: s.section, km: sectionKm(s.section, cps, opts.totalKm), t: clockSec(s.checkpointTime) }))
    .filter((x): x is { name: string; km: number; t: number } => x.km !== null && x.t !== null)
    .sort((a, b) => a.km - b.km || a.t - b.t);
  const startSec = known.find((x) => x.km === 0)?.t ?? opts.gunSec ?? null;
  const last = known.filter((x) => x.km > 0).pop();
  const finished = !!last && last.km >= opts.totalKm - 0.05;
  const paceSec = last && startSec !== null && last.t > startSec ? (last.t - startSec) / last.km : null;
  const kms = [...new Set([...cps.map((c) => (FINISH.test(c.name.trim()) ? opts.totalKm : c.km)), opts.totalKm])].sort((a, b) => a - b);
  const lastKm = last?.km ?? 0;
  const nextKm = finished ? null : kms.find((k) => k > lastKm + 0.01) ?? opts.totalKm;
  let estKm: number | null = null;
  if (finished) estKm = opts.totalKm;
  else if (last && paceSec) estKm = Math.min(nextKm ?? opts.totalKm, lastKm + Math.max(0, opts.nowSec - last.t) / paceSec);
  else if (known.some((x) => x.km === 0) && opts.nowSec >= (startSec ?? 0)) estKm = 0; // only once a start-mat split exists
  const finishSec = finished ? last!.t : paceSec && startSec !== null ? startSec + paceSec * opts.totalKm : null;
  return { startSec, lastKm, lastSec: last?.t ?? null, lastName: last?.name ?? '', paceSec, estKm: estKm === null ? null : finished ? opts.totalKm : Math.round(estKm * 100) / 100, nextKm, finishSec, finished };
}

/** Seconds of day in Korea time (all supported timing providers are Korean). */
export function kstNowSec(now = new Date()): number {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds();
}
