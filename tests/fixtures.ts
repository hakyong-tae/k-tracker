/** Synthetic course: due north from Seoul City Hall, with a 30 m hill at 10–12 km. */
export function syntheticGpx(totalM = 42195, opts: { ele?: boolean; wpts?: { km: number; name: string }[] } = {}): string {
  const lat0 = 37.5665, lon0 = 126.978, mPerDegLat = 111195;
  const pts: string[] = [];
  for (let d = 0; d <= totalM; d += 10) {
    const lat = lat0 + d / mPerDegLat;
    const hill = d > 10000 && d < 12000 ? 30 * Math.sin(((d - 10000) / 2000) * Math.PI) : 0;
    const e = 20 + hill + (Math.sin(d) * 0.8); // GPS-like noise
    pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon0}">${opts.ele === false ? '' : `<ele>${e.toFixed(1)}</ele>`}</trkpt>`);
  }
  const w = (opts.wpts ?? []).map((p) => `<wpt lat="${(lat0 + (p.km * 1000) / mPerDegLat).toFixed(7)}" lon="${lon0 + 0.0001}"><name>${p.name}</name><type>water</type></wpt>`).join('');
  return `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${w}<trk><name>Test &amp; Run</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}
