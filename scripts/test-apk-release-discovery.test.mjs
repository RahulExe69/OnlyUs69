import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, getReleaseTagFromDownloadUrl, parseLegacyReleaseMetadata, sortStableReleases } from '../src/lib/apkReleaseDiscovery.mjs';

test('chooses the highest semantic version even when the newest API item is older', () => {
  // /releases/latest may still point at 1.0.7 while the list contains 1.0.8.
  const sorted = sortStableReleases([
    { tag_name: 'v1.0.7', published_at: '2026-10-23T19:00:00Z' },
    { tag_name: 'v1.0.8', published_at: '2026-10-23T18:00:00Z' }
  ]);
  assert.equal(sorted[0].tag_name, 'v1.0.8');
});

test('uses numeric semantic ordering for multi-digit patch versions', () => {
  assert.ok(compareVersions('v1.0.10', 'v1.0.9') > 0);
  assert.deepEqual(
    sortStableReleases([{ tag_name: 'v1.0.9' }, { tag_name: 'v1.0.10' }]).map(item => item.tag_name),
    ['v1.0.10', 'v1.0.9']
  );
});

test('ignores drafts, prereleases, and non-semver release tags', () => {
  const sorted = sortStableReleases([
    { tag_name: 'v2.0.0-rc.1' },
    { tag_name: 'v1.0.10', draft: true },
    { tag_name: 'not-a-version' },
    { tag_name: 'v1.0.9', prerelease: true },
    { tag_name: 'v1.0.8' },
    { tag_name: 'v1.0.7' }
  ]);
  assert.deepEqual(sorted.map(item => item.tag_name), ['v1.0.8', 'v1.0.7']);
});

test('extracts only tags embedded in official release asset URLs', () => {
  assert.equal(
    getReleaseTagFromDownloadUrl('https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/OnlyUs.apk'),
    'v1.0.8'
  );
  assert.equal(
    getReleaseTagFromDownloadUrl('https://example.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/OnlyUs.apk'),
    null
  );
  assert.equal(
    getReleaseTagFromDownloadUrl('https://github.com/attacker/other/releases/download/v1.0.8/OnlyUs.apk'),
    null
  );
});

const legacyV108Manifest = {
  version: 'v1.0.8',
  releaseDate: '2026-10-23T19:48:55Z',
  releases: [
    {
      appId: 'com.onlyus.app',
      version: 'v1.0.8',
      versionCode: 1008,
      apkPath: 'releases/download/v1.0.8/OnlyUs-v1.0.8.apk',
      sizeMB: 4.75,
      sha256: '93ba47ec389974b59af569de2cce535f9d60d4ba27d7d50abbe884943cf2bfc1'
    },
    {
      appId: 'com.onlyus.notes',
      version: 'v1.0.8',
      versionCode: 1008,
      apkPath: 'releases/download/v1.0.8/Notes-v1.0.8.apk',
      sizeMB: 4.75,
      sha256: 'a696e85014c3a0a4a41751213142dde09b402d13f592762e4776b863607ce69d'
    }
  ],
  changelog: {
    newFeatures: ['Support pasting clipboard images and GIFs in chat'],
    improvements: ['Improve avatar cropping and profile syncing'],
    bugFixes: ['Fix Notes media picker lifecycle and camera media options'],
    otherUpdates: ['Compact APK update screen']
  }
};

const legacyV108Assets = [
  {
    name: 'OnlyUs-v1.0.8.apk',
    browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/OnlyUs-v1.0.8.apk',
    size: 4984553
  },
  {
    name: 'Notes-v1.0.8.apk',
    browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/Notes-v1.0.8.apk',
    size: 4980424
  }
];

test('parses the real legacy v1.0.8 attached metadata schema and exact asset size', () => {
  const parsed = parseLegacyReleaseMetadata(
    legacyV108Manifest,
    'v1.0.8',
    'com.onlyus.app',
    legacyV108Assets
  );
  assert.ok(parsed);
  assert.equal(parsed.versionName, '1.0.8');
  assert.equal(parsed.versionCode, 1008);
  assert.equal(parsed.packageId, 'com.onlyus.app');
  assert.equal(parsed.assetName, 'OnlyUs-v1.0.8.apk');
  assert.equal(parsed.downloadUrl, legacyV108Assets[0].browser_download_url);
  assert.equal(parsed.sizeBytes, 4984553);
  assert.equal(parsed.sha256, legacyV108Manifest.releases[0].sha256);
  assert.deepEqual(parsed.releaseNotes.map(section => section.title), [
    'New features',
    'Improvements',
    'Bug fixes',
    'Other updates'
  ]);
});

test('parses legacy metadata for Notes independently of the standard edition', () => {
  const parsed = parseLegacyReleaseMetadata(
    legacyV108Manifest,
    'v1.0.8',
    'com.onlyus.notes',
    legacyV108Assets
  );
  assert.ok(parsed);
  assert.equal(parsed.versionCode, 1008);
  assert.equal(parsed.packageId, 'com.onlyus.notes');
  assert.equal(parsed.assetName, 'Notes-v1.0.8.apk');
  assert.equal(parsed.sizeBytes, 4980424);
  assert.equal(parsed.sha256, legacyV108Manifest.releases[1].sha256);
});

test('rejects legacy metadata with a mismatched tag, missing asset, or unsafe version', () => {
  assert.equal(
    parseLegacyReleaseMetadata(legacyV108Manifest, 'v1.0.7', 'com.onlyus.app', legacyV108Assets),
    null
  );
  assert.equal(
    parseLegacyReleaseMetadata(legacyV108Manifest, 'v1.0.8', 'com.unknown.app', legacyV108Assets),
    null
  );
  assert.equal(
    parseLegacyReleaseMetadata(legacyV108Manifest, 'v1.0.8', 'com.onlyus.app', []),
    null
  );

  const altered = structuredClone(legacyV108Manifest);
  altered.releases[0].apkPath = 'releases/download/v1.0.7/OnlyUs-v1.0.8.apk';
  assert.equal(
    parseLegacyReleaseMetadata(altered, 'v1.0.8', 'com.onlyus.app', legacyV108Assets),
    null
  );
});
