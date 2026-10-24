// Phone-portrait audit against a running dev server (default http://localhost:8788).
// For each page × width: horizontal overflow, tap targets < 40px, text < 12px, and a full-page screenshot.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || '/Users/hytae/Downloads/cryzen-downloader/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://localhost:8788';
const OUT = 'smoke-out/mobile';
mkdirSync(OUT, { recursive: true });
const PAGES = [
  ['home', '/'],
  ['race-chuncheon', '/r/chuncheon-2026'],
  ['race-singapore', '/r/singapore-2026'],
  ['band', '/r/chuncheon-2026/band?t=3:30'],
  ['tracker-list', '/event.html'],
  ['tracker-register', '/group_register.html?eventId=176&source=myresult'],
  ['tracker-viewer', '/group_viewer.html?eventId=2026101804&group=audit&source=smartchip&bibs=020230,1001'],
  ['submit', '/submit'],
];
const WIDTHS = (process.env.WIDTHS || '360,390,430').split(',').map(Number);
const only = process.argv[2];
const browser = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let issues = 0;
for (const [name, path] of PAGES.filter(([n]) => !only || n.includes(only))) {
  for (const w of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: Math.round(w * 2.16), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    const r = await page.evaluate(() => {
      const W = innerWidth;
      const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; } return false; };
      const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || el.value || el.placeholder || '').trim().slice(0, 24)}"`;
      const over = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.getBoundingClientRect().right > W + 1 && !inScroller(el)).slice(0, 6).map(label);
      const small = [...document.querySelectorAll('a, button, input, select, textarea, [role=button]')].filter((el) => {
        if (!visible(el) || el.closest('.foot, .sources, .seg-meta, .muted')) return false;
        const b = el.getBoundingClientRect(); return b.height < 40 && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline');
      }).slice(0, 8).map((el) => `${label(el)} ${Math.round(el.getBoundingClientRect().height)}px`);
      const tiny = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).slice(0, 5).map((el) => `${label(el)} ${getComputedStyle(el).fontSize}`);
      return { sw: document.documentElement.scrollWidth, W, over, small, tiny };
    });
    await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
    const bad = r.sw > r.W + 1 || r.over.length;
    if (bad || r.small.length || r.tiny.length) issues++;
    console.log(`${bad ? '✕' : '✓'} ${name} @${w}: scroll ${r.sw}/${r.W}${r.over.length ? `\n   overflow: ${r.over.join(' | ')}` : ''}${r.small.length ? `\n   small taps: ${r.small.join(' | ')}` : ''}${r.tiny.length ? `\n   tiny text: ${r.tiny.join(' | ')}` : ''}`);
    await page.close();
  }
}
await browser.close();
console.log(issues ? `\n${issues} page/width combos with notes` : '\nclean');
