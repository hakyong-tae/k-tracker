import type { Ctx } from '../_lib/env.ts';
import { json } from '../_lib/html.ts';
import { ipHash } from '../_lib/auth.ts';
import { sanitizeMeta, validateCourse } from '../../src/shared/validate.ts';
import { runChecks } from '../../src/shared/checks.ts';
import { parseGpx } from '../../src/shared/gpx.ts';

const MAX_GPX = 8 * 1024 * 1024;

/** Public course submission → pending review. multipart: gpx (file), payload (JSON: {meta, course, submitter, contact, message, raceId?}) */
export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
  const ip = await ipHash(request);
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE ip_hash=?1 AND created_at > datetime('now','-1 hour')`).bind(ip).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return json({ error: 'rate-limited' }, 429);

  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: 'bad-form' }, 400); }
  const file = form.get('gpx');
  const payloadRaw = form.get('payload');
  if (typeof payloadRaw !== 'string') return json({ error: 'payload-required' }, 400);
  if (String(form.get('website') ?? '')) return json({ ok: true }); // honeypot
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(payloadRaw); } catch { return json({ error: 'bad-payload' }, 400); }

  let meta, course;
  try {
    meta = sanitizeMeta(payload.meta);
    course = validateCourse(payload.course);
  } catch (e) { return json({ error: (e as Error).message }, 400); }

  let gpxKey: string | null = null;
  if (file && typeof file !== 'string') {
    if (file.size > MAX_GPX) return json({ error: 'gpx-too-large' }, 413);
    const text = await file.text();
    try { if (parseGpx(text).points.length < 2) throw new Error(); } catch { return json({ error: 'bad-gpx' }, 400); }
    gpxKey = `submissions/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.gpx`;
    await env.GPX.put(gpxKey, text, { httpMetadata: { contentType: 'application/gpx+xml' } });
  }
  const { results } = await env.DB.prepare('SELECT slug FROM races').all<{ slug: string }>();
  const raceId = Number(payload.raceId) || null;
  const checks = runChecks(course, meta, { existingSlugs: raceId ? [] : results.map((r) => r.slug) });
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  meta.credit = str(payload.submitter, 40) || null;
  const r = await env.DB.prepare(
    `INSERT INTO submissions (kind, race_id, meta, course, gpx_key, submitter, contact, message, checks, ip_hash) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) RETURNING id`,
  ).bind(raceId ? 'edit' : 'new', raceId, JSON.stringify(meta), JSON.stringify(course), gpxKey, meta.credit, str(payload.contact, 120), str(payload.message, 1000), JSON.stringify(checks), ip).first<{ id: number }>();
  return json({ ok: true, id: r!.id, checks });
};
