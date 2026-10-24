import type { Lang, RaceRecord } from '../../src/shared/types.ts';
import { t, l, POI_LABEL, AID_TYPES, CHECKLIST } from '../../src/shared/i18n.ts';
import { planSplits } from '../../src/shared/pace.ts';
import { segmentStats } from '../../src/shared/segments.ts';
import { fmtDuration, fmtPace, addClock, daysUntil } from '../../src/shared/time.ts';
import { defaultTarget, officialKm, TARGET_PRESETS } from '../../src/shared/race-defaults.ts';
import { html, raw, jsonScript, page, adSlot, type Raw } from './html.ts';
import type { Env } from './env.ts';

const fmtDate = (lang: Lang, date: string) => {
  const d = new Date(date + 'T12:00:00Z');
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(d);
};

function sparkline(profile: number[], lo: number, hi: number): Raw {
  const w = 120, h = 36, span = Math.max(15, hi - lo);
  const pts = profile.map((e, i) => `${((i / (profile.length - 1)) * w).toFixed(1)},${(h - 2 - ((e - lo) / span) * (h - 6)).toFixed(1)}`).join(' ');
  return raw(`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`);
}

export function ddayLabel(lang: Lang, days: number): string {
  return days > 0 ? `${t(lang, 'dday')}${days}` : days === 0 ? t(lang, 'raceDay') : t(lang, 'finished');
}

