import type { Ctx } from '../../../_lib/env.ts';
import { json } from '../../../_lib/html.ts';
import { saveRace } from '../../../_lib/db.ts';
import { sanitizeMeta, validateCourse } from '../../../../src/shared/validate.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const r = await ctx.env.DB.prepare('SELECT id, slug, status, meta, course, gpx_key, updated_at FROM races WHERE id=?1').bind(Number(ctx.params.id)).first<Record<string, string>>();
  if (!r) return json({ error: 'not-found' }, 404);
  return json({ ...r, meta: JSON.parse(r.meta), course: JSON.parse(r.course) });
};

/** body: {meta, status, course?} */
export const onRequestPut = async (ctx: Ctx) => {
  const id = Number(ctx.params.id);
  const cur = await ctx.env.DB.prepare('SELECT course FROM races WHERE id=?1').bind(id).first<{ course: string }>();
  if (!cur) return json({ error: 'not-found' }, 404);
  const body = (await ctx.request.json().catch(() => ({}))) as { meta?: unknown; status?: string; course?: unknown };
  let meta, course;
  try { meta = sanitizeMeta(body.meta); course = body.course ? validateCourse(body.course) : JSON.parse(cur.course); } catch (e) { return json({ error: (e as Error).message }, 400); }
  const clash = await ctx.env.DB.prepare('SELECT id FROM races WHERE slug=?1 AND id<>?2').bind(meta.slug, id).first();
  if (clash) return json({ error: 'slug-taken' }, 409);
  const status = ['published', 'draft', 'hidden'].includes(body.status ?? '') ? body.status! : 'draft';
  await saveRace(ctx.env, meta, course, status, null, id);
  return json({ ok: true });
};
