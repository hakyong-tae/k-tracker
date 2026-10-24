import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import type { Poi } from '../shared/types.ts';
import type { Track } from './track.ts';
import { AID_TYPES } from '../shared/i18n.ts';

export interface CourseMap { setPosition(d: number): void; resize(): void }

/** Course map on OpenFreeMap vector tiles (free, commercial use allowed). */
export function createMap(el: HTMLElement, track: Track, pois: Poi[], onSeek: (d: number) => void): CourseMap {
  const c = track.c;
  const coords = c.lat.map((la, i) => [c.lon[i], la]);
  const map = new maplibregl.Map({
    container: el,
    style: 'https://tiles.openfreemap.org/styles/positron',
    bounds: [[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]],
    fitBoundsOptions: { padding: 30 },
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  const kmFeatures = [] as GeoJSON.Feature[];
  for (let k = 5; k < track.totalKm; k += 5) {
    const [la, lo] = track.latlon(track.dist(k));
    kmFeatures.push({ type: 'Feature', properties: { label: `${k}` }, geometry: { type: 'Point', coordinates: [lo, la] } });
  }
  const poiFeatures = pois.filter((p) => AID_TYPES.includes(p.type)).map((p) => {
    const [la, lo] = track.latlon(track.dist(p.km));
    return { type: 'Feature', properties: { type: p.type }, geometry: { type: 'Point', coordinates: [lo, la] } } as GeoJSON.Feature;
  });
  map.on('load', () => {
    map.addSource('course', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
    map.addLayer({ id: 'course-casing', type: 'line', source: 'course', paint: { 'line-color': '#ffffff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'course', type: 'line', source: 'course', paint: { 'line-color': '#ff5a36', 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addSource('aid', { type: 'geojson', data: { type: 'FeatureCollection', features: poiFeatures } });
    map.addLayer({ id: 'aid', type: 'circle', source: 'aid', paint: { 'circle-radius': 4.5, 'circle-color': ['match', ['get', 'type'], 'water', '#2f80ed', 'sports-drink', '#27ae60', '#f2994a'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.addSource('km', { type: 'geojson', data: { type: 'FeatureCollection', features: kmFeatures } });
    map.addLayer({ id: 'km', type: 'circle', source: 'km', paint: { 'circle-radius': 9, 'circle-color': '#0f172a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'km-label', type: 'symbol', source: 'km', layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
    map.on('click', 'course', (e) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < c.lat.length; i += 2) {
        const dx = c.lon[i] - e.lngLat.lng, dy = c.lat[i] - e.lngLat.lat, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = i; }
      }
      onSeek(best * c.step);
    });
    map.on('mouseenter', 'course', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'course', () => (map.getCanvas().style.cursor = ''));
  });
  const dot = document.createElement('div');
  dot.className = 'map-dot';
  const marker = new maplibregl.Marker({ element: dot }).setLngLat([c.lon[0], c.lat[0]]).addTo(map);
  return {
    setPosition(d) { const [la, lo] = track.latlon(d); marker.setLngLat([lo, la]); },
    resize() { map.resize(); },
  };
}
