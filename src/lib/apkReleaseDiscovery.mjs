/**
 * Stable-release ordering helpers for the APK updater.
 * These helpers are intentionally independent of React/native APIs so their
 * release-selection behavior can be covered by Node's built-in test runner.
 */

/**
 * @typedef {{
 *   tag_name?: string,
 *   draft?: boolean,
 *   prerelease?: boolean,
 *   published_at?: string,
 *   assets?: Array<{ name?: string, browser_download_url?: string }>
 * }} GithubReleaseCandidate
 */

const STABLE_VERSION_TAG = /^v?\d+\.\d+\.\d+$/i;

/** Compare stable semantic versions (including the v1.0.10 vs v1.0.9 case). */
export function compareVersions(a, b) {
  const parse = value => value.replace(/^v/i, '').split('.').map(part => Number.parseInt(part, 10));
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] || 0) - (right[i] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * GitHub's /releases/latest endpoint can point at a release that is not the
 * highest semantic version. Always sort the complete published release list.
 * @param {GithubReleaseCandidate[]} releases
 * @returns {GithubReleaseCandidate[]}
 */
export function sortStableReleases(releases) {
  return releases
    .filter(release =>
      !release.draft &&
      !release.prerelease &&
      typeof release.tag_name === 'string' &&
      STABLE_VERSION_TAG.test(release.tag_name)
    )
    .sort((a, b) => {
      const versionOrder = compareVersions(String(b.tag_name), String(a.tag_name));
      if (versionOrder !== 0) return versionOrder;
      return String(b.published_at || '').localeCompare(String(a.published_at || ''));
    });
}

/**
 * Return the release tag embedded in an official GitHub release asset URL.
 * This validates the release asset URLs referenced by either metadata schema.
 */
export function getReleaseTagFromDownloadUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== 'github.com' ||
      url.username ||
      url.password ||
      url.port
    ) return null;

    const match = url.pathname.match(/^\/RahulExe69\/OnlyUs69-Releases\/releases\/download\/(v?\d+\.\d+\.\d+)\/[^/]+$/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Parse the legacy metadata schema attached to the v1.0.x releases.
 *
 * The legacy file uses { version, releaseDate, releases[], changelog } rather
 * than schemaVersion/versionTag/editions/releaseNotes. The exact asset size is
 * taken from the GitHub Release API response, not the rounded sizeMB field.
 *
 * @param {any} manifest
 * @param {string} tagName
 * @param {string} packageId
 * @param {Array<{name?: string, browser_download_url?: string, size?: number}>} assets
 * @returns {null | {
 *   appName: string,
 *   versionName: string,
 *   versionCode: number,
 *   publishedAt: string,
 *   releaseNotes: Array<{title: string, items: string[]}>,
 *   packageId: string,
 *   assetName: string,
 *   downloadUrl: string,
 *   sha256: string,
 *   sizeBytes: number
 * }}
 */
export function parseLegacyReleaseMetadata(manifest, tagName, packageId, assets) {
  const version = String(manifest?.version || '');
  if (version !== tagName || !STABLE_VERSION_TAG.test(tagName)) return null;

  const release = Array.isArray(manifest?.releases)
    ? manifest.releases.find(item => item?.appId === packageId && item?.version === tagName)
    : null;
  if (!release) return null;

  const versionName = String(release.version).replace(/^v/i, '');
  const versionCode = Number(release.versionCode);
  const apkPath = String(release.apkPath || '');
  const pathMatch = apkPath.match(/^releases\/download\/(v?\d+\.\d+\.\d+)\/([^/]+)$/i);
  if (!pathMatch || pathMatch[1] !== tagName) return null;

  let assetName;
  try {
    assetName = decodeURIComponent(pathMatch[2]);
  } catch {
    return null;
  }
  const matchingAsset = assets.find(asset => asset?.name === assetName);
  const downloadUrl = String(matchingAsset?.browser_download_url || '');
  const sizeBytes = Number(matchingAsset?.size);
  const sha256 = String(release.sha256 || '').toLowerCase();

  const changelog = manifest?.changelog || {};
  const releaseNotes = [
    { title: 'New features', items: changelog.newFeatures },
    { title: 'Improvements', items: changelog.improvements },
    { title: 'Bug fixes', items: changelog.bugFixes },
    { title: 'Other updates', items: changelog.otherUpdates }
  ].map(section => ({
    title: section.title,
    items: Array.isArray(section.items)
      ? section.items.map(item => String(item).trim()).filter(Boolean)
      : []
  })).filter(section => section.items.length > 0);

  if (
    versionName !== tagName.replace(/^v/i, '') ||
    !Number.isSafeInteger(versionCode) ||
    versionCode < 1 ||
    !downloadUrl.startsWith('https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/') ||
    getReleaseTagFromDownloadUrl(downloadUrl) !== tagName ||
    !new URL(downloadUrl).pathname.endsWith('/' + encodeURIComponent(assetName)) ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    releaseNotes.length === 0
  ) return null;

  return {
    appName: packageId === 'com.onlyus.notes' ? 'Notes' : 'OnlyUs',
    versionName,
    versionCode,
    publishedAt: String(manifest.releaseDate || ''),
    releaseNotes,
    packageId,
    assetName,
    downloadUrl,
    sha256,
    sizeBytes
  };
}
