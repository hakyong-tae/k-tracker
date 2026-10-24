import type { Course, RaceMeta, RaceRecord } from '../../src/shared/types.ts';
import { makeThumb, type Thumb } from '../../src/shared/thumb.ts';
import type { Env } from './env.ts';

interface RaceRow { id: number; slug: string; status: string; meta: string; course: string; updated_at: string }

export async function getRace(env: Env, slug: string, opts: { includeDraft?: boolean } = {}): Promise<RaceRecord | null> {
  const row = await env.DB.prepare(`SELECT id, slug, status, meta, course, updated_at FROM races WHERE slug = ?1 ${opts.includeDraft ? '' : "AND status = 'published'"}`)
    .bind(slug).first<RaceRow>();
  return row ? { id: row.id, slug: row.slug, status: row.status, meta: JSON.parse(row.meta), course: JSON.parse(row.course), updatedAt: row.updated_at } : null;
}

export interface RaceSummary { id: number; slug: string; status: string; date: string; meta: RaceMeta; stats: { total: number; gain: number }; thumb: Thumb | null; updatedAt: string }

export async function listRaces(env: Env, opts: { includeDraft?: boolean } = {}): Promise<RaceSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, status, date, meta, thumb, json_extract(course,'$.total') AS total, json_extract(course,'$.gain') AS gain, updated_at
     FROM races ${opts.includeDraft ? '' : "WHERE status = 'published'"} ORDER BY date ASC`,
  ).all<{ id: number; slug: string; status: string; date: string; meta: string; thumb: string | null; total: number; gain: number; updated_at: string }>();
  return results.map((r) => ({ id: r.id, slug: r.slug, status: r.status, date: r.date, meta: JSON.parse(r.meta), stats: { total: r.total, gain: r.gain }, thumb: r.thumb ? JSON.parse(r.thumb) : null, updatedAt: r.updated_at }));
}

export async function saveRace(env: Env, meta: RaceMeta, course: Course, status: string, gpxKey: string | null, id?: number): Promise<number> {
  if (id) {
    await env.DB.prepare(`UPDATE races SET slug=?1, status=?2, date=?3, country=?4, meta=?5, course=?6, gpx_key=COALESCE(?7, gpx_key), thumb=?9, updated_at=datetime('now') WHERE id=?8`)
      .bind(meta.slug, status, meta.date, meta.country, JSON.stringify(meta), JSON.stringify(course), gpxKey, id, JSON.stringify(makeThumb(course))).run();
    return id;
  }
  const r = await env.DB.prepare(`INSERT INTO races (slug, status, date, country, meta, course, gpx_key, thumb) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) RETURNING id`)
    .bind(meta.slug, status, meta.date, meta.country, JSON.stringify(meta), JSON.stringify(course), gpxKey, JSON.stringify(makeThumb(course))).first<{ id: number }>();
  return r!.id;
}

export async function cacheGet<T>(env: Env, key: string): Promise<T | null> {
  const r = await env.DB.prepare('SELECT value FROM cache WHERE key=?1 AND expires > ?2').bind(key, Date.now()).first<{ value: string }>();
  return r ? (JSON.parse(r.value) as T) : null;
}
export async function cacheSet(env: Env, key: string, value: unknown, ttlSec: number) {
  await env.DB.prepare('INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?1, ?2, ?3)').bind(key, JSON.stringify(value), Date.now() + ttlSec * 1000).run();
}
