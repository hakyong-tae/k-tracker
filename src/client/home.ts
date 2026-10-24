/** Client-side filter + search over the server-rendered race feed. */
const items = [...document.querySelectorAll<HTMLElement>('.race-feed > li')];
const search = document.getElementById('feed-search') as HTMLInputElement | null;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.seg-ctl [data-f]')];
const empty = document.querySelector<HTMLElement>('.feed-empty');
let f = new URLSearchParams(location.search).get('f') ?? 'all';

function apply() {
  const q = (search?.value ?? '').trim().toLowerCase();
  let shown = 0;
  for (const li of items) {
    const ok = (f === 'all' || (f === 'course' && li.dataset.kind === 'course') || (f === 'live' && li.dataset.live === '1') || (f === 'intl' && li.dataset.intl === '1'))
      && (!q || (li.dataset.name ?? '').includes(q));
    li.hidden = !ok;
    if (ok) shown++;
  }
  document.querySelectorAll<HTMLElement>('.feed-sec').forEach((s) => { s.hidden = !s.querySelector('.race-feed > li:not([hidden])') && !!s.querySelector('.race-feed'); });
  if (empty) empty.hidden = shown > 0;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.f === f)));
}
tabs.forEach((t) => t.addEventListener('click', () => {
  f = t.dataset.f ?? 'all';
  const u = new URL(location.href);
  if (f === 'all') u.searchParams.delete('f'); else u.searchParams.set('f', f);
  history.replaceState(null, '', u);
  apply();
}));
search?.addEventListener('input', apply);
apply();
