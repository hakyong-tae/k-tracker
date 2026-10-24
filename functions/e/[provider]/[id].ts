import type { Ctx } from '../../_lib/env.ts';
import { pickLang } from '../../_lib/lang.ts';
import { html, raw, page, notFound } from '../../_lib/html.ts';
import { dateTile, ddayBadge } from '../../_lib/ui.ts';
import { swr, upstream } from '../../api/live/_upstream.ts';
import { linkedSlug } from '../../api/live/event.ts';
import { liveRaces } from '../../_lib/catalog.ts';
import { isEventId, parseMyResultEvent, type LiveEvent, type Provider } from '../../../src/shared/live.ts';
import { icon } from '../../../src/shared/icons.ts';

/** Race page for events we can track live but have no course (GPX) for yet. */
export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  const ko = lang === 'ko';
  const provider = String(ctx.params.provider) as Provider;
  const id = String(ctx.params.id);
  if ((provider !== 'myresult' && provider !== 'spct') || !isEventId(id)) return notFound(lang, ctx.env);
  const slug = await linkedSlug(ctx.env, provider, id);
  if (slug) return Response.redirect(new URL(`/r/${slug}${ko ? '' : '?lang=en'}`, ctx.request.url).toString(), 302);

  let ev: Omit<LiveEvent, 'courseSlug'> | null = null;
  try {
    ev = (await swr(ctx.env, `live:eventinfo:${provider}:${id}`, 6 * 3600, async () => {
      if (provider === 'myresult') return parseMyResultEvent(await (await upstream(`https://myresult.co.kr/api/event/${id}`, 'application/json')).json());
      const hit = (await liveRaces(ctx.env, 'spct')).data.find((e) => e.id === id);
      return { provider, id, name: hit?.name ?? '', date: hit?.date ?? '', time: '', location: '', courses: [] };
    })).data;
  } catch { ev = null; }
  if (!ev || !ev.name) return notFound(lang, ctx.env);

  const source = provider === 'spct' ? 'smartchip' : 'myresult';
  const trackHref = `/group_register.html?eventId=${encodeURIComponent(id)}&source=${source}`;
  const submitHref = `/submit?${new URLSearchParams({ live: `${provider}:${id}`, name: ev.name, date: ev.date, ...(ko ? {} : { lang: 'en' }) }).toString()}`;
  const official = provider === 'myresult' ? `https://myresult.co.kr/${id}` : `https://time.spct.kr/m1.php?TargetYear=${id.slice(0, 4)}&EVENT_NO=${id}&currentPage=1`;
  const courses = ev.courses.filter((c) => c.checkpoints.length > 1);

  const body = html`<main class="event wrap">
  <section class="ev-head">
    ${dateTile(ev.date, lang, 'lg')}
    <div>
      <div class="ev-badges"><span class="tag tag-live">${raw(icon('timer', 14))}${ko ? '실시간 응원' : 'Live tracking'}</span>${ddayBadge(ev.date, 'Asia/Seoul', lang)}</div>
      <h1>${ev.name}</h1>
      <p class="muted">${[ev.date, ev.time, ev.location].filter(Boolean).join(' · ')}</p>
    </div>
  </section>

  <section class="ev-grid">
    <article class="panel-card primary">
      <span class="pc-ic">${raw(icon('timer', 24))}</span>
      <h2>${ko ? '배번으로 실시간 응원' : 'Follow bibs live'}</h2>
      <p>${ko ? '그룹을 만들고 배번을 추가하면 통과 기록, 지금 위치, 예상 골인 시각을 한 화면에서 볼 수 있어요. 링크로 가족과 크루에게 공유하세요.'
              : 'Make a group, add bibs, and see splits, current position and ETA on one screen. Share the link with family and crew.'}</p>
      <a class="btn" href="${trackHref}">${ko ? '응원 그룹 만들기' : 'Start a group'}${raw(icon('arrowRight', 18))}</a>
    </article>
    <article class="panel-card empty">
      <span class="pc-ic">${raw(icon('route', 24))}</span>
      <h2>${ko ? '아직 코스 페이지가 없어요' : 'No course page yet'}</h2>
      <p>${ko ? '이 대회를 뛰어보셨다면 GPX를 보내주세요. 확인 후 고도, 구간 공략, 목표 기록별 스플릿이 있는 코스 페이지를 만들어요.'
              : 'Ran this race before? Send your GPX and we will build a course page with elevation, segment notes and splits.'}</p>
      <a class="btn ghost" href="${submitHref}">${raw(icon('upload', 18))}${ko ? 'GPX 올리기' : 'Upload GPX'}</a>
    </article>
  </section>

  ${courses.length ? html`<section class="block">
    <h2>${ko ? '기록 측정 지점' : 'Timing mats'}</h2>
    ${courses.map((c) => html`<div class="mats"><h3>${c.label || c.code} <span class="muted">${c.distanceKm} km</span></h3>
      <ol>${c.checkpoints.map((p) => html`<li><span>${p.name}</span><b>${p.km.toFixed(p.km % 1 ? 1 : 0)}</b></li>`)}</ol></div>`)}
  </section>` : ''}

  <p class="muted small"><a href="${official}" target="_blank" rel="noopener">${provider === 'spct' ? 'SPCT' : 'MyResult'} ${ko ? '공식 기록 페이지' : 'official results'} ${raw(icon('external', 13))}</a></p>
</main>`;
  return page({
    lang, env: ctx.env, path: `/e/${provider}/${id}`, body, ads: true,
    title: ko ? `${ev.name} 실시간 기록 응원 | K-TRACKER` : `${ev.name} live tracking | K-TRACKER`,
    description: ko ? `${ev.date} ${ev.name}. 배번으로 친구와 가족의 통과 기록과 위치를 실시간으로 확인하세요.` : `${ev.date} ${ev.name}. Follow friends' splits and position live by bib.`,
  });
};
