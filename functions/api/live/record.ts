import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';
import { guardRaceDay, isBib, isEventId, keepRaceDaySplits, myResultResultUrl, myResultStamps, parseMyResultPage, parseSpctRecord, spctResultUrl, spctYear } from '../../../src/shared/live.ts';
import { UA, swr, upstream } from './_upstream.ts';

/**
 * GET /api/live/record?provider=spct|myresult&event=…&bib=… → LiveRecord
 * MyResult's JSON API now needs a partner key, so we read the public server-rendered runner page instead.
 */
export const onRequestGet = async (ctx: Ctx) => {
  const url = new URL(ctx.request.url);
  const provider = url.searchParams.get('provider');
  const event = url.searchParams.get('event') ?? '';
  const bib = url.searchParams.get('bib') ?? '';
  if (!isEventId(event) || !isBib(bib)) return json({ error: 'bad-input' }, 400);
  if (provider !== 'spct' && provider !== 'myresult') return json({ error: 'bad-provider' }, 400);

  // Edge cache per runner for 60 s (Cache API needs a GET Request key)
  const cacheKey = new Request(`https://kt-cache.internal/${provider}/${event}/${bib}`);
  let cache: Cache | null = null;
  try { cache = (caches as unknown as { default: Cache }).default; } catch { cache = null; }
  const hit = cache ? await cache.match(cacheKey).catch(() => undefined) : undefined;
  if (hit) return hit;

  let res: Response;
  try {
    if (provider === 'myresult') {
      const r = await fetch(myResultResultUrl(event, bib), { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'manual' });
      const html = r.status === 200 ? await r.text() : '';
      let rec = html ? parseMyResultPage(html, event, bib) : null;
      if (!rec && r.status >= 500) throw new Error(`upstream ${r.status}`);
      if (rec) {
        // MyResult shows last year's result under a bib until this year's timing starts
        const ev = await swr(ctx.env, `live:event:myresult:${event}`, 6 * 3600, async () => {
          const j = (await (await upstream(`https://myresult.co.kr/api/event/${event}`, 'application/json')).json()) as { date?: string; time?: string };
          return { date: j.date ?? '', time: j.time ?? '00:00:00' };
        }).then((x) => x.data).catch(() => null);
        if (ev?.date) rec = keepRaceDaySplits(guardRaceDay(rec, ev.date, ev.time), ev.date, myResultStamps(html));
      }
      res = rec
        ? json(rec, 200, { 'cache-control': 'public, max-age=60' })
        : json({ error: 'not-found', resultUrl: myResultResultUrl(event, bib) }, 404, { 'cache-control': 'public, max-age=60' });
    } else {
      const html = await (await upstream(`https://time.spct.kr/m2.php?EVENT_NO=${event}&TargetYear=${spctYear(event)}&currentPage=1&BIB_NO=${encodeURIComponent(bib)}`)).text();
      const rec = parseSpctRecord(html, event, bib);
      res = rec
        ? json(rec, 200, { 'cache-control': 'public, max-age=60' })
        : json({ error: 'not-found', resultUrl: spctResultUrl(event, bib) }, 404, { 'cache-control': 'public, max-age=60' });
    }
  } catch (e) {
    return json({ error: 'upstream-unavailable', detail: String(e) }, 502);
  }
  if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
  return res;
};
