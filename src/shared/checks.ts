import type { Course, RaceMeta } from './types.ts';
import { NOMINAL_M } from './types.ts';
import { haversine } from './geo.ts';

export interface Check { level: 'ok' | 'warn' | 'error'; code: string; detail?: string }

export function runChecks(c: Course, meta: Partial<RaceMeta>, opts: { existingSlugs?: string[] } = {}): Check[] {
  const out: Check[] = [];
  const nominal = meta.distance ? NOMINAL_M[meta.distance] : null;
  if (nominal) {
    const diff = (c.total - nominal) / nominal;
    const pct = (diff * 100).toFixed(1);
    if (Math.abs(diff) <= 0.01) out.push({ level: 'ok', code: 'distance', detail: pct });
    else if (Math.abs(diff) <= 0.03) out.push({ level: 'warn', code: 'distance', detail: pct });
    else out.push({ level: 'error', code: 'distance', detail: pct });
  }
  if (c.elevationSource === 'none') out.push({ level: 'warn', code: 'no-elevation' });
  // spikes: >15% grade sustained over 50 m is suspicious on a road course
  let spikes = 0;
  for (let i = 2; i < c.ele.length; i++) if (Math.abs(c.ele[i] - c.ele[i - 2]) / (2 * c.step) > 0.15) spikes++;
  if (spikes > 3) out.push({ level: 'warn', code: 'elevation-spikes', detail: String(spikes) });
  // gaps: consecutive samples far apart cannot happen after resampling, so check bbox sanity instead
  const span = haversine(c.bbox[1], c.bbox[0], c.bbox[3], c.bbox[2]);
  if (span > 60000) out.push({ level: 'error', code: 'bbox-too-large', detail: String(Math.round(span / 1000)) });
  const startFinish = haversine(c.lat[0], c.lon[0], c.lat[c.lat.length - 1], c.lon[c.lon.length - 1]);
  out.push({ level: 'ok', code: 'start-finish', detail: String(Math.round(startFinish)) });
  if (meta.slug && opts.existingSlugs?.includes(meta.slug)) out.push({ level: 'warn', code: 'duplicate-slug', detail: meta.slug });
  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) out.push({ level: 'error', code: 'bad-date' });
  if (meta.startTime && !/^\d{1,2}:\d{2}$/.test(meta.startTime)) out.push({ level: 'error', code: 'bad-start-time' });
  return out;
}

export function suggestScale(c: Course, distance: RaceMeta['distance']): number {
  const nominal = NOMINAL_M[distance];
  if (!nominal) return 1;
  const s = nominal / c.total;
  return Math.abs(1 - s) <= 0.03 ? +s.toFixed(5) : 1;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
