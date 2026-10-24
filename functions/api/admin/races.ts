import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';
import { listRaces, saveRace } from '../../_lib/db.ts';
import { sanitizeMeta, validateCourse } from '../../../src/shared/validate.ts';

export const onRequestGet = async (ctx: Ctx) => json(await listRaces(ctx.env, { includeDraft: true }));

/** Create a race directly (admin upload). multipart: gpx?, payload {meta, course, status} */
export const onRequestPost = async (ctx: Ctx) => {
  const form = await ctx.request.formData();
  const payload = JSON.parse(String(form.get('payload') ?? '{}'));
  let meta, course;
  try { meta = sanitizeMeta(payload.meta); course = validateCourse(payload.course); } catch (e) { return json({ error: (e as Error).message }, 400); }
  const exists = await ctx.env.DB.prepare('SELECT id FROM races WHERE slug=?1').bind(meta.slug).first();
  if (exists) return json({ error: 'slug-taken', detail: meta.slug }, 409);
  let gpxKey: string | null = null;
  const file = form.get('gpx');
  if (file && typeof file !== 'string') { gpxKey = `races/${meta.slug}.gpx`; await ctx.env.GPX.put(gpxKey, await file.text(), { httpMetadata: { contentType: 'application/gpx+xml' } }); }
  const id = await saveRace(ctx.env, meta, course, payload.status === 'published' ? 'published' : 'draft', gpxKey);
  return json({ ok: true, id, slug: meta.slug });
};
