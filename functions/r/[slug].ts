import type { Ctx } from '../_lib/env.ts';
import { getRace } from '../_lib/db.ts';
import { pickLang } from '../_lib/lang.ts';
import { notFound } from '../_lib/html.ts';
import { renderRacePage } from '../_lib/race-page.ts';
import { isAdmin } from '../_lib/auth.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  const slug = String(ctx.params.slug);
  const admin = new URL(ctx.request.url).searchParams.has('preview') && (await isAdmin(ctx.request, ctx.env));
  const race = await getRace(ctx.env, slug, { includeDraft: admin });
  if (!race) return notFound(lang, ctx.env);
  const res = renderRacePage(ctx.env, lang, race);
  if (admin) res.headers.set('cache-control', 'no-store');
  return res;
};
