import type { Ctx } from '../_lib/env.ts';
import { getRace } from '../_lib/db.ts';
import { json } from '../_lib/html.ts';
import { raceWeather } from '../_lib/weather.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const slug = new URL(ctx.request.url).searchParams.get('slug') ?? '';
  const race = await getRace(ctx.env, slug);
  if (!race) return json({ error: 'not-found' }, 404);
  try {
    const rep = await raceWeather(ctx.env, race.meta, race.course);
    return json(rep, 200, { 'cache-control': 'public, max-age=600' });
  } catch (e) {
    return json({ error: 'weather-unavailable', detail: String(e) }, 502);
  }
};
