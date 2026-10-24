import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';
import type { Provider } from '../../../src/shared/live.ts';
import { swr } from './_upstream.ts';
import { loadMyResult, loadSpct } from '../../_lib/catalog.ts';

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
