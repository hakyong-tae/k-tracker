import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { guardRaceDay, keepRaceDaySplits, myResultStamps, parseMyResultEvents, parseMyResultPage, parseSpctEvents, parseSpctRecord, spctYear, clean, isBib, isEventId } from '../src/shared/live.ts';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

describe('live tracker parsers', () => {
  it('parses MyResult public event list', () => {
    const r = parseMyResultEvents(JSON.parse(fx('myresult-events.json')));
    expect(r).toHaveLength(3);
    expect(r[1]).toMatchObject({ id: '176', source: 'myresult', name: '2026 춘천마라톤', date: '2026-10-25 09:00' });
  });
  it('parses an SPCT event list page', () => {
    const r = parseSpctEvents(fx('spct-main.html'));
    expect(r).toHaveLength(10);
    expect(r[0].id).toMatch(/^2026\d+$/);
    expect(r[0].date).toMatch(/^2026-\d{2}-\d{2}$/);
    expect(r[0].name.length).toBeGreaterThan(2);
  });
  it('parses an SPCT runner record', () => {
    const r = parseSpctRecord(fx('spct-record.html'), '2026101804', '020230')!;
    expect(r.name).toBe('홍길동');
    expect(r.category).toBe('M HALF');
    expect(r.bib).toBe('20230');
    expect(r.total).toBe('01:14:26.33');
    expect(r.startTime).toBe('08:29:56.46');
    expect(r.finishTime).toBe('09:44:22.79');
    expect(r.records.map((x) => x.section)).toEqual(['Section 1', 'Section 2', 'Section 3']);
    expect(r.records[0].checkpointTime).toBe('-');
    expect(r.records[2].checkpointTime).toBe('09:06:19.45 (00:36:22.99)');
    expect(r.rankOverall).toBe('1/873');
    expect(r.rankGender).toBe('1/734');
    expect(r.resultUrl).toContain('TargetYear=2026');
  });
  it('parses a MyResult runner page (SSR table, no API key)', () => {
    const r = parseMyResultPage(fx('myresult-record.html'), '176', '3743')!;
    expect(r.name).toBe('홍길동');
    expect(r.bib).toBe('3743');
    expect(r.category).toBe('마스터스 풀코스');
    expect(r.total).toBe('03:26:40');
    expect(r.records.map((x) => x.section)).toEqual(['출발', '반환점', '5K', '10K', '15K', '20K', 'Half', '25K', '30K', '35K', '40K', '도착']);
    expect(r.records[2].checkpointTime).toBe('09:28:52');
    expect(r.startTime).toBe('09:06:18');
    expect(r.finishTime).toBe('12:32:58');
    expect(r.rankOverall).toBe('1,525/9995');
    expect(r.rankGender).toBe('1,468/8325');
  });
  it('hides last year\'s record before the gun and future splits on race day', () => {
    const r = parseMyResultPage(fx('myresult-record.html'), '176', '3743')!;
    const pre = guardRaceDay(r, '2026-10-25', '09:00:00', new Date('2026-10-24T05:00:00Z'));
    expect(pre.status).toBe('pre-race');
    expect(pre.name).toBe('');
    expect(pre.records).toEqual([]);
    const early = guardRaceDay(r, '2026-10-25', '09:00:00', new Date('2026-10-25T00:30:00Z')); // 09:30 KST
    expect(early.status).toBe('live');
    expect(early.records.map((x) => x.section)).toEqual(['출발', '반환점', '5K']); // 09:06, 09:23, 09:28
    expect(early.total).toBe('');
    const after = guardRaceDay(r, '2026-10-25', '09:00:00', new Date('2026-10-25T04:00:00Z')); // 13:00 KST
    expect(after.records).toHaveLength(12);
    expect(after.total).toBe('03:26:40');
    expect(guardRaceDay(r, '2026-10-25', '09:00', new Date('2026-10-26T00:00:00Z')).status).toBe('final');
    const stale = guardRaceDay({ ...r, records: r.records.map((x) => ({ ...x, checkpointTime: x.checkpointTime.replace(/^09/, '11') })) }, '2026-10-25', '09:00:00', new Date('2026-10-25T00:10:00Z'));
    expect(stale.name).toBe('');
  });
  it('drops splits uploaded before race day (last year under the same bib)', () => {
    const html = fx('myresult-record.html');
    const r = parseMyResultPage(html, '176', '3743')!;
    const stamps = myResultStamps(html);
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps[0]).toEqual({ created: '2026-10-16T09:17:48.489Z', time: '09:06:17.52' });
    const stale = keepRaceDaySplits(r, '2026-10-25', stamps);
    expect(stale.records).toEqual([]);
    expect(stale.name).toBe('');
    expect(keepRaceDaySplits({ ...r, status: 'pre-race' }, '2026-10-25', stamps).status).toBe('pre-race');
    // first two passings re-uploaded on race day (KST) → only those survive, no finish yet
    const live = keepRaceDaySplits(r, '2026-10-25', stamps.map((s, i) => (i < 2 ? { ...s, created: '2026-10-25T00:30:00Z' } : s)));
    expect(live.records.length).toBe(2);
    expect(live.name).toBe('홍길동');
    expect(live.total).toBe('');
  });
  it('treats ? and blank future mats as not passed', () => {
    const html = fx('myresult-record.html').replace(/09:28:52/g, '?');
    const r = parseMyResultPage(html, '176', '3743')!;
    expect(r.records[2]).toEqual({ section: '5K', checkpointTime: '-' });
  });
  it('MyResult page without player is null', () => expect(parseMyResultPage('<html><body>nothing</body></html>', '176', '1')).toBeNull());
  it('returns null for an unknown bib', () => expect(parseSpctRecord(fx('spct-record-empty.html'), '20261017002', '1001')).toBeNull());
  it('derives year and validates input', () => {
    expect(spctYear('2025053101')).toBe('2025');
    expect(isEventId('2026101804')).toBe(true);
    expect(isEventId('1;drop')).toBe(false);
    expect(isBib('020230')).toBe(true);
    expect(isBib('<script>')).toBe(false);
    expect(clean('<img onerror=x>')).toBe('img onerror=x');
  });
});
