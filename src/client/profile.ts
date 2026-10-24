import type { Poi, Lang } from '../shared/types.ts';
import { AID_TYPES, POI_LABEL, l } from '../shared/i18n.ts';
import type { Track } from './track.ts';
import { cssVar } from './dom.ts';

const gradeColor = (g: number): string => {
  if (g >= 6) return '#d63c2f';
  if (g >= 3) return '#f07c3a';
  if (g >= 1) return '#f5b25b';
  if (g <= -3) return '#3c8fd6';
  if (g <= -1) return '#7fb8e6';
  return '#9aa7b4';
};

/** Elevation profile coloured by grade, with aid ticks and a draggable cursor. */
export class Profile {
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1;
  private base: HTMLCanvasElement | null = null;
  private cursorKm = 0;
  private hoverKm: number | null = null;
  onSeek: ((km: number) => void) | null = null;
  private pad = { l: 34, r: 10, t: 44, b: 30 };

  constructor(private canvas: HTMLCanvasElement, private track: Track, private pois: Poi[], private lang: Lang, private labels: { km: number; text: string; pri?: number }[] = []) {
    this.ctx = canvas.getContext('2d')!;
    const seek = (e: PointerEvent) => { const km = this.kmAt(e.clientX); if (km !== null) this.onSeek?.(km); };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); seek(e); });
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons & 1) seek(e);
      else { this.hoverKm = this.kmAt(e.clientX); this.draw(); }
    });
    canvas.addEventListener('pointerleave', () => { this.hoverKm = null; this.draw(); });
    this.resize();
  }

  private kmAt(clientX: number): number | null {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) * this.dpr;
    const u = (x - this.pad.l * this.dpr) / (this.W - (this.pad.l + this.pad.r) * this.dpr);
    return Math.max(0, Math.min(1, u)) * this.track.totalKm;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.round(r.width * this.dpr));
    this.H = Math.max(1, Math.round(r.height * this.dpr));
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.base = null;
    this.draw();
  }

  setCursor(km: number) { this.cursorKm = km; this.draw(); }

  private geom() {
    const { dpr, W, H, track } = this;
    const L = this.pad.l * dpr, R = W - this.pad.r * dpr, T = this.pad.t * dpr, B = H - this.pad.b * dpr;
    const lo = Math.floor(track.c.minEle - 3), hi = Math.max(lo + 20, Math.ceil(track.c.maxEle + 3));
    const x = (km: number) => L + ((R - L) * km) / track.totalKm;
    const y = (e: number) => B - ((B - T) * (e - lo)) / (hi - lo);
    return { L, R, T, B, lo, hi, x, y };
  }

  private drawBase() {
    const off = document.createElement('canvas');
    off.width = this.W; off.height = this.H;
    const ctx = off.getContext('2d')!;
    const { dpr, track } = this;
    const { L, R, T, B, lo, hi, x, y } = this.geom();
    const fg = cssVar('--muted') || '#667085';
    const gridC = cssVar('--line') || '#e4e7ec';
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.fillStyle = fg; ctx.strokeStyle = gridC; ctx.lineWidth = dpr;
    // horizontal grid
    const stepE = (hi - lo) > 120 ? 50 : (hi - lo) > 50 ? 20 : 10;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let e = Math.ceil(lo / stepE) * stepE; e <= hi; e += stepE) {
      ctx.beginPath(); ctx.moveTo(L, y(e)); ctx.lineTo(R, y(e)); ctx.stroke();
      ctx.fillText(`${e}`, L - 5 * dpr, y(e));
    }
    // km labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const stepK = track.totalKm > 25 ? 5 : track.totalKm > 8 ? 2 : 1;
    for (let k = 0; k <= track.totalKm + 0.01; k += stepK) {
      ctx.beginPath(); ctx.moveTo(x(k), B); ctx.lineTo(x(k), B + 4 * dpr); ctx.stroke();
      ctx.fillText(`${k}`, x(k), B + 8 * dpr);
    }
    // grade-coloured area, one column per device pixel pair
    const colW = Math.max(1, Math.round(2 * dpr));
    for (let px = L; px < R; px += colW) {
      const km = ((px - L) / (R - L)) * track.totalKm;
      const d = track.dist(km);
      ctx.fillStyle = gradeColor(track.grade(d));
      const top = y(track.ele(d));
      ctx.fillRect(px, top, colW, B - top);
    }
    // outline
    ctx.beginPath();
    for (let px = L; px <= R; px += dpr) {
      const d = track.dist(((px - L) / (R - L)) * track.totalKm);
      px === L ? ctx.moveTo(px, y(track.ele(d))) : ctx.lineTo(px, y(track.ele(d)));
    }
    ctx.strokeStyle = cssVar('--fg') || '#111'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    // aid ticks
    for (const p of this.pois.filter((q) => AID_TYPES.includes(q.type))) {
      ctx.fillStyle = p.type === 'water' ? '#2f80ed' : p.type === 'sports-drink' ? '#27ae60' : '#f2994a';
      ctx.beginPath(); ctx.arc(x(p.km), B - 4 * dpr, 3 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    // labels: two rows above the chart, highest priority first, no overlaps
    ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
    const rows: [number, number][][] = [[], []];
    const placed: { x: number; row: number; text: string; km: number }[] = [];
    for (const lb of [...this.labels].sort((a, b) => (b.pri ?? 0) - (a.pri ?? 0))) {
      const w = ctx.measureText(lb.text).width + 10 * dpr;
      const px = Math.max(L + w / 2, Math.min(R - w / 2, x(lb.km)));
      const row = rows.findIndex((r) => r.every(([a, b]) => px + w / 2 < a || px - w / 2 > b));
      if (row < 0) continue;
      rows[row].push([px - w / 2, px + w / 2]);
      placed.push({ x: px, row, text: lb.text, km: lb.km });
    }
    for (const pl of placed) {
      const ly = T - 4 * dpr - pl.row * 15 * dpr;
      const cx = x(pl.km), cy = y(track.ele(track.dist(pl.km)));
      ctx.strokeStyle = gridC; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(cx, ly + 2 * dpr); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = cssVar('--fg') || '#111';
      ctx.fillText(pl.text, pl.x, ly);
    }
    void POI_LABEL; void l;
    this.base = off;
  }

  draw() {
    if (!this.base) this.drawBase();
    const { ctx, dpr, track } = this;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(this.base!, 0, 0);
    const { T, B, x, y } = this.geom();
    const cx = x(this.cursorKm);
    ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(cx, T - 8 * dpr); ctx.lineTo(cx, B); ctx.stroke();
    ctx.fillStyle = '#ff5a36';
    ctx.beginPath(); ctx.arc(cx, y(track.ele(track.dist(this.cursorKm))), 5 * dpr, 0, Math.PI * 2); ctx.fill();
    if (this.hoverKm !== null) {
      const hx = x(this.hoverKm), d = track.dist(this.hoverKm);
      ctx.strokeStyle = cssVar('--muted') || '#888'; ctx.lineWidth = dpr; ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(hx, T); ctx.lineTo(hx, B); ctx.stroke(); ctx.setLineDash([]);
      const txt = `${this.hoverKm.toFixed(1)} km · ${Math.round(track.ele(d))} m · ${track.grade(d) >= 0 ? '+' : ''}${track.grade(d).toFixed(1)}%`;
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`;
      const w = ctx.measureText(txt).width + 12 * dpr;
      const bx = Math.max(0, Math.min(this.W - w, hx - w / 2));
      ctx.fillStyle = cssVar('--card') || '#fff'; ctx.fillRect(bx, 0, w, 18 * dpr);
      ctx.fillStyle = cssVar('--fg') || '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 6 * dpr, 9 * dpr);
    }
  }
}
