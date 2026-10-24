import type { LiveEvent, LiveRace, LiveRecord, Provider } from '../../shared/live.ts';

/** Tracker URLs use source=myresult|smartchip; "smartchip" is historical and means SPCT. */
export type Source = 'myresult' | 'smartchip';
export const providerOf = (source: string | null): Provider => (source === 'smartchip' ? 'spct' : 'myresult');
export const sourceOf = (provider: string): Source => (provider === 'spct' || provider === 'smartchip' ? 'smartchip' : 'myresult');
export const providerLabel = (p: Provider) => (p === 'spct' ? 'SPCT' : 'MyResult');

export const params = new URLSearchParams(location.search);
/** ?now=ISO replays a past moment (record API honours it only on localhost). */
export const debugNow = params.get('now');
export const nowDate = () => (debugNow ? new Date(debugNow) : new Date());

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json() as Promise<T>;
}

export async function getRaces(provider: Provider): Promise<LiveRace[]> {
  try { return await getJson<LiveRace[]>(`/api/live/races?provider=${provider}`); }
  catch {
    // static fallbacks kept from the original K-TRACKER
    if (provider === 'myresult') {
      const old = await getJson<{ id: unknown; name: string; date: string; location?: string }[]>('/data/myresult_races_parsed.json').catch(() => []);
      return old.map((r) => ({ id: String(r.id), source: 'myresult', name: r.name, date: r.date, location: r.location ?? '', url: '' }));
    }
    const old = await getJson<{ event_no: string; title: string; date: string }[]>('https://raw.githubusercontent.com/hakyong-tae/spct-proxy/main/spct_races_parsed.json').catch(() => []);
    return old.map((r) => ({ id: String(r.event_no), source: 'spct', name: r.title, date: r.date, location: 'SPCT', url: '' }));
  }
}

export const getEvent = (provider: Provider, id: string) => getJson<LiveEvent>(`/api/live/event?provider=${provider}&event=${encodeURIComponent(id)}`);
export const getLinks = () => getJson<{ provider: Provider; eventId: string; slug: string }[]>('/api/live/links').catch(() => []);

export async function getRecord(provider: Provider, id: string, bib: string): Promise<LiveRecord | { notFound: true }> {
  const q = `/api/live/record?provider=${provider}&event=${encodeURIComponent(id)}&bib=${encodeURIComponent(bib)}${debugNow ? `&now=${encodeURIComponent(debugNow)}` : ''}`;
  const r = await fetch(q);
  if (r.status === 404) return { notFound: true };
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<LiveRecord>;
}

export const groupPrefix = (source: string, eventId: string) => `group_${source}_${eventId}_`;
export interface StoredRunner { bib: string; name?: string; records?: { section: string; checkpointTime: string }[]; [k: string]: unknown }
export const loadGroup = (key: string): StoredRunner[] => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
export const saveGroup = (key: string, runners: StoredRunner[]) => { try { localStorage.setItem(key, JSON.stringify(runners)); } catch { /* private mode */ } };

export const BIB_RE = /^[0-9A-Za-z-]{1,10}$/;

/** "D-3" / "D-DAY" / "" for past dates (Korea time). */
export function ddayLabel(date: string): string {
  const d = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const today = new Date(nowDate().getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const n = Math.round((Date.parse(d) - Date.parse(today)) / 86400000);
  return n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : '';
}

export function toast(msg: string) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t!.classList.remove('show'), 2200);
}
