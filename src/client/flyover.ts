import type { Poi } from '../shared/types.ts';
import type { Track } from './track.ts';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface P { sx: number; sy: number; ok: boolean; Y: number }
interface Sprite { s: number; kind: 'tree' | 'lamp' | 'block' | 'km' | 'aid' | 'runner'; side: number; off: number; seed: number; label?: string }

const ROAD_W = 11;
const N = 150;
const Z_NEAR = 1.6;
const Z_FAR = 650;

/** Pseudo-3D "runner's eye" renderer that follows the real GPX geometry and elevation. */
export class Flyover {
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1;
  private exag: number;
  private kmSigns: Sprite[] = [];
  private aidSprites: Sprite[] = [];

  constructor(private canvas: HTMLCanvasElement, private track: Track, aid: Poi[]) {
    this.ctx = canvas.getContext('2d')!;
    const span = track.c.maxEle - track.c.minEle;
    this.exag = span < 15 ? 4 : span < 60 ? 3 : 2;
    for (let k = 1; k < track.totalKm; k++) this.kmSigns.push({ s: track.dist(k), kind: 'km', side: 1, off: ROAD_W / 2 + 1.5, seed: k, label: String(k) });
    this.aidSprites = aid.map((p, i) => ({ s: track.dist(p.km), kind: 'aid' as const, side: -1, off: ROAD_W / 2 + 2.5, seed: i, label: p.type }));
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.round(r.width * this.dpr));
    this.H = Math.max(1, Math.round(r.height * this.dpr));
    this.canvas.width = this.W; this.canvas.height = this.H;
  }

  render(d: number, sunEl: number, time: number) {
    const { ctx, W, H, track } = this;
    const light = clamp((sunEl + 10) / 16, 0.18, 1);
    const horizon = H * 0.44;
    const f = W * 0.85;
    const cx = W / 2;
    const camH = 2.0;
    const [px, py] = track.pos(d);
    const th = (track.lookHeading(d, 35) * Math.PI) / 180;
    const Fx = Math.sin(th), Fy = Math.cos(th), Rx = Math.cos(th), Ry = -Math.sin(th);
    const camE = track.ele(d) * this.exag + camH;

    this.sky(sunEl, horizon, th);

    const project = (wx: number, wy: number, wz: number): P => {
      const rx = wx - px, ry = wy - py;
      const X = rx * Rx + ry * Ry, Y = rx * Fx + ry * Fy;
      if (Y < 0.6) return { sx: 0, sy: 0, ok: false, Y };
      return { sx: cx + (X / Y) * f, sy: horizon + ((camE - wz) / Y) * f, ok: true, Y };
    };

    // slices along the path, far → near
    const end = track.c.total;
    const slices: { s: number; c: P; l: P; r: P; hl: number }[] = [];
    for (let k = N; k >= 0; k--) {
      const s = d + Z_NEAR * Math.pow(Z_FAR / Z_NEAR, k / N);
      if (s > end) continue;
      const [wx, wy] = track.pos(s);
      const h = (track.headingAt(s) * Math.PI) / 180;
      const nx = Math.cos(h), ny = -Math.sin(h);
      const wz = track.ele(s) * this.exag;
      slices.push({ s, c: project(wx, wy, wz), l: project(wx - nx * ROAD_W / 2, wy - ny * ROAD_W / 2, wz), r: project(wx + nx * ROAD_W / 2, wy + ny * ROAD_W / 2, wz), hl: h });
    }

    const grassA: RGB = shade([88, 140, 78], light), grassB: RGB = shade([80, 130, 72], light);
    const roadA: RGB = shade([92, 96, 104], light), roadB: RGB = shade([86, 90, 98], light);
    const line: RGB = shade([235, 235, 228], Math.max(0.45, light));
    const sprites = this.collectSprites(d, time);
    let si = 0;

    const quad = (a: P, b: P, c: P, e: P, col: string) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.lineTo(c.sx, c.sy); ctx.lineTo(e.sx, e.sy); ctx.closePath(); ctx.fill();
    };
    const lerpP = (a: P, b: P, t: number): P => ({ sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t, ok: true, Y: a.Y + (b.Y - a.Y) * t });

    for (let k = 0; k < slices.length - 1; k++) {
      const A = slices[k], B = slices[k + 1]; // A far, B near
      // sprites located beyond this strip get drawn first so nearer ground can cover them
      while (si < sprites.length && sprites[si].s >= A.s) { this.drawSprite(sprites[si], project, light, f, time); si++; }
      if (!A.c.ok || !B.c.ok || !A.l.ok || !A.r.ok || !B.l.ok || !B.r.ok) continue;
      const y0 = Math.min(A.c.sy, B.c.sy), y1 = Math.max(A.c.sy, B.c.sy);
      if (y1 < 0 || y0 > H) continue;
      ctx.fillStyle = css(Math.floor(A.s / 18) % 2 ? grassA : grassB);
      ctx.fillRect(0, y0, W, Math.max(1, y1 - y0 + 1));
      quad(A.l, A.r, B.r, B.l, css(Math.floor(A.s / 9) % 2 ? roadA : roadB));
      // edge lines
      const e = 0.35 / ROAD_W;
      quad(A.l, lerpP(A.l, A.r, e), lerpP(B.l, B.r, e), B.l, css(line, 0.9));
      quad(lerpP(A.l, A.r, 1 - e), A.r, B.r, lerpP(B.l, B.r, 1 - e), css(line, 0.9));
      // centre dashes
      if (Math.floor(A.s / 5) % 2 === 0) {
        const c0 = 0.5 - 0.08 / ROAD_W * 2, c1 = 0.5 + 0.08 / ROAD_W * 2;
        quad(lerpP(A.l, A.r, c0), lerpP(A.l, A.r, c1), lerpP(B.l, B.r, c1), lerpP(B.l, B.r, c0), css([230, 200, 90], 0.9 * Math.max(0.5, light)));
      }
    }
    while (si < sprites.length) { this.drawSprite(sprites[si], project, light, f, time); si++; }

    if (d >= end - 1) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
    }
  }

  private sky(sunEl: number, horizon: number, th: number) {
    const { ctx, W } = this;
    const night: [RGB, RGB] = [[10, 16, 38], [28, 40, 78]];
    const dawn: [RGB, RGB] = [[46, 62, 120], [240, 150, 110]];
    const day: [RGB, RGB] = [[86, 148, 222], [196, 222, 245]];
    let top: RGB, bot: RGB;
    if (sunEl < -10) [top, bot] = night;
    else if (sunEl < 0) { const t = (sunEl + 10) / 10; top = mix(night[0], dawn[0], t); bot = mix(night[1], dawn[1], t); }
    else if (sunEl < 12) { const t = sunEl / 12; top = mix(dawn[0], day[0], t); bot = mix(dawn[1], day[1], t); }
    else [top, bot] = day;
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, css(top)); g.addColorStop(1, css(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon + 2);
    if (sunEl < -4) {
      ctx.fillStyle = `rgba(255,255,255,${clamp((-sunEl - 4) / 8, 0, 0.8)})`;
      for (let i = 0; i < 70; i++) {
        const x = ((hash(i) * W * 3 - (th / (2 * Math.PI)) * W * 3) % W + W) % W, y = hash(i + 99) * horizon * 0.9;
        ctx.fillRect(x, y, this.dpr * (hash(i + 7) > 0.85 ? 2 : 1), this.dpr * (hash(i + 7) > 0.85 ? 2 : 1));
      }
    }
    // distant hills, parallax with heading
    const light = clamp((sunEl + 10) / 16, 0.2, 1);
    const layers: [RGB, number, number][] = [[[120, 140, 160], 0.11, 1.0], [[96, 120, 110], 0.06, 1.6]];
    for (const [col, amp, par] of layers) {
      ctx.fillStyle = css(shade(col, light));
      ctx.beginPath(); ctx.moveTo(0, horizon + 1);
      const off = (th / (2 * Math.PI)) * W * 2 * par;
      for (let x = 0; x <= W; x += 6 * this.dpr) {
        const u = (x + off) / W;
        const y = horizon - horizon * amp * (0.55 + 0.25 * Math.sin(u * 6.3) + 0.15 * Math.sin(u * 17.1 + 1) + 0.08 * Math.sin(u * 41 + 2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, horizon + 1); ctx.closePath(); ctx.fill();
    }
  }

  private collectSprites(d: number, time: number): Sprite[] {
    const out: Sprite[] = [];
    const s0 = d + 2, s1 = Math.min(this.track.c.total, d + 420);
    const sp = 14;
    for (let j = Math.ceil(s0 / sp); j * sp < s1; j++) {
      const r = hash(j);
      const side = hash(j + 0.5) > 0.5 ? 1 : -1;
      if (r < 0.42) out.push({ s: j * sp, kind: 'tree', side, off: ROAD_W / 2 + 3 + hash(j + 3) * 9, seed: j });
      else if (r < 0.58) out.push({ s: j * sp, kind: 'lamp', side, off: ROAD_W / 2 + 1.2, seed: j });
      else if (r < 0.66) out.push({ s: j * sp, kind: 'block', side, off: ROAD_W / 2 + 18 + hash(j + 5) * 25, seed: j });
    }
    for (const k of this.kmSigns) if (k.s > s0 && k.s < s1) out.push(k);
    for (const a of this.aidSprites) if (a.s > s0 && a.s < s1) out.push(a);
    for (let i = 0; i < 7; i++) {
      const base = 8 + i * 22 + hash(i) * 14;
      const s = d + base + Math.sin(time * 0.15 + i * 2) * 5;
      if (s < s1) out.push({ s, kind: 'runner', side: hash(i + 11) > 0.5 ? 1 : -1, off: 0.8 + hash(i + 21) * 3.2, seed: i });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  private drawSprite(sp: Sprite, project: (x: number, y: number, z: number) => P, light: number, f: number, time: number) {
    const { ctx, track } = this;
    const [wx, wy] = track.pos(sp.s);
    const h = (track.headingAt(sp.s) * Math.PI) / 180;
    const nx = Math.cos(h), ny = -Math.sin(h);
    const off = sp.kind === 'runner' ? (sp.side * sp.off) : sp.side * sp.off;
    const z = track.ele(sp.s) * this.exag;
    const p = project(wx + nx * off, wy + ny * off, z);
    if (!p.ok || p.Y > 450) return;
    const k = f / p.Y; // pixels per meter
    const fade = clamp((450 - p.Y) / 120, 0, 1);
    ctx.globalAlpha = fade;
    switch (sp.kind) {
      case 'tree': {
        const ht = (5 + hash(sp.seed + 1) * 5) * k;
        ctx.fillStyle = css(shade([90, 70, 50], light)); ctx.fillRect(p.sx - 0.15 * k, p.sy - ht * 0.45, 0.3 * k, ht * 0.45);
        ctx.fillStyle = css(shade(hash(sp.seed + 2) > 0.5 ? [52, 110, 62] : [70, 128, 70], light));
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy - ht * 0.68, ht * 0.28, ht * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'lamp': {
        const ht = 7 * k;
        ctx.fillStyle = css(shade([70, 74, 80], Math.max(0.5, light))); ctx.fillRect(p.sx - 0.08 * k, p.sy - ht, 0.16 * k, ht);
        ctx.fillRect(p.sx - (sp.side > 0 ? 1.2 : 0) * k, p.sy - ht, 1.2 * k, 0.15 * k);
        if (light < 0.6) {
          const lx = p.sx - sp.side * 1.1 * k, ly = p.sy - ht;
          const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 4 * k);
          g.addColorStop(0, 'rgba(255,220,150,.75)'); g.addColorStop(1, 'rgba(255,220,150,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 4 * k, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'block': {
        const w = (10 + hash(sp.seed + 4) * 14) * k, ht = (12 + hash(sp.seed + 6) * 40) * k;
        const base: RGB = hash(sp.seed + 8) > 0.5 ? [196, 190, 182] : [170, 178, 190];
        ctx.fillStyle = css(shade(base, light)); ctx.fillRect(p.sx - w / 2, p.sy - ht, w, ht);
        if (light < 0.7) {
          ctx.fillStyle = 'rgba(255,214,140,.55)';
          for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) if (hash(sp.seed * 31 + r * 7 + c) > 0.55) ctx.fillRect(p.sx - w / 2 + (c + 0.3) * w / 4, p.sy - ht + (r + 0.3) * ht / 6.5, w / 10, ht / 18);
        }
        break;
      }
      case 'km': {
        const ht = 2.6 * k, w = 1.3 * k;
        ctx.fillStyle = css(shade([60, 60, 60], Math.max(0.6, light))); ctx.fillRect(p.sx - 0.06 * k, p.sy - ht, 0.12 * k, ht);
        ctx.fillStyle = '#ff5a36'; ctx.fillRect(p.sx - w / 2, p.sy - ht - w * 0.8, w, w * 0.8);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(6, w * 0.45)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(sp.label ?? '', p.sx, p.sy - ht - w * 0.4);
        break;
      }
      case 'aid': {
        const w = 4 * k, ht = 2.6 * k;
        ctx.fillStyle = css(shade([235, 240, 245], Math.max(0.6, light))); ctx.fillRect(p.sx - w / 2, p.sy - ht, w, ht * 0.1);
        ctx.fillStyle = sp.label === 'water' ? '#2f80ed' : sp.label === 'sports-drink' ? '#27ae60' : '#f2994a';
        ctx.beginPath(); ctx.moveTo(p.sx - w * 0.6, p.sy - ht); ctx.lineTo(p.sx, p.sy - ht * 1.45); ctx.lineTo(p.sx + w * 0.6, p.sy - ht); ctx.closePath(); ctx.fill();
        ctx.fillStyle = css(shade([200, 200, 200], light)); ctx.fillRect(p.sx - w / 2, p.sy - ht * 0.45, w, ht * 0.12);
        ctx.fillRect(p.sx - w / 2, p.sy - ht, 0.08 * k, ht); ctx.fillRect(p.sx + w / 2 - 0.08 * k, p.sy - ht, 0.08 * k, ht);
        break;
      }
      case 'runner': {
        const ht = 1.75 * k;
        const cols: RGB[] = [[255, 90, 54], [47, 128, 237], [242, 201, 76], [155, 81, 224], [39, 174, 96], [235, 87, 87], [45, 156, 219]];
        const leg = Math.sin(time * 9 + sp.seed * 2) * 0.22 * ht;
        ctx.strokeStyle = css(shade([40, 40, 48], Math.max(0.5, light))); ctx.lineWidth = Math.max(1, 0.12 * k);
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy - ht * 0.48); ctx.lineTo(p.sx - leg * 0.5, p.sy); ctx.moveTo(p.sx, p.sy - ht * 0.48); ctx.lineTo(p.sx + leg * 0.5, p.sy); ctx.stroke();
        ctx.fillStyle = css(shade(cols[sp.seed % cols.length], Math.max(0.5, light)));
        ctx.fillRect(p.sx - 0.2 * k, p.sy - ht * 0.84, 0.4 * k, ht * 0.38);
        ctx.fillStyle = css(shade([224, 178, 140], Math.max(0.5, light)));
        ctx.beginPath(); ctx.arc(p.sx, p.sy - ht * 0.92, 0.12 * k, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
