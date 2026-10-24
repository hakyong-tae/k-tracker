export interface RawPoint { lat: number; lon: number; ele: number | null }
export interface RawWaypoint { lat: number; lon: number; name: string; type: string | null }
export interface ParsedGpx { name: string | null; points: RawPoint[]; waypoints: RawWaypoint[] }

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};
const inner = (body: string, name: string): string | null => {
  const m = body.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()) : null;
};
const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function points(xml: string, tagName: string): { tag: string; body: string }[] {
  const out: { tag: string; body: string }[] = [];
  const re = new RegExp(`<(?:\\w+:)?${tagName}\\b([^>]*?)(\\/>|>([\\s\\S]*?)</(?:\\w+:)?${tagName}>)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push({ tag: m[1], body: m[3] ?? '' });
  return out;
}

/** Dependency-free GPX parser that runs in browsers and Workers alike. */
export function parseGpx(xml: string): ParsedGpx {
  if (!/<gpx[\s>]/i.test(xml)) throw new Error('not-gpx');
  const toPoint = ({ tag, body }: { tag: string; body: string }): RawPoint | null => {
    const lat = Number(attr(tag, 'lat'));
    const lon = Number(attr(tag, 'lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const e = inner(body, 'ele');
    const ele = e !== null && e !== '' && Number.isFinite(Number(e)) ? Number(e) : null;
    return { lat, lon, ele };
  };
  let pts = points(xml, 'trkpt').map(toPoint).filter((p): p is RawPoint => !!p);
  if (pts.length < 2) pts = points(xml, 'rtept').map(toPoint).filter((p): p is RawPoint => !!p);
  const waypoints = points(xml, 'wpt')
    .map((w) => {
      const p = toPoint(w);
      if (!p) return null;
      return { lat: p.lat, lon: p.lon, name: inner(w.body, 'name') ?? '', type: inner(w.body, 'type') ?? inner(w.body, 'sym') };
    })
    .filter((w): w is RawWaypoint => !!w);
  const trk = xml.match(/<trk\b[\s\S]*?<\/trk>/i);
  const name = (trk && inner(trk[0], 'name')) || inner(xml, 'name');
  return { name, points: pts, waypoints };
}
