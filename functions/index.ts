import type { Ctx } from './_lib/env.ts';
import { pickLang } from './_lib/lang.ts';
import { html, raw, page, adSlot } from './_lib/html.ts';
import { catalog, type CatalogItem } from './_lib/catalog.ts';
import { courseCard, eventRow } from './_lib/ui.ts';
import { icon } from '../src/shared/icons.ts';
import { todayIn } from '../src/shared/time.ts';

export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  const ko = lang === 'ko';
  const items = await catalog(ctx.env, lang);
  const today = todayIn('Asia/Seoul');
  const weekEnd = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
  const upcoming = items.filter((i) => i.date >= today);
  const thisWeek = upcoming.filter((i) => i.date <= weekEnd);
  const later = upcoming.filter((i) => i.date > weekEnd);
  const past = items.filter((i) => i.date < today).reverse().slice(0, 24);
  const courses = items.filter((i) => i.course).length;
  const lives = items.filter((i) => i.live).length;
  const render = (list: CatalogItem[]) => html`<ul class="race-feed">${list.map((i) => (i.course ? courseCard(i, lang) : eventRow(i, lang)))}</ul>`;
  const q = ko ? '' : '?lang=en';
  const f = new URL(ctx.request.url).searchParams.get('f') ?? 'all';

  const body = html`<main class="home">
  <section class="hero wrap">
    <p class="eyebrow">${ko ? '러너를 위한 대회 페이지' : 'Race pages for runners'}</p>
    <h1>${ko ? raw('대회 전엔 코스를,<br>당일엔 친구를.') : raw('Know the course.<br>Follow your friends.')}</h1>
    <p class="lede">${ko
      ? '코스가 있는 대회는 고도와 구간 공략, 목표 기록별 스플릿까지. 국내 대회는 배번만 넣으면 친구의 통과 기록과 위치를 실시간으로 볼 수 있어요.'
      : 'Course pages with elevation, segment notes and goal-time splits. For Korean races, add a bib to follow splits and position live.'}</p>
    <div class="hero-stats"><span>${raw(icon('route', 16))}${ko ? `코스 ${courses}개` : `${courses} courses`}</span><span>${raw(icon('timer', 16))}${ko ? `실시간 ${lives}개 대회` : `${lives} live races`}</span></div>
  </section>

  <section class="wrap feed-tools" id="races">
    <label class="search-box">${raw(icon('search', 18))}<input id="feed-search" type="search" placeholder="${ko ? '대회 이름 검색' : 'Search races'}" autocomplete="off"></label>
    <div class="seg-ctl" role="tablist" aria-label="${ko ? '대회 종류' : 'Filter'}">
      ${[['all', ko ? '전체' : 'All'], ['course', ko ? '코스 미리보기' : 'Course'], ['live', ko ? '실시간 응원' : 'Live'], ['intl', ko ? '해외' : 'Abroad']].map(([k, label]) =>
        html`<button type="button" role="tab" data-f="${k}" aria-selected="${String(f === k)}">${label}</button>`)}
    </div>
  </section>

  ${thisWeek.length ? html`<section class="wrap block feed-sec"><h2>${ko ? '이번 주' : 'This week'}</h2>${render(thisWeek)}</section>` : ''}
  <section class="wrap block feed-sec"><h2>${ko ? '다가오는 대회' : 'Upcoming'}</h2>${later.length ? render(later) : html`<p class="muted">${ko ? '예정된 대회가 없어요.' : 'Nothing scheduled.'}</p>`}</section>
  <p class="wrap muted small feed-empty" hidden>${ko ? '조건에 맞는 대회가 없어요.' : 'No races match.'}</p>

  <section class="wrap block cta-row">
    <a class="cta" href="/submit${q}">
      <span class="cta-ic">${raw(icon('upload', 22))}</span>
      <span><b>${ko ? '코스 GPX 올리기' : 'Share a course GPX'}</b><small>${ko ? '뛰어본 대회의 GPX를 보내주시면 확인 후 코스 페이지를 만들어요.' : 'Send a GPX of a race you ran and we will build its course page.'}</small></span>
      ${raw(icon('arrowRight', 18))}
    </a>
  </section>
  ${adSlot(ctx.env, lang, 'home')}
  ${past.length ? html`<section class="wrap block feed-sec past"><h2>${ko ? '지난 대회' : 'Recent'}</h2>${render(past)}</section>` : ''}
</main>`;
  return page({
    lang, env: ctx.env, path: '/', body, ads: true, scripts: ['home'],
    title: ko ? 'K-TRACKER · 마라톤 코스 미리보기와 실시간 응원' : 'K-TRACKER · Marathon course previews and live tracking',
    description: ko ? '마라톤 코스 고도·구간 공략·목표 기록별 스플릿과, 국내 대회 배번 실시간 기록 추적.' : 'Marathon course elevation, segment notes and splits, plus live bib tracking for Korean races.',
  });
};
