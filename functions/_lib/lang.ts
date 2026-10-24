import type { Lang } from '../../src/shared/types.ts';

export function pickLang(req: Request): Lang {
  const url = new URL(req.url);
  const q = url.searchParams.get('lang');
  if (q === 'ko' || q === 'en') return q;
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)lang=(ko|en)/);
  if (m) return m[1] as Lang;
  const al = (req.headers.get('accept-language') ?? '').toLowerCase();
  return al.startsWith('ko') || (!al.startsWith('en') && al.includes('ko')) ? 'ko' : al ? 'en' : 'ko';
}
