import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { getReleaseTagFromDownloadUrl, sortStableReleases } from '../lib/apkReleaseDiscovery.mjs';

const RELEASES_API = 'https://api.github.com/repos/RahulExe69/OnlyUs69-Releases/releases?per_page=100';
const LEGACY_MANIFEST_API = 'https://raw.githubusercontent.com/RahulExe69/OnlyUs69-Releases/main/latest.json';
const RELEASE_ASSET_PREFIX = 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/';

export type ApkUpdateStatus =
  | 'idle' | 'checking' | 'current' | 'available' | 'downloading'
  | 'installer' | 'permission' | 'ready' | 'error' | 'installed' | 'offline';

export interface ApkUpdateRelease {
  appName: string;
  versionName: string;
  versionCode: number;
  publishedAt: string;
  releaseNotes: Array<{ title: string; items: string[] }>;
  packageId: string;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
}

interface AppInfo { packageId: string; versionName: string; versionCode: number }
interface NativeProgress { status: string; progress?: number; downloadedBytes?: number; totalBytes?: number; error?: string }
interface UpdateStarted { started: boolean }
interface GitHubAsset { name?: string; browser_download_url?: string }
interface GitHubRelease { tag_name?: string; published_at?: string; draft?: boolean; prerelease?: boolean; assets?: GitHubAsset[] }
interface OnlyUsUpdaterPlugin {
  getAppInfo(): Promise<AppInfo>;
  closeApp(): Promise<void>;
  downloadAndInstallUpdate(options: {
    downloadUrl: string; expectedPackageId: string; expectedVersionName: string;
    expectedVersionCode: string; expectedSha256: string; expectedSizeBytes: string;
  }): Promise<UpdateStarted>;
  installPendingUpdate(): Promise<UpdateStarted>;
  addListener(eventName: 'progress', listenerFunc: (progress: NativeProgress) => void): Promise<PluginListenerHandle>;
}

const OnlyUsUpdater = registerPlugin<OnlyUsUpdaterPlugin>('OnlyUsUpdater');

function parseReleaseMetadata(manifest: any, tagName: string, packageId: string, allowMissingVersionTag = false): ApkUpdateRelease | null {
  const versionName = String(manifest?.versionName || tagName.replace(/^v/i, '')).trim().replace(/^v/i, '');
  const versionCode = Number(manifest?.versionCode);
  const edition = manifest?.editions?.[packageId];
  const notes = Array.isArray(manifest?.releaseNotes)
    ? manifest.releaseNotes.map((section: any) => ({
        title: String(section?.title || '').trim(),
        items: Array.isArray(section?.items) ? section.items.map((item: unknown) => String(item).trim()).filter(Boolean) : []
      })).filter((section: { title: string; items: string[] }) => section.title && section.items.length > 0)
    : [];
  const downloadUrl = String(edition?.downloadUrl || '');
  const sha256 = String(edition?.sha256 || '').toLowerCase();
  const sizeBytes = Number(edition?.sizeBytes);

  if (
    manifest?.schemaVersion !== 1 ||
    (allowMissingVersionTag
      ? Boolean(manifest?.versionTag && String(manifest.versionTag) !== tagName)
      : String(manifest?.versionTag || '') !== tagName) ||
    !/^\d+\.\d+\.\d+$/.test(versionName) ||
    versionName !== tagName.replace(/^v/i, '') ||
    !Number.isSafeInteger(versionCode) || versionCode < 1 ||
    !edition || edition.packageId !== packageId ||
    !downloadUrl.startsWith(RELEASE_ASSET_PREFIX) ||
    getReleaseTagFromDownloadUrl(downloadUrl) !== tagName ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 ||
    notes.length === 0
  ) return null;

  return {
    appName: String(manifest.appName || 'OnlyUs'),
    versionName,
    versionCode,
    publishedAt: String(manifest.publishedAt || ''),
    releaseNotes: notes,
    packageId,
    assetName: String(edition.assetName || ''),
    downloadUrl,
    sha256,
    sizeBytes
  };
}

