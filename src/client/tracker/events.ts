import { ddayLabel, esc, getLinks, getRaces, nowDate, providerLabel, sourceOf } from './common.ts';
import type { LiveRace } from '../../shared/live.ts';

const list = document.getElementById('race-list')!;
const search = document.getElementById('race-search') as HTMLInputElement;
let races: (LiveRace & { slug?: string })[] = [];

function render() {
  const q = search.value.trim().toLowerCase();
  const today = new Date(nowDate().getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const shown = races.filter((r) => !q || r.name.toLowerCase().includes(q));
  const upcoming = shown.filter((r) => r.date.slice(0, 10) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = shown.filter((r) => r.date.slice(0, 10) < today).sort((a, b) => b.date.localeCompare(a.date));
  const card = (r: LiveRace & { slug?: string }) => {
    const dd = ddayLabel(r.date);
    return `<li><a class="card race-card" href="group_register.html?eventId=${encodeURIComponent(r.id)}&source=${sourceOf(r.source)}">
      <div class="card-top"><span class="badge-src src-${r.source}">${providerLabel(r.source)}</span>${dd ? `<span class="dday ${dd === 'D-DAY' ? 'hot' : ''}">${dd}</span>` : ''}</div>
      <h3>${esc(r.name)}</h3>
      <div class="muted small">${esc(r.date)}${r.location && r.location !== 'SPCT' ? ` · ${esc(r.location)}` : ''}</div>
      ${r.slug ? '<div class="chip-course">🗺 코스 미리보기 / Course</div>' : ''}
    </a></li>`;
  };
  list.innerHTML = !shown.length
    ? `<p class="muted">${races.length ? '검색 결과가 없어요. / No matches.' : '대회 정보를 불러오지 못했어요. / Could not load races.'}</p>`
    : `${upcoming.length ? `<h2>다가오는 대회 / Upcoming</h2><ul class="cards">${upcoming.map(card).join('')}</ul>` : ''}
       ${past.length ? `<h2>지난 대회 / Recent</h2><ul class="cards past">${past.map(card).join('')}</ul>` : ''}`;
}

(async () => {
  const [mr, sp, links] = await Promise.all([getRaces('myresult'), getRaces('spct'), getLinks()]);
  races = [...mr, ...sp].filter((r) => r.id).map((r) => ({ ...r, slug: links.find((l) => l.provider === r.source && l.eventId === r.id)?.slug }));
  render();
})();
search.addEventListener('input', render);
