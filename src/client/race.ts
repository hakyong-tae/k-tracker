import type { Course, Lang, RaceMeta } from '../shared/types.ts';
import { t, l, POI_LABEL, AID_TYPES } from '../shared/i18n.ts';
import { planSplits } from '../shared/pace.ts';
import { fmtDuration, fmtPace, addClock, parseDuration, raceStartInstant, daysUntil } from '../shared/time.ts';
import { sunElevation } from '../shared/geo.ts';
import { dewPoint, heatAdjustment, windRelative, type WeatherReport } from '../shared/weather.ts';
import { defaultTarget } from '../shared/race-defaults.ts';
import { findClimbs } from '../shared/segments.ts';
import { Track, compass } from './track.ts';
import { Flyover } from './flyover.ts';
import { Profile } from './profile.ts';
import type { CourseMap } from './map.ts';
import { $, $$, h, store } from './dom.ts';
import { icon, weatherIcon } from '../shared/icons.ts';
import { clockSec, estimate, kstNowSec } from '../shared/position.ts';
import type { LiveEvent, LiveRecord } from '../shared/live.ts';

const data = JSON.parse($('#race-data')!.textContent!) as { meta: RaceMeta; course: Course; lang: Lang };
const { meta, course, lang } = data;
const track = new Track(meta, course);
const aid = meta.pois.filter((p) => AID_TYPES.includes(p.type));
const startInstant = raceStartInstant(meta.date, meta.startTime, meta.timezone);
const KEY = `kt:${meta.slug}`;
const isKR = meta.country === 'KR';

// ---------- state ----------
let target = store.get<number>(`${KEY}:target`, defaultTarget(meta, course));
let plan = makePlan();
let d = 0;               // raw meters along the GPX
let playing = false;
const SPEEDS = [10, 30, 60, 120];
let speedIdx = 1;
let wx: WeatherReport | null = null;

function makePlan() { return planSplits(course, target, { scale: track.scale, extra: meta.distance === 'full' ? [21.0975] : [] }); }

// ---------- D-day (SSR may be cached across midnight) ----------
const dd = $('#dday');
if (dd) {
  const n = daysUntil(meta.date, meta.timezone);
  dd.textContent = n > 0 ? `${t(lang, 'dday')}${n}` : n === 0 ? t(lang, 'raceDay') : t(lang, 'finished');
}

