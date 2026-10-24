import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';
import { parseMyResultEvents, parseSpctEvents, type LiveRace, type Provider } from '../../../src/shared/live.ts';
import { swr, upstream } from './_upstream.ts';

async function loadMyResult(): Promise<LiveRace[]> {
  const pages = await Promise.all([1, 2, 3].map(async (p) => parseMyResultEvents(await (await upstream(`https://myresult.co.kr/api/event/?page=${p}`, 'application/json')).json())));
  const seen = new Set<string>();
  return pages.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
async function loadSpct(): Promise<LiveRace[]> {
  const pages = await Promise.all([1, 2, 3].map(async (p) => parseSpctEvents(await (await upstream(`https://time.spct.kr/main.php?currentPage=${p}`)).text())));
  const seen = new Set<string>();
  return pages.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** GET /api/live/races?provider=myresult|spct → LiveRace[] (newest first). */
export const onRequestGet = async (ctx: Ctx) => {
  const provider = new URL(ctx.request.url).searchParams.get('provider') as Provider;
  if (provider !== 'myresult' && provider !== 'spct') return json({ error: 'bad-provider' }, 400);
  try {
    const { data, stale, at } = await swr(ctx.env, `live:races:${provider}`, 20 * 60, provider === 'myresult' ? loadMyResult : loadSpct);
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    return json(sorted, 200, { 'cache-control': 'public, max-age=300', 'x-kt-stale': String(stale), 'x-kt-fetched': new Date(at).toISOString() });
  } catch (e) {
    return json({ error: 'upstream-unavailable', detail: String(e) }, 502);
  }
};
