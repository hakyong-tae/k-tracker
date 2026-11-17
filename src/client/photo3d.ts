import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { GLTFExtensionsPlugin, TileCompressionPlugin, UnloadTilesPlugin } from '3d-tiles-renderer/plugins';
import type { Track } from './track.ts';

export interface Photo3d {
  setPosition(d: number): void;
  setActive(on: boolean): void;
  resize(): void;
  /** fires once if Google refuses the session (quota, key) */
  onError: (() => void) | null;
}

const DEG = Math.PI / 180;
const BACK = 280, UP = 300;            // chase camera offset (m)
const angleLerp = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

/**
 * Google Photorealistic 3D Tiles, chase camera along the course. Rendered live only: Google's terms forbid
 * caching or re-hosting the tiles, and each viewer load is one billed session (gated by /api/photo3d).
 */
export function createPhoto3d(el: HTMLElement, track: Track, key: string): Photo3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0xbfd8f2);
  renderer.domElement.className = 'photo-canvas';
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 160000);
  const tiles = new TilesRenderer();
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: false }));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new UnloadTilesPlugin());
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/') }));
  tiles.setCamera(camera);
  scene.add(tiles.group);

  // runner pin, drawn over the buildings so it never hides behind a facade
  const pin = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff4d1f, depthTest: false }));
  pin.renderOrder = 10;
  scene.add(pin);

  // attribution: Google logo + data providers of the visible tiles (required by the Map Tiles API policies)
  const attr = document.createElement('div');
  attr.className = 'photo-attr';
  attr.innerHTML = '<img alt="Google" width="59" height="18" src="https://maps.gstatic.com/mapfiles/api-3/images/google_white5_hdpi.png"><span></span>';
  el.append(attr);
  const attrText = attr.querySelector('span')!;

  const api: Photo3d = { setPosition, setActive, resize, onError: null };
  let failed = false;
  let retry = 0;
  tiles.addEventListener('load-error', (e) => {
    // a dropped tile request stays failed until reset; retry shortly instead of leaving a hole in the city
    if (e.tile) { if (!retry) retry = window.setTimeout(() => { retry = 0; try { tiles.resetFailedTiles(); } catch { /* tile tree changed mid-reset */ } }, 2500); return; }
    if (failed) return; // only the root tileset (= the session) failing ends the viewer
    failed = true;
    api.onError?.();
  });

  const ell = tiles.ellipsoid;
  const enu = new THREE.Matrix4();
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3();
  const target = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  (ray as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  const carto = { lat: 0, lon: 0, height: 0 };

  let d = 0;
  let bearing = track.lookHeading(0, 150);
  // tile heights are ellipsoidal and the GPX is roughly sea level: street height = GPX ele + offset (geoid, GPS bias).
  // The offset barely changes along a course, so a cheap probe every ~1.5 s keeps it honest; per-frame mesh raycasts stall the page.
  let offset = NaN;
  let frame = 0, active = false, raf = 0;

  function probeGround(la: number, lo: number) {
    const ele = track.ele(d);
    const guess = ele + (Number.isFinite(offset) ? offset : 40);
    ell.getEastNorthUpFrame(la * DEG, lo * DEG, guess + 600, enu);
    enu.extractBasis(east, north, up);
    let low = Infinity;
    // lowest of five nearby hits = the street, not a rooftop or a bridge deck
    for (const [dx, dy] of [[0, 0], [18, 0], [-18, 0], [0, 18], [0, -18]]) {
      ray.ray.origin.setFromMatrixPosition(enu).addScaledVector(east, dx).addScaledVector(north, dy);
      ray.ray.direction.copy(up).negate();
      ray.far = 1500;
      const hit = ray.intersectObject(tiles.group, true)[0];
      if (!hit) continue;
      ell.getPositionToCartographic(hit.point, carto);
      low = Math.min(low, carto.height);
    }
    if (!Number.isFinite(low)) return;
    const o = low - ele;
    offset = Number.isFinite(offset) ? offset + Math.max(-15, Math.min(15, o - offset)) * 0.5 : o;
  }

  function place(smooth: boolean) {
    const [la, lo] = track.latlon(d);
    if (frame % 90 === 1 || (!Number.isFinite(offset) && frame % 15 === 1)) probeGround(la, lo);
    const h = track.ele(d) + (Number.isFinite(offset) ? offset : 40);
    bearing = smooth ? angleLerp(bearing, track.lookHeading(d, 150), 0.06) : track.lookHeading(d, 150);
    ell.getEastNorthUpFrame(la * DEG, lo * DEG, h, enu);
    enu.extractBasis(east, north, up);
    target.setFromMatrixPosition(enu);
    fwd.copy(east).multiplyScalar(Math.sin(bearing * DEG)).addScaledVector(north, Math.cos(bearing * DEG));
    camera.position.copy(target).addScaledVector(fwd, -BACK).addScaledVector(up, UP);
    camera.up.copy(up);
    camera.lookAt(tmp.copy(target).addScaledVector(fwd, 60));
    camera.updateMatrixWorld();
    pin.position.copy(target).addScaledVector(up, 4);
  }

  const attributions: { type: string; value: string }[] = [];
  function loop() {
    raf = requestAnimationFrame(loop);
    frame++;
    place(true);
    tiles.update();
    renderer.render(scene, camera);
    if (frame % 30 === 0) {
      attributions.length = 0;
      tiles.getAttributions(attributions);
      attrText.textContent = attributions.filter((a) => a.type === 'string').map((a) => a.value).join(' ');
    }
  }

  function resize() {
    const w = el.clientWidth || 600, h = el.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    tiles.setResolutionFromRenderer(camera, renderer);
  }
  function setPosition(nd: number) {
    const jump = Math.abs(nd - d) > 300;
    d = nd;
    if (jump) place(false);
  }
  function setActive(on: boolean) {
    if (on === active) return;
    active = on;
    cancelAnimationFrame(raf);
    if (on) { resize(); place(false); loop(); }
  }
  return api;
}
