import type { Course, RaceMeta } from '../shared/types.ts';
import type { Check } from '../shared/checks.ts';
import { runChecks } from '../shared/checks.ts';
import type { ParsedGpx } from '../shared/gpx.ts';
import { courseFromText } from './gpx-tool.ts';
import { metaForm } from './meta-form.ts';
import { checkList, coursePreview } from './preview.ts';
import { $, h } from './dom.ts';

const lang = (document.documentElement.lang as 'ko' | 'en') || 'ko';
const app = $('#admin-app')!;
const K = (ko: string, en: string) => (lang === 'ko' ? ko : en);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string; detail?: string }).error + ((j as { detail?: string }).detail ? `: ${(j as { detail?: string }).detail}` : ''));
  return j as T;
}

type Tab = 'pending' | 'races' | 'new';
let tab: Tab = (location.hash.slice(1) as Tab) || 'pending';

function nav() {
  return h('nav', { class: 'tabs' }, (['pending', 'races', 'new'] as Tab[]).map((k) => h('button', { type: 'button', class: k === tab ? 'on' : '', onclick: () => { tab = k; location.hash = k; render(); } } as never,
    { pending: K('대기 중 제보', 'Pending'), races: K('대회 목록', 'Races'), new: K('새 대회', 'New race') }[k])));
}

async function render() {
  app.innerHTML = '';
  app.append(nav());
  const body = h('div', { class: 'admin-body' }, h('p', { class: 'muted' }, '…'));
  app.append(body);
  try {
    if (tab === 'pending') await renderPending(body);
    else if (tab === 'races') await renderRaces(body);
    else renderNew(body);
  } catch (e) { body.innerHTML = ''; body.append(h('p', { class: 'warn' }, String(e))); }
}

interface SubRow { id: number; kind: string; name: { ko: string; en: string }; date: string; slug: string; submitter: string; checks: Check[]; created_at: string }
async function renderPending(body: HTMLElement) {
  const rows = await api<SubRow[]>('/api/admin/submissions?status=pending');
  body.innerHTML = '';
  if (!rows.length) { body.append(h('p', { class: 'muted' }, K('대기 중인 제보가 없어요.', 'Nothing pending.'))); return; }
  body.append(h('ul', { class: 'list' }, rows.map((r) => h('li', {},
    h('button', { type: 'button', class: 'linkish', onclick: () => openSubmission(r.id, body) } as never, `${r.name.ko || r.name.en} · ${r.date}`),
    h('span', { class: 'muted small' }, ` ${r.kind} · ${r.submitter || '—'} · ${r.created_at}`),
    r.checks.some((c) => c.level === 'error') ? h('span', { class: 'badge err' }, '✕') : r.checks.some((c) => c.level === 'warn') ? h('span', { class: 'badge warn' }, '⚠') : h('span', { class: 'badge ok' }, '✓')))));
}

