import { existsSync, mkdirSync, copyFileSync, cpSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const root = process.cwd();
const nextDir = join(root, '.next');
const distDir = join(root, 'dist');

console.log('[prepare-dist] Populating dist artifact directory...');

if (!existsSync(nextDir)) {
  console.error('[prepare-dist] Error: .next directory does not exist! Run next build first.');
  process.exit(1);
}

// 1. Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// 2. Copy the entire .next build output into dist
try {
  cpSync(nextDir, distDir, { recursive: true });
  console.log('[prepare-dist] Copied .next build output to dist/');
} catch (err) {
  console.warn('[prepare-dist] Warning copying .next to dist:', err.message);
}

// 3. Ensure static HTML pages are available at standard SPA/static paths in dist/
const appServerDir = join(nextDir, 'server', 'app');
if (existsSync(appServerDir)) {
  const pages = [
    { src: 'index.html', targets: ['index.html'] },
    { src: 'admin.html', targets: ['admin.html', 'admin/index.html'] },
    { src: 'owner.html', targets: ['owner.html', 'owner/index.html'] },
    { src: 'host.html', targets: ['host.html', 'host/index.html'] },
    { src: '_not-found.html', targets: ['404.html', '_not-found.html'] },
  ];

  for (const page of pages) {
    const srcPath = join(appServerDir, page.src);
    if (existsSync(srcPath)) {
      for (const target of page.targets) {
        const destPath = join(distDir, target);
        const destParent = resolve(destPath, '..');
        if (!existsSync(destParent)) {
          mkdirSync(destParent, { recursive: true });
        }
        copyFileSync(srcPath, destPath);
        console.log(`[prepare-dist] Emitted ${target}`);
      }
    }
  }
}

// 4. Ensure _next/static asset paths are accessible in dist/
const nextStaticDir = join(nextDir, 'static');
const distNextStaticDir = join(distDir, '_next', 'static');
if (existsSync(nextStaticDir)) {
  if (!existsSync(resolve(distNextStaticDir, '..'))) {
    mkdirSync(resolve(distNextStaticDir, '..'), { recursive: true });
  }
  cpSync(nextStaticDir, distNextStaticDir, { recursive: true });
  console.log('[prepare-dist] Emitted dist/_next/static');
}

// 5. Copy public directory assets if present
const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true });
  console.log('[prepare-dist] Copied public assets to dist/');
}

// 6. Verify dist is not empty
const distContents = readdirSync(distDir);
console.log(`[prepare-dist] Successfully populated dist/ with ${distContents.length} top-level entries:`, distContents.join(', '));
