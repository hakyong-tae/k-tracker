import type { Ctx } from '../_lib/env.ts';
import { json } from '../_lib/html.ts';

/**
 * DEM elevation for up to 300 points via Open Topo Data (SRTM 30 m).
 * Used by the GPX upload preview when a file has no <ele> tags.
 */
export const onRequestPost = async (ctx: Ctx) => {
  const body = (await ctx.request.json().catch(() => null)) as { points?: [number, number][] } | null;
  const pts = body?.points;
  if (!Array.isArray(pts) || !pts.length || pts.length > 300) return json({ error: 'bad-points' }, 400);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 100) {
    if (i) await new Promise((r) => setTimeout(r, 1100));
    const loc = pts.slice(i, i + 100).map(([la, lo]) => `${(+la).toFixed(5)},${(+lo).toFixed(5)}`).join('|');
    const r = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${loc}`);
    if (!r.ok) return json({ error: 'dem-unavailable', status: r.status }, 502);
    const j = (await r.json()) as { results: { elevation: number | null }[] };
    out.push(...j.results.map((x) => x.elevation ?? 0));
  }
  return json({ elevation: out, source: 'Open Topo Data · SRTM 30m' });
};
