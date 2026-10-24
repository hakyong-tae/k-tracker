import type { Ctx } from '../../_lib/env.ts';
import { json } from '../../_lib/html.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const status = new URL(ctx.request.url).searchParams.get('status') ?? 'pending';
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, kind, race_id, status, json_extract(meta,'$.name') AS name, json_extract(meta,'$.date') AS date, json_extract(meta,'$.slug') AS slug, submitter, checks, created_at
     FROM submissions WHERE status=?1 ORDER BY created_at DESC LIMIT 200`,
  ).bind(status).all();
  return json(results.map((r: Record<string, unknown>) => ({ ...r, name: JSON.parse(String(r.name)), checks: JSON.parse(String(r.checks ?? '[]')) })));
};
