import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, getReleaseTagFromDownloadUrl, sortStableReleases } from '../src/lib/apkReleaseDiscovery.mjs';

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
