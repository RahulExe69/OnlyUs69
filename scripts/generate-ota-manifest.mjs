#!/usr/bin/env node
/**
 * Build-Time OTA Manifest Generator
 * Scans the compiled Vite `dist/` directory and produces `dist/ota-manifest.json`.
 * Used by the Android APK's native OtaUpdateManager to perform fast, incremental
 * local-storage OTA updates without requiring a new APK build for UI/web changes.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const MANIFEST_PATH = path.join(DIST_DIR, 'ota-manifest.json');

// Ignore server-only artifacts or the manifest itself
const IGNORED_FILES = new Set([
  'ota-manifest.json',
  'server.cjs',
  'server.cjs.map',
]);

function walkDir(dir, baseDir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, fileList);
    } else if (entry.isFile()) {
      if (!IGNORED_FILES.has(relPath) && !relPath.endsWith('.map')) {
        const buf = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        fileList.push({
          path: relPath,
          hash,
          size: buf.length,
        });
      }
    }
  }
  return fileList;
}

function generateManifest() {
  if (!fs.existsSync(DIST_DIR)) {
    console.warn('[ota-manifest] dist/ directory not found, skipping manifest generation.');
    return;
  }

  const files = walkDir(DIST_DIR, DIST_DIR).sort((a, b) => a.path.localeCompare(b.path));

  const combinedHashInput = files.map((f) => `${f.path}:${f.hash}`).join('|');
  const bundleHash = crypto.createHash('sha256').update(combinedHashInput).digest('hex');

  const manifest = {
    bundleHash,
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[ota-manifest] ✨ Generated dist/ota-manifest.json (hash: ${bundleHash}, files: ${files.length})`);
}

generateManifest();
