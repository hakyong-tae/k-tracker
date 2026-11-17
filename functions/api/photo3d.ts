import type { Ctx } from '../_lib/env.ts';
import { json } from '../_lib/html.ts';

/**
 * Daily budget for Google Photorealistic 3D Tiles. Each viewer load = one root request = one billed session
 * (1,000 free / month). The cap sits under the Google Cloud quota (30/day) so the site degrades before Google refuses.
 * GET → remaining today; POST → reserve one (409 when spent).
 */
export const PHOTO3D_DAILY = 25;
// Google's quota day rolls over at midnight US Pacific; UTC-8 is close enough (off by an hour in summer)
const day = () => new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
const noStore = { 'cache-control': 'no-store' };

export const onRequestGet = async (ctx: Ctx) => {
  if (!ctx.env.GOOGLE_MAPS_KEY) return json({ left: 0 }, 200, noStore);
  const row = await ctx.env.DB.prepare(`SELECT n FROM api_quota WHERE day = ?1 AND name = 'photo3d'`).bind(day()).first<{ n: number }>();
  return json({ left: Math.max(0, PHOTO3D_DAILY - (row?.n ?? 0)) }, 200, noStore);
};

export const onRequestPost = async (ctx: Ctx) => {
  if (!ctx.env.GOOGLE_MAPS_KEY) return json({ ok: false, left: 0 }, 409, noStore);
  const row = await ctx.env.DB.prepare(
    `INSERT INTO api_quota (day, name, n) VALUES (?1, 'photo3d', 1)
     ON CONFLICT (day, name) DO UPDATE SET n = n + 1 WHERE n < ?2
     RETURNING n`,
  ).bind(day(), PHOTO3D_DAILY).first<{ n: number }>();
  if (!row) return json({ ok: false, left: 0 }, 409, noStore);
  return json({ ok: true, left: PHOTO3D_DAILY - row.n }, 200, noStore);
};
