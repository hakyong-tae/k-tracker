import { parseGpx, type ParsedGpx } from '../shared/gpx.ts';
import { buildCourse } from '../shared/course.ts';
import { haversine } from '../shared/geo.ts';
import type { Course } from '../shared/types.ts';

/** Parse a GPX in the browser and build the resampled course, filling elevation from a DEM if missing. */
export async function courseFromText(text: string, onStatus?: (s: string) => void): Promise<{ gpx: ParsedGpx; course: Course }> {
  const gpx = parseGpx(text);
  if (gpx.points.length < 2) throw new Error('no-track');
  const hasEle = gpx.points.filter((p) => p.ele !== null).length >= gpx.points.length * 0.5;
  if (!hasEle) {
    onStatus?.('dem');
    const pts = gpx.points;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon));
    const total = cum[cum.length - 1];
    const M = Math.min(300, Math.max(2, Math.ceil(total / 120)));
    const sampleIdx: number[] = [];
    let j = 0;
    for (let k = 0; k < M; k++) { const target = (total * k) / (M - 1); while (j < cum.length - 1 && cum[j] < target) j++; sampleIdx.push(j); }
    const r = await fetch('/api/elevation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ points: sampleIdx.map((i) => [pts[i].lat, pts[i].lon]) }) });
    if (!r.ok) throw new Error('dem-failed');
    const { elevation } = (await r.json()) as { elevation: number[] };
    // interpolate DEM samples back onto every raw point by distance
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      while (s < sampleIdx.length - 2 && cum[sampleIdx[s + 1]] < cum[i]) s++;
      const a = cum[sampleIdx[s]], b = cum[sampleIdx[s + 1]] || a + 1;
      const t = Math.max(0, Math.min(1, (cum[i] - a) / (b - a)));
      pts[i].ele = elevation[s] + (elevation[s + 1] - elevation[s]) * t;
    }
    const course = buildCourse(pts);
    course.elevationSource = 'dem';
    return { gpx, course };
  }
  return { gpx, course: buildCourse(gpx.points) };
}
