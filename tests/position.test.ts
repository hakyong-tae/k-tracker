import { describe, expect, it } from 'vitest';
import { categoryKm, clockSec, estimate, fmtClock, kstNowSec, sectionKm } from '../src/shared/position.ts';

const CPS = [
  { name: '출발', km: 0 }, { name: '반환점', km: 4 }, { name: '5K', km: 5 }, { name: '10K', km: 10 }, { name: '15K', km: 15 },
  { name: '20K', km: 20 }, { name: 'Half', km: 21.1 }, { name: '25K', km: 25 }, { name: '30K', km: 30 }, { name: '35K', km: 35 },
  { name: '40K', km: 40 }, { name: '도착', km: 42.2 },
];
const SPLITS = [
  ['출발', '09:06:18'], ['반환점', '09:23:30'], ['5K', '09:28:52'], ['10K', '09:50:58'], ['15K', '10:12:17'],
].map(([section, checkpointTime]) => ({ section, checkpointTime }));

describe('position estimate', () => {
  it('maps section names to km', () => {
    expect(sectionKm('반환점', CPS, 42.195)).toBe(4);
    expect(sectionKm('도착', CPS, 42.195)).toBe(42.195);
    expect(sectionKm('Half', [], 42.195)).toBe(21.0975);
    expect(sectionKm('25K', [], 42.195)).toBe(25);
    expect(sectionKm('Section 1', [], 21.0975)).toBeNull();
    expect(categoryKm('M HALF')).toBe(21.0975);
    expect(categoryKm('마스터스 풀코스')).toBe(42.195);
    expect(categoryKm('10K 코스')).toBe(10);
  });
  it('extrapolates from the last split at the average pace, capped at the next checkpoint', () => {
    const e = estimate(SPLITS, { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('10:20:00')! });
    expect(e.startSec).toBe(clockSec('09:06:18'));
    expect(e.lastKm).toBe(15);
    expect(e.paceSec).toBeCloseTo((clockSec('10:12:17')! - clockSec('09:06:18')!) / 15, 3); // ~4:24/km
    expect(e.estKm).toBeGreaterThan(16.5);
    expect(e.estKm).toBeLessThan(17);
    expect(e.nextKm).toBe(20);
    expect(fmtClock(e.finishSec!)).toBe('12:11'); // 09:06:18 + 42.195 × 4:23.9
    const late = estimate(SPLITS, { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('11:30:00')! });
    expect(late.estKm).toBe(20); // never past the next mat without a split
  });
  it('handles finish, not started and gun-time fallback', () => {
    const fin = estimate([...SPLITS, { section: '도착', checkpointTime: '12:32:58' }], { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('13:00:00')! });
    expect(fin.finished).toBe(true);
    expect(fin.estKm).toBe(42.195);
    expect(fmtClock(fin.finishSec!)).toBe('12:32');
    const none = estimate([], { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('08:30:00')!, gunSec: clockSec('09:00:00') });
    expect(none.estKm).toBeNull();
    const gunOnly = estimate([{ section: '5K', checkpointTime: '-' }], { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('11:00:00')!, gunSec: clockSec('09:00:00') });
    expect(gunOnly.estKm).toBeNull(); // gun has gone but no mat crossed yet → unknown, not 0 km
    const started = estimate([{ section: '출발', checkpointTime: '09:04:00' }], { totalKm: 42.195, checkpoints: CPS, nowSec: clockSec('09:10:00')! });
    expect(started.estKm).toBe(0);
    expect(started.paceSec).toBeNull();
  });
  it('kst clock', () => expect(kstNowSec(new Date('2026-10-25T01:00:00Z'))).toBe(10 * 3600));
});
