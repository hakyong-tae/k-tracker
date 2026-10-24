/** Dew point (°C) from temperature (°C) and relative humidity (%), Magnus formula. */
export function dewPoint(t: number, rh: number): number {
  const a = 17.62, b = 243.12;
  const g = Math.log(Math.max(1, rh) / 100) + (a * t) / (b + t);
  return (b * g) / (a - g);
}

/**
 * Pace slowdown suggestion from temperature + dew point (°F sum rule used by many coaches).
 * Returns [minPct, maxPct] or null when running hard is not advised.
 */
export function heatAdjustment(tC: number, dewC: number): { min: number; max: number; level: 0 | 1 | 2 | 3 | 4 | 5 } | null {
  const f = (c: number) => (c * 9) / 5 + 32;
  const s = f(tC) + f(dewC);
  if (s <= 100) return { min: 0, max: 0, level: 0 };
  if (s <= 110) return { min: 0, max: 0.5, level: 1 };
  if (s <= 120) return { min: 0.5, max: 1, level: 1 };
  if (s <= 130) return { min: 1, max: 2, level: 2 };
  if (s <= 140) return { min: 2, max: 3, level: 2 };
  if (s <= 150) return { min: 3, max: 4.5, level: 3 };
  if (s <= 160) return { min: 4.5, max: 6, level: 3 };
  if (s <= 170) return { min: 6, max: 8, level: 4 };
  if (s <= 180) return { min: 8, max: 10, level: 5 };
  return null;
}

export interface HourWx { hour: string; t: number; rh: number; wind: number; wdir?: number | null; rain?: number | null; symbol?: string | null }
export interface WeatherReport {
  kind: 'forecast' | 'climate';
  source: string;
  hours: HourWx[];
  years?: number[];
  fetchedAt: string;
}

/** Wind relative to running direction: 'head' | 'tail' | 'cross'. `from` is meteorological (where wind comes from). */
export function windRelative(headingDeg: number, fromDeg: number): 'head' | 'tail' | 'cross' {
  const d = Math.abs((((fromDeg - headingDeg) % 360) + 540) % 360 - 180); // 0 = wind from straight ahead
  return d <= 50 ? 'head' : d >= 130 ? 'tail' : 'cross';
}

/** Circular mean of directions in degrees. */
export function meanDir(dirs: number[]): number | null {
  if (!dirs.length) return null;
  let x = 0, y = 0;
  for (const d of dirs) { x += Math.cos((d * Math.PI) / 180); y += Math.sin((d * Math.PI) / 180); }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
