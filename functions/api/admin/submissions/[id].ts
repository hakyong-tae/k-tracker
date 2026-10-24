import type { Ctx } from '../../../_lib/env.ts';
import { json } from '../../../_lib/html.ts';
import { saveRace } from '../../../_lib/db.ts';
import { sanitizeMeta, validateCourse } from '../../../../src/shared/validate.ts';

interface Row { id: number; kind: string; race_id: number | null; status: string; meta: string; course: string; gpx_key: string | null; submitter: string; contact: string; message: string; checks: string; created_at: string }

export const onRequestGet = async (ctx: Ctx) => {
  const r = await ctx.env.DB.prepare('SELECT * FROM submissions WHERE id=?1').bind(Number(ctx.params.id)).first<Row>();
  if (!r) return json({ error: 'not-found' }, 404);
  return json({ ...r, meta: JSON.parse(r.meta), course: JSON.parse(r.course), checks: JSON.parse(r.checks ?? '[]') });
};

/** body: {action:'approve'|'reject', meta?, status?: 'published'|'draft', note?} */
export const onRequestPost = async (ctx: Ctx) => {
  const id = Number(ctx.params.id);
  const r = await ctx.env.DB.prepare('SELECT * FROM submissions WHERE id=?1').bind(id).first<Row>();
  if (!r) return json({ error: 'not-found' }, 404);
  const body = (await ctx.request.json().catch(() => ({}))) as { action?: string; meta?: unknown; status?: string; note?: string };
  if (body.action === 'reject') {
    await ctx.env.DB.prepare(`UPDATE submissions SET status='rejected', review_note=?2, reviewed_at=datetime('now') WHERE id=?1`).bind(id, body.note ?? null).run();
    return json({ ok: true });
  }
  if (body.action !== 'approve') return json({ error: 'bad-action' }, 400);
  let meta, course;
  try { meta = sanitizeMeta(body.meta ?? JSON.parse(r.meta)); course = validateCourse(JSON.parse(r.course)); } catch (e) { return json({ error: (e as Error).message }, 400); }
  const status = body.status === 'draft' ? 'draft' : 'published';
  let raceId = r.race_id ?? undefined;
  if (!raceId) {
    const existing = await ctx.env.DB.prepare('SELECT id FROM races WHERE slug=?1').bind(meta.slug).first<{ id: number }>();
    if (existing) return json({ error: 'slug-taken', detail: meta.slug }, 409);
  }
  let gpxKey: string | null = null;
  if (r.gpx_key) {
    const obj = await ctx.env.GPX.get(r.gpx_key);
    if (obj) { gpxKey = `races/${meta.slug}.gpx`; await ctx.env.GPX.put(gpxKey, await obj.text(), { httpMetadata: { contentType: 'application/gpx+xml' } }); }
  }
  raceId = await saveRace(ctx.env, meta, course, status, gpxKey, raceId);
  await ctx.env.DB.prepare(`UPDATE submissions SET status='approved', race_id=?2, review_note=?3, reviewed_at=datetime('now') WHERE id=?1`).bind(id, raceId, body.note ?? null).run();
  return json({ ok: true, raceId, slug: meta.slug });
};
