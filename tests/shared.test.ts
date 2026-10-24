import { describe, expect, it } from 'vitest';
import { parseGpx } from '../src/shared/gpx.ts';
import { buildCourse, gradeAt, waypointsToKm } from '../src/shared/course.ts';
import { gradeFactor, planSplits } from '../src/shared/pace.ts';
import { runChecks, suggestScale, slugify } from '../src/shared/checks.ts';
import { segmentStats, findClimbs } from '../src/shared/segments.ts';
import { daysUntil, raceStartInstant, addClock, parseDuration, fmtDuration } from '../src/shared/time.ts';
import { sunElevation } from '../src/shared/geo.ts';
import { dewPoint, heatAdjustment } from '../src/shared/weather.ts';
import { syntheticGpx } from './fixtures.ts';

describe('gpx', () => {
  it('parses track points, elevation, waypoints and name', () => {
    const g = parseGpx(syntheticGpx(1000, { wpts: [{ km: 0.5, name: 'Water' }] }));
    expect(g.points.length).toBe(101);
    expect(g.points[0].ele).not.toBeNull();
    expect(g.waypoints[0].name).toBe('Water');
    expect(g.name).toBe('Test & Run');
  });
  it('handles self-closing points, namespaces and routes', () => {
    const xml = `<gpx><rte><gpx:rtept lon="127" lat="37"/><rtept lat="37.01" lon="127"/></rte></gpx>`;
    expect(parseGpx(xml).points).toEqual([{ lat: 37, lon: 127, ele: null }, { lat: 37.01, lon: 127, ele: null }]);
  });
  it('rejects non-gpx', () => expect(() => parseGpx('<html></html>')).toThrow('not-gpx'));
});

describe('course', () => {
  const c = buildCourse(parseGpx(syntheticGpx()).points);
  it('measures the right length and resamples', () => {
    expect(Math.abs(c.total - 42195)).toBeLessThan(15);
    expect(c.lat.length).toBe(Math.floor(c.total / 25) + 2);
    expect(c.elevationSource).toBe('gpx');
  });
  it('smooths noise but keeps the hill', () => {
    expect(c.gain).toBeGreaterThan(25);
    expect(c.gain).toBeLessThan(40);
    expect(gradeAt(c, 10500)).toBeGreaterThan(1);
    expect(gradeAt(c, 11500)).toBeLessThan(-1);
    expect(Math.abs(gradeAt(c, 30000))).toBeLessThan(0.3);
  });
  it('reports missing elevation', () => {
    const c2 = buildCourse(parseGpx(syntheticGpx(5000, { ele: false })).points);
    expect(c2.elevationSource).toBe('none');
  });
  it('snaps waypoints to km', () => {
    const g = parseGpx(syntheticGpx(10000, { wpts: [{ km: 5, name: 'W5' }, { km: 2.5, name: 'W2' }] }));
    const k = waypointsToKm(buildCourse(g.points), g.waypoints);
    expect(k.map((w) => w.name)).toEqual(['W2', 'W5']);
    expect(Math.abs(k[1].km - 5)).toBeLessThan(0.03);
    expect(k[1].off).toBeLessThan(15);
  });
});

describe('pace', () => {
  const c = buildCourse(parseGpx(syntheticGpx()).points);
  it('grade factor is monotonic for moderate grades', () => {
    expect(gradeFactor(0)).toBe(1);
    expect(gradeFactor(3)).toBeGreaterThan(gradeFactor(1));
    expect(gradeFactor(-3)).toBeLessThan(1);
  });
  it('splits sum to the target and slow down on the hill', () => {
    const p = planSplits(c, 4 * 3600, { scale: 42195 / c.total, extra: [21.0975] });
    const last = p.splits[p.splits.length - 1];
    expect(last.elapsed).toBe(4 * 3600);
    expect(last.km).toBeCloseTo(42.195, 3);
    expect(p.splits.some((s) => s.km === 21.0975)).toBe(true);
    const sum = p.splits.reduce((a, s) => a + s.lap, 0);
    expect(sum).toBeCloseTo(4 * 3600, 3);
    const s10 = p.splits.find((s) => s.km === 10)!, s15 = p.splits.find((s) => s.km === 15)!, s35 = p.splits.find((s) => s.km === 35)!;
    expect(s15.lapPace).toBeGreaterThan(s35.lapPace - 0.01); // hill segment (10–15) not faster than flat
    expect(s10.lapPace).toBeGreaterThan(300);
  });
});

describe('checks & segments', () => {
  const c = buildCourse(parseGpx(syntheticGpx(42600)).points);
  it('flags distance and suggests scale within 3%', () => {
    const ch = runChecks(c, { distance: 'full', slug: 'a', date: '2026-12-06', startTime: '04:30' }, { existingSlugs: ['a'] });
    expect(ch.find((x) => x.code === 'distance')!.level).toBe('ok'); // +0.96%
    expect(ch.find((x) => x.code === 'duplicate-slug')).toBeTruthy();
    expect(suggestScale(c, 'full')).toBeCloseTo(42195 / c.total, 4);
    expect(suggestScale(c, 'half')).toBe(1);
  });
  it('builds 9 segments for a marathon and finds the climb', () => {
    const s = segmentStats(c, 42195 / c.total);
    expect(s.length).toBe(9);
    expect(s[2].gain).toBeGreaterThan(20);
    const climbs = findClimbs(c, 42195 / c.total);
    expect(climbs.length).toBe(1);
    expect(climbs[0].fromKm).toBeGreaterThan(9.5);
  });
  it('slugify', () => expect(slugify('Singapore Marathon 2026!')).toBe('singapore-marathon-2026'));
});

describe('time & sun & heat', () => {
  it('counts calendar days in the race zone (fixes D-day off-by-one)', () => {
    const now = new Date('2026-10-21T17:46:54Z'); // 2026-10-22 02:46 KST
    expect(daysUntil('2026-10-25', 'Asia/Seoul', now)).toBe(3);
    expect(daysUntil('2026-12-06', 'Asia/Singapore', new Date('2026-12-05T16:30:00Z'))).toBe(1 - 1 + 0); // 00:30 SGT on race day
  });
  it('resolves local start to an instant', () => {
    expect(raceStartInstant('2026-12-06', '04:30', 'Asia/Singapore').toISOString()).toBe('2026-12-05T20:30:00.000Z');
    expect(addClock('04:30', 4 * 3600 + 59)).toBe('08:31');
    expect(parseDuration('3:29:50')).toBe(12590);
    expect(fmtDuration(12590)).toBe('3:29:50');
  });
  it('sun is below horizon at a 04:30 Singapore start and up by 08:00', () => {
    expect(sunElevation(new Date('2026-12-05T20:30:00Z'), 1.29, 103.85)).toBeLessThan(-10);
    expect(sunElevation(new Date('2026-12-06T00:00:00Z'), 1.29, 103.85)).toBeGreaterThan(10);
  });
  it('heat adjustment for humid Singapore morning', () => {
    const dp = dewPoint(27, 85);
    expect(dp).toBeGreaterThan(23.5);
    const h = heatAdjustment(27, dp)!;
    expect(h.min).toBeGreaterThanOrEqual(4.5);
  });
});
