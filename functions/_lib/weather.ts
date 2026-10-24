import type { RaceMeta, Course } from '../../src/shared/types.ts';
import { meanDir, type HourWx, type WeatherReport } from '../../src/shared/weather.ts';
import { raceStartInstant, tzOffsetMinutes } from '../../src/shared/time.ts';
import type { Env } from './env.ts';
import { cacheGet, cacheSet } from './db.ts';

const UA = 'K-TRACKER/1.0 (+https://github.com/hakyong-tae/k-tracker; hy.tae@kakao.com)';
const HOURS = 7; // start hour + 6

const localHour = (d: Date, tz: string) => {
  const off = tzOffsetMinutes(tz, d);
  const l = new Date(d.getTime() + off * 60000);
  return `${String(l.getUTCHours()).padStart(2, '0')}:00`;
};

/** MET Norway Locationforecast (free incl. commercial use, CC BY 4.0). ~9 days ahead. */
async function forecast(meta: RaceMeta, lat: number, lon: number, start: Date): Promise<WeatherReport | null> {
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { headers: { 'user-agent': UA } });
  if (!r.ok) return null;
  const j = (await r.json()) as { properties: { timeseries: { time: string; data: { instant: { details: Record<string, number> }; next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount: number } }; next_6_hours?: { summary: { symbol_code: string }; details: { precipitation_amount: number } } } }[] } };
  const from = start.getTime() - 3600000, to = start.getTime() + HOURS * 3600000;
  const hours: HourWx[] = j.properties.timeseries
    .filter((s) => { const t = Date.parse(s.time); return t >= from && t <= to; })
    .map((s) => {
      const d = s.data.instant.details;
      const nx = s.data.next_1_hours ?? s.data.next_6_hours;
      return { hour: localHour(new Date(s.time), meta.timezone), t: d.air_temperature, rh: d.relative_humidity, wind: d.wind_speed, wdir: d.wind_from_direction ?? null, rain: nx?.details.precipitation_amount ?? null, symbol: nx?.summary.symbol_code ?? null };
    });
  if (!hours.length) return null;
  return { kind: 'forecast', source: 'MET Norway (api.met.no)', hours, fetchedAt: new Date().toISOString() };
}

/** NASA POWER hourly (public domain): average of the same local hours over recent years, race date ±2 days. */
async function climate(meta: RaceMeta, lat: number, lon: number, start: Date): Promise<WeatherReport | null> {
  const year = Number(meta.date.slice(0, 4));
  const now = new Date();
  const years: number[] = [];
  for (let y = year - 1; years.length < 5 && y >= year - 8; y--) {
    const d = new Date(Date.UTC(y, Number(meta.date.slice(5, 7)) - 1, Number(meta.date.slice(8, 10))));
    if (d.getTime() < now.getTime() - 10 * 86400000) years.push(y);
  }
  const startUtcHour = start.getUTCHours();
  const acc = new Map<number, { t: number[]; rh: number[]; ws: number[]; wd: number[]; pr: number[] }>();
  await Promise.all(years.map(async (y) => {
    const base = new Date(Date.UTC(y, Number(meta.date.slice(5, 7)) - 1, Number(meta.date.slice(8, 10))));
    const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const a = new Date(base.getTime() - 3 * 86400000), b = new Date(base.getTime() + 3 * 86400000);
    const u = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,RH2M,WS2M,WD2M,PRECTOTCORR&community=SB&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${ymd(a)}&end=${ymd(b)}&format=JSON&time-standard=UTC`;
    const r = await fetch(u, { headers: { 'user-agent': UA } });
    if (!r.ok) return;
    const j = (await r.json()) as { properties: { parameter: Record<string, Record<string, number>> } };
    const P = j.properties.parameter;
    for (const key of Object.keys(P.T2M ?? {})) {
      const hh = Number(key.slice(8, 10));
      const dayDiff = Math.abs(Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8)) - base.getTime()) / 86400000;
      if (dayDiff > 3) continue;
      const rel = (hh - startUtcHour + 24) % 24;
      if (rel >= HOURS) continue;
      const v = { t: P.T2M[key], rh: P.RH2M?.[key], ws: P.WS2M?.[key], wd: P.WD2M?.[key], pr: P.PRECTOTCORR?.[key] };
      if (v.t <= -900 || v.rh === undefined || v.rh <= -900) continue;
      const e = acc.get(rel) ?? { t: [], rh: [], ws: [], wd: [], pr: [] };
      e.t.push(v.t); e.rh.push(v.rh); if (v.ws !== undefined && v.ws > -900) e.ws.push(v.ws); if (v.wd !== undefined && v.wd > -900) e.wd.push(v.wd); if (v.pr !== undefined && v.pr > -900) e.pr.push(v.pr);
      acc.set(rel, e);
    }
  }));
  if (!acc.size) return null;
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const hours: HourWx[] = [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([rel, e]) => ({
    hour: localHour(new Date(start.getTime() + rel * 3600000), meta.timezone),
    t: +avg(e.t).toFixed(1), rh: Math.round(avg(e.rh)), wind: +avg(e.ws).toFixed(1), wdir: meanDir(e.wd), rain: +avg(e.pr).toFixed(2),
  }));
  return { kind: 'climate', source: 'NASA POWER (power.larc.nasa.gov)', hours, years: years.sort(), fetchedAt: new Date().toISOString() };
}

export async function raceWeather(env: Env, meta: RaceMeta, course: Course): Promise<WeatherReport | null> {
  const mid = Math.floor(course.lat.length / 2);
  const lat = (course.lat[0] + course.lat[mid]) / 2, lon = (course.lon[0] + course.lon[mid]) / 2;
  const start = raceStartInstant(meta.date, meta.startTime, meta.timezone);
  const until = start.getTime() - Date.now();
  if (until < -12 * 3600000) return null;
  const useForecast = until < 8.5 * 86400000;
  const key = `wx:${useForecast ? 'f' : 'c'}:${meta.slug}:${meta.date}:${meta.startTime}`;
  const cached = await cacheGet<WeatherReport>(env, key);
  if (cached) return cached;
  let rep = useForecast ? await forecast(meta, lat, lon, start) : null;
  if (!rep) rep = await climate(meta, lat, lon, start);
  if (rep) await cacheSet(env, key, rep, rep.kind === 'forecast' ? 3600 : 30 * 86400);
  return rep;
}
