import type { Course, L10n, Poi, PoiType, RaceMeta, Segment } from './types.ts';
import { gainLoss } from './course.ts';

const POI_TYPES: PoiType[] = ['water', 'sports-drink', 'food', 'gel', 'medical', 'toilet', 'landmark', 'turnaround', 'cutoff', 'hill'];
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const l10n = (v: unknown, max = 200): L10n => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { ko: str(o.ko, max), en: str(o.en, max) };
};
const num = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const url = (v: unknown): string | null => {
  const s = str(v, 500);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null;
};

/** Coerce untrusted input into a RaceMeta, dropping anything malformed. Throws on missing essentials. */
export function sanitizeMeta(input: unknown): RaceMeta {
  const o = (input ?? {}) as Record<string, unknown>;
  const name = l10n(o.name, 120);
  if (!name.ko && !name.en) throw new Error('name-required');
  const date = str(o.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date-required');
  const startTime = str(o.startTime, 5) || '08:00';
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) throw new Error('bad-start-time');
  const timezone = str(o.timezone, 64) || 'Asia/Seoul';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('bad-timezone'); }
  const distance = (['full', 'half', '10k', 'other'] as const).includes(o.distance as never) ? (o.distance as RaceMeta['distance']) : 'full';
  const slug = str(o.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) throw new Error('slug-required');
  const pois: Poi[] = (Array.isArray(o.pois) ? o.pois : []).slice(0, 80).flatMap((p: Record<string, unknown>) => {
    const km = num(p?.km, 0, 120);
    const type = POI_TYPES.includes(p?.type as PoiType) ? (p.type as PoiType) : null;
    if (km === null || !type) return [];
    const nm = p.name ? l10n(p.name, 80) : null;
    return [{ km: Math.round(km * 100) / 100, type, name: nm && (nm.ko || nm.en) ? nm : null }];
  }).sort((a, b) => a.km - b.km);
  const segments: Segment[] = (Array.isArray(o.segments) ? o.segments : []).slice(0, 20).flatMap((s: Record<string, unknown>) => {
    const fromKm = num(s?.fromKm, 0, 120), toKm = num(s?.toKm, 0, 120);
    if (fromKm === null || toKm === null || toKm <= fromKm) return [];
    return [{ fromKm, toKm, title: l10n(s.title, 120), tip: l10n(s.tip, 400) }];
  });
  const notesIn = (o.notes ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 20).map((x) => str(x, 400)).filter(Boolean) : []);
  const cs = o.courseSource as Record<string, unknown> | null | undefined;
  const live = o.live as Record<string, unknown> | null | undefined;
  return {
    slug, name, date, startTime: startTime.padStart(5, '0'), timezone,
    country: str(o.country, 2).toUpperCase() || 'KR',
    city: l10n(o.city, 80),
    distance,
    officialUrl: url(o.officialUrl),
    cutoff: /^\d{1,2}:\d{2}$/.test(str(o.cutoff, 5)) ? str(o.cutoff, 5) : null,
    courseSource: cs ? { type: str(cs.type, 40) || 'community-gpx', url: url(cs.url), note: typeof cs.note === 'object' && cs.note ? l10n(cs.note, 1200) : str(cs.note, 1200) || null } : null,
    pois, segments,
    notes: { ko: list(notesIn.ko), en: list(notesIn.en) },
    sources: (Array.isArray(o.sources) ? o.sources : []).map(url).filter((x): x is string => !!x).slice(0, 15),
    credit: str(o.credit, 40) || null,
    scale: num(o.scale, 0.9, 1.1) ?? 1,
    live: live && ['myresult', 'spct', 'smartchip'].includes(live.provider as string) && str(live.eventId, 40)
      ? { provider: live.provider as 'myresult' | 'spct' | 'smartchip', eventId: str(live.eventId, 40) } : null,
  };
}

/** Validate a client-computed course. Recomputes derived stats so they cannot be spoofed. */
export function validateCourse(input: unknown): Course {
  const c = (input ?? {}) as Record<string, unknown>;
  const lat = c.lat, lon = c.lon, ele = c.ele;
  const step = num(c.step, 5, 200);
  if (!step || !Array.isArray(lat) || !Array.isArray(lon) || !Array.isArray(ele)) throw new Error('bad-course');
  const n = lat.length;
  if (n < 20 || n > 12000 || lon.length !== n || ele.length !== n) throw new Error('bad-course-size');
  for (let i = 0; i < n; i++) {
    if (typeof lat[i] !== 'number' || Math.abs(lat[i]) > 90 || typeof lon[i] !== 'number' || Math.abs(lon[i]) > 180 || typeof ele[i] !== 'number' || ele[i] < -500 || ele[i] > 9000)
      throw new Error('bad-course-values');
  }
  const total = num(c.total, (n - 2) * step, (n - 1) * step + 0.5);
  if (total === null) throw new Error('bad-course-total');
  const { gain, loss } = gainLoss(ele as number[]);
  const src = c.elevationSource === 'gpx' || c.elevationSource === 'dem' ? c.elevationSource : 'none';
  return {
    v: 1, step, total, lat: lat as number[], lon: lon as number[], ele: ele as number[],
    gain: Math.round(gain), loss: Math.round(loss),
    minEle: Math.min(...(ele as number[])), maxEle: Math.max(...(ele as number[])),
    bbox: [Math.min(...(lon as number[])), Math.min(...(lat as number[])), Math.max(...(lon as number[])), Math.max(...(lat as number[]))],
    elevationSource: src,
  };
}
