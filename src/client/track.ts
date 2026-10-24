import type { Course, RaceMeta } from '../shared/types.ts';
import { at, gradeAt } from '../shared/course.ts';
import { bearing, angleDiff } from '../shared/geo.ts';

/** Client-side derived geometry: local ENU meters, headings, official-km mapping. */
export class Track {
  readonly c: Course;
  readonly scale: number;
  readonly x: Float64Array; // east meters from start
  readonly y: Float64Array; // north meters from start
  readonly heading: Float64Array; // deg, smoothed
  readonly totalKm: number;

  constructor(meta: RaceMeta, c: Course) {
    this.c = c;
    this.scale = meta.scale ?? 1;
    const n = c.lat.length;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    const lat0 = c.lat[0], lon0 = c.lon[0];
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
    for (let i = 0; i < n; i++) { this.x[i] = (c.lon[i] - lon0) * kx; this.y[i] = (c.lat[i] - lat0) * ky; }
    const raw = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      raw[i] = bearing(c.lat[a], c.lon[a], c.lat[b], c.lon[b]);
    }
    // smooth headings with unwrapped average ±2 samples
    this.heading = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, k = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sum += angleDiff(raw[i], raw[j]); k++; }
      this.heading[i] = (raw[i] + sum / k + 360) % 360;
    }
    this.totalKm = (c.total * this.scale) / 1000;
  }
  /** raw meters ↔ official km */
  km(d: number) { return (d * this.scale) / 1000; }
  dist(km: number) { return Math.max(0, Math.min(this.c.total, (km * 1000) / this.scale)); }
  ele(d: number) { return at(this.c, this.c.ele, d); }
  grade(d: number) { return gradeAt(this.c, d, 100); }
  pos(d: number): [number, number] { return [at(this.c, this.x as unknown as number[], d), at(this.c, this.y as unknown as number[], d)]; }
  latlon(d: number): [number, number] { return [at(this.c, this.c.lat, d), at(this.c, this.c.lon, d)]; }
  headingAt(d: number): number {
    const i = Math.min(this.heading.length - 1, Math.max(0, Math.round(d / this.c.step)));
    return this.heading[i];
  }
  /** heading looking `ahead` meters forward (camera smoothing) */
  lookHeading(d: number, ahead = 40): number {
    const [x0, y0] = this.pos(d), [x1, y1] = this.pos(Math.min(this.c.total, d + ahead));
    if (Math.hypot(x1 - x0, y1 - y0) < 1) return this.headingAt(d);
    return (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI;
  }
}

export const compass = (deg: number, lang: 'ko' | 'en') => {
  const ko = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return lang === 'ko' ? ko[i] : en[i];
};
