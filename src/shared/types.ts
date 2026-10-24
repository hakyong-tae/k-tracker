export type Lang = 'ko' | 'en';
export type L10n = { ko: string; en: string };

export type PoiType =
  | 'water' | 'sports-drink' | 'food' | 'gel' | 'medical' | 'toilet'
  | 'landmark' | 'turnaround' | 'cutoff' | 'hill';

export interface Poi { km: number; type: PoiType; name?: L10n | null }

export interface Segment { fromKm: number; toKm: number; title: L10n; tip: L10n }

export type DistanceType = 'full' | 'half' | '10k' | 'other';

export interface RaceMeta {
  slug: string;
  name: L10n;
  date: string;            // YYYY-MM-DD (local)
  startTime: string;       // HH:MM (local)
  timezone: string;        // IANA, e.g. Asia/Seoul
  country: string;         // ISO-3166 alpha-2
  city: L10n;
  distance: DistanceType;
  officialUrl?: string | null;
  cutoff?: string | null;  // H:MM
  courseSource?: { type: string; url?: string | null; note?: L10n | string | null } | null;
  pois: Poi[];
  segments: Segment[];
  notes: { ko: string[]; en: string[] };
  sources: string[];
  credit?: string | null;  // contributor nickname
  /** km markers in GPX are stretched/shrunk to the official distance by this factor */
  scale?: number;
  /** timing provider for the live tracker (K-TRACKER) */
  live?: { provider: 'myresult' | 'spct' | 'smartchip'; eventId: string } | null;
}

/** Resampled course, every `step` meters along the track. */
export interface Course {
  v: 1;
  step: number;
  total: number;   // meters, raw GPX length
  lat: number[];
  lon: number[];
  ele: number[];   // smoothed, meters
  gain: number;
  loss: number;
  minEle: number;
  maxEle: number;
  bbox: [number, number, number, number]; // w,s,e,n
  elevationSource: 'gpx' | 'dem' | 'none';
}

export interface RaceRecord { id: number; slug: string; status: string; meta: RaceMeta; course: Course; updatedAt?: string }

export const NOMINAL_M: Record<DistanceType, number | null> = {
  full: 42195, half: 21097.5, '10k': 10000, other: null,
};
