import type { Ctx } from '../_lib/env.ts';
import { isAdmin } from '../_lib/auth.ts';
import { html, page } from '../_lib/html.ts';
import { pickLang } from '../_lib/lang.ts';

export const onRequestGet = async (ctx: Ctx) => {
  if (!(await isAdmin(ctx.request, ctx.env))) return Response.redirect(new URL('/admin/login', ctx.request.url).toString(), 303);
  return page({
    lang: pickLang(ctx.request), env: ctx.env, title: 'Admin · K-TRACKER', description: '', path: '/admin', noindex: true, scripts: ['admin'],
    body: html`<main class="wrap block admin"><div class="admin-head"><h1>Admin</h1><a href="/admin/logout">Logout</a></div><div id="admin-app"><p class="muted">Loading…</p></div></main>`,
  });
};
