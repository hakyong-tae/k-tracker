import type { Course } from './types.ts';
import { gradeAt, sampleDist } from './course.ts';

/**
 * Time multiplier for running on a grade (percent).
 * Uphill ≈ +3.3%/1%, downhill ≈ −1.8%/1% with diminishing benefit past −9%.
 * Matches common grade-adjusted-pace tables closely enough for split planning.
 */
export function gradeFactor(g: number): number {
  const x = Math.max(-20, Math.min(20, g));
  if (x >= 0) return 1 + 0.033 * x;
  if (x >= -9) return 1 + 0.018 * x;
  return 1 - 0.018 * 9 + 0.01 * (-x - 9); // steep descents get harder again
}

export interface Split { km: number; elapsed: number; lap: number; lapPace: number; gain: number; loss: number }

/**
 * Even-effort plan: time per sample ∝ gradeFactor, normalized so the finish equals targetSec.
 * `scale` maps raw GPX meters to official meters. Splits are taken every `every` official km,
 * plus extra marks (e.g. half) and the finish.
 */
export function planSplits(c: Course, targetSec: number, opts: { scale?: number; every?: number; extra?: number[] } = {}): {
  splits: Split[]; at: (officialKm: number) => number; avgPace: number; officialTotal: number;
} {
  const scale = opts.scale ?? 1;
  const n = c.lat.length;
  const w = new Array<number>(n).fill(0); // effort-weighted length of segment i-1..i
  let sum = 0;
  for (let i = 1; i < n; i++) {
    const d0 = sampleDist(c, i - 1), d1 = sampleDist(c, i);
    const f = gradeFactor(gradeAt(c, (d0 + d1) / 2, 50));
    w[i] = (d1 - d0) * f;
    sum += w[i];
  }
  const cumT = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cumT[i] = cumT[i - 1] + (w[i] / sum) * targetSec;

  const officialTotal = c.total * scale;
  const at = (km: number) => {
    const d = Math.max(0, Math.min(c.total, (km * 1000) / scale));
    const x = d / c.step;
    const i = Math.min(n - 2, Math.floor(x));
    const segLen = sampleDist(c, i + 1) - sampleDist(c, i) || 1;
    const t = Math.min(1, (d - sampleDist(c, i)) / segLen);
    return cumT[i] + (cumT[i + 1] - cumT[i]) * t;
  };
  const eleAt = (km: number) => {
    const d = Math.max(0, Math.min(c.total, (km * 1000) / scale));
    const i = Math.min(n - 1, Math.round(d / c.step));
    return i;
  };
  const every = opts.every ?? 5;
  const marks = new Set<number>();
  for (let k = every; k < officialTotal / 1000 - 0.05; k += every) marks.add(Math.round(k * 1000) / 1000);
  for (const e of opts.extra ?? []) if (e > 0 && e < officialTotal / 1000) marks.add(e);
  const finishKm = Math.round(officialTotal) / 1000;
  const list = [...marks].sort((a, b) => a - b).concat(finishKm);

  const splits: Split[] = [];
  let prevKm = 0, prevT = 0;
  for (const km of list) {
    const t = km === finishKm ? targetSec : at(km);
    let gain = 0, loss = 0;
    const i0 = eleAt(prevKm), i1 = eleAt(km);
    for (let i = i0 + 1; i <= i1; i++) {
      const de = c.ele[i] - c.ele[i - 1];
      if (de > 0) gain += de; else loss -= de;
    }
    splits.push({ km, elapsed: t, lap: t - prevT, lapPace: (t - prevT) / (km - prevKm), gain: Math.round(gain), loss: Math.round(loss) });
    prevKm = km; prevT = t;
  }
  return { splits, at, avgPace: targetSec / (officialTotal / 1000), officialTotal };
}
