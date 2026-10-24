import type { Course, Lang, PoiType, RaceMeta } from '../shared/types.ts';
import { NOMINAL_M } from '../shared/types.ts';
import { POI_LABEL, l, t } from '../shared/i18n.ts';
import { slugify, suggestScale } from '../shared/checks.ts';
import { waypointsToKm } from '../shared/course.ts';
import type { ParsedGpx } from '../shared/gpx.ts';
import { h } from './dom.ts';

const POI_TYPES = Object.keys(POI_LABEL) as PoiType[];
const TIMEZONES = ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Bangkok', 'Asia/Taipei', 'Asia/Shanghai', 'Australia/Sydney', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles'];
const COUNTRY_TZ: Record<string, string> = { 'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Asia/Singapore': 'SG', 'Asia/Hong_Kong': 'HK', 'Asia/Bangkok': 'TH', 'Asia/Taipei': 'TW', 'Asia/Shanghai': 'CN', 'Australia/Sydney': 'AU', 'Europe/Berlin': 'DE', 'Europe/London': 'GB', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US' };

export interface MetaForm { el: HTMLElement; read(): RaceMeta; setCourse(c: Course, gpx?: ParsedGpx | null): void }

/** Editable race-details form shared by the public submit page and the admin console. */
export function metaForm(lang: Lang, init: Partial<RaceMeta>, opts: { admin?: boolean } = {}): MetaForm {
  const m: RaceMeta = {
    slug: '', name: { ko: '', en: '' }, date: '', startTime: '08:00', timezone: 'Asia/Seoul', country: 'KR', city: { ko: '', en: '' },
    distance: 'full', officialUrl: '', cutoff: '', pois: [], segments: [], notes: { ko: [], en: [] }, sources: [], scale: 1, ...structuredClone(init),
  } as RaceMeta;
  let course: Course | null = null;
  let slugTouched = !!init.slug;

  const inp = (label: string, value: string, set: (v: string) => void, attrs: Record<string, string> = {}) => {
    const i = h('input', { value, ...attrs, oninput: (e: Event) => set((e.target as HTMLInputElement).value) } as never);
    return h('label', {}, h('span', {}, label), i);
  };
  const area = (label: string, value: string, set: (v: string) => void, rows = 3) =>
    h('label', { class: 'wide' }, h('span', {}, label), h('textarea', { rows, oninput: (e: Event) => set((e.target as HTMLTextAreaElement).value) } as never, value));

  const slugIn = h('input', { value: m.slug, pattern: '[a-z0-9\\-]+', oninput: (e: Event) => { slugTouched = true; m.slug = (e.target as HTMLInputElement).value; } } as never) as HTMLInputElement;
  const autoSlug = () => { if (!slugTouched) { m.slug = slugify(`${m.name.en || ''} ${m.date.slice(0, 4)}`) || slugify(m.date); slugIn.value = m.slug; } };

  const scaleInfo = h('small', { class: 'muted' });
  const scaleIn = h('input', { type: 'number', step: '0.00001', min: '0.9', max: '1.1', value: String(m.scale ?? 1), oninput: (e: Event) => { m.scale = Number((e.target as HTMLInputElement).value) || 1; } } as never) as HTMLInputElement;
  const refreshScale = () => {
    if (!course) return;
    const nominal = NOMINAL_M[m.distance];
    scaleInfo.textContent = `GPX ${(course.total / 1000).toFixed(3)} km${nominal ? ` → ${(nominal / 1000).toFixed(3)} km` : ''}`;
  };

  const tzSel = h('select', { onchange: (e: Event) => { m.timezone = (e.target as HTMLSelectElement).value; if (COUNTRY_TZ[m.timezone]) { m.country = COUNTRY_TZ[m.timezone]; countryIn.value = m.country; } } } as never,
    ...[...new Set([m.timezone, ...TIMEZONES])].map((z) => h('option', { value: z, selected: z === m.timezone } as never, z)));
  const countryIn = h('input', { value: m.country, maxlength: '2', oninput: (e: Event) => { m.country = (e.target as HTMLInputElement).value.toUpperCase(); } } as never) as HTMLInputElement;

  // POIs
  const poiBody = h('tbody');
  const renderPois = () => {
    poiBody.innerHTML = '';
    m.pois.sort((a, b) => a.km - b.km).forEach((p, i) => {
      poiBody.append(h('tr', {},
        h('td', {}, h('input', { type: 'number', step: '0.1', min: '0', value: String(p.km), class: 'num', onchange: (e: Event) => { p.km = Number((e.target as HTMLInputElement).value); } } as never)),
        h('td', {}, h('select', { onchange: (e: Event) => { p.type = (e.target as HTMLSelectElement).value as PoiType; } } as never, POI_TYPES.map((ty) => h('option', { value: ty, selected: ty === p.type } as never, l(lang, POI_LABEL[ty]))))),
        h('td', {}, h('input', { placeholder: '한국어', value: p.name?.ko ?? '', oninput: (e: Event) => { p.name = { ko: (e.target as HTMLInputElement).value, en: p.name?.en ?? '' }; } } as never)),
        h('td', {}, h('input', { placeholder: 'English', value: p.name?.en ?? '', oninput: (e: Event) => { p.name = { ko: p.name?.ko ?? '', en: (e.target as HTMLInputElement).value }; } } as never)),
        h('td', {}, h('button', { type: 'button', class: 'x', onclick: () => { m.pois.splice(i, 1); renderPois(); } } as never, '×')),
      ));
    });
  };
  const everyN = h('input', { type: 'number', value: '5', min: '1', step: '0.5', class: 'num' }) as HTMLInputElement;
  const poiBox = h('fieldset', { class: 'wide' }, h('legend', {}, t(lang, 'aidStations')),
    h('table', { class: 'poi-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'km'), h('th', {}, lang === 'ko' ? '종류' : 'Type'), h('th', {}, 'KO'), h('th', {}, 'EN'), h('th', {}))), poiBody),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { m.pois.push({ km: m.pois.length ? m.pois[m.pois.length - 1].km + 5 : 5, type: 'water' }); renderPois(); } } as never, `+ ${t(lang, 'addPoi')}`),
      h('span', { class: 'muted small' }, lang === 'ko' ? '또는 매' : 'or every'), everyN, h('span', { class: 'muted small' }, 'km'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => {
        const total = course ? (course.total * (m.scale ?? 1)) / 1000 : (NOMINAL_M[m.distance] ?? 42195) / 1000;
        const step = Number(everyN.value) || 5;
        for (let k = step; k < total - 0.5; k += step) if (!m.pois.some((p) => Math.abs(p.km - k) < 0.3)) m.pois.push({ km: +k.toFixed(1), type: 'water' });
        renderPois();
      } } as never, lang === 'ko' ? '급수 채우기' : 'Fill water'),
    ));

  // segments (admin edits tips; submitters may too)
  const segBody = h('div', { class: 'seg-edit' });
  const renderSegs = () => {
    segBody.innerHTML = '';
    m.segments.forEach((s) => {
      segBody.append(h('div', { class: 'seg-row' },
        h('b', {}, `${s.fromKm}–${s.toKm} km`),
        h('input', { placeholder: lang === 'ko' ? '제목 (한국어)' : 'Title (KO)', value: s.title.ko, oninput: (e: Event) => { s.title.ko = (e.target as HTMLInputElement).value; } } as never),
        h('input', { placeholder: 'Title (EN)', value: s.title.en, oninput: (e: Event) => { s.title.en = (e.target as HTMLInputElement).value; } } as never),
        h('textarea', { rows: 2, placeholder: lang === 'ko' ? '공략 팁 (한국어)' : 'Tip (KO)', oninput: (e: Event) => { s.tip.ko = (e.target as HTMLTextAreaElement).value; } } as never, s.tip.ko),
        h('textarea', { rows: 2, placeholder: 'Tip (EN)', oninput: (e: Event) => { s.tip.en = (e.target as HTMLTextAreaElement).value; } } as never, s.tip.en),
      ));
    });
  };
  const ensureSegs = () => {
    const total = course ? (course.total * (m.scale ?? 1)) / 1000 : (NOMINAL_M[m.distance] ?? 0) / 1000;
    if (!total || m.segments.length) return;
    for (let a = 0; a < total - 0.05; a += 5) m.segments.push({ fromKm: a, toKm: +Math.min(total, a + 5).toFixed(3), title: { ko: '', en: '' }, tip: { ko: '', en: '' } });
    renderSegs();
  };

  const el = h('div', { class: 'form grid' },
    inp(t(lang, 'raceNameKo'), m.name.ko, (v) => { m.name.ko = v; }, { required: 'true', placeholder: '스탠다드차타드 싱가포르 마라톤 2026' }),
    inp(t(lang, 'raceNameEn'), m.name.en, (v) => { m.name.en = v; autoSlug(); }, { placeholder: 'Standard Chartered Singapore Marathon 2026' }),
    inp(t(lang, 'raceDate'), m.date, (v) => { m.date = v; autoSlug(); }, { type: 'date', required: 'true' }),
    inp(t(lang, 'startTime'), m.startTime, (v) => { m.startTime = v; }, { type: 'time', required: 'true' }),
    h('label', {}, h('span', {}, t(lang, 'timezone')), tzSel),
    h('label', {}, h('span', {}, t(lang, 'country')), countryIn),
    inp(t(lang, 'cityKo'), m.city.ko, (v) => { m.city.ko = v; }),
    inp(t(lang, 'cityEn'), m.city.en, (v) => { m.city.en = v; }),
    h('label', {}, h('span', {}, t(lang, 'distanceType')), h('select', { onchange: (e: Event) => { m.distance = (e.target as HTMLSelectElement).value as RaceMeta['distance']; if (course) { m.scale = suggestScale(course, m.distance); scaleIn.value = String(m.scale); refreshScale(); } } } as never,
      (['full', 'half', '10k', 'other'] as const).map((d) => h('option', { value: d, selected: d === m.distance } as never, { full: lang === 'ko' ? '풀코스' : 'Marathon', half: lang === 'ko' ? '하프' : 'Half', '10k': '10K', other: lang === 'ko' ? '기타' : 'Other' }[d])))),
    inp(t(lang, 'cutoff'), m.cutoff ?? '', (v) => { m.cutoff = v; }, { placeholder: '7:00' }),
    inp(t(lang, 'officialUrl'), m.officialUrl ?? '', (v) => { m.officialUrl = v; }, { type: 'url', placeholder: 'https://' }),
    h('label', {}, h('span', {}, 'URL slug'), slugIn),
    h('label', {}, h('span', {}, lang === 'ko' ? '거리 보정 배율' : 'Distance scale'), scaleIn, scaleInfo),
    poiBox,
    h('fieldset', { class: 'wide' }, h('legend', {}, lang === 'ko' ? '구간 설명 (선택)' : 'Segment notes (optional)'), segBody),
    area(lang === 'ko' ? '알아둘 것 (한국어, 줄마다 하나)' : 'Good to know (Korean, one per line)', m.notes.ko.join('\n'), (v) => { m.notes.ko = v.split('\n').map((s) => s.trim()).filter(Boolean); }),
    area(lang === 'ko' ? '알아둘 것 (영어, 줄마다 하나)' : 'Good to know (English, one per line)', m.notes.en.join('\n'), (v) => { m.notes.en = v.split('\n').map((s) => s.trim()).filter(Boolean); }),
    area(lang === 'ko' ? '출처 주소 (줄마다 하나)' : 'Source URLs (one per line)', m.sources.join('\n'), (v) => { m.sources = v.split('\n').map((s) => s.trim()).filter(Boolean); }, 2),
    opts.admin ? inp(lang === 'ko' ? '코스 제공자' : 'Credit', m.credit ?? '', (v) => { m.credit = v; }) : null,
    opts.admin ? inp(lang === 'ko' ? '실시간 추적 (myresult|spct|smartchip:대회ID)' : 'Live tracker (provider:eventId)', m.live ? `${m.live.provider}:${m.live.eventId}` : '', (v) => {
      const [p, id] = v.split(':');
      m.live = p && id && ['myresult', 'spct', 'smartchip'].includes(p) ? { provider: p as 'myresult', eventId: id } : null;
    }) : null,
  );
  renderPois(); renderSegs();

  return {
    el,
    read: () => structuredClone(m),
    setCourse(c, gpx) {
      course = c;
      if (!init.scale || init.scale === 1) { m.scale = suggestScale(c, m.distance); scaleIn.value = String(m.scale); }
      refreshScale();
      if (gpx?.waypoints.length && !m.pois.length) {
        for (const w of waypointsToKm(c, gpx.waypoints, m.scale)) {
          if (w.off > 150) continue;
          const s = `${w.name} ${w.type ?? ''}`.toLowerCase();
          const type: PoiType = /water|급수|drink stop/.test(s) ? 'water' : /sport|isotonic|pocari|100plus|gatorade|음료/.test(s) ? 'sports-drink' : /gel|젤/.test(s) ? 'gel' : /food|banana|간식|바나나/.test(s) ? 'food' : /medic|first aid|의료/.test(s) ? 'medical' : /toilet|화장실/.test(s) ? 'toilet' : /turn|반환/.test(s) ? 'turnaround' : 'landmark';
          m.pois.push({ km: w.km, type, name: w.name ? { ko: w.name, en: w.name } : null });
        }
        renderPois();
      }
      ensureSegs();
    },
  };
}
