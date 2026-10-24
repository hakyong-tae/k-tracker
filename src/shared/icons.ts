/** Stroke icon set (24×24, 1.75 stroke, round caps). Strings so SSR and client can both inline them. */
const P: Record<string, string> = {
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M19 6l1.5-1.5"/>',
  mountain: '<path d="M3 20 9.5 8l4 7 2.5-4L21 20Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  droplet: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  sunrise: '<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v4M9.5 6.5 12 4l2.5 2.5M3.5 14h1.5M19 14h1.5"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7Z"/>',
  cloudSun: '<path d="M8 20h9a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.4-.8A3.5 3.5 0 0 0 8 20Z"/><path d="M6.5 3.5v1.5M2.5 7.5H4M3.8 4.3l1 1M10 6.2A3.5 3.5 0 0 0 4.4 10"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7Z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7Z"/><path d="m12.5 15-2 3.5h3l-2 3.5"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7Z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8Z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  play: '<path d="M8 5v14l11-7Z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6Z"/><path d="M9 4v14M15 6v14"/>',
  runner: '<circle cx="14" cy="4.5" r="1.8"/><path d="m8 21 3-6 3 2v4M6 12l3-4 4 1 2 4h3M11 15l-2-3"/>',
  printer: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  bib: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5M7 5v-1M17 5v-1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};
export type IconName = keyof typeof P;
export function icon(name: IconName | string, size = 18, cls = ''): string {
  return `<svg class="ic${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
/** MET Norway symbol code → icon */
export function weatherIcon(sym?: string | null): IconName | '' {
  if (!sym) return '';
  if (sym.includes('thunder')) return 'storm';
  if (sym.includes('snow') || sym.includes('sleet')) return 'snow';
  if (sym.includes('rain')) return 'rain';
  if (sym.includes('partlycloudy') || sym.includes('fair')) return sym.includes('night') ? 'moon' : 'cloudSun';
  if (sym.includes('cloudy') || sym.includes('fog')) return 'cloud';
  if (sym.includes('clear')) return sym.includes('night') ? 'moon' : 'sun';
  return 'cloud';
}