async function fetchJson(url: string, signal: AbortSignal, accept = 'application/vnd.github+json') {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: accept },
    signal
  });
  if (!response.ok) throw new Error('GitHub returned HTTP ' + response.status + '.');
  return response.json();
}

async function parseLegacyLatestManifest(packageId: string, signal: AbortSignal): Promise<ApkUpdateRelease | null> {
  const manifest = await fetchJson(LEGACY_MANIFEST_API + '?t=' + Date.now(), signal, 'application/json');
  const edition = manifest?.editions?.[packageId];
  const tagName = getReleaseTagFromDownloadUrl(String(edition?.downloadUrl || ''));
  if (!tagName) return null;
  return parseReleaseMetadata(manifest, tagName, packageId, true);
}

async function findNewestValidRelease(packageId: string, signal: AbortSignal): Promise<ApkUpdateRelease | null> {
  let releases: GitHubRelease[];

  try {
    // Do not rely on /releases/latest: GitHub may designate an older release as
    // "latest" even when a higher semantic-version tag has already been published.
    releases = await fetchJson(RELEASES_API + '&t=' + Date.now(), signal) as GitHubRelease[];
  } catch (error) {
    if (signal.aborted) throw error;
    // The raw manifest is a fallback when the Releases API is unavailable/rate-limited.
    try {
      return await parseLegacyLatestManifest(packageId, signal);
    } catch (fallbackError) {
      if (signal.aborted) throw fallbackError;
      return null;
    }
  }

  const candidates = sortStableReleases(releases);
  let legacyManifestPromise: Promise<any> | null = null;

  for (const candidate of candidates) {
    if (signal.aborted) throw new Error('Update check cancelled.');
    const tag = String(candidate.tag_name);
    const metadataAsset = candidate.assets?.find(asset => asset?.name === 'onlyus-update-metadata.json');

    if (
      metadataAsset?.browser_download_url &&
      getReleaseTagFromDownloadUrl(metadataAsset.browser_download_url) === tag
    ) {
      try {
        const metadata = await fetchJson(
          metadataAsset.browser_download_url + '?t=' + Date.now(),
          signal,
          'application/json'
        );
        const parsed = parseReleaseMetadata(metadata, tag, packageId);
        if (parsed) return parsed;
      } catch (error) {
        if (signal.aborted) throw error;
        // Bad/missing metadata on one release must not hide an older valid one.
      }
    }

    // latest.json intentionally omits versionTag for backwards compatibility.
    // Use it only when its download URL identifies this exact release candidate,
    // never when it points at a deleted or different version.
    try {
      if (!legacyManifestPromise) {
        legacyManifestPromise = fetchJson(
          LEGACY_MANIFEST_API + '?t=' + Date.now(),
          signal,
          'application/json'
        );
      }
      const legacyManifest = await legacyManifestPromise;
      const legacyEdition = legacyManifest?.editions?.[packageId];
      const legacyTag = getReleaseTagFromDownloadUrl(String(legacyEdition?.downloadUrl || ''));
      if (legacyTag === tag) {
        const parsed = parseReleaseMetadata(legacyManifest, tag, packageId, true);
        if (parsed) return parsed;
      }
    } catch (error) {
      if (signal.aborted) throw error;
      // Continue scanning published releases if the legacy manifest is unavailable.
    }
  }

  return null;
}

