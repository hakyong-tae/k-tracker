import type { Ctx } from './_lib/env.ts';
export const onRequestGet = async (ctx: Ctx) => {
  const site = (ctx.env.SITE_URL || new URL(ctx.request.url).origin).replace(/\/$/, '');
  return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nAllow: /\nSitemap: ${site}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
};
