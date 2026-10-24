import type { Lang } from '../../src/shared/types.ts';
import { icon } from '../../src/shared/icons.ts';
import { daysUntil } from '../../src/shared/time.ts';
import { html, raw, type Raw } from './html.ts';
import type { CatalogItem } from './catalog.ts';

const WD = { ko: ['일', '월', '화', '수', '목', '금', '토'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function dateParts(date: string, lang: Lang) {
  const d = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return { mon: '', day: '', wd: '' };
  return { mon: lang === 'ko' ? `${d.getUTCMonth() + 1}월` : MON[d.getUTCMonth()], day: String(d.getUTCDate()), wd: WD[lang][d.getUTCDay()] };
}

export function dateTile(date: string, lang: Lang, size: 'sm' | 'lg' = 'sm'): Raw {
  const p = dateParts(date, lang);
  return html`<div class="dtile dtile-${size}" aria-hidden="true"><span class="dt-mon">${p.mon}</span><span class="dt-day">${p.day}</span><span class="dt-wd">${p.wd}</span></div>`;
}

export function ddayBadge(date: string, tz: string, lang: Lang): Raw {
  const n = daysUntil(date, tz);
  if (n < 0) return raw('');
  return html`<span class="dday ${n <= 7 ? 'soon' : ''}">${n === 0 ? (lang === 'ko' ? '오늘' : 'Today') : `D-${n}`}</span>`;
}

export function featureTags(it: Pick<CatalogItem, 'course' | 'live'>, lang: Lang): Raw {
  return html`<span class="tags">${it.course ? raw(`<span class="tag tag-course">${icon('route', 14)}${lang === 'ko' ? '코스' : 'Course'}</span>`) : ''}${it.live ? raw(`<span class="tag tag-live">${icon('timer', 14)}${lang === 'ko' ? '실시간' : 'Live'}</span>`) : ''}</span>`;
}

const provName = (p: string) => (p === 'spct' ? 'SPCT' : 'MyResult');

export function courseCard(it: CatalogItem, lang: Lang): Raw {
  const t = it.thumb;
  return html`<li class="rc" data-kind="course" data-live="${it.live ? 1 : 0}" data-intl="${it.country !== 'KR' ? 1 : 0}" data-name="${it.name.toLowerCase()}">
    <a class="rc-link" href="${it.href}">
      <div class="rc-art">${t ? raw(`<svg viewBox="0 0 ${t.w} ${t.h}" aria-hidden="true"><path d="${t.route}" class="rc-route"/></svg>`) : ''}</div>
      <div class="rc-body">
        <div class="rc-top">${dateTile(it.date, lang)}${ddayBadge(it.date, 'Asia/Seoul', lang)}</div>
        <h3>${it.name}</h3>
        <div class="rc-meta">${raw(icon('pin', 14))}${it.place}${it.time ? html` · ${it.time}` : ''}</div>
        <div class="rc-stats">
          ${it.distanceKm ? html`<span><b>${it.distanceKm.toFixed(it.distanceKm % 1 ? 1 : 0)}</b> km</span>` : ''}
          ${it.gain !== null ? html`<span>${raw(icon('mountain', 14))}<b>${it.gain}</b> m</span>` : ''}
          ${featureTags(it, lang)}
        </div>
      </div>
      ${t ? raw(`<svg class="rc-elev" viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true"><path d="${t.elev}"/></svg>`) : ''}
    </a></li>`;
}

export function eventRow(it: CatalogItem, lang: Lang): Raw {
  return html`<li class="er" data-kind="event" data-live="1" data-intl="0" data-name="${it.name.toLowerCase()}">
    <a class="er-link" href="${it.href}">
      ${dateTile(it.date, lang)}
      <div class="er-body"><h3>${it.name}</h3><div class="er-meta">${[it.place, it.live ? provName(it.live.provider) : ''].filter(Boolean).join(' · ')}</div></div>
      ${featureTags(it, lang)}
      ${raw(icon('chevronRight', 18, 'er-chev'))}
    </a></li>`;
}

export function brandMark(): Raw {
  return raw(`<svg class="logo" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M7 22.5c3-0.2 4.2-8.5 8-8.5s4 5 7 5 3-7 3-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="22.5" r="2" fill="#fff"/></svg>`);
}
