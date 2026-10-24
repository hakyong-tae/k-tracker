import { icon } from '../../shared/icons.ts';
import { esc, getEvent, groupPrefix, params, providerLabel, providerOf, toast } from './common.ts';

const eventId = params.get('eventId') ?? '';
const source = params.get('source') === 'smartchip' ? 'smartchip' : 'myresult';
const provider = providerOf(source);
const prefix = groupPrefix(source, eventId);
const info = document.getElementById('event-info')!;
const input = document.getElementById('group-name') as HTMLInputElement;
const mine = document.getElementById('my-groups')!;

const viewerUrl = (g: string) => `group_viewer.html?group=${encodeURIComponent(g)}&eventId=${encodeURIComponent(eventId)}&source=${source}`;

function renderGroups() {
  const groups = Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  mine.innerHTML = groups.length
    ? groups.map((g) => `<li class="group-row"><a href="${viewerUrl(g)}">${icon('runner', 18)}${esc(g)}</a><button type="button" class="linkish danger" data-del="${esc(g)}">삭제 / Delete</button></li>`).join('')
    : '<li class="muted small">아직 만든 그룹이 없어요. / No groups yet.</li>';
}
mine.addEventListener('click', (e) => {
  const g = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (g && confirm(`"${g}" 그룹을 삭제할까요? / Delete this group?`)) { localStorage.removeItem(prefix + g); renderGroups(); }
});
document.getElementById('group-form')!.addEventListener('submit', (e) => {
  e.preventDefault();
  const g = input.value.trim();
  if (!g || !eventId) return toast('그룹 이름을 입력하세요. / Enter a group name.');
  if (g.length > 16) return toast('16글자 이하로 입력하세요. / Max 16 characters.');
  if (!localStorage.getItem(prefix + g)) localStorage.setItem(prefix + g, '[]');
  location.href = viewerUrl(g);
});

(async () => {
  try {
    const ev = await getEvent(provider, eventId);
    info.innerHTML = `<span class="badge-src src-${provider}">${providerLabel(provider)}</span>
      <h1>${esc(ev.name || '대회 / Race')}</h1>
      <div class="muted">${esc([ev.date, ev.time].filter(Boolean).join(' '))}${ev.location && ev.location !== 'SPCT' ? ` · ${esc(ev.location)}` : ''}</div>
      ${ev.courseSlug ? `<a class="btn ghost small-btn" href="/r/${esc(ev.courseSlug)}">${icon('route', 16)}코스 보기<span class="en"> / Course</span></a>` : `<a class="btn ghost small-btn" href="/e/${provider}/${encodeURIComponent(eventId)}">${icon('info', 16)}대회 정보<span class="en"> / Race info</span></a>`}`;
  } catch { info.innerHTML = '<p class="warn">대회 정보를 불러오지 못했어요. / Could not load the race.</p>'; }
})();
renderGroups();
