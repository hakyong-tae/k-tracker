import type { Ctx, Env } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';
import { isEventId, parseMyResultEvent, parseSpctEvents, type LiveEvent, type Provider } from '../../../src/shared/live.ts';
import { swr, upstream } from './_upstream.ts';

/** Published course-preview race linked to a timing event via meta.live, if any. */
export async function linkedSlug(env: Env, provider: Provider, id: string): Promise<string | null> {
  const providers = provider === 'spct' ? ['spct', 'smartchip'] : [provider];
  const r = await env.DB.prepare(
    `SELECT slug FROM races WHERE status='published' AND json_extract(meta,'$.live.eventId')=?1 AND json_extract(meta,'$.live.provider') IN (${providers.map((_, i) => `?${i + 2}`).join(',')}) LIMIT 1`,
  ).bind(id, ...providers).first<{ slug: string }>();
  return r?.slug ?? null;
}

/** GET /api/live/event?provider=myresult|spct&event=… → LiveEvent (name, date, course checkpoints, linked course page) */
export const onRequestGet = async (ctx: Ctx) => {
  const url = new URL(ctx.request.url);
  const provider = url.searchParams.get('provider') as Provider;
  const id = url.searchParams.get('event') ?? '';
  if ((provider !== 'myresult' && provider !== 'spct') || !isEventId(id)) return json({ error: 'bad-input' }, 400);
  try {
    const { data } = await swr(ctx.env, `live:eventinfo:${provider}:${id}`, 6 * 3600, async () => {
      if (provider === 'myresult') return parseMyResultEvent(await (await upstream(`https://myresult.co.kr/api/event/${id}`, 'application/json')).json());
      // SPCT has no event API: look it up in the cached list pages
      for (let p = 1; p <= 5; p++) {
        const hit = parseSpctEvents(await (await upstream(`https://time.spct.kr/main.php?currentPage=${p}`)).text()).find((e) => e.id === id);
        if (hit) return { provider, id, name: hit.name, date: hit.date, time: '', location: 'SPCT', courses: [] };
      }
      return { provider, id, name: '', date: '', time: '', location: 'SPCT', courses: [] };
    });
    const out: LiveEvent = { ...data, courseSlug: await linkedSlug(ctx.env, provider, id) };
    return json(out, 200, { 'cache-control': 'public, max-age=300' });
  } catch (e) {
    return json({ error: 'upstream-unavailable', detail: String(e) }, 502);
  }
};