export function useApkForceUpdate({ enabled }: { enabled: boolean }) {
  const [release, setRelease] = useState<ApkUpdateRelease | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState('1.0.0');
  const [status, setStatus] = useState<ApkUpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const checkInFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;
    let progressListener: PluginListenerHandle | null = null;
    let appStateListener: PluginListenerHandle | null = null;
    let activeController: AbortController | null = null;

    const checkForUpdate = async () => {
      if (cancelled || checkInFlight.current) return;
      checkInFlight.current = true;
      activeController = new AbortController();
      const controller = activeController;
      const timeout = window.setTimeout(() => controller.abort(), 30000);
      setStatus('checking');
      setErrorMessage('');

      try {
        const nativeInfo = await OnlyUsUpdater.getAppInfo();
        const packageId = String(nativeInfo.packageId || '');
        const installedCode = Number(nativeInfo.versionCode);
        const installedName = String(nativeInfo.versionName || '1.0.0').replace(/-(rahul|nusrat)$/i, '');
        if (!packageId || !Number.isSafeInteger(installedCode) || installedCode < 1) {
          throw new Error('Installed app version could not be read.');
        }
        if (cancelled) return;
        setCurrentVersionName(installedName);

        const nextRelease = await findNewestValidRelease(packageId, controller.signal);
        if (cancelled) return;
        if (!nextRelease) throw new Error('No valid published APK release metadata was found.');
        if (nextRelease.versionCode <= installedCode) {
          setRelease(null);
          setStatus('current');
          return;
        }
        setRelease(nextRelease);
        setStatus('available');
      } catch (error) {
        if (cancelled) return;
        setStatus('offline');
        setErrorMessage(error instanceof Error ? error.message : 'Update check unavailable.');
      } finally {
        window.clearTimeout(timeout);
        if (activeController === controller) activeController = null;
        checkInFlight.current = false;
      }
    };

    const onResume = () => { void checkForUpdate(); };
    const onOnline = () => { void checkForUpdate(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };

    const setup = async () => {
      try {
        progressListener = await OnlyUsUpdater.addListener('progress', event => {
          setProgress(Math.max(0, Math.min(100, Number(event.progress) || 0)));
          if (event.status === 'downloading') { setStatus('downloading'); setErrorMessage(''); }
          else if (event.status === 'installer') { setStatus('installer'); setErrorMessage(''); }
          else if (event.status === 'permission') { setStatus('permission'); setErrorMessage(event.error || ''); }
          else if (event.status === 'ready') { setStatus('ready'); setErrorMessage(event.error || 'The installer was closed before the update completed.'); }
          else if (event.status === 'installed') { setStatus('installed'); setErrorMessage(''); }
          else if (event.status === 'error') { setStatus('error'); setErrorMessage(event.error || 'The APK could not be downloaded or opened.'); }
        });
      } catch {
        // Update checks still work if progress events are unavailable.
      }
      if (cancelled) {
        if (progressListener) await progressListener.remove();
        return;
      }
      try {
        appStateListener = await App.addListener('appStateChange', state => {
          if (state.isActive) void checkForUpdate();
        });
      } catch {
        // Browser visibility and network events remain available.
      }
      void checkForUpdate();
    };

    void setup();
    const retryTimer = window.setInterval(() => { void checkForUpdate(); }, 15 * 60 * 1000);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      activeController?.abort();
      if (progressListener) void progressListener.remove();
      if (appStateListener) void appStateListener.remove();
      checkInFlight.current = false;
    };
  }, [enabled]);

  const closeApp = useCallback(() => {
    void OnlyUsUpdater.closeApp().catch(() => {});
  }, []);

  const startUpdate = useCallback(async () => {
    if (!release) return;
    setErrorMessage('');
    setProgress(0);
    setStatus('downloading');
    try {
      const result = await OnlyUsUpdater.downloadAndInstallUpdate({
        downloadUrl: release.downloadUrl,
        expectedPackageId: release.packageId,
        expectedVersionName: release.versionName,
        expectedVersionCode: String(release.versionCode),
        expectedSha256: release.sha256,
        expectedSizeBytes: String(release.sizeBytes)
      });
      if (!result.started) {
        setStatus('error');
        setErrorMessage('The APK update could not be started. Tap Try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('The APK update could not be started. Tap Try again.');
    }
  }, [release]);

  const retryUpdate = useCallback(async () => {
    try {
      const result = await OnlyUsUpdater.installPendingUpdate();
      if (result.started) {
        setStatus('installer');
        setErrorMessage('');
        return;
      }
    } catch {
      // No valid staged APK; retry the download below.
    }
    await startUpdate();
  }, [startUpdate]);

  return { release, currentVersionName, status, progress, errorMessage, startUpdate, retryUpdate, closeApp };
}
