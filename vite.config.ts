import { defineConfig, type Plugin } from 'vite';
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Stamp an asset version the server templates use for cache-busting. */
const stamp = (): Plugin => ({
  name: 'asset-version',
  closeBundle() {
    writeFileSync('functions/_lib/version.ts', `export const ASSET_VERSION = '${Date.now().toString(36)}';\n`);
  },
});

/** In `vite build --watch`, also rebuild (and re-copy public/) when files in public/ change. */
const watchPublic = (): Plugin => ({
  name: 'watch-public',
  buildStart() {
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : this.addWatchFile(p); } };
    walk('public');
  },
});

export default defineConfig({
  publicDir: 'public',
  plugins: [stamp(), watchPublic()],
  worker: { format: 'es', rollupOptions: { output: { entryFileNames: 'assets/chunks/[name]-[hash].js' } } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        race: 'src/client/race.ts', submit: 'src/client/submit.ts', admin: 'src/client/admin.ts', app: 'src/styles/app.css',
        home: 'src/client/home.ts', 'tracker-register': 'src/client/tracker/register.ts', 'tracker-viewer': 'src/client/tracker/viewer.ts',
      },
      output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/chunks/[name]-[hash].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
