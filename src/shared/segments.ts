import type { Course } from './types.ts';
import { gradeAt } from './course.ts';

export interface SegStat { fromKm: number; toKm: number; gain: number; loss: number; maxGrade: number; minGrade: number; profile: number[] }

/** Elevation stats per official-km window. */
export function segmentStats(c: Course, scale = 1, every = 5): SegStat[] {
  const totalKm = (c.total * scale) / 1000;
  const out: SegStat[] = [];
  for (let a = 0; a < totalKm - 0.05; a += every) {
    const b = Math.min(totalKm, a + every);
    const i0 = Math.round((a * 1000) / scale / c.step), i1 = Math.min(c.ele.length - 1, Math.round((b * 1000) / scale / c.step));
    let gain = 0, loss = 0, maxG = -99, minG = 99;
    for (let i = i0 + 1; i <= i1; i++) {
      const de = c.ele[i] - c.ele[i - 1];
      if (de > 0) gain += de; else loss -= de;
    }
    for (let i = i0; i <= i1; i += 4) {
      const g = gradeAt(c, i * c.step, 100);
      maxG = Math.max(maxG, g); minG = Math.min(minG, g);
    }
    const profile: number[] = [];
    const N = 24;
    for (let k = 0; k <= N; k++) profile.push(c.ele[Math.round(i0 + ((i1 - i0) * k) / N)]);
    out.push({ fromKm: a, toKm: Math.round(b * 1000) / 1000, gain: Math.round(gain), loss: Math.round(loss), maxGrade: +maxG.toFixed(1), minGrade: +minG.toFixed(1), profile });
  }
  return out;
}

/** Find notable climbs: continuous stretches gaining ≥ minGain m (a drop of >4 m ends a climb). */
export function findClimbs(c: Course, scale = 1, minGain = 10): { fromKm: number; toKm: number; gain: number; avgGrade: number }[] {
  const out: { fromKm: number; toKm: number; gain: number; avgGrade: number }[] = [];
  let low = c.ele[0], high = c.ele[0], highI = 0, from = 0;
  const flush = () => {
    if (high - low < minGain) return;
    // climb starts where we last left the valley floor
    let s = highI;
    while (s > from && c.ele[s - 1] > low + 1) s--;
    const len = Math.max(c.step, (highI - s) * c.step);
    const km = (i: number) => +((i * c.step * scale) / 1000).toFixed(2);
    out.push({ fromKm: km(s), toKm: km(highI), gain: Math.round(high - low), avgGrade: +(((high - low) / len) * 100).toFixed(1) });
  };
  for (let i = 1; i < c.ele.length; i++) {
    const e = c.ele[i];
    if (e < low && high - low < minGain) { low = e; high = e; highI = i; from = i; continue; }
    if (e > high) { high = e; highI = i; }
    if (high - e > 4) { flush(); low = e; high = e; highI = i; from = i; }
  }
  flush();
  return out;
}
