/** Parsers for Korean timing providers used by the live tracker. Pure functions, no DOM. */

export type Provider = 'myresult' | 'spct';
export interface LiveRace { id: string; source: Provider; name: string; date: string; location: string; url: string }
export interface LiveSplit { section: string; checkpointTime: string }
export interface LiveRecord {
  source: Provider; eventId: string; bib: string; name: string; category: string;
  total: string; startTime: string; finishTime: string;
  records: LiveSplit[]; rankOverall: string; rankGender: string; resultUrl: string;
  /** 'pre-race' before the gun, 'live' on race day, 'final' afterwards */
  status?: 'pre-race' | 'live' | 'final';
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
/** Strip anything that could become markup when a client drops it into innerHTML. */
export const clean = (s: string, max = 80) => s.replace(/[<>"'`]/g, '').trim().slice(0, max);

export const isEventId = (s: string) => /^\d{1,14}$/.test(s);
export const isBib = (s: string) => /^[0-9A-Za-z-]{1,10}$/.test(s);

export function myResultResultUrl(eventId: string, bib: string) {
  return `https://myresult.co.kr/${encodeURIComponent(eventId)}/${encodeURIComponent(bib)}`;
}
export function spctResultUrl(eventId: string, bib: string) {
  return `https://time.spct.kr/m2.php?EVENT_NO=${encodeURIComponent(eventId)}&TargetYear=${spctYear(eventId)}&currentPage=1&BIB_NO=${encodeURIComponent(bib)}`;
}
/** SPCT event numbers start with the year (e.g. 2026101804). */
export const spctYear = (eventId: string) => (/^20\d{2}/.test(eventId) ? eventId.slice(0, 4) : String(new Date().getUTCFullYear()));

/** MyResult public event list JSON → races. */
export function parseMyResultEvents(json: unknown): LiveRace[] {
  const list = (json as { results?: unknown[] })?.results ?? (Array.isArray(json) ? json : []);
  return (list as Record<string, unknown>[])
    .filter((e) => e && e.visible !== false && e.id !== undefined)
    .map((e) => {
      const id = String(e.id);
      return {
        id, source: 'myresult' as const,
        name: clean(String(e.name ?? ''), 120) || '이름 없음',
        date: [e.date, typeof e.time === 'string' ? e.time.slice(0, 5) : ''].filter(Boolean).join(' '),
        location: clean(String(e.place_area ?? e.place_start ?? ''), 80),
        url: `https://myresult.co.kr/${id}`,
      };
    });
}

/** SPCT main.php HTML → races (one page holds 10). */
export function parseSpctEvents(html: string): LiveRace[] {
  const out: LiveRace[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const link = row.match(/href=["']m1\.php\?([^"']*EVENT_NO=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const date = row.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
    const id = link[2];
    out.push({ id, source: 'spct', name: clean(text(link[3]), 120) || '이름 없음', date, location: 'SPCT', url: `https://time.spct.kr/m1.php?TargetYear=${spctYear(id)}&EVENT_NO=${id}&currentPage=1` });
  }
  return out;
}

/** SPCT m2.php HTML (one runner) → record, or null when the bib has no data. */
export function parseSpctRecord(html: string, eventId: string, bib: string): LiveRecord | null {
  const h = html.replace(/<!--[\s\S]*?-->/g, '');
  if (/class=['"]error['"]/.test(h) || /No Results/.test(h)) return null;
  const nameBlock = h.match(/<p class=['"]name['"]>([\s\S]*?)<\/p>/i);
  if (!nameBlock) return null;
  const category = text(nameBlock[1].match(/<span>([\s\S]*?)<\/span>/)?.[1] ?? '');
  const name = text(nameBlock[1].replace(/<span>[\s\S]*?<\/span>/, ''));
  const tag = text(h.match(/<p class=['"]tag['"]>\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? bib);
  const recordBlock = h.match(/<div class=['"]record['"]>([\s\S]*?)<\/div>\s*(?:<table|$)/i)?.[1] ?? h.match(/<div class=['"]record['"]>([\s\S]*?<\/p>[\s\S]*?<\/p>)/i)?.[1] ?? '';
  const total = text(recordBlock.match(/<div class=['"]time['"]>([\s\S]*?)<\/div>/i)?.[1] ?? '');
  const ps = [...recordBlock.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((x) => text(x[1]));
  const after = (s?: string) => (s ? s.slice(s.indexOf(':') + 1).trim() : '');
  const tbody = h.slice(h.indexOf("<div class='record'>") >= 0 ? h.indexOf("<div class='record'>") : 0);
  const records: LiveSplit[] = [...tbody.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/gi)]
    .map((x) => ({ section: clean(text(x[1]), 40), checkpointTime: clean(text(x[2]).replace(/^\(\)$/, ''), 60) || '-' }))
    .filter((r) => r.section);
  const ranks = [...h.matchAll(/<li>\s*<p>[\s\S]*?<\/p>\s*<p>\s*<span>([^<]*)<\/span>\s*<span>([^<]*)<\/span>/gi)].map((x) => `${x[1].trim()}${x[2].trim()}`);
  return {
    source: 'spct', eventId, bib: clean(tag, 12), name: clean(name, 40), category: clean(category, 30),
    total: clean(total, 20), startTime: clean(after(ps.find((p) => /^Start/i.test(p))), 20), finishTime: clean(after(ps.find((p) => /^Finish/i.test(p))), 20),
    records, rankOverall: ranks[0] ?? '', rankGender: ranks[1] ?? '', resultUrl: spctResultUrl(eventId, bib),
  };
}

/**
 * MyResult runner page (server-rendered Nuxt) → record.
 * The JSON API now needs a partner key, but the public page carries the same table, which the old K-TRACKER read too.
 */
export function parseMyResultPage(html: string, eventId: string, bib: string): LiveRecord | null {
  const player = html.match(/player:\{([\s\S]{0,3000}?)course:\{/);
  const rowRe = /<div class="table-row ant-row"[^>]*>([\s\S]*?)<\/div><\/div>/g;
  const rows: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const cols = [...(m[1] + '</div>').matchAll(/<div class="ant-col[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((c) => text(c[1]));
    if (cols.length >= 2 && cols[0]) rows.push(cols);
  }
  if (!player && !rows.length) return null;
  const p = player?.[1] ?? '';
  const pick = (k: string) => p.match(new RegExp(`\\b${k}:"([^"]*)"`))?.[1] ?? '';
  const flat = text(html);
  const rank = (label: string) => {
    const r = flat.match(new RegExp(`${label}\\s*([0-9,]+)\\s*/\\s*([0-9,]+)`));
    return r ? `${r[1]}/${r[2]}` : '';
  };
  const explain = html.match(/course:\{[\s\S]{0,400}?explain:"([^"]*)"/)?.[1] ?? '';
  const net = pick('result_nettime');
  return {
    source: 'myresult', eventId,
    bib: clean(p.match(/\btag:(?:"([^"]*)"|(\d+))/)?.slice(1).find(Boolean) ?? bib, 12),
    name: clean(pick('name'), 40),
    category: clean(explain, 30),
    total: clean(net.replace(/\.\d+$/, ''), 20),
    startTime: clean(rows.find((r) => r[0] === '출발')?.[1] ?? '', 20),
    finishTime: clean(rows.find((r) => r[0] === '도착')?.[1] ?? '', 20),
    records: rows.map((r) => ({ section: clean(r[0], 40), checkpointTime: clean(r[1] || '-', 60) || '-' })),
    rankOverall: rank('코스 전체순위'), rankGender: rank('코스 성별순위'),
    resultUrl: myResultResultUrl(eventId, bib),
  };
}

const hms = (t: string): number | null => {
  const m = t.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

/**
 * MyResult keeps last year's results under a bib until this year's timing starts.
 * Hide everything before the gun, and on race day drop any split whose clock time is still in the future.
 * eventDate "YYYY-MM-DD", eventTime "HH:MM[:SS]" in Korea time.
 */
export function guardRaceDay(rec: LiveRecord, eventDate: string, eventTime: string, now = new Date()): LiveRecord {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const today = kst.toISOString().slice(0, 10);
  const nowSec = kst.getUTCHours() * 3600 + kst.getUTCMinutes() * 60 + kst.getUTCSeconds();
  const gun = hms(eventTime.length === 5 ? `${eventTime}:00` : eventTime) ?? 0;
  const blank = { ...rec, name: '', category: '', total: '', startTime: '', finishTime: '', records: [], rankOverall: '', rankGender: '' };
  if (!eventDate || today < eventDate || (today === eventDate && nowSec < gun)) return { ...blank, status: 'pre-race' };
  if (today > eventDate) return { ...rec, status: 'final' };
  const slack = 120;
  const fresh = rec.records.filter((r) => { const t = hms(r.checkpointTime); return t === null || t <= nowSec + slack; });
  const finished = (hms(rec.finishTime) ?? Infinity) <= nowSec + slack;
  const looksStale = fresh.length < rec.records.filter((r) => hms(r.checkpointTime) !== null).length;
  return {
    ...rec,
    records: fresh,
    total: finished ? rec.total : '',
    finishTime: finished ? rec.finishTime : '',
    rankOverall: finished ? rec.rankOverall : '',
    rankGender: finished ? rec.rankGender : '',
    // a split from the future means the whole row is last year's, including the name
    name: looksStale && !fresh.some((r) => hms(r.checkpointTime) !== null) ? '' : rec.name,
    status: 'live',
  };
}

/** Per-split upload stamps from the MyResult page payload: when each passing was recorded. */
export function myResultStamps(html: string): { created: string; time: string }[] {
  const out: { created: string; time: string }[] = [];
  const re = /player_num:[^,]+,created_at:"([^"]+)"[^{}]*?time_point:"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ created: m[1], time: m[2] });
  return out;
}

const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** Keep only splits uploaded on or after race day; anything older is last year's data under the same bib. */
export function keepRaceDaySplits(rec: LiveRecord, eventDate: string, stamps: { created: string; time: string }[]): LiveRecord {
  if (!stamps.length) return rec;
  const fresh = stamps.filter((s) => kstDate(s.created) >= eventDate).map((s) => hms(s.time)).filter((t): t is number => t !== null);
  const isFresh = (t: string) => { const v = hms(t); return v === null || fresh.some((f) => Math.abs(f - v) <= 1); };
  const records = rec.records.filter((r) => isFresh(r.checkpointTime));
  if (!fresh.length) return { ...rec, name: '', category: '', total: '', startTime: '', finishTime: '', records: [], rankOverall: '', rankGender: '', status: rec.status };
  const finished = rec.finishTime ? isFresh(rec.finishTime) : false;
  return { ...rec, records, total: finished ? rec.total : '', finishTime: finished ? rec.finishTime : '', rankOverall: finished ? rec.rankOverall : '', rankGender: finished ? rec.rankGender : '' };
}
