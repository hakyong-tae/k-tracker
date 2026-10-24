import type { Ctx } from '../_lib/env.ts';
import { makeSession, passwordOk } from '../_lib/auth.ts';
import { html, page } from '../_lib/html.ts';
import { pickLang } from '../_lib/lang.ts';

const form = (ctx: Ctx, err = false) => page({
  lang: pickLang(ctx.request), env: ctx.env, title: 'Admin', description: '', path: '/admin/login', noindex: true,
  body: html`<main class="wrap narrow block"><h1>Admin</h1>${err ? html`<p class="warn">비밀번호가 맞지 않아요 / Wrong password</p>` : ''}
  <form method="post" class="form"><label>Password <input type="password" name="password" autocomplete="current-password" required autofocus></label><button class="btn" type="submit">Login</button></form></main>`,
});

export const onRequestGet = async (ctx: Ctx) => form(ctx);
export const onRequestPost = async (ctx: Ctx) => {
  const f = await ctx.request.formData();
  if (!(await passwordOk(ctx.env, String(f.get('password') ?? '')))) return form(ctx, true);
  const secure = new URL(ctx.request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(null, { status: 303, headers: { location: '/admin', 'set-cookie': `kt_admin=${encodeURIComponent(await makeSession(ctx.env))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}` } });
};
