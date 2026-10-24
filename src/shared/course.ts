import type { Course } from './types.ts';
import type { RawPoint, RawWaypoint } from './gpx.ts';
import { haversine } from './geo.ts';

export const STEP = 25;

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Cumulative distance array for raw points (drops exact duplicates). */
function clean(points: RawPoint[]): { pts: RawPoint[]; cum: number[] } {
  const pts: RawPoint[] = [];
  const cum: number[] = [];
  for (const p of points) {
    if (!pts.length) { pts.push(p); cum.push(0); continue; }
    const last = pts[pts.length - 1];
    const d = haversine(last.lat, last.lon, p.lat, p.lon);
    if (d < 0.5) continue;
    pts.push(p);
    cum.push(cum[cum.length - 1] + d);
  }
  return { pts, cum };
}

function fillMissing(vals: (number | null)[]): number[] | null {
  const idx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (idx.length < Math.max(2, vals.length * 0.5)) return null;
  const out = new Array<number>(vals.length);
  let k = 0;
  for (let i = 0; i < vals.length; i++) {
    while (k < idx.length - 1 && idx[k + 1] <= i) k++;
    const a = idx[k], b = idx[Math.min(k + 1, idx.length - 1)];
    const va = vals[a] as number, vb = vals[b] as number;
    out[i] = i <= a || a === b ? va : i >= b ? vb : va + ((vb - va) * (i - a)) / (b - a);
  }
  return out;
}

/** Median filter then moving average over ±halfWin samples. */
export function smooth(vals: number[], halfWin: number): number[] {
  const med = vals.map((_, i) => {
    const w = vals.slice(Math.max(0, i - 1), i + 2).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
  const out = new Array<number>(vals.length);
  let sum = 0, n = 0, lo = 0, hi = -1;
  for (let i = 0; i < vals.length; i++) {
    const a = Math.max(0, i - halfWin), b = Math.min(vals.length - 1, i + halfWin);
    while (hi < b) { hi++; sum += med[hi]; n++; }
    while (lo < a) { sum -= med[lo]; lo++; n--; }
    out[i] = sum / n;
  }
  return out;
}

export function gainLoss(ele: number[], hysteresis = 0.75): { gain: number; loss: number } {
  let gain = 0, loss = 0, ref = ele[0];
  for (const e of ele) {
    if (e - ref >= hysteresis) { gain += e - ref; ref = e; }
    else if (ref - e >= hysteresis) { loss += ref - e; ref = e; }
  }
  return { gain, loss };
}

/**
 * Resample a raw track every `step` meters and smooth the elevation.
 * `demElevation` lets callers supply elevations (e.g. from a DEM) when the GPX has none.
 */
export function buildCourse(points: RawPoint[], opts: { step?: number; demElevation?: number[] | null } = {}): Course {
  const step = opts.step ?? STEP;
  const { pts, cum } = clean(points);
  if (pts.length < 2) throw new Error('too-few-points');
  const total = cum[cum.length - 1];
  if (total < 500) throw new Error('too-short');

  let rawEle = fillMissing(pts.map((p) => p.ele));
  let elevationSource: Course['elevationSource'] = rawEle ? 'gpx' : 'none';
  if (!rawEle && opts.demElevation && opts.demElevation.length === pts.length) {
    rawEle = opts.demElevation;
    elevationSource = 'dem';
  }

  const n = Math.floor(total / step) + 1;
  const lat: number[] = [], lon: number[] = [], ele: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.min(i * step, total);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    lat.push(round(pts[j].lat + (pts[j + 1].lat - pts[j].lat) * t, 6));
    lon.push(round(pts[j].lon + (pts[j + 1].lon - pts[j].lon) * t, 6));
    ele.push(rawEle ? rawEle[j] + (rawEle[j + 1] - rawEle[j]) * t : 0);
  }
  // keep the true finish point
  if ((n - 1) * step < total - 1) {
    const last = pts[pts.length - 1];
    lat.push(round(last.lat, 6)); lon.push(round(last.lon, 6)); ele.push(rawEle ? rawEle[rawEle.length - 1] : 0);
  }
  const sm = smooth(ele, Math.max(1, Math.round(75 / step))).map((e) => round(e, 1));
  const { gain, loss } = gainLoss(sm);
  return {
    v: 1, step, total: round(total, 1), lat, lon, ele: sm,
    gain: Math.round(gain), loss: Math.round(loss),
    minEle: Math.min(...sm), maxEle: Math.max(...sm),
    bbox: [Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat)],
    elevationSource,
  };
}

/** Distance (m, raw GPX scale) of sample i. The last sample may be shorter than step. */
export const sampleDist = (c: Course, i: number) => Math.min(i * c.step, c.total);

/** Interpolated value at raw distance d (m). */
export function at(c: Course, arr: number[], d: number): number {
  const x = Math.max(0, Math.min(c.total, d)) / c.step;
  const i = Math.min(arr.length - 2, Math.floor(x));
  const t = Math.min(1, x - i);
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}

/** Grade in percent at raw distance d, measured over ±window m. */
export function gradeAt(c: Course, d: number, window = 100): number {
  const a = Math.max(0, d - window), b = Math.min(c.total, d + window);
  if (b - a < 1) return 0;
  return ((at(c, c.ele, b) - at(c, c.ele, a)) / (b - a)) * 100;
}

/** Nearest sample index along the course to a coordinate. */
export function nearestIndex(c: Course, lat: number, lon: number): { i: number; dist: number } {
  let best = 0, bd = Infinity;
  for (let i = 0; i < c.lat.length; i++) {
    const d = haversine(lat, lon, c.lat[i], c.lon[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, dist: bd };
}

/** Snap GPX waypoints to the course and return their official km (after scale). */
export function waypointsToKm(c: Course, wps: RawWaypoint[], scale = 1): { km: number; name: string; type: string | null; off: number }[] {
  return wps
    .map((w) => {
      const { i, dist } = nearestIndex(c, w.lat, w.lon);
      return { km: round((sampleDist(c, i) * scale) / 1000, 2), name: w.name, type: w.type, off: Math.round(dist) };
    })
    .sort((a, b) => a.km - b.km);
}
