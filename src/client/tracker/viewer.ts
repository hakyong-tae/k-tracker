import type { LiveCourse, LiveEvent, LiveRecord } from '../../shared/live.ts';
import { clockSec, estimate, fmtClock, kstNowSec, type Estimate } from '../../shared/position.ts';
import { fmtPace } from '../../shared/time.ts';
import { BIB_RE, esc, getEvent, getRecord, groupPrefix, loadGroup, nowDate, params, providerLabel, providerOf, saveGroup, toast, debugNow, type StoredRunner } from './common.ts';

const eventId = params.get('eventId') ?? '';
const source = params.get('source') === 'smartchip' ? 'smartchip' : 'myresult';
const provider = providerOf(source);
let group = params.get('group') ?? '';
let key = groupPrefix(source, eventId) + group;
const COLORS = ['#ff5a36', '#2f80ed', '#27ae60', '#9b51e0', '#f2994a', '#eb5757', '#2d9cdb', '#219653'];

let event: LiveEvent | null = null;
const latest = new Map<string, LiveRecord | null>(); // bib → last fetched record (null = not found)
let lastFetch = 0;

const $ = (id: string) => document.getElementById(id)!;

// ---------- group membership (localStorage + share link) ----------
function bibs(): string[] { return loadGroup(key).map((r) => r.bib); }
function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set('group', group);
  const b = bibs();
  if (b.length) u.searchParams.set('bibs', b.join(',')); else u.searchParams.delete('bibs');
  history.replaceState(null, '', u.toString());
}
function importBibs() {
  const incoming = (params.get('bibs') || '').split(',').map((b) => b.trim()).filter((b) => BIB_RE.test(b)).slice(0, 50);
  if (!incoming.length) return;
  const runners = loadGroup(key);
  for (const bib of incoming) if (!runners.find((r) => r.bib === bib)) runners.push({ bib, name: '', records: [] });
  saveGroup(key, runners);
}

// ---------- course selection & estimates ----------
function courseFor(rec: LiveRecord | null | undefined): LiveCourse | null {
  const cs = event?.courses ?? [];
  if (!cs.length) return null;
  if (rec?.category) { const byLabel = cs.find((c) => c.label === rec.category); if (byLabel) return byLabel; }
  if (rec?.distanceKm) { const byDist = cs.find((c) => Math.abs(c.distanceKm - rec.distanceKm!) < 0.2); if (byDist) return byDist; }
  return cs.length === 1 ? cs[0] : null;
}
function estimateFor(rec: LiveRecord | null | undefined): { est: Estimate; total: number } | null {
  if (!rec || rec.status === 'pre-race' || !rec.records.length) return null;
  const course = courseFor(rec);
  const total = course?.distanceKm || rec.distanceKm || 0;
  if (!total) return null;
  const est = estimate(rec.records, { totalKm: total, checkpoints: course?.checkpoints ?? [], nowSec: kstNowSec(nowDate()), gunSec: clockSec(course?.gun) });
  // providers like SPCT name splits "Section 1…" (no km), but a posted finish time still means done
  if (!est.finished && rec.finishTime && rec.total) return { est: { ...est, finished: true, estKm: total, finishSec: clockSec(rec.finishTime) }, total };
  return { est, total };
}

// ---------- rendering ----------
function renderHeader() {
  const box = $('event-info');
  if (!event) { box.innerHTML = '<p class="muted">대회 정보를 불러오는 중… / Loading…</p>'; return; }
  const courseLink = event.courseSlug
    ? `<a class="btn ghost small-btn" href="/r/${esc(event.courseSlug)}?live=${provider}:${encodeURIComponent(eventId)}&bibs=${encodeURIComponent(bibs().join(','))}">🗺 코스에서 보기 / On the course</a>` : '';
  box.innerHTML = `<span class="badge-src src-${provider}">${providerLabel(provider)}</span>
    <h1>${esc(event.name || '대회 / Race')}</h1>
    <div class="muted">${esc([event.date, event.time].filter(Boolean).join(' '))}${event.location && event.location !== 'SPCT' ? ` · ${esc(event.location)}` : ''}</div>
    <div class="row">${courseLink}</div>`;
}

