import type { Lang } from '../shared/types.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { h } from './dom.ts';

export interface StreetKeys { kakao: string; google: string }
export interface StreetView { show(la: number, lo: number, heading: number, playing: boolean): void }

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { kakao?: any } }

function loadKakao(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.Roadview) return resolve(window.kakao);
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = reject;
    document.head.append(s);
  });
}

/**
 * Street-level photo at the current course position.
 * Korea → Kakao roadview (JS SDK), elsewhere (or no Kakao key) → Google Maps Embed street view (free, unlimited).
 * No key → a note with the external link the panel already offers.
 */
export function createStreet(el: HTMLElement, lang: Lang, isKR: boolean, keys: StreetKeys): StreetView {
  const msg = h('div', { class: 'street-msg' });
  const link = h('a', { class: 'btn', target: '_blank', rel: 'noopener' } as never);
  link.innerHTML = `${icon('external', 16)}<span>${t(lang, 'streetOpen')}</span>`;
  const note = (text: string, href?: string) => {
    msg.innerHTML = '';
    msg.append(h('p', {}, text));
    if (href) { link.setAttribute('href', href); msg.append(link); }
    msg.hidden = false;
  };
  const extUrl = (la: number, lo: number, hd: number) => isKR
    ? `https://map.kakao.com/link/roadview/${la.toFixed(6)},${lo.toFixed(6)}`
    : `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${la.toFixed(6)},${lo.toFixed(6)}&heading=${Math.round(hd)}`;
  el.append(msg);
  msg.hidden = true;

  const useKakao = isKR && !!keys.kakao;
  const useGoogle = !useKakao && !!keys.google;
  let last = { la: NaN, lo: NaN, at: 0 };
  let timer = 0;

  // ---- Kakao ----
  let rv: any = null, rvc: any = null, kakao: any = null, pan = 0;
  const kakaoReady = useKakao ? loadKakao(keys.kakao).then((k) => {
    kakao = k;
    const box = h('div', { class: 'street-frame' });
    el.prepend(box);
    rv = new k.maps.Roadview(box);
    rvc = new k.maps.RoadviewClient();
    const face = () => rv.setViewpoint({ pan, tilt: 0, zoom: 0 });
    k.maps.event.addListener(rv, 'init', face);
    k.maps.event.addListener(rv, 'panoid_changed', face);
  }).catch(() => { kakao = null; }) : Promise.resolve();

  // ---- Google ----
  let frame: HTMLIFrameElement | null = null;
  if (useGoogle) {
    frame = h('iframe', { class: 'street-frame', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: '', title: t(lang, 'viewStreet') } as never) as HTMLIFrameElement;
    el.prepend(frame);
  }

  const load = async (la: number, lo: number, hd: number) => {
    last = { la, lo, at: performance.now() };
    if (useKakao) {
      await kakaoReady;
      if (!kakao) return note(t(lang, 'streetNone'), extUrl(la, lo, hd));
      const pos = new kakao.maps.LatLng(la, lo);
      rvc.getNearestPanoId(pos, 60, (panoId: number | null) => {
        if (!panoId) return note(t(lang, 'streetNone'), extUrl(la, lo, hd));
        msg.hidden = true;
        pan = ((hd % 360) + 360) % 360;
        rv.setPanoId(panoId, pos);
        setTimeout(() => rv.setViewpoint({ pan, tilt: 0, zoom: 0 }), 600); // the pano's own default heading can land after panoid_changed
      });
    } else if (frame) {
      msg.hidden = true;
      frame.src = `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(keys.google)}&location=${la.toFixed(6)},${lo.toFixed(6)}&heading=${Math.round(hd)}&pitch=0&fov=90&language=${lang}`;
    } else {
      note(lang === 'ko' ? '이 위치의 거리 사진은 새 창에서 볼 수 있어요.' : 'Open the street photo for this spot in a new tab.', extUrl(la, lo, hd));
    }
  };

  return {
    show(la, lo, hd, playing) {
      const moved = !Number.isFinite(last.la) || Math.abs(la - last.la) + Math.abs(lo - last.lo) > 0.0003; // ~30 m
      if (!moved) return;
      clearTimeout(timer);
      // while the fly-along plays, refresh at most every few seconds; when paused, after a short settle
      const gap = performance.now() - last.at;
      const wait = playing ? Math.max(0, (useKakao ? 1500 : 3500) - gap) : 350;
      timer = window.setTimeout(() => load(la, lo, hd), wait);
    },
  };
}
