import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const required = (name) => {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error('Missing required environment variable: ' + name);
  return value;
};

const versionName = required('RELEASE_VERSION_NAME').replace(/^v/i, '');
const versionCode = Number(required('RELEASE_VERSION_CODE'));
const versionTag = required('RELEASE_VERSION_TAG');
const repo = required('RELEASE_REPO');
const outDir = resolve(process.env.RELEASE_REPO_PATH || 'release-repo');
const releaseNotes = JSON.parse(await readFile('release-notes.json', 'utf8'));
const sourceCommit = required('GITHUB_SHA');

if (!/^\d+\.\d+\.\d+$/.test(versionName)) throw new Error('Release version must be MAJOR.MINOR.PATCH.');
if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('Version code must be a positive integer.');
if (!Array.isArray(releaseNotes) || !releaseNotes.length || releaseNotes.some(section => !section.title || !Array.isArray(section.items) || !section.items.length)) {
  throw new Error('Generated release notes must contain titled sections with at least one item.');
}

const definitions = [
  { packageId: 'com.onlyus.app', assetName: 'OnlyUs.apk', file: 'OnlyUs.apk' },
  { packageId: 'com.onlyus.notes', assetName: 'Notes.apk', file: 'Notes.apk' }
];
const editions = {};

for (const item of definitions) {
  const filePath = join(process.cwd(), item.file);
  const bytes = await readFile(filePath);
  const fileInfo = await stat(filePath);
  editions[item.packageId] = {
    packageId: item.packageId,
    assetName: item.assetName,
    downloadUrl: 'https://github.com/' + repo + '/releases/download/' + encodeURIComponent(versionTag) + '/' + encodeURIComponent(item.assetName),
    sizeBytes: fileInfo.size,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

const document = {
  schemaVersion: 1,
  appName: 'OnlyUs',
  versionName,
  versionCode,
  publishedAt: new Date().toISOString(),
  sourceCommit,
  releaseNotes,
  editions
};

await writeFile(join(outDir, 'latest.json'), JSON.stringify(document, null, 2) + '\n', 'utf8');
console.log('Generated public latest.json for ' + versionTag + ' with ' + releaseNotes.length + ' release-note section(s).');
