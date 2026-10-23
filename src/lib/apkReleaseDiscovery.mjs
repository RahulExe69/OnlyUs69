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
 * This is used to validate metadata from latest.json, which intentionally
 * omits versionTag for legacy compatibility.
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
