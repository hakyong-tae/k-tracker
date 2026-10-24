import type { Course, Lang, RaceMeta } from '../shared/types.ts';
import type { Check } from '../shared/checks.ts';
import { Track } from './track.ts';
import { Profile } from './profile.ts';
import { h } from './dom.ts';

const CHECK_TEXT: Record<string, [string, string]> = {
  distance: ['공식 거리 대비 차이', 'Difference from official distance'],
  'no-elevation': ['고도 정보 없음', 'No elevation data'],
  'elevation-spikes': ['고도가 비정상적으로 튀는 곳', 'Suspicious elevation spikes'],
  'bbox-too-large': ['코스 범위가 너무 넓음 (km)', 'Course spans too wide (km)'],
  'start-finish': ['출발–골인 직선거리 (m)', 'Start–finish distance (m)'],
  'duplicate-slug': ['같은 주소의 대회가 이미 있음', 'A race with this slug exists'],
  'bad-date': ['날짜 형식 오류', 'Bad date'],
  'bad-start-time': ['출발 시각 형식 오류', 'Bad start time'],
};

export function checkList(lang: Lang, checks: Check[]): HTMLElement {
  return h('ul', { class: 'checks' }, checks.map((c) => h('li', { class: `ck-${c.level}` },
    c.level === 'ok' ? '✓ ' : c.level === 'warn' ? '! ' : '✕ ',
    (CHECK_TEXT[c.code]?.[lang === 'ko' ? 0 : 1] ?? c.code) + (c.detail ? `: ${c.code === 'distance' ? (Number(c.detail) > 0 ? '+' : '') + c.detail + '%' : c.detail}` : ''))));
}

/** Small course preview: stats line + elevation profile. */
export function coursePreview(lang: Lang, meta: Partial<RaceMeta>, course: Course): HTMLElement {
  const canvas = h('canvas', { class: 'profile-sm' }) as HTMLCanvasElement;
  const box = h('div', { class: 'preview' },
    h('p', {}, h('b', {}, `${(course.total / 1000).toFixed(2)} km`), ` · ↗ ${course.gain} m · ↘ ${course.loss} m · ${Math.round(course.minEle)}–${Math.round(course.maxEle)} m · ${course.elevationSource}`),
    canvas);
  requestAnimationFrame(() => {
    const track = new Track({ scale: 1, ...meta } as RaceMeta, course);
    const p = new Profile(canvas, track, meta.pois ?? [], lang);
    new ResizeObserver(() => p.resize()).observe(canvas);
  });
  return box;
}