async function openSubmission(id: number, body: HTMLElement) {
  const s = await api<{ id: number; meta: RaceMeta; course: Course; checks: Check[]; submitter: string; contact: string; message: string; gpx_key: string | null }>(`/api/admin/submissions/${id}`);
  const form = metaForm(lang, s.meta, { admin: true });
  form.setCourse(s.course);
  const out = h('p', { role: 'status' });
  const note = h('input', { placeholder: K('메모 (반려 사유 등)', 'Note (e.g. reject reason)') }) as HTMLInputElement;
  const act = async (action: string, status?: string) => {
    try {
      const r = await api<{ slug?: string }>(`/api/admin/submissions/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, status, meta: form.read(), note: note.value }) });
      out.textContent = action === 'reject' ? K('반려했어요.', 'Rejected.') : K(`승인 완료: /r/${r.slug}`, `Approved: /r/${r.slug}`);
      setTimeout(render, 900);
    } catch (e) { out.textContent = `${(e as Error).message}`; }
  };
  body.innerHTML = '';
  body.append(
    h('button', { type: 'button', class: 'linkish', onclick: render } as never, K('← 목록', '← Back')),
    h('h2', {}, `#${s.id} ${s.meta.name.ko || s.meta.name.en}`),
    h('p', { class: 'muted small' }, `${s.submitter || '—'} · ${s.contact || '—'}`), s.message ? h('blockquote', {}, s.message) : '',
    coursePreview(lang, s.meta, s.course), checkList(lang, s.checks),
    form.el,
    h('div', { class: 'row actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => act('approve', 'published') } as never, K('승인하고 공개', 'Approve & publish')),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => act('approve', 'draft') } as never, K('승인 (비공개 초안)', 'Approve as draft')),
      note,
      h('button', { type: 'button', class: 'btn danger', onclick: () => act('reject') } as never, K('반려', 'Reject'))),
    out);
}

interface RaceRow { id: number; slug: string; status: string; date: string; meta: RaceMeta }
async function renderRaces(body: HTMLElement) {
  const rows = await api<RaceRow[]>('/api/admin/races');
  body.innerHTML = '';
  body.append(h('table', { class: 'splits' }, h('thead', {}, h('tr', {}, h('th', {}, K('대회', 'Race')), h('th', {}, K('날짜', 'Date')), h('th', {}, K('상태', 'Status')), h('th', {}))),
    h('tbody', {}, rows.map((r) => h('tr', {},
      h('td', {}, r.meta.name.ko || r.meta.name.en), h('td', {}, r.date), h('td', {}, h('span', { class: `badge ${r.status === 'published' ? 'ok' : 'warn'}` }, r.status)),
      h('td', {}, h('a', { href: `/r/${r.slug}?preview=1`, target: '_blank' }, K('보기', 'View')), ' · ', h('button', { type: 'button', class: 'linkish', onclick: () => editRace(r.id, body) } as never, K('편집', 'Edit'))))))));
}

async function editRace(id: number, body: HTMLElement) {
  const r = await api<{ id: number; slug: string; status: string; meta: RaceMeta; course: Course }>(`/api/admin/races/${id}`);
  const form = metaForm(lang, r.meta, { admin: true });
  form.setCourse(r.course);
  let newCourse: Course | null = null;
  const statusSel = h('select', {}, ['published', 'draft', 'hidden'].map((s) => h('option', { value: s, selected: s === r.status } as never, s))) as HTMLSelectElement;
  const gpxIn = h('input', { type: 'file', accept: '.gpx' }) as HTMLInputElement;
  const prev = h('div');
  gpxIn.addEventListener('change', async () => {
    const f = gpxIn.files?.[0]; if (!f) return;
    const res = await courseFromText(await f.text());
    newCourse = res.course; form.setCourse(newCourse, res.gpx);
    prev.innerHTML = ''; prev.append(coursePreview(lang, form.read(), newCourse));
  });
  const out = h('p', { role: 'status' });
  body.innerHTML = '';
  body.append(
    h('button', { type: 'button', class: 'linkish', onclick: render } as never, K('← 목록', '← Back')),
    h('h2', {}, r.meta.name.ko || r.meta.name.en),
    coursePreview(lang, r.meta, r.course),
    h('label', { class: 'file' }, h('span', {}, K('GPX 교체 (선택)', 'Replace GPX (optional)')), gpxIn), prev,
    form.el,
    h('div', { class: 'row actions' }, h('label', {}, K('상태 ', 'Status '), statusSel),
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        try { await api(`/api/admin/races/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meta: form.read(), status: statusSel.value, course: newCourse ?? undefined }) }); out.textContent = K('저장했어요.', 'Saved.'); }
        catch (e) { out.textContent = `${(e as Error).message}`; }
      } } as never, K('저장', 'Save')),
      h('a', { class: 'btn ghost', href: `/r/${form.read().slug}?preview=1`, target: '_blank' }, K('미리보기', 'Preview'))),
    out);
}

function renderNew(body: HTMLElement) {
  const form = metaForm(lang, {}, { admin: true });
  let course: Course | null = null, file: File | null = null, gpx: ParsedGpx | null = null;
  const gpxIn = h('input', { type: 'file', accept: '.gpx' }) as HTMLInputElement;
  const prev = h('div'); const out = h('p', { role: 'status' });
  gpxIn.addEventListener('change', async () => {
    file = gpxIn.files?.[0] ?? null; if (!file) return;
    try {
      const res = await courseFromText(await file.text());
      course = res.course; gpx = res.gpx; form.setCourse(course, gpx);
      prev.innerHTML = ''; prev.append(coursePreview(lang, form.read(), course), checkList(lang, runChecks(course, form.read())));
    } catch (e) { out.textContent = `${(e as Error).message}`; }
  });
  const save = async (status: string) => {
    if (!course) { out.textContent = K('GPX를 먼저 올려주세요.', 'Upload a GPX first.'); return; }
    const fd = new FormData();
    if (file) fd.append('gpx', file);
    fd.append('payload', JSON.stringify({ meta: form.read(), course, status }));
    try { const r = await api<{ slug: string }>('/api/admin/races', { method: 'POST', body: fd }); out.innerHTML = ''; out.append(K('저장했어요: ', 'Saved: '), h('a', { href: `/r/${r.slug}?preview=1`, target: '_blank' }, `/r/${r.slug}`)); }
    catch (e) { out.textContent = `${(e as Error).message}`; }
  };
  body.innerHTML = '';
  body.append(h('label', { class: 'file' }, h('span', {}, 'GPX'), gpxIn), prev, form.el,
    h('div', { class: 'row actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => save('published') } as never, K('바로 공개', 'Publish')),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => save('draft') } as never, K('초안 저장', 'Save draft'))), out);
}

window.addEventListener('hashchange', () => { tab = (location.hash.slice(1) as Tab) || 'pending'; render(); });
render();
