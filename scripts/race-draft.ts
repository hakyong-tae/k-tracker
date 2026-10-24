// Usage: node scripts/race-draft.ts <course.gpx> [--distance full|half|10k|other] [--every 1000] [--no-geocode] [--out draft.json]
//
// Prints the facts a race page is written from: course stats, official-km scale, 5 km segment stats,
// climbs, likely turnarounds, and OpenStreetMap place names along each segment (reverse geocoding).
// Nominatim policy: max 1 request/second, identifying User-Agent, results cached in .cache/geocode.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseGpx } from '../src/shared/gpx.ts';
import { buildCourse, waypointsToKm } from '../src/shared/course.ts';
import { segmentStats, findClimbs } from '../src/shared/segments.ts';
import { runChecks, suggestScale } from '../src/shared/checks.ts';
import { bearing, angleDiff } from '../src/shared/geo.ts';
import type { Course, DistanceType } from '../src/shared/types.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (k: string, d?: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error('usage: node scripts/race-draft.ts <course.gpx> [--distance full] [--every 1000] [--no-geocode] [--out draft.json]'); process.exit(1); }

const distance = (opt('distance', 'full') as DistanceType);
const every = Number(opt('every', '1000'));
const geocode = !args.includes('--no-geocode');
const UA = 'K-TRACKER race-draft/1.0 (+https://k-tracker-vit.pages.dev; hy.tae@kakao.com)';
const CACHE = '.cache/geocode.json';

const gpx = parseGpx(readFileSync(file, 'utf8'));
const course = buildCourse(gpx.points);
const scale = suggestScale(course, distance);
const km = (d: number) => +((d * scale) / 1000).toFixed(2);

/** Out-and-back U-turns: heading flips by >150° within ±60 m. */
function turnarounds(c: Course): number[] {
  const out: number[] = [];
  const w = Math.max(1, Math.round(60 / c.step));
  for (let i = w; i < c.lat.length - w; i++) {
    const b1 = bearing(c.lat[i - w], c.lon[i - w], c.lat[i], c.lon[i]);
    const b2 = bearing(c.lat[i], c.lon[i], c.lat[i + w], c.lon[i + w]);
    if (Math.abs(angleDiff(b1, b2)) > 150) {
      const k = km(i * c.step);
      if (!out.length || k - out[out.length - 1] > 1) out.push(k);
    }
  }
  return out;
}

type Place = { road?: string; roadEn?: string; area?: string; name?: string; country?: string };
async function reverse(lat: number, lon: number, cache: Record<string, Place>): Promise<Place> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache[key]) return cache[key];
  await new Promise((r) => setTimeout(r, 1100));
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17&namedetails=1&accept-language=ko,en`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = (await r.json()) as { name?: string; address?: Record<string, string>; namedetails?: Record<string, string> };
  const a = j.address ?? {};
  const p: Place = {
    road: a.road ?? a.pedestrian ?? a.footway ?? a.cycleway ?? a.path,
    roadEn: j.namedetails?.['name:en'],
    area: a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.village ?? a.town,
    name: j.name && j.name !== (a.road ?? '') ? j.name : undefined,
    country: a.country_code?.toUpperCase(),
  };
  cache[key] = p;
  return p;
}

const segs = segmentStats(course, scale, 5);
const climbs = findClimbs(course, scale, 8);
const turns = turnarounds(course);
const draft: Record<string, unknown> = {
  file,
  checks: runChecks(course, { distance }),
  rawKm: +(course.total / 1000).toFixed(3),
  scale,
  officialKm: +((course.total * scale) / 1000).toFixed(3),
  gain: course.gain, loss: course.loss, minEle: course.minEle, maxEle: course.maxEle, elevationSource: course.elevationSource,
  start: [course.lat[0], course.lon[0]],
  finish: [course.lat[course.lat.length - 1], course.lon[course.lon.length - 1]],
  climbs, turnarounds: turns,
  waypoints: gpx.waypoints.length ? waypointsToKm(course, gpx.waypoints, scale) : [],
};

let places: { km: number; place: Place }[] = [];
if (geocode) {
  mkdirSync('.cache', { recursive: true });
  const cache: Record<string, Place> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const stepIdx = Math.max(1, Math.round(every / scale / course.step));
  const idx: number[] = [];
  for (let i = 0; i < course.lat.length; i += stepIdx) idx.push(i);
  if (idx[idx.length - 1] !== course.lat.length - 1) idx.push(course.lat.length - 1);
  // bridges and overpasses are usually climb tops; U-turn points name the turnaround
  const toIdx = (k: number) => Math.min(course.lat.length - 1, Math.round((k * 1000) / scale / course.step));
  for (const k of [...climbs.map((c) => c.toKm), ...turns]) idx.push(toIdx(k));
  idx.sort((a, b) => a - b);
  for (const i of idx) {
    try { places.push({ km: km(i * course.step), place: await reverse(course.lat[i], course.lon[i], cache) }); }
    catch (e) { console.error(`geocode failed at ${km(i * course.step)} km: ${(e as Error).message}`); break; }
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  draft.country = places[0]?.place.country ?? null;
}

draft.turnaroundPlaces = turns.map((t) => ({ km: t, place: places.reduce((b, p) => (Math.abs(p.km - t) < Math.abs(b.km - t) ? p : b), places[0] ?? { km: t, place: {} }).place }));
draft.climbPlaces = climbs.map((c) => ({ ...c, place: places.reduce((b, p) => (Math.abs(p.km - c.toKm) < Math.abs(b.km - c.toKm) ? p : b), places[0] ?? { km: c.toKm, place: {} }).place }));
draft.segments = segs.map((s) => {
  const inSeg = places.filter((p) => p.km >= s.fromKm - 0.01 && p.km <= s.toKm + 0.01);
  const uniq = (xs: (string | undefined)[]) => xs.filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  return {
    fromKm: s.fromKm, toKm: s.toKm, gain: s.gain, loss: s.loss, maxGrade: s.maxGrade, minGrade: s.minGrade,
    climbs: climbs.filter((c) => c.toKm > s.fromKm && c.fromKm < s.toKm),
    turnarounds: turns.filter((t) => t >= s.fromKm && t < s.toKm),
    roads: uniq(inSeg.map((p) => p.place.road)),
    roadsEn: uniq(inSeg.map((p) => p.place.roadEn)),
    areas: uniq(inSeg.map((p) => p.place.area)),
    landmarks: uniq(inSeg.map((p) => p.place.name)),
    bridges: uniq(inSeg.map((p) => p.place.road ?? p.place.name).filter((n) => n && /교$|대교|다리|bridge/i.test(n))),
  };
});
draft.attribution = geocode ? 'Place names © OpenStreetMap contributors (Nominatim)' : null;

const json = JSON.stringify(draft, null, 2);
const out = opt('out');
if (out) { writeFileSync(out, json); console.error(`draft written to ${out}`); } else console.log(json);