export function renderRacePage(env: Env, lang: Lang, race: RaceRecord): Response {
  const { meta, course: c } = race;
  const scale = meta.scale ?? 1;
  const name = l(lang, meta.name);
  const city = l(lang, meta.city);
  const totalKm = officialKm(meta, c);
  const target = defaultTarget(meta, c);
  const plan = planSplits(c, target, { scale, extra: meta.distance === 'full' ? [21.0975] : [] });
  const segs = segmentStats(c, scale, 5);
  const days = daysUntil(meta.date, meta.timezone);
  const aid = meta.pois.filter((p) => AID_TYPES.includes(p.type));
  const halfSplit = plan.splits.find((s) => Math.abs(s.km - 21.0975) < 0.001);
  const segTip = (from: number) => meta.segments.find((s) => Math.abs(s.fromKm - from) < 0.5);
  const poisIn = (a: number, b: number) => meta.pois.filter((p) => p.km > a && p.km <= b + 0.001);
  const approx = meta.courseSource?.type?.startsWith('approx');

  const title = lang === 'ko'
    ? `${name} 코스 미리보기 · 고도·구간·페이스 | K-TRACKER`
    : `${name} course preview: elevation, segments, pacing | K-TRACKER`;
  const desc = lang === 'ko'
    ? `${fmtDate(lang, meta.date)} ${meta.startTime} 출발, ${city}. 거리 ${totalKm.toFixed(3)}km, 누적 상승 ${c.gain}m. 5km 구간별 고도와 공략 팁, 목표 기록별 스플릿, 당일 날씨까지 미리 확인하세요.`
    : `${fmtDate(lang, meta.date)}, ${meta.startTime} start in ${city}. ${totalKm.toFixed(3)} km with ${c.gain} m of climbing. 5 km segment profiles and tips, goal-time splits and race-morning weather.`;

  const body = html`
<main class="race" data-slug="${meta.slug}">
  <section class="race-head wrap">
    <div class="eyebrow">${fmtDate(lang, meta.date)} · ${t(lang, 'start')} ${meta.startTime} · ${city}</div>
    <h1>${name} <span class="dday" id="dday" data-date="${meta.date}" data-tz="${meta.timezone}">${ddayLabel(lang, days)}</span></h1>
    <ul class="chips">
      <li><b>${totalKm.toFixed(totalKm % 1 ? 3 : 0)}</b> km</li>
      <li>${t(lang, 'gain')} <b>${c.gain}</b> m</li>
      <li>${t(lang, 'highest')} <b>${Math.round(c.maxEle)}</b> m</li>
      ${meta.cutoff ? html`<li>${t(lang, 'cutoff')} <b>${meta.cutoff}</b></li>` : ''}
      ${meta.officialUrl ? html`<li><a href="${meta.officialUrl}" target="_blank" rel="noopener">${t(lang, 'official')} ↗</a></li>` : ''}
    </ul>
    ${meta.live ? html`<p class="row"><a class="btn btn-live" href="/group_register.html?eventId=${encodeURIComponent(meta.live.eventId)}&source=${meta.live.provider === 'myresult' ? 'myresult' : 'smartchip'}">⏱ ${lang === 'ko' ? '실시간 응원' : 'Live tracking'}</a></p>` : ''}
    <div id="live-runners" class="live-runners" hidden></div>
  </section>

  <section class="stage wrap">
    <div class="viewer">
      <canvas id="fly" aria-label="${lang === 'ko' ? '코스 주행 미리보기' : 'Course fly-through'}"></canvas>
      <div id="map" class="map" hidden></div>
      <div class="ov ov-tl"><span id="ov-km">0.0</span><small>km</small></div>
      <button class="ov ov-tr iconbtn" id="btn-map" type="button" aria-pressed="false" title="${t(lang, 'showMap')}">${t(lang, 'showMap')}</button>
      <div class="ov ov-bl" id="ov-next"></div>
      <div class="ov ov-br">
        <button class="iconbtn" id="btn-speed" type="button">×10</button>
        <button class="playbtn" id="btn-play" type="button" aria-label="${t(lang, 'play')}">▶</button>
      </div>
    </div>
    <aside class="panel" id="panel">
      <div class="panel-top">
        <div class="bigkm"><span id="p-km">0.0</span><small>km</small></div>
        <div class="clock"><small>${t(lang, 'clock')}</small><b id="p-clock">${meta.startTime}</b><small id="p-elapsed">0:00:00</small></div>
      </div>
      <div class="p-seg" id="p-seg">${l(lang, meta.segments[0]?.title) || ''}</div>
      <div class="p-stats">
        <div><small>${t(lang, 'grade')}</small><b id="p-grade">0.0%</b></div>
        <div><small>${t(lang, 'elevation')}</small><b id="p-ele">${Math.round(c.ele[0])} m</b></div>
        <div><small>${t(lang, 'nextAid')}</small><b id="p-aid">${aid[0] ? aid[0].km.toFixed(1) + ' km' : '—'}</b></div>
      </div>
      <div class="p-light" id="p-light"></div>
      <p class="p-tip" id="p-tip">${l(lang, meta.segments[0]?.tip) || ''}</p>
      <div class="p-links">
        <a id="lnk-sv" target="_blank" rel="noopener" href="#">${t(lang, 'streetView')}</a>
        <a id="lnk-map" target="_blank" rel="noopener" href="#">${t(lang, 'openMap')}</a>
      </div>
    </aside>
  </section>

  <section class="wrap profile-wrap">
    <canvas id="profile" aria-label="${t(lang, 'elevation')}"></canvas>
  </section>

  <nav class="subnav wrap" aria-label="sections">
    <a href="#segments">${t(lang, 'segments')}</a><a href="#pace">${t(lang, 'pace')}</a><a href="#weather">${t(lang, 'weather')}</a><a href="#prep">${t(lang, 'prep')}</a>
  </nav>

  <section id="segments" class="wrap block">
    <h2>${t(lang, 'segments')}</h2>
    <ol class="seglist">
      ${segs.map((s) => {
        const tip = segTip(s.fromKm);
        const ps = poisIn(s.fromKm, s.toKm);
        const sp = plan.splits.find((x) => Math.abs(x.km - s.toKm) < 0.01);
        return html`<li class="seg" data-from="${s.fromKm}">
          <div class="seg-l">
            <div class="seg-km">${s.fromKm}–${+s.toKm.toFixed(3)} km${sp ? html` · <span class="seg-clock">${addClock(meta.startTime, sp.elapsed)}</span>` : ''}</div>
            <h3>${l(lang, tip?.title) || `${s.fromKm}–${+s.toKm.toFixed(1)} km`}</h3>
            ${tip ? html`<p>${l(lang, tip.tip)}</p>` : ''}
            <div class="seg-meta"><span class="up">+${s.gain} m</span> <span class="down">−${s.loss} m</span>${s.maxGrade >= 2 ? html` · ${t(lang, 'grade')} max ${s.maxGrade}%` : ''}${ps.length ? html` · ${ps.map((p) => html`<span class="poi poi-${p.type}">${p.km.toFixed(1)} ${l(lang, p.name) || l(lang, POI_LABEL[p.type])}</span> `)}` : ''}</div>
          </div>
          ${sparkline(s.profile, c.minEle, c.maxEle)}
        </li>`;
      })}
    </ol>
  </section>

  ${adSlot(env, lang, 'race-mid')}

  <section id="pace" class="wrap block">
    <h2>${t(lang, 'pace')}</h2>
    <div class="pacebox">
      <div class="target">
        <label for="target">${t(lang, 'targetTime')}</label>
        <div class="stepper"><button type="button" data-step="-60">−</button><input id="target" inputmode="numeric" value="${fmtDuration(target, false)}" aria-label="${t(lang, 'targetTime')}"><button type="button" data-step="60">+</button></div>
        <div class="presets">${TARGET_PRESETS[meta.distance].map((p) => html`<button type="button" data-preset="${p}">${p}</button>`)}</div>
      </div>
      <div class="pace-sum">
        <div><small>${t(lang, 'avgPace')}</small><b id="pace-avg">${fmtPace(plan.avgPace)}</b><small>/km</small></div>
        ${halfSplit ? html`<div><small>${t(lang, 'half')}</small><b id="pace-half">${fmtDuration(halfSplit.elapsed, false)}</b></div>` : ''}
        <div><small>${t(lang, 'finishClock')}</small><b id="pace-finish">${addClock(meta.startTime, target)}</b></div>
      </div>
    </div>
    <p class="muted small">${t(lang, 'paceNote')}</p>
    <table class="splits">
      <thead><tr><th>${t(lang, 'split')}</th><th>${t(lang, 'lapPace')}</th><th>${t(lang, 'elapsed')}</th><th>${t(lang, 'clock')}</th><th class="hide-sm">${t(lang, 'aidStations')}</th></tr></thead>
      <tbody id="splits">
        ${plan.splits.map((s, i) => {
          const prev = i ? plan.splits[i - 1].km : 0;
          const ps = poisIn(prev, s.km).filter((p) => AID_TYPES.includes(p.type));
          const label = Math.abs(s.km - 21.0975) < 0.001 ? t(lang, 'half') : Math.abs(s.km - totalKm) < 0.01 ? t(lang, 'finish') : `${s.km}K`;
          return html`<tr><td>${label}</td><td>${fmtPace(s.lapPace)}</td><td>${fmtDuration(s.elapsed)}</td><td>${addClock(meta.startTime, s.elapsed)}</td><td class="hide-sm">${ps.map((p) => l(lang, POI_LABEL[p.type])).filter((v, k, a) => a.indexOf(v) === k).join('·')}</td></tr>`;
        })}
      </tbody>
    </table>
    <p><a class="btn" id="band-link" href="/r/${meta.slug}/band?t=${fmtDuration(target, false)}${lang === 'en' ? '&lang=en' : ''}" target="_blank">${t(lang, 'printBand')}</a></p>
  </section>

  <section id="weather" class="wrap block">
    <h2>${t(lang, 'weather')}</h2>
    <div id="wx" class="wx"><p class="muted">…</p></div>
  </section>

  ${env.AGODA_CID ? html`<section class="wrap block stay">
    <h2>${t(lang, 'nearbyStay')}</h2>
    <p class="muted">${t(lang, 'nearbyStayDesc')}</p>
    <a class="btn" rel="sponsored noopener" target="_blank" href="https://www.agoda.com/search?cid=${env.AGODA_CID}&textToSearch=${encodeURIComponent(l('en', meta.city) || city)}">Agoda ↗</a>
  </section>` : ''}

  <section id="prep" class="wrap block">
    <h2>${t(lang, 'prep')}</h2>
    ${meta.notes[lang].length ? html`<h3>${t(lang, 'notes')}</h3><ul class="notes">${meta.notes[lang].map((n) => html`<li>${n}</li>`)}</ul>` : ''}
    <h3>${t(lang, 'checklist')} <span class="muted" id="ck-count"></span></h3>
    <div class="checklist" id="checklist">
      ${CHECKLIST.map((g, gi) => html`<fieldset><legend>${l(lang, g.group)}</legend>${g.items.map((it, ii) => html`<label><input type="checkbox" data-k="${gi}.${ii}"> ${l(lang, it)}</label>`)}</fieldset>`)}
    </div>
  </section>

  ${adSlot(env, lang, 'race-bottom')}

  <section class="wrap block sources">
    <h3>${t(lang, 'courseSource')}</h3>
    ${approx ? html`<p class="warn">${t(lang, 'approxCourse')}</p>` : ''}
    ${meta.courseSource?.note ? html`<p class="muted small">${typeof meta.courseSource.note === 'string' ? meta.courseSource.note : l(lang, meta.courseSource.note)}</p>` : ''}
    ${meta.credit ? html`<p class="muted small">${t(lang, 'credit')}: ${meta.credit}</p>` : ''}
    ${meta.sources.length ? html`<h3>${t(lang, 'sources')}</h3><ul class="small">${meta.sources.map((s) => html`<li><a href="${s}" target="_blank" rel="noopener nofollow">${s.replace(/^https?:\/\//, '').slice(0, 70)}</a></li>`)}</ul>` : ''}
  </section>
</main>
${jsonScript('race-data', { meta, course: c, lang })}`;

  const site = (env.SITE_URL || '').replace(/\/$/, '');
  return page({
    lang, env, title, description: desc, path: `/r/${meta.slug}`, body, scripts: ['race'], ads: true,
    ogImage: null,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'SportsEvent', name: l('en', meta.name) || name, sport: 'Running',
      startDate: `${meta.date}T${meta.startTime}`, eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: l('en', meta.city) || city, address: { '@type': 'PostalAddress', addressCountry: meta.country } },
      url: `${site}/r/${meta.slug}`, ...(meta.officialUrl ? { sameAs: meta.officialUrl } : {}),
    },
  });
}