function renderStrip() {
  const strip = $('strip');
  const pts = bibs().map((bib, i) => ({ bib, i, rec: latest.get(bib), e: estimateFor(latest.get(bib)) })).filter((x) => x.e && x.e.est.estKm !== null);
  if (!pts.length) { strip.hidden = true; return; }
  strip.hidden = false;
  const total = Math.max(...pts.map((p) => p.e!.total));
  const course = courseFor(pts[0].rec);
  const ticks = (course?.checkpoints ?? []).filter((c) => c.km > 0 && c.km < total - 0.2);
  strip.innerHTML = `<div class="strip-head"><b>코스 위 위치 / On course</b><span class="muted small">0 – ${total.toFixed(1)} km · 추정 / estimated</span></div>
    <div class="strip-bar">
      ${ticks.map((c) => `<span class="tick" style="left:${(c.km / total) * 100}%" title="${esc(c.name)}"></span>`).join('')}
      ${pts.map((p) => {
        const left = Math.min(100, (p.e!.est.estKm! / total) * 100);
        const label = p.rec?.name || p.bib;
        return `<span class="dot" style="left:${left}%;--c:${COLORS[p.i % COLORS.length]}" title="${esc(label)} ${p.e!.est.estKm!.toFixed(1)}km"><i>${esc(label.slice(0, 4))}</i></span>`;
      }).join('')}
    </div>`;
}

function runnerCard(r: StoredRunner, i: number): string {
  const rec = latest.get(r.bib);
  const name = rec?.name || (r.name as string) || '';
  const title = name ? esc(name) : `배번 ${esc(r.bib)}`;
  const color = COLORS[i % COLORS.length];
  const resultUrl = rec?.resultUrl || (provider === 'spct'
    ? `https://time.spct.kr/m2.php?EVENT_NO=${encodeURIComponent(eventId)}&TargetYear=${eventId.slice(0, 4)}&currentPage=1&BIB_NO=${encodeURIComponent(r.bib)}`
    : `https://myresult.co.kr/${encodeURIComponent(eventId)}/${encodeURIComponent(r.bib)}`);
  let body = '';
  if (rec === undefined) body = '<p class="muted small">불러오는 중… / Loading…</p>';
  else if (rec === null) body = '<p class="warn small">이 배번의 기록을 찾지 못했어요. / Bib not found.</p>';
  else if (rec.status === 'pre-race') body = '<p class="status">⏳ 출발 전이에요. 대회가 시작되면 기록이 들어와요. / Not started yet.</p>';
  else {
    const passed = rec.records.filter((x) => x.checkpointTime && x.checkpointTime !== '-');
    const last = passed[passed.length - 1];
    const e = estimateFor(rec);
    if (!last) body = '<p class="status">⏳ 아직 통과 기록이 없어요. / No splits yet.</p>';
    else {
      const pct = e && e.est.estKm !== null ? Math.min(100, (e.est.estKm / e.total) * 100) : 0;
      const finished = e?.est.finished || (!!rec.finishTime && !!rec.total);
      body = `
        <div class="rc-main">
          <div><small>마지막 통과 / Last split</small><b>${esc(last.section)}</b><span class="muted small">${esc(last.checkpointTime.replace(/\s*\(.*\)$/, ''))}</span></div>
          ${finished
            ? `<div><small>완주 / Finish</small><b>${esc(rec.total || (e ? fmtClock(e.est.finishSec!) : ''))}</b><span class="muted small">${rec.rankOverall ? `순위 ${esc(rec.rankOverall)}` : ''}</span></div>`
            : e && e.est.estKm !== null
              ? `<div><small>추정 위치 / Now</small><b>${e.est.estKm.toFixed(1)} km</b><span class="muted small">${e.est.paceSec ? `${fmtPace(e.est.paceSec)}/km` : ''}</span></div>
                 <div><small>예상 골인 / ETA</small><b>${e.est.finishSec ? fmtClock(e.est.finishSec) : '—'}</b><span class="muted small">${e.est.nextKm ? `다음 매트 ${e.est.nextKm}km` : ''}</span></div>`
              : ''}
        </div>
        ${e ? `<div class="progress" aria-label="${pct.toFixed(0)}%"><span style="width:${pct}%;background:${color}"></span></div>` : ''}`;
    }
  }
  return `<article class="runner" style="--c:${color}">
    <header><span class="swatch"></span><h3>${title}</h3>${rec?.category ? `<span class="muted small">${esc(rec.category)}</span>` : ''}
      <button type="button" class="x" data-remove="${esc(r.bib)}" aria-label="삭제 / Remove">×</button></header>
    <div class="muted small">🎽 ${esc(r.bib)}</div>
    ${body}
    <a class="small" href="${esc(resultUrl)}" target="_blank" rel="noopener">${providerLabel(provider)} 공식 기록 / Official ↗</a>
  </article>`;
}

