import type { Env } from '../../_lib/env.ts';
import { cacheGet, cacheSet } from '../../_lib/db.ts';

export const UA = 'Mozilla/5.0 (compatible; K-TRACKER/1.0; +https://github.com/hakyong-tae/k-tracker)';

export async function upstream(url: string, accept = 'text/html'): Promise<Response> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept }, cf: { cacheTtl: 0 } } as RequestInit);
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r;
}

/** Stale-while-error cache in D1: fresh for `freshSec`, kept for a week so outages still show the last list. */
export async function swr<T>(env: Env, key: string, freshSec: number, load: () => Promise<T>): Promise<{ data: T; stale: boolean; at: number }> {
  const hit = await cacheGet<{ data: T; at: number }>(env, key);
  if (hit && Date.now() - hit.at < freshSec * 1000) return { ...hit, stale: false };
  try {
    const data = await load();
    const at = Date.now();
    await cacheSet(env, key, { data, at }, 7 * 86400);
    return { data, stale: false, at };
  } catch (e) {
    if (hit) return { ...hit, stale: true };
    throw e;
  }
}
