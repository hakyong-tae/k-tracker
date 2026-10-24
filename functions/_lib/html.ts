import type { Lang } from '../../src/shared/types.ts';
import { BRAND } from '../../src/shared/brand.ts';
import { t } from '../../src/shared/i18n.ts';
import type { Env } from './env.ts';
import { ASSET_VERSION } from './version.ts';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Mark a string as already-safe HTML */
export class Raw { constructor(public s: string) {} toString() { return this.s; } }
export const raw = (s: string) => new Raw(s);
export function html(strings: TemplateStringsArray, ...vals: unknown[]): Raw {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('');
    else if (v !== null && v !== undefined && v !== false) out += v instanceof Raw ? v.s : esc(v);
    out += strings[i + 1];
  }
  return new Raw(out);
}

/** JSON safe to embed inside <script type="application/json"> */
export const jsonScript = (id: string, data: unknown) =>
  raw(`<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);

export interface PageOpts {
  lang: Lang;
  title: string;
  description: string;
  path: string;          // path without query, for canonical/hreflang
  body: Raw;
  env: Env;
  scripts?: string[];    // asset entry names, e.g. ['race']
  jsonLd?: unknown;
  ogImage?: string | null;
  noindex?: boolean;
  ads?: boolean;
}

export function page(o: PageOpts): Response {
  const site = (o.env.SITE_URL || '').replace(/\/$/, '');
  const canonical = `${site}${o.path}${o.lang === 'en' ? '?lang=en' : ''}`;
  const other: Lang = o.lang === 'ko' ? 'en' : 'ko';
  const ads = o.ads && o.env.ADSENSE_CLIENT;
  const doc = html`<!doctype html>
<html lang="${o.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="ko" href="${site}${o.path}">
<link rel="alternate" hreflang="en" href="${site}${o.path}?lang=en">
<link rel="alternate" hreflang="x-default" href="${site}${o.path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${canonical}">
${o.ogImage ? html`<meta property="og:image" content="${o.ogImage}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${o.noindex ? raw('<meta name="robots" content="noindex">') : ''}
<meta name="theme-color" content="#0f172a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
${o.jsonLd ? raw(`<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>`) : ''}
${ads ? raw(`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(o.env.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>`) : ''}
</head>
<body>
<header class="topbar">
  <a class="brand" href="/${o.lang === 'en' ? '?lang=en' : ''}">${BRAND.name}</a>
  <nav class="topnav">
    <a href="/event.html">${o.lang === 'ko' ? '실시간 응원' : 'Live'}</a>
    <a class="hide-xs" href="/submit${o.lang === 'en' ? '?lang=en' : ''}">${t(o.lang, 'submitCourse')}</a>
    <a class="lang" href="${o.path}?lang=${other}" data-lang="${other}">${other === 'en' ? 'EN' : '한국어'}</a>
  </nav>
</header>
${o.body}
<footer class="foot">
  <div>${BRAND.name} · ${t(o.lang, 'liveTracker')} · <a href="/event.html">${o.lang === 'ko' ? '대회 목록' : 'Races'}</a></div>
  <div class="muted">© ${BRAND.author} · <a href="mailto:${BRAND.email}">${BRAND.email}</a> · Map data © OpenStreetMap contributors</div>
</footer>
${(o.scripts ?? []).map((s) => raw(`<script type="module" src="/assets/${s}.js?v=${ASSET_VERSION}"></script>`))}
<script>document.querySelectorAll('a.lang').forEach(a=>a.addEventListener('click',()=>{document.cookie='lang='+a.dataset.lang+';path=/;max-age=31536000;samesite=lax'}))</script>
</body>
</html>`;
  return new Response(doc.s, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': o.noindex ? 'no-store' : 'public, max-age=60, s-maxage=300',
      vary: 'accept-language, cookie',
    },
  });
}

export function adSlot(env: Env, lang: Lang, slot: string): Raw {
  if (!env.ADSENSE_CLIENT) return raw('');
  return html`<aside class="ad" aria-label="${t(lang, 'ad')}"><ins class="adsbygoogle" style="display:block" data-ad-client="${env.ADSENSE_CLIENT}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({})</script></aside>`;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

export function notFound(lang: Lang, env: Env): Response {
  const r = page({ lang, env, title: '404', description: '', path: '/404', noindex: true, body: html`<main class="wrap narrow"><h1>404</h1><p><a href="/">${t(lang, 'home')}</a></p></main>` });
  return new Response(r.body, { status: 404, headers: r.headers });
}
