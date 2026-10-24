import type { Course, Lang } from '../shared/types.ts';
import { t } from '../shared/i18n.ts';
import { runChecks } from '../shared/checks.ts';
import type { ParsedGpx } from '../shared/gpx.ts';
import { courseFromText } from './gpx-tool.ts';
import { metaForm } from './meta-form.ts';
import { checkList, coursePreview } from './preview.ts';
import { $, h } from './dom.ts';
import { icon } from '../shared/icons.ts';

const root = $('#submit-app')!;
const lang = (root.dataset.lang as Lang) || 'ko';
let course: Course | null = null, gpx: ParsedGpx | null = null, file: File | null = null;

// prefill from an event page link (/submit?live=myresult:176&name=…&date=…)
const pre = new URLSearchParams(location.search);
const [preProv, preId] = (pre.get('live') ?? '').split(':');
const form = metaForm(lang, {
  ...(pre.get('name') ? { name: { ko: pre.get('name')!, en: '' } } : {}),
  ...(pre.get('date') && /^\d{4}-\d{2}-\d{2}/.test(pre.get('date')!) ? { date: pre.get('date')!.slice(0, 10) } : {}),
  ...(preProv && preId ? { live: { provider: preProv === 'spct' ? 'spct' : 'myresult', eventId: preId } as never } : {}),
});
const status = h('p', { class: 'muted small' });
const previewBox = h('div');
const fileIn = h('input', { type: 'file', accept: '.gpx,application/gpx+xml,application/xml,text/xml', required: true }) as HTMLInputElement;
const nick = h('input', { maxlength: '40' }) as HTMLInputElement;
const contact = h('input', { maxlength: '120' }) as HTMLInputElement;
const msg = h('textarea', { rows: 3, maxlength: '1000' }) as HTMLTextAreaElement;
const honey = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', class: 'hp' }) as HTMLInputElement;
const send = h('button', { class: 'btn', type: 'submit' }, t(lang, 'send')) as HTMLButtonElement;
const result = h('div', { role: 'status' });

fileIn.addEventListener('change', async () => {
  file = fileIn.files?.[0] ?? null;
  previewBox.innerHTML = '';
  if (!file) return;
  status.textContent = lang === 'ko' ? '읽는 중…' : 'Reading…';
  try {
    const r = await courseFromText(await file.text(), (s) => { if (s === 'dem') status.textContent = lang === 'ko' ? '고도 정보가 없어 지형 데이터로 채우는 중…' : 'No elevation in file, filling from terrain data…'; });
    course = r.course; gpx = r.gpx;
    form.setCourse(course, gpx);
    status.textContent = '';
    previewBox.append(h('h3', {}, t(lang, 'preview')), coursePreview(lang, form.read(), course), h('h3', {}, t(lang, 'checks')), checkList(lang, runChecks(course, form.read())));
  } catch (e) {
    course = null;
    status.textContent = (lang === 'ko' ? 'GPX를 읽지 못했어요: ' : 'Could not read GPX: ') + (e as Error).message;
  }
});

const el = h('form', { class: 'submit-form', onsubmit: async (e: Event) => {
  e.preventDefault();
  result.textContent = '';
  if (!course || !file) { result.textContent = lang === 'ko' ? 'GPX 파일을 먼저 선택하세요.' : 'Choose a GPX file first.'; return; }
  send.disabled = true;
  const fd = new FormData();
  fd.append('gpx', file);
  fd.append('website', honey.value);
  fd.append('payload', JSON.stringify({ meta: form.read(), course, submitter: nick.value, contact: contact.value, message: msg.value }));
  try {
    const r = await fetch('/api/submit', { method: 'POST', body: fd });
    const j = await r.json();
    if (r.ok) { { const done = h('div', { class: 'done' }); done.innerHTML = `${icon('check', 44)}<h2>${lang === 'ko' ? '받았어요' : 'Received'}</h2><p>${t(lang, 'sent')}</p>`; el.replaceWith(done); } window.scrollTo(0, 0); }
    else result.textContent = `${j.error}`;
  } catch { result.textContent = 'network error'; }
  send.disabled = false;
} } as never,
  h('label', { class: 'file' }, h('span', {}, t(lang, 'gpxFile')), fileIn), status, previewBox,
  form.el,
  h('div', { class: 'form grid' },
    h('label', {}, h('span', {}, t(lang, 'nickname')), nick),
    h('label', {}, h('span', {}, t(lang, 'contact')), contact),
    h('label', { class: 'wide' }, h('span', {}, t(lang, 'message')), msg)),
  honey, send, result);
root.append(el);
