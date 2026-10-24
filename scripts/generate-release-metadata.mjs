import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises';
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
const outDir = resolve(process.cwd());
const releaseNotes = JSON.parse(await readFile('release-notes.json', 'utf8'));
const sourceCommit = required('GITHUB_SHA');

if (!/^\d+\.\d+\.\d+$/.test(versionName)) throw new Error('Release version must be MAJOR.MINOR.PATCH.');
if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('Version code must be a positive integer.');
if (versionTag.replace(/^v/i, '') !== versionName) throw new Error('Release tag must match the APK version name.');
if (!Array.isArray(releaseNotes) || !releaseNotes.length || releaseNotes.some(section => !section.title || !Array.isArray(section.items) || !section.items.length)) {
  throw new Error('Generated release notes must contain titled sections with at least one item.');
}

// Validate each actual APK before metadata is generated or published. This
// prevents a stale/wrongly selected APK from being advertised under a new tag.
const androidHome = process.env.ANDROID_HOME || '/usr/local/lib/android/sdk';
const buildToolsDir = join(androidHome, 'build-tools');
const buildToolVersions = (await readdir(buildToolsDir))
  .filter(name => /^\d+(?:\.\d+)+$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!buildToolVersions.length) throw new Error('Android build-tools not found; cannot verify APK identity.');
const aaptPath = join(buildToolsDir, buildToolVersions[buildToolVersions.length - 1], 'aapt');
await access(aaptPath);

const definitions = [
  { packageId: 'com.onlyus.app', assetName: 'OnlyUs.apk', file: 'OnlyUs.apk' },
  { packageId: 'com.onlyus.notes', assetName: 'Notes.apk', file: 'Notes.apk' }
];
const editions = {};

for (const item of definitions) {
  const filePath = join(process.cwd(), item.file);
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile() || fileInfo.size < 1) throw new Error('Built APK is missing or empty: ' + item.file);

  const inspection = spawnSync(aaptPath, ['dump', 'badging', filePath], { encoding: 'utf8' });
  if (inspection.error) throw new Error('Could not inspect ' + item.file + ': ' + inspection.error.message);
  if (inspection.status !== 0) {
    throw new Error('aapt failed to inspect ' + item.file + ': ' + String(inspection.stderr || '').trim());
  }
  const packageLine = String(inspection.stdout || '').match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']*)'/m);
  if (!packageLine) throw new Error('Could not read package/version details from ' + item.file);
  const [, actualPackageId, actualVersionCode, actualVersionName] = packageLine;
  if (
    actualPackageId !== item.packageId ||
    Number(actualVersionCode) !== versionCode ||
    actualVersionName !== versionName
  ) {
    throw new Error(
      item.file + ' identity mismatch. Expected ' + item.packageId + ' v' + versionName +
      ' (code ' + versionCode + '), got ' + actualPackageId + ' v' + actualVersionName +
      ' (code ' + actualVersionCode + '). Refusing to publish incorrect update metadata.'
    );
  }

  const bytes = await readFile(filePath);
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
  versionTag,
  publishedAt: new Date().toISOString(),
  sourceCommit,
  releaseNotes,
  editions
};

await writeFile(join(outDir, 'onlyus-update-metadata.json'), JSON.stringify(document, null, 2) + '\n', 'utf8');
console.log('Generated verified release metadata for ' + versionTag + ' after checking both APK package IDs, version names, and version codes.');
