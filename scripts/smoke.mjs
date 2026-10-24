// End-to-end smoke test against a running `npm run dev` (http://localhost:8788).
// Covers: home, race page render + canvas, SEO files, public submit, admin login → approve → publish, auth guard.
// Puppeteer is not a dependency of this repo; point PUPPETEER_PATH at any install.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || '/Users/hytae/Downloads/cryzen-downloader/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://localhost:8788';
const PW = readFileSync('.dev.vars', 'utf8').match(/ADMIN_PASSWORD=(.+)/)[1].trim();
const OUT = 'smoke-out';
mkdirSync(OUT, { recursive: true });
const slug = `smoke-test-${Date.now().toString(36)}`;
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✕'} ${msg}`); if (!cond) failures++; };

// 10 km out-and-back along the Han river with a small bump, no waypoints
const gpx = (() => {
  const pts = [];
  for (let d = 0; d <= 5000; d += 20) pts.push([37.5172 + d / 111195, 126.9346, 15 + (d > 2000 && d < 2600 ? 8 * Math.sin(((d - 2000) / 600) * Math.PI) : 0)]);
  const back = pts.slice(0, -1).reverse().map(([a, b, e]) => [a, b + 0.0002, e]);
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Smoke</name><trkseg>${[...pts, ...back].map(([a, b, e]) => `<trkpt lat="${a.toFixed(6)}" lon="${b.toFixed(6)}"><ele>${e.toFixed(1)}</ele></trkpt>`).join('')}</trkseg></trk></gpx>`;
})();
import { writeFileSync } from 'node:fs';
writeFileSync(`${OUT}/smoke.gpx`, gpx);

const browser = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/tiles\.openfreemap|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.setViewport({ width: 1280, height: 900 });

  let r = await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  ok(r.status() === 200, 'home 200');
  ok(await page.$eval('body', (b) => b.innerText.includes('D-')), 'home lists an upcoming race');

  r = await page.goto(`${BASE}/r/singapore-2026`, { waitUntil: 'networkidle0' });
  ok(r.status() === 200, 'race page 200');
  const html = await page.content();
  ok(html.includes('application/ld+json') && html.includes('SportsEvent'), 'race page has JSON-LD');
  ok((await page.$$('.seg')).length === 9, 'race page renders 9 segments server-side');
  await new Promise((res) => setTimeout(res, 1500));
  const painted = await page.$eval('#fly', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 997) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    return seen.size;
  });
  ok(painted > 8, `fly-through canvas painted (${painted} colour buckets)`);
  await page.click('#btn-play');
  await new Promise((res) => setTimeout(res, 2500));
  const km = Number(await page.$eval('#p-km', (e) => e.textContent));
  ok(km > 0.05, `playback advances (${km} km)`);
  ok(await page.$eval('#wx', (e) => e.querySelectorAll('.wx-h').length > 0), 'weather hours loaded');
  await page.screenshot({ path: `${OUT}/race.png` });

  for (const [p, needle] of [['/sitemap.xml', '/r/singapore-2026'], ['/robots.txt', 'Sitemap:']]) {
    const t = await (await fetch(BASE + p)).text();
    ok(t.includes(needle), `${p} contains ${needle}`);
  }
  ok((await fetch(`${BASE}/api/admin/races`)).status === 401, 'admin API requires login');
  ok((await fetch(`${BASE}/r/does-not-exist`)).status === 404, 'unknown race 404');

  // live tracker (needs network to MyResult / SPCT)
  for (const prov of ['myresult', 'spct']) {
    const res = await fetch(`${BASE}/api/live/races?provider=${prov}`);
    const list = res.ok ? await res.json() : [];
    ok(res.ok && Array.isArray(list) && list.length >= 10 && list.every((x) => x.id && x.name && x.source === prov), `live races ${prov} (${list.length})`);
  }
  {
    const r = await fetch(`${BASE}/api/live/record?provider=myresult&event=176&bib=3743`);
    const j = r.ok ? await r.json() : {};
    ok(r.ok && Array.isArray(j.records) && j.records.length > 0, `MyResult record via public page (${j.records?.length ?? 0} splits)`);
    ok((await fetch(`${BASE}/api/live/record?provider=myresult&event=176&bib=99999999`)).status === 404, 'MyResult unknown bib 404');
  }
  ok((await fetch(`${BASE}/api/live/record?provider=spct&event=1;x&bib=1`)).status === 400, 'live record rejects bad input');
  await page.goto(`${BASE}/event.html`, { waitUntil: 'networkidle0' });
  ok((await page.$$('.race-list a')).length >= 10, 'tracker race list renders');
  ok(!(await page.content()).includes('fly.dev'), 'tracker pages no longer call fly.dev');
  await page.goto(`${BASE}/group_register.html?eventId=176&source=myresult`, { waitUntil: 'networkidle0' });
  ok(await page.$eval('body', (b) => b.innerText.includes('춘천')), 'group register shows event info');

  // public submit
  await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle0' });
  const file = await page.$('input[type=file]');
  await file.uploadFile(`${OUT}/smoke.gpx`);
  await page.waitForSelector('.preview', { timeout: 10000 });
  const fill = async (label, value) => {
    const handle = await page.evaluateHandle((lb) => [...document.querySelectorAll('.form label')].find((l) => l.querySelector('span')?.textContent === lb)?.querySelector('input,textarea'), label);
    await handle.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  };
  await fill('대회명 (한국어)', '스모크 테스트 10K');
  await fill('대회명 (영어)', 'Smoke Test 10K');
  await fill('대회 날짜', '2026-11-29');
  await fill('URL slug', slug);
  await page.$eval('.form select', () => {});
  await page.evaluate(() => { const s = [...document.querySelectorAll('.form label')].find((l) => l.querySelector('span')?.textContent === '종목')?.querySelector('select'); s.value = '10k'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await fill('닉네임 (페이지에 표시)', 'smoke-bot');
  await page.click('.submit-form button[type=submit]');
  await page.waitForSelector('.done', { timeout: 10000 }).catch(() => {});
  ok(!!(await page.$('.done')), 'public submission accepted');

  // admin approve
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name=password]', PW);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')]);
  ok(page.url().endsWith('/admin'), 'admin login redirects to console');
  await page.waitForSelector('.list li button', { timeout: 10000 });
  const opened = await page.evaluate((s) => { const b = [...document.querySelectorAll('.list li button')].find((x) => x.textContent.includes('스모크')); b?.click(); return !!b; }, slug);
  ok(opened, 'pending submission listed');
  await page.waitForSelector('.row.actions .btn', { timeout: 10000 });
  await page.click('.row.actions .btn');
  await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.includes('/r/'), { timeout: 10000 }).catch(() => {});
  r = await page.goto(`${BASE}/r/${slug}`, { waitUntil: 'networkidle0' });
  ok(r.status() === 200, `approved race published at /r/${slug}`);
  ok((await page.$$('.seg')).length === 2, 'approved 10K has 2 segments');
  ok(await page.$eval('.sources', (e) => e.innerText.includes('smoke-bot')), 'contributor credit shown');
  await page.screenshot({ path: `${OUT}/approved.png` });

  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally {
  await browser.close();
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'k-tracker', '--local', '--command', `DELETE FROM races WHERE slug LIKE 'smoke-test-%'; DELETE FROM submissions WHERE json_extract(meta,'$.slug') LIKE 'smoke-test-%';`], { stdio: 'ignore' });
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
