import type { Ctx } from '../../_lib/env.ts';
import { getRace } from '../../_lib/db.ts';
import { pickLang } from '../../_lib/lang.ts';
import { notFound, html, esc } from '../../_lib/html.ts';
import { planSplits } from '../../../src/shared/pace.ts';
import { fmtDuration, fmtPace, addClock, parseDuration } from '../../../src/shared/time.ts';
import { l, t, AID_TYPES } from '../../../src/shared/i18n.ts';
import { defaultTarget, officialKm } from '../../../src/shared/race-defaults.ts';

/** Printable pace band: per-km splits in two narrow strips sized for a wrist. */
export const onRequestGet = async (ctx: Ctx) => {
  const lang = pickLang(ctx.request);
  const race = await getRace(ctx.env, String(ctx.params.slug));
  if (!race) return notFound(lang, ctx.env);
  const { meta, course } = race;
  const q = new URL(ctx.request.url).searchParams.get('t');
  const target = (q && parseDuration(q)) || defaultTarget(meta, course);
  const plan = planSplits(course, target, { scale: meta.scale ?? 1, every: 1, extra: meta.distance === 'full' ? [21.0975] : [] });
  const total = officialKm(meta, course);
  const aidKm = meta.pois.filter((p) => AID_TYPES.includes(p.type)).map((p) => p.km);
  const rows = plan.splits.map((s, i) => {
    const prev = i ? plan.splits[i - 1].km : 0;
    const aid = aidKm.some((k) => k > prev && k <= s.km);
    const label = Math.abs(s.km - 21.0975) < 0.001 ? 'H' : Math.abs(s.km - total) < 0.01 ? 'F' : String(s.km);
    return html`<tr class="${aid ? 'aid' : ''}${s.lapPace > plan.avgPace * 1.03 ? ' slow' : ''}"><td>${label}</td><td>${s.elapsed < 3600 ? fmtDuration(s.elapsed, true).replace(/^0:0?/, '') : fmtDuration(s.elapsed, true)}</td><td>${fmtPace(s.lapPace)}</td></tr>`;
  });
  const half = Math.ceil(rows.length / 2);
  const strip = (r: typeof rows) => html`<table><thead><tr><th>km</th><th>${t(lang, 'elapsed')}</th><th>/km</th></tr></thead><tbody>${r}</tbody></table>`;
  const doc = html`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${t(lang, 'printBand')} · ${l(lang, meta.name)} ${fmtDuration(target, false)}</title>
<style>
:root{color-scheme:light}body{font:12px/1.25 ui-sans-serif,system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;margin:16px;color:#111;background:#fff}
h1{font-size:15px;margin:0 0 4px}.meta{color:#555;margin-bottom:12px}.bands{display:flex;gap:12px;flex-wrap:wrap}
.band{width:62mm;border:1.5px solid #111;border-radius:4mm;padding:2mm 3mm}.band h2{font-size:11px;margin:0 0 2px;display:flex;justify-content:space-between}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{font-size:9px;text-align:left;color:#555;font-weight:600}td{padding:1px 0;border-top:.5px solid #ddd}
td:first-child{font-weight:700;width:10mm}tr.aid td:first-child::after{content:" 💧";font-size:8px}tr.slow td:last-child{font-weight:700}
.tip{margin-top:12px;color:#555}@media print{.noprint{display:none}body{margin:0}}button{font:inherit;padding:8px 14px;margin-bottom:12px}
</style></head><body>
<button class="noprint" onclick="print()">🖨 ${t(lang, 'printBand')}</button>
<h1>${l(lang, meta.name)}</h1>
<div class="meta">${t(lang, 'targetTime')} ${fmtDuration(target, false)} · ${t(lang, 'avgPace')} ${fmtPace(plan.avgPace)}/km · ${t(lang, 'start')} ${meta.startTime} → ${t(lang, 'finish')} ${addClock(meta.startTime, target)}</div>
<div class="bands">
  <div class="band"><h2><span>${esc(meta.slug)}</span><span>${fmtDuration(target, false)}</span></h2>${strip(rows.slice(0, half))}</div>
  <div class="band"><h2><span>${esc(meta.slug)}</span><span>${fmtDuration(target, false)}</span></h2>${strip(rows.slice(half))}</div>
</div>
<p class="tip noprint">${lang === 'ko' ? '굵은 페이스는 오르막 구간, 💧는 급수가 있는 km예요. 잘라서 투명테이프로 손목에 감으세요.' : 'Bold paces are climbs, 💧 marks km with aid. Cut out and wrap with clear tape.'}</p>
</body></html>`;
  return new Response(doc.s, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
};
