import type { Env } from './env.ts';
import { listRaces } from './db.ts';
import { swr, upstream } from '../api/live/_upstream.ts';
import { parseMyResultEvents, parseSpctEvents, type LiveRace, type Provider } from '../../src/shared/live.ts';
import type { Thumb } from '../../src/shared/thumb.ts';
import type { Lang } from '../../src/shared/types.ts';
import { l } from '../../src/shared/i18n.ts';

export async function loadMyResult(): Promise<LiveRace[]> {
  const pages = await Promise.all([1, 2, 3].map(async (p) => parseMyResultEvents(await (await upstream(`https://myresult.co.kr/api/event/?page=${p}`, 'application/json')).json())));
  const seen = new Set<string>();
  return pages.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
export async function loadSpct(): Promise<LiveRace[]> {
  const pages = await Promise.all([1, 2, 3].map(async (p) => parseSpctEvents(await (await upstream(`https://time.spct.kr/main.php?currentPage=${p}`)).text())));
  const seen = new Set<string>();
  return pages.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
export const liveRaces = (env: Env, provider: Provider) =>
  swr(env, `live:races:${provider}`, 20 * 60, provider === 'myresult' ? loadMyResult : loadSpct);

export interface CatalogItem {
  key: string;
  href: string;
  name: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM or ''
  place: string;
  country: string;
  distanceKm: number | null;
  gain: number | null;
  thumb: Thumb | null;
  course: boolean;
  live: { provider: Provider; eventId: string } | null;
}

/** One list of races: course pages (with GPX) merged with timing-provider events (live tracking only). */
export async function catalog(env: Env, lang: Lang): Promise<CatalogItem[]> {
  const [races, mr, sp] = await Promise.all([
    listRaces(env),
    liveRaces(env, 'myresult').then((x) => x.data).catch(() => [] as LiveRace[]),
    liveRaces(env, 'spct').then((x) => x.data).catch(() => [] as LiveRace[]),
  ]);
  const q = lang === 'en' ? '?lang=en' : '';
  const linked = new Set<string>();
  const items: CatalogItem[] = races.map((r) => {
    const live = r.meta.live ? { provider: (r.meta.live.provider === 'myresult' ? 'myresult' : 'spct') as Provider, eventId: r.meta.live.eventId } : null;
    if (live) linked.add(`${live.provider}:${live.eventId}`);
    return {
      key: `r:${r.slug}`, href: `/r/${r.slug}${q}`, name: l(lang, r.meta.name), date: r.meta.date, time: r.meta.startTime,
      place: l(lang, r.meta.city), country: r.meta.country, distanceKm: (r.stats.total * (r.meta.scale ?? 1)) / 1000,
      gain: r.stats.gain, thumb: r.thumb, course: true, live,
    };
  });
  for (const e of [...mr, ...sp]) {
    if (linked.has(`${e.source}:${e.id}`)) continue;
    const [date, time = ''] = e.date.split(' ');
    items.push({
      key: `e:${e.source}:${e.id}`, href: `/e/${e.source}/${e.id}${q}`, name: e.name, date, time,
      place: e.location && e.location !== 'SPCT' ? e.location : '', country: 'KR', distanceKm: null, gain: null, thumb: null,
      course: false, live: { provider: e.source, eventId: e.id },
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || Number(b.course) - Number(a.course));
}
