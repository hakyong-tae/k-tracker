import type { Ctx } from '../../_lib/env.ts';
import { isAdmin } from '../../_lib/auth.ts';
import { json } from '../../_lib/html.ts';

export const onRequest = async (ctx: Ctx) => {
  if (!(await isAdmin(ctx.request, ctx.env))) return json({ error: 'unauthorized' }, 401);
  if (ctx.request.method !== 'GET') {
    // CSRF: require same-origin for mutations
    const origin = ctx.request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(ctx.request.url).host) return json({ error: 'bad-origin' }, 403);
  }
  return ctx.next();
};
