import type { Course, RaceMeta } from './types.ts';
import { NOMINAL_M } from './types.ts';

export function defaultTarget(meta: RaceMeta, c: Course): number {
  if (meta.distance === 'full') return 4 * 3600;
  if (meta.distance === 'half') return 2 * 3600;
  if (meta.distance === '10k') return 55 * 60;
  return Math.round(((c.total * (meta.scale ?? 1)) / 1000) * 360);
}
export const officialKm = (meta: RaceMeta, c: Course) => (NOMINAL_M[meta.distance] ?? c.total * (meta.scale ?? 1)) / 1000;
export const TARGET_PRESETS: Record<RaceMeta['distance'], string[]> = {
  full: ['3:00', '3:30', '4:00', '4:30', '5:00', '5:30'],
  half: ['1:30', '1:45', '2:00', '2:15', '2:30'],
  '10k': ['0:40', '0:45', '0:50', '0:55', '1:00', '1:10'],
  other: [],
};
