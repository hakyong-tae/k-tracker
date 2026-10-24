import type { Course } from './types.ts';

export interface Thumb { route: string; elev: string; w: number; h: number }

/** Precomputed card art: the course outline (equal-scale, north up) and an elevation sparkline. */
export function makeThumb(c: Course, w = 120, h = 120, ew = 200, eh = 36): Thumb {
  const n = c.lat.length;
  const step = Math.max(1, Math.floor(n / 160));
  const lat0 = c.lat[0];
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i += step) { xs.push(c.lon[i] * kx); ys.push(c.lat[i]); }
  xs.push(c.lon[n - 1] * kx); ys.push(c.lat[n - 1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = 8, s = (Math.min(w, h) - pad * 2) / span;
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
  const route = xs.map((x, i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * s).toFixed(1)} ${(h - oy - (ys[i] - minY) * s).toFixed(1)}`).join('');
  const m = 48;
  const lo = c.minEle, hi = Math.max(c.minEle + 20, c.maxEle);
  const pts: string[] = [];
  for (let k = 0; k <= m; k++) {
    const e = c.ele[Math.round(((n - 1) * k) / m)];
    pts.push(`${((ew * k) / m).toFixed(1)} ${(eh - 2 - ((e - lo) / (hi - lo)) * (eh - 6)).toFixed(1)}`);
  }
  const elev = `M0 ${eh}L${pts.join('L')}L${ew} ${eh}Z`;
  return { route, elev, w, h };
}