function render() {
  renderHeader();
  const runners = loadGroup(key);
  $('group-name').textContent = group || '-';
  $('runners').innerHTML = runners.length ? runners.map(runnerCard).join('') : '<p class="muted">배번을 추가해 응원할 선수를 등록하세요. / Add a bib to start.</p>';
  renderStrip();
  $('refreshed').textContent = lastFetch ? `최근 새로고침 / Updated ${new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '';
}

// ---------- data ----------
async function fetchAll() {
  const list = bibs();
  await Promise.all(list.map(async (bib) => {
    try {
      const r = await getRecord(provider, eventId, bib);
      latest.set(bib, 'notFound' in r ? null : r);
    } catch { if (!latest.has(bib)) latest.set(bib, null); }
  }));
  // keep names in storage so the group list stays readable offline
  saveGroup(key, loadGroup(key).map((r) => ({ ...r, name: latest.get(r.bib)?.name || r.name || '' })));
  lastFetch = Date.now();
  render();
}

// ---------- actions ----------
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('bib-input') as HTMLInputElement;
  const bib = input.value.trim();
  if (!BIB_RE.test(bib)) return toast('배번을 확인하세요. / Check the bib.');
  const runners = loadGroup(key);
  if (runners.find((r) => r.bib === bib)) return toast('이미 있는 배번이에요. / Already added.');
  runners.push({ bib, name: '', records: [] });
  saveGroup(key, runners); syncUrl(); input.value = '';
  render();
  try { const r = await getRecord(provider, eventId, bib); latest.set(bib, 'notFound' in r ? null : r); } catch { latest.set(bib, null); }
  render();
  toast(`배번 ${bib} 추가 / added`);
});
$('runners').addEventListener('click', (e) => {
  const bib = (e.target as HTMLElement).closest<HTMLElement>('[data-remove]')?.dataset.remove;
  if (!bib || !confirm(`배번 ${bib}를 그룹에서 뺄까요? / Remove from group?`)) return;
  saveGroup(key, loadGroup(key).filter((r) => r.bib !== bib)); latest.delete(bib); syncUrl(); render();
});
$('btn-share').addEventListener('click', async () => {
  syncUrl();
  const shareData = { title: `${event?.name ?? 'K-TRACKER'} · ${group}`, url: location.href };
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(location.href); toast('공유 링크를 복사했어요. / Link copied.'); }
  } catch { /* user cancelled */ }
});
$('btn-rename').addEventListener('click', () => {
  const name = prompt('새 그룹 이름 / New group name', group)?.trim();
  if (!name || name === group || name.length > 16) return;
  const newKey = groupPrefix(source, eventId) + name;
  saveGroup(newKey, loadGroup(key)); localStorage.removeItem(key);
  group = name; key = newKey; syncUrl(); render();
});
let lastManual = 0;
$('btn-refresh').addEventListener('click', () => {
  if (Date.now() - lastManual < 30000) return toast('30초 뒤에 다시 눌러주세요. / Try again in 30s.');
  lastManual = Date.now(); fetchAll();
});

// ---------- boot ----------
if (!eventId || !group) { $('runners').innerHTML = '<p class="warn">잘못된 링크예요. / Invalid link.</p>'; }
else {
  importBibs(); syncUrl(); render();
  getEvent(provider, eventId).then((ev) => { event = ev; render(); }).catch(() => { event = { provider, id: eventId, name: '', date: '', time: '', location: '', courses: [], courseSlug: null }; render(); });
  fetchAll();
  setInterval(fetchAll, 2 * 60 * 1000);   // records (server caches 60 s)
  setInterval(render, 20 * 1000);         // re-estimate positions between fetches
  if (debugNow) document.title = `[replay ${debugNow}] ${document.title}`;
}