// ---------- views ----------
const flyCanvas = $<HTMLCanvasElement>('#fly')!;
const fly = new Flyover(flyCanvas, track, aid);
const short = (s: string) => s.split(/\s[(（–-]\s?|\s\(/)[0].trim().slice(0, 22);
const PRI: Record<string, number> = { turnaround: 3, hill: 3, landmark: 1 };
const labels = [
  ...meta.pois.filter((p) => PRI[p.type] && p.name && p.km > 0.3 && p.km < track.totalKm - 0.3).map((p) => ({ km: p.km, text: short(l(lang, p.name)), pri: PRI[p.type] })),
  ...findClimbs(course, track.scale, 12).filter((cl) => !meta.pois.some((p) => p.type === 'hill' && Math.abs(p.km - cl.toKm) < 1.5)).map((cl) => ({ km: cl.toKm, text: `↗${cl.gain}m`, pri: 2 })),
];
const profile = new Profile($<HTMLCanvasElement>('#profile')!, track, meta.pois, lang, labels);
profile.onSeek = (km) => { playing = false; syncPlay(); seek(track.dist(km)); };

let map: CourseMap | null = null;
const mapEl = $('#map')!;
const btnMap = $('#btn-map')!;
btnMap.addEventListener('click', async () => {
  const show = mapEl.hidden;
  mapEl.hidden = !show; flyCanvas.hidden = show;
  btnMap.setAttribute('aria-pressed', String(show));
  btnMap.innerHTML = show ? `${icon('runner', 16)}<span>${lang === 'ko' ? '주행' : 'Run view'}</span>` : `${icon('map', 16)}<span>${t(lang, 'showMap')}</span>`;
  if (show && !map) {
    const { createMap } = await import('./map.ts');
    map = createMap(mapEl, track, meta.pois, (dd2) => seek(dd2));
    map.setPosition(d);
    map.setRunners(liveMarks.map((m) => ({ d: track.dist(m.km), color: m.color, label: m.label })));
  } else map?.resize();
  if (!show) { fly.resize(); draw(); }
});

// ---------- panel ----------
const el = {
  ovKm: $('#ov-km')!, ovNext: $('#ov-next')!, km: $('#p-km')!, clock: $('#p-clock')!, elapsed: $('#p-elapsed')!,
  seg: $('#p-seg')!, grade: $('#p-grade')!, ele: $('#p-ele')!, aid: $('#p-aid')!, tip: $('#p-tip')!, light: $('#p-light')!,
  sv: $<HTMLAnchorElement>('#lnk-sv')!, mapLnk: $<HTMLAnchorElement>('#lnk-map')!,
};
let lastLinkUpdate = -1e9;

function hourAt(sec: number) {
  if (!wx?.hours.length) return null;
  const clock = addClock(meta.startTime, sec).slice(0, 2);
  return wx.hours.find((x) => x.hour.startsWith(clock)) ?? null;
}

function updatePanel() {
  const km = track.km(d);
  const sec = plan.at(km);
  const g = track.grade(d);
  el.ovKm.textContent = km.toFixed(1);
  el.km.textContent = km.toFixed(1);
  el.clock.textContent = addClock(meta.startTime, sec);
  el.elapsed.textContent = fmtDuration(sec);
  el.grade.textContent = `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`;
  el.grade.className = g >= 2 ? 'up' : g <= -2 ? 'down' : '';
  el.ele.textContent = `${Math.round(track.ele(d))} m`;
  const next = aid.find((p) => p.km > km + 0.01);
  el.aid.textContent = next ? `${next.km.toFixed(1)} km` : '—';
  el.ovNext.innerHTML = '';
  if (next) { el.ovNext.innerHTML = icon('droplet', 15); el.ovNext.append(h('b', {}, `${next.km.toFixed(1)}km`), ' ', l(lang, POI_LABEL[next.type])); }
  const seg = meta.segments.find((s) => km >= s.fromKm && km < s.toKm + 1e-6) ?? meta.segments[meta.segments.length - 1];
  el.seg.textContent = seg ? l(lang, seg.title) : '';
  el.tip.textContent = seg ? l(lang, seg.tip) : '';
  // sun + heading + wind
  const at = new Date(startInstant.getTime() + sec * 1000);
  const [la, lo] = track.latlon(d);
  const sun = sunElevation(at, la, lo);
  const head = track.headingAt(d);
  const bits: string[] = [];
  bits.push(sun < -0.8 ? `${icon('moon', 15)}${t(lang, 'dark')}` : sun < 15 ? `${icon('sunrise', 15)}${lang === 'ko' ? '낮은 해' : 'Low sun'} ${Math.round(sun)}°` : `${icon('sun', 15)}${lang === 'ko' ? '해' : 'Sun'} ${Math.round(sun)}°`);
  bits.push(`${icon('compass', 15)}${compass(head, lang)}${lang === 'ko' ? '쪽으로' : '-bound'}`);
  const hw = hourAt(sec);
  if (hw?.wdir != null && hw.wind >= 1) {
    const rel = windRelative(head, hw.wdir);
    bits.push(`${icon('wind', 15)}${rel === 'head' ? (lang === 'ko' ? '맞바람' : 'Headwind') : rel === 'tail' ? (lang === 'ko' ? '뒷바람' : 'Tailwind') : (lang === 'ko' ? '옆바람' : 'Crosswind')} ${hw.wind.toFixed(1)}m/s`);
  }
  el.light.innerHTML = bits.map((b) => `<span>${b}</span>`).join('');
  if (Math.abs(d - lastLinkUpdate) > 50) {
    lastLinkUpdate = d;
    el.sv.href = isKR ? `https://map.kakao.com/link/roadview/${la.toFixed(6)},${lo.toFixed(6)}` : `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${la.toFixed(6)},${lo.toFixed(6)}&heading=${Math.round(head)}`;
    el.mapLnk.href = isKR ? `https://map.kakao.com/link/map/${encodeURIComponent(km.toFixed(1) + 'km')},${la.toFixed(6)},${lo.toFixed(6)}` : `https://www.google.com/maps/search/?api=1&query=${la.toFixed(6)},${lo.toFixed(6)}`;
  }
  return sun;
}

let sunEl = 0;
function draw() {
  sunEl = updatePanel();
  if (!flyCanvas.hidden) fly.render(d, sunEl, performance.now() / 1000);
  profile.setCursor(track.km(d));
  map?.setPosition(d);
}
function seek(nd: number) { d = Math.max(0, Math.min(course.total, nd)); draw(); }

// ---------- playback ----------
const btnPlay = $('#btn-play')!, btnSpeed = $('#btn-speed')!;
btnSpeed.textContent = `×${SPEEDS[speedIdx]}`;
function syncPlay() { btnPlay.innerHTML = icon(playing ? 'pause' : 'play', 22); btnPlay.setAttribute('aria-label', t(lang, playing ? 'pause' : 'play')); }
btnPlay.addEventListener('click', () => { if (d >= course.total - 1) d = 0; playing = !playing; syncPlay(); });
btnSpeed.addEventListener('click', () => { speedIdx = (speedIdx + 1) % SPEEDS.length; btnSpeed.textContent = `×${SPEEDS[speedIdx]}`; });
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    const km = track.km(d);
    const pace = (plan.at(Math.min(track.totalKm, km + 0.05)) - plan.at(Math.max(0, km - 0.05))) / (Math.min(track.totalKm, km + 0.05) - Math.max(0, km - 0.05)) || plan.avgPace;
    const vKm = 1 / pace; // km per second
    d = Math.min(course.total, d + track.dist(vKm * dt * SPEEDS[speedIdx]));
    if (d >= course.total) { playing = false; syncPlay(); }
    draw();
  } else if (!flyCanvas.hidden && document.visibilityState === 'visible') {
    fly.render(d, sunEl, now / 1000); // keep the crowd moving
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input,textarea,select')) return;
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; syncPlay(); }
  if (e.code === 'ArrowRight') seek(d + track.dist(0.5));
  if (e.code === 'ArrowLeft') seek(d - track.dist(0.5));
});
new ResizeObserver(() => { fly.resize(); profile.resize(); draw(); }).observe(flyCanvas.parentElement!);

