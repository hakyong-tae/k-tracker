import type { Ctx } from './_lib/env.ts';
import { listRaces } from './_lib/db.ts';
import { pickLang } from './_lib/lang.ts';
import { html, page, adSlot } from './_lib/html.ts';
import { ddayLabel } from './_lib/race-page.ts';
import { BRAND } from '../src/shared/brand.ts';
import { t, l } from '../src/shared/i18n.ts';
import { daysUntil } from '../src/shared/time.ts';

const flag = (cc: string) => cc.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  const races = await listRaces(ctx.env);
  const withDays = races.map((r) => ({ ...r, days: daysUntil(r.meta.date, r.meta.timezone) }));
  const upcoming = withDays.filter((r) => r.days >= 0);
  const past = withDays.filter((r) => r.days < 0).reverse();
  const q = lang === 'en' ? '?lang=en' : '';
  const card = (r: (typeof withDays)[number]) => html`<li><a class="card" href="/r/${r.slug}${q}">
    <div class="card-top"><span class="flag">${flag(r.meta.country)}</span><span class="dday ${r.days <= 7 && r.days >= 0 ? 'hot' : ''}">${ddayLabel(lang, r.days)}</span></div>
    <h3>${l(lang, r.meta.name)}</h3>
    <div class="muted">${r.meta.date} · ${r.meta.startTime} · ${l(lang, r.meta.city)}</div>
    <div class="card-stats"><span>${((r.stats.total * (r.meta.scale ?? 1)) / 1000).toFixed(1)} km</span><span>↗ ${r.stats.gain} m</span></div>
  </a></li>`;
  const body = html`<main class="home">
  <section class="hero wrap">
    <h1>${l(lang, BRAND.tagline)}</h1>
    <p class="muted">${lang === 'ko' ? 'GPX로 만든 코스 주행 미리보기, 5km 구간 고도, 목표 기록별 스플릿, 대회 당일 날씨를 한 화면에서.' : 'Fly-through previews from GPX, 5 km elevation segments, goal-time splits and race-day weather on one page.'}</p>
  </section>
  <section class="wrap block">
    <h2>${t(lang, 'upcoming')}</h2>
    ${upcoming.length ? html`<ul class="cards">${upcoming.map(card)}</ul>` : html`<p class="muted">${t(lang, 'noRaces')}</p>`}
  </section>
  <section class="wrap block duo">
    <a class="card cta" href="/event.html"><h3>⏱ ${t(lang, 'liveTracker')}</h3><p class="muted">${t(lang, 'liveTrackerDesc')}</p></a>
    <a class="card cta" href="/submit${q}"><h3>📍 ${t(lang, 'submitCourse')}</h3><p class="muted">${t(lang, 'submitIntro')}</p></a>
  </section>
  ${adSlot(ctx.env, lang, 'home')}
  ${past.length ? html`<section class="wrap block"><h2>${t(lang, 'past')}</h2><ul class="cards past">${past.map(card)}</ul></section>` : ''}
</main>`;
  return page({
    lang, env: ctx.env, path: '/', body, ads: true,
    title: lang === 'ko' ? 'K-TRACKER · 마라톤 코스 미리보기와 실시간 기록' : 'K-TRACKER · Marathon course previews and live tracking',
    description: l(lang, BRAND.tagline),
  });
};
