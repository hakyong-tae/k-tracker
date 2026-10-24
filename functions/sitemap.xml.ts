import type { Ctx } from './_lib/env.ts';
import { listRaces } from './_lib/db.ts';
import { esc } from './_lib/html.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const site = (ctx.env.SITE_URL || new URL(ctx.request.url).origin).replace(/\/$/, '');
  const races = await listRaces(ctx.env);
  const urls = [{ loc: '/', mod: null as string | null }, ...races.map((r) => ({ loc: `/r/${r.slug}`, mod: r.updatedAt?.slice(0, 10) ?? null }))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `<url><loc>${esc(site + u.loc)}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<xhtml:link rel="alternate" hreflang="ko" href="${esc(site + u.loc)}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(site + u.loc)}?lang=en"/></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