// segment cards jump the viewer
$$('.seg').forEach((li) => li.addEventListener('click', () => { seek(track.dist(Number(li.dataset.from))); $('.stage')!.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));

// ---------- pace ----------
const tInput = $<HTMLInputElement>('#target')!;
function renderPace() {
  plan = makePlan();
  store.set(`${KEY}:target`, target);
  tInput.value = fmtDuration(target, false);
  $('#pace-avg')!.textContent = fmtPace(plan.avgPace);
  const half = plan.splits.find((s) => Math.abs(s.km - 21.0975) < 0.001);
  if (half && $('#pace-half')) $('#pace-half')!.textContent = fmtDuration(half.elapsed, false);
  $('#pace-finish')!.textContent = addClock(meta.startTime, target);
  const tb = $('#splits')!;
  tb.innerHTML = '';
  plan.splits.forEach((s, i) => {
    const prev = i ? plan.splits[i - 1].km : 0;
    const ps = aid.filter((p) => p.km > prev && p.km <= s.km + 0.001).map((p) => l(lang, POI_LABEL[p.type])).filter((v, k, a) => a.indexOf(v) === k).join('·');
    const label = Math.abs(s.km - 21.0975) < 0.001 ? t(lang, 'half') : i === plan.splits.length - 1 ? t(lang, 'finish') : `${s.km}K`;
    tb.append(h('tr', {}, h('td', {}, label), h('td', {}, fmtPace(s.lapPace)), h('td', {}, fmtDuration(s.elapsed)), h('td', {}, addClock(meta.startTime, s.elapsed)), h('td', { class: 'hide-sm' }, ps)));
  });
  $$('.seg').forEach((li) => {
    const to = Number(li.dataset.from) + 5;
    const sp = plan.splits.find((x) => Math.abs(x.km - Math.min(to, track.totalKm)) < 0.01) ?? plan.splits[plan.splits.length - 1];
    const c = li.querySelector('.seg-clock'); if (c && sp) c.textContent = addClock(meta.startTime, sp.elapsed);
  });
  const band = $<HTMLAnchorElement>('#band-link');
  if (band) band.href = `/r/${meta.slug}/band?t=${fmtDuration(target, false)}${lang === 'en' ? '&lang=en' : ''}`;
  $$('.presets button').forEach((b) => b.classList.toggle('on', parseDuration(b.dataset.preset!) === target));
  renderHeat();
  draw();
}
tInput.addEventListener('change', () => { const v = parseDuration(tInput.value); if (v && v > 600 && v < 12 * 3600) target = v; renderPace(); });
$$('.stepper button').forEach((b) => b.addEventListener('click', () => { target = Math.max(600, target + Number(b.dataset.step)); renderPace(); }));
$$('.presets button').forEach((b) => b.addEventListener('click', () => { target = parseDuration(b.dataset.preset!)!; renderPace(); }));

// ---------- weather ----------
const wxEl = $('#wx')!;
function renderHeat() {
  const box = $('#heat');
  if (!box || !wx) return;
  const endClock = addClock(meta.startTime, target).slice(0, 2);
  const startH = Number(meta.startTime.slice(0, 2));
  const inRace = wx.hours.filter((x) => { const hh = Number(x.hour.slice(0, 2)); const e = Number(endClock); return e >= startH ? hh >= startH && hh <= e : hh >= startH || hh <= e; });
  const hs = inRace.length ? inRace : wx.hours;
  const tAvg = hs.reduce((a, x) => a + x.t, 0) / hs.length;
  const rhAvg = hs.reduce((a, x) => a + x.rh, 0) / hs.length;
  const dp = dewPoint(tAvg, rhAvg);
  const adj = heatAdjustment(tAvg, dp);
  box.innerHTML = '';
  box.append(h('h3', {}, t(lang, 'heatAdj')), h('p', { class: 'muted small' }, `${t(lang, 'heatAdjDesc')} · ${t(lang, 'temp')} ${tAvg.toFixed(1)}° · ${t(lang, 'dew')} ${dp.toFixed(1)}°`));
  if (!adj) box.append(h('p', { class: 'warn' }, t(lang, 'heatTooHot')));
  else if (adj.max === 0) box.append(h('p', {}, lang === 'ko' ? '기록 내기 좋은 조건이에요.' : 'Good conditions for a fast time.'));
  else {
    const slow = (pct: number) => fmtDuration(target * (1 + pct / 100), false);
    box.append(h('p', { class: 'heat-big' }, `+${adj.min}–${adj.max}%`, h('small', {}, ` → ${slow(adj.min)}–${slow(adj.max)}`)));
  }
}
async function loadWeather() {
  try {
    const r = await fetch(`/api/weather?slug=${encodeURIComponent(meta.slug)}`);
    wx = r.ok ? ((await r.json()) as WeatherReport | null) : null;
  } catch { wx = null; }
  wxEl.innerHTML = '';
  if (!wx || !wx.hours?.length) { wxEl.append(h('p', { class: 'muted' }, lang === 'ko' ? '날씨 정보를 불러오지 못했어요.' : 'Weather unavailable.')); return; }
  wxEl.append(
    h('p', { class: 'muted small' }, wx.kind === 'forecast' ? `${t(lang, 'forecast')} · ${t(lang, 'forecastNote')}` : `${t(lang, 'climate')} (${wx.years?.join(', ')}) · ${t(lang, 'climateNote')}`),
    h('div', { class: 'wx-hours' }, wx.hours.map((x) => h('div', { class: 'wx-h' },
      h('small', {}, x.hour), (() => { const d = h('div', { class: 'wx-i' }); d.innerHTML = weatherIcon(x.symbol) ? icon(weatherIcon(x.symbol), 22) : ''; return d; })(), h('b', {}, `${Math.round(x.t)}°`),
      ...[[ 'droplet', `${Math.round(x.rh)}%`], ['wind', `${x.wind.toFixed(1)}`], ...(x.rain ? [['rain', `${x.rain}mm`]] : [])].map(([ic, v]) => { const sm = h('small'); sm.innerHTML = icon(ic, 12) + v; return sm; })))),
    h('div', { id: 'heat', class: 'heat' }),
    h('p', { class: 'muted tiny' }, `${t(lang, 'sources')}: ${wx.source}`),
  );
  renderHeat();
  draw();
}

// ---------- checklist ----------
const ck = store.get<Record<string, boolean>>(`${KEY}:check`, {});
const boxes = $$<HTMLInputElement>('#checklist input[type=checkbox]');
const count = () => { const n = boxes.filter((b) => b.checked).length; $('#ck-count')!.textContent = `${n}/${boxes.length}`; };
boxes.forEach((b) => { b.checked = !!ck[b.dataset.k!]; b.addEventListener('change', () => { ck[b.dataset.k!] = b.checked; store.set(`${KEY}:check`, ck); count(); }); });
count();

// ---------- live runners on the course (opened from the tracker's "On the course" link) ----------
const COLORS = ['#ff5a36', '#2f80ed', '#27ae60', '#9b51e0', '#f2994a', '#eb5757', '#2d9cdb', '#219653'];
let liveMarks: { km: number; color: string; label: string }[] = [];
function startLive() {
  const q = new URLSearchParams(location.search);
  const [prov, evId] = (q.get('live') ?? '').split(':');
  const live = prov && evId ? { provider: prov === 'spct' || prov === 'smartchip' ? 'spct' : 'myresult', eventId: evId } : meta.live ? { provider: meta.live.provider === 'myresult' ? 'myresult' : 'spct', eventId: meta.live.eventId } : null;
  const bibs = (q.get('bibs') ?? '').split(',').map((b) => b.trim()).filter((b) => /^[0-9A-Za-z-]{1,10}$/.test(b)).slice(0, 20);
  if (!live || !bibs.length) return;
  const debugNow = q.get('now');
  const box = $('#live-runners')!;
  let ev: LiveEvent | null = null;
  const recs = new Map<string, LiveRecord>();
  const paint = () => {
    const nowSec = kstNowSec(debugNow ? new Date(debugNow) : new Date());
    liveMarks = [];
    box.innerHTML = '';
    bibs.forEach((bib, i) => {
      const rec = recs.get(bib);
      const color = COLORS[i % COLORS.length];
      const label = rec?.name || bib;
      const course = ev?.courses.find((c) => c.label === rec?.category) ?? ev?.courses.find((c) => Math.abs(c.distanceKm - track.totalKm) < 0.3) ?? null;
      const e = rec && rec.status !== 'pre-race' && rec.records.length
        ? estimate(rec.records, { totalKm: track.totalKm, checkpoints: course?.checkpoints ?? [], nowSec, gunSec: clockSec(course?.gun) }) : null;
      const km = e?.estKm ?? null;
      if (km !== null) liveMarks.push({ km, color, label: label.slice(0, 6) });
      const b = h('button', { type: 'button', style: `--c:${color}`, onclick: () => { if (km !== null) { playing = false; syncPlay(); seek(track.dist(km)); } } } as never,
        h('i'), `${label} · ${km !== null ? `${km.toFixed(1)}km` : rec?.status === 'pre-race' ? (lang === 'ko' ? '출발 전' : 'not started') : '—'}`);
      box.append(b);
    });
    box.hidden = false;
    profile.setRunners(liveMarks);
    map?.setRunners(liveMarks.map((m) => ({ d: track.dist(m.km), color: m.color, label: m.label })));
  };
  const load = async () => {
    if (!ev) ev = await fetch(`/api/live/event?provider=${live.provider}&event=${encodeURIComponent(live.eventId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    await Promise.all(bibs.map(async (bib) => {
      const r = await fetch(`/api/live/record?provider=${live.provider}&event=${encodeURIComponent(live.eventId)}&bib=${encodeURIComponent(bib)}${debugNow ? `&now=${encodeURIComponent(debugNow)}` : ''}`).catch(() => null);
      if (r?.ok) recs.set(bib, await r.json());
    }));
    paint();
  };
  load();
  setInterval(load, 2 * 60 * 1000);
  setInterval(paint, 20 * 1000);
}

renderPace();
loadWeather();
startLive();
