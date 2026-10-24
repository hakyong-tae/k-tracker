// Usage: node scripts/seed-race.ts data/races/<slug> [--remote] [--draft]
// Builds the course from course.gpx with the same shared code the site uses, then upserts into D1.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseGpx } from '../src/shared/gpx.ts';
import { buildCourse } from '../src/shared/course.ts';
import { sanitizeMeta } from '../src/shared/validate.ts';
import { runChecks, suggestScale } from '../src/shared/checks.ts';
import { makeThumb } from '../src/shared/thumb.ts';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/seed-race.ts data/races/<slug> [--remote] [--draft]'); process.exit(1); }
const remote = process.argv.includes('--remote');
const status = process.argv.includes('--draft') ? 'draft' : 'published';

const raw = JSON.parse(readFileSync(join(dir, 'race.json'), 'utf8'));
const gpx = parseGpx(readFileSync(join(dir, 'course.gpx'), 'utf8'));
const course = buildCourse(gpx.points);
const meta = sanitizeMeta({ ...raw, scale: raw.scale ?? suggestScale(course, raw.distance) });
const checks = runChecks(course, meta);
console.log(`${meta.slug}: ${(course.total / 1000).toFixed(3)} km raw, scale ${meta.scale}, gain ${course.gain} m, ${course.lat.length} samples`);
for (const c of checks) console.log(`  ${c.level.padEnd(5)} ${c.code} ${c.detail ?? ''}`);
if (checks.some((c) => c.level === 'error')) process.exit(2);

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql = `INSERT INTO races (slug, status, date, country, meta, course, thumb) VALUES (${q(meta.slug)}, ${q(status)}, ${q(meta.date)}, ${q(meta.country)}, ${q(JSON.stringify(meta))}, ${q(JSON.stringify(course))}, ${q(JSON.stringify(makeThumb(course)))})
ON CONFLICT(slug) DO UPDATE SET status=excluded.status, date=excluded.date, country=excluded.country, meta=excluded.meta, course=excluded.course, thumb=excluded.thumb, updated_at=datetime('now');
DELETE FROM cache WHERE key LIKE ${q(`wx:%:${meta.slug}:%`)};
`;
mkdirSync('.wrangler', { recursive: true });
const file = `.wrangler/seed-${meta.slug}.sql`;
writeFileSync(file, sql);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'k-tracker', remote ? '--remote' : '--local', '--file', file], { stdio: 'inherit' });
console.log(`seeded ${meta.slug} (${status}) → /r/${meta.slug}`);
