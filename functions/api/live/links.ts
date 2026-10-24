import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';

/** GET /api/live/links → [{provider, eventId, slug}] for published course pages linked to timing events. */
export const onRequestGet = async (ctx: Ctx) => {
  const { results } = await ctx.env.DB.prepare(
    `SELECT slug, json_extract(meta,'$.live.provider') AS provider, json_extract(meta,'$.live.eventId') AS eventId
     FROM races WHERE status='published' AND json_extract(meta,'$.live.eventId') IS NOT NULL`,
  ).all<{ slug: string; provider: string; eventId: string }>();
  return json(results.map((r) => ({ ...r, provider: r.provider === 'smartchip' ? 'spct' : r.provider })), 200, { 'cache-control': 'public, max-age=300' });
};
