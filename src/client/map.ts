import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import type { Lang, Poi } from '../shared/types.ts';
import type { Track } from './track.ts';
import { AID_TYPES, l } from '../shared/i18n.ts';

export type MapMode = 'follow' | 'overview';
export interface CourseMap {
  setPosition(d: number): void;
  resize(): void;
  setRunners(r: { d: number; color: string; label: string }[]): void;
  setMode(m: MapMode): void;
  /** true once the style is up; false if WebGL failed */
  ready: Promise<boolean>;
}

const PITCH = 64;
const TERRAIN = { source: 'dem', exaggeration: 1.4 } as const;
const angleLerp = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

/**
 * Course map on OpenFreeMap vector tiles (free, commercial use allowed).
 * "follow" = runner's-eye 3D camera with extruded buildings + terrain; "overview" = flat whole-course map.
 */
export function createMap(el: HTMLElement, track: Track, pois: Poi[], lang: Lang, onSeek: (d: number) => void): CourseMap {
  const c = track.c;
  const coords = c.lat.map((la, i) => [c.lon[i], la]);
  let mode: MapMode = 'follow';
  let terrainOk = false;
  let d = 0;
  let bearing = track.lookHeading(0, 150);
  let map: maplibregl.Map;
  try {
    map = new maplibregl.Map({
      container: el,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [c.lon[0], c.lat[0]],
      zoom: 16, pitch: PITCH, bearing, maxPitch: 75,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
  } catch {
    return { setPosition() {}, resize() {}, setRunners() {}, setMode() {}, ready: Promise.resolve(false) };
  }
  // the liberty style references a few POI icons its sprite lacks; a blank stand-in keeps the console quiet
  map.on('styleimagemissing', (e) => { if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
  // start collapsed to the (i) button so it never sits under the overlays
  map.once('load', () => el.querySelectorAll('.maplibregl-ctrl-attrib').forEach((a) => { a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); }));

  const kmFeatures = [] as GeoJSON.Feature[];
  for (let k = 1; k < track.totalKm; k++) {
    const [la, lo] = track.latlon(track.dist(k));
    kmFeatures.push({ type: 'Feature', properties: { label: `${k}`, major: k % 5 === 0 }, geometry: { type: 'Point', coordinates: [lo, la] } });
  }
  const pt = (km: number, props: Record<string, unknown>) => {
    const [la, lo] = track.latlon(track.dist(km));
    return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lo, la] } } as GeoJSON.Feature;
  };
  const poiFeatures = pois.filter((p) => AID_TYPES.includes(p.type)).map((p) => pt(p.km, { type: p.type }));
  const nameFeatures = pois.filter((p) => ['landmark', 'turnaround', 'hill'].includes(p.type) && p.name)
    .map((p) => pt(p.km, { name: l(lang, p.name).split(/\s[(（]/)[0].slice(0, 24) }));

  const progress = () => ['step', ['line-progress'], '#ffb199', Math.max(1e-6, Math.min(0.999999, d / c.total)), '#ff4d1f'] as maplibregl.ExpressionSpecification;

  const camera = (smooth: boolean) => {
    const [la, lo] = track.latlon(d);
    const want = track.lookHeading(d, 150);
    bearing = smooth ? angleLerp(bearing, want, 0.08) : want;
    const h = el.clientHeight || 400;
    map.jumpTo({ center: [lo, la], bearing, pitch: PITCH, zoom: el.clientWidth < 600 ? 15.6 : 16.2, padding: { top: h * 0.32, bottom: 0, left: 0, right: 0 } });
  };
  const overview = () => {
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.fitBounds([[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]], { padding: 40, pitch: 0, bearing: 0, duration: 600 });
  };

  const ready = new Promise<boolean>((resolve) => {
    map.on('error', (e) => { if (!map.isStyleLoaded()) console.warn(e.error); });
    map.on('load', () => {
      const dem: maplibregl.RasterDEMSourceSpecification = {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
        tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
        attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles (AWS Open Data)</a>',
      };
      map.addSource('dem', dem);
      map.addSource('dem-shade', dem); // separate source per MapLibre's advice for terrain + hillshade
      const firstWater = map.getStyle().layers.find((x) => x.id.startsWith('water'))?.id;
      map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem-shade', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#4a5568', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#6b7a5a' } }, firstWater);
      // terrain after the first full paint so the streets show up without waiting on DEM tiles
      map.once('idle', () => { terrainOk = true; if (mode === 'follow') map.setTerrain(TERRAIN); });
      map.setSky({ 'sky-color': '#8fbdf0', 'horizon-color': '#e8f1fb', 'fog-color': '#eef3f8', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.35, 'atmosphere-blend': 0.6 });
      if (map.getLayer('building-3d')) map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.6);

      map.addSource('course', { type: 'geojson', lineMetrics: true, data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
      const under = map.getLayer('building-3d') ? 'building-3d' : undefined;
      map.addLayer({ id: 'course-casing', type: 'line', source: 'course', paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 14] }, layout: { 'line-cap': 'round', 'line-join': 'round' } }, under);
      map.addLayer({ id: 'course', type: 'line', source: 'course', paint: { 'line-gradient': progress(), 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 16, 9] }, layout: { 'line-cap': 'round', 'line-join': 'round' } }, under);
      map.addSource('aid', { type: 'geojson', data: { type: 'FeatureCollection', features: poiFeatures } });
      map.addLayer({ id: 'aid', type: 'circle', source: 'aid', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 8], 'circle-color': ['match', ['get', 'type'], 'water', '#2f80ed', 'sports-drink', '#27ae60', '#f2994a'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' } });
      map.addSource('km', { type: 'geojson', data: { type: 'FeatureCollection', features: kmFeatures } });
      map.addLayer({ id: 'km', type: 'circle', source: 'km', filter: ['any', ['get', 'major'], ['>=', ['zoom'], 13.5]], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 9, 16, 12], 'circle-color': '#0f172a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'km-label', type: 'symbol', source: 'km', filter: ['any', ['get', 'major'], ['>=', ['zoom'], 13.5]], layout: { 'text-field': ['get', 'label'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 12], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
      map.addSource('names', { type: 'geojson', data: { type: 'FeatureCollection', features: nameFeatures } });
      map.addLayer({ id: 'names', type: 'symbol', source: 'names', layout: { 'text-field': ['get', 'name'], 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-anchor': 'bottom', 'text-offset': [0, -1] }, paint: { 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 2 } });

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
      resolve(true);
    });
  });

  const dot = document.createElement('div');
  dot.className = 'map-dot';
  const marker = new maplibregl.Marker({ element: dot, pitchAlignment: 'viewport' }).setLngLat([c.lon[0], c.lat[0]]).addTo(map);
  const runnerMarkers: maplibregl.Marker[] = [];
  let lastD = -1;

  return {
    ready,
    setRunners(rs) {
      runnerMarkers.splice(0).forEach((m) => m.remove());
      for (const r of rs) {
        const e2 = document.createElement('div'); e2.className = 'map-runner'; e2.style.setProperty('--c', r.color); e2.title = r.label;
        const [la, lo] = track.latlon(r.d);
        runnerMarkers.push(new maplibregl.Marker({ element: e2 }).setLngLat([lo, la]).addTo(map));
      }
    },
    setPosition(nd) {
      const jumped = Math.abs(nd - lastD) > 300;
      if (nd === lastD) return;
      lastD = nd; d = nd;
      const [la, lo] = track.latlon(d);
      marker.setLngLat([lo, la]);
      if (map.getLayer('course')) map.setPaintProperty('course', 'line-gradient', progress());
      if (mode === 'follow') camera(!jumped);
    },
    setMode(m) {
      mode = m;
      if (m === 'follow') {
        if (terrainOk) map.setTerrain(TERRAIN);
        camera(false);
      } else {
        map.setTerrain(null);
        overview();
      }
    },
    resize() { map.resize(); if (mode === 'follow') camera(false); },
  };
}
