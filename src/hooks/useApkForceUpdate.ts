import { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/RahulExe69/OnlyUs69-Releases/main/latest.json';

export type ApkUpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installer'
  | 'permission'
  | 'ready'
  | 'error'
  | 'installed'
  | 'offline';

export interface ApkUpdateRelease {
  appName: string;
  versionName: string;
  versionCode: number;
  publishedAt: string;
  releaseNotes: string[];
  packageId: string;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
}

interface AppInfo {
  packageId: string;
  versionName: string;
  versionCode: number;
}

interface NativeProgress {
  status: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

interface UpdateStarted {
  started: boolean;
}

interface OnlyUsUpdaterPlugin {
  getAppInfo(): Promise<AppInfo>;
  closeApp(): Promise<void>;
  downloadAndInstallUpdate(options: {
    downloadUrl: string;
    expectedPackageId: string;
    expectedVersionName: string;
    expectedVersionCode: string;
    expectedSha256: string;
    expectedSizeBytes: string;
  }): Promise<UpdateStarted>;
  installPendingUpdate(): Promise<UpdateStarted>;
  addListener(
    eventName: 'progress',
    listenerFunc: (progress: NativeProgress) => void
  ): Promise<PluginListenerHandle>;
}

const OnlyUsUpdater = registerPlugin<OnlyUsUpdaterPlugin>('OnlyUsUpdater');

export function useApkForceUpdate({ enabled }: { enabled: boolean }) {
  const [release, setRelease] = useState<ApkUpdateRelease | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState('1.0.0');
  const [status, setStatus] = useState<ApkUpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);

    const checkForUpdate = async () => {
      setStatus('checking');
      setErrorMessage('');
      let progressListener: PluginListenerHandle | null = null;

      try {
        const nativeInfo = await OnlyUsUpdater.getAppInfo();
        const packageId = String(nativeInfo.packageId || '');
        const installedCode = Number(nativeInfo.versionCode);
        const installedName = String(nativeInfo.versionName || '1.0.0')
          .replace(/-(rahul|nusrat)$/i, '');

        if (!packageId || !Number.isSafeInteger(installedCode) || installedCode < 1) {
          throw new Error('Installed app version could not be read.');
        }
        if (cancelled) return;
        setCurrentVersionName(installedName);

        // Listen before downloading; native events provide progress and installer state.
        progressListener = await OnlyUsUpdater.addListener('progress', event => {
          setProgress(Math.max(0, Math.min(100, Number(event.progress) || 0)));
          if (event.status === 'downloading') {
            setStatus('downloading');
            setErrorMessage('');
          } else if (event.status === 'installer') {
            setStatus('installer');
            setErrorMessage('');
          } else if (event.status === 'permission') {
            setStatus('permission');
            setErrorMessage(event.error || '');
          } else if (event.status === 'ready') {
            setStatus('ready');
            setErrorMessage(event.error || 'The installer was closed before the update completed.');
          } else if (event.status === 'installed') {
            setStatus('installed');
            setErrorMessage('');
          } else if (event.status === 'error') {
            setStatus('error');
            setErrorMessage(event.error || 'The APK could not be downloaded or opened.');
          }
        });
        if (cancelled) {
          await progressListener.remove();
          return;
        }

        const response = await fetch(UPDATE_MANIFEST_URL + '?t=' + Date.now(), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Update metadata returned HTTP ' + response.status + '.');

        const manifest = await response.json();
        const versionName = String(manifest?.versionName || '').trim().replace(/^v/i, '');
        const versionCode = Number(manifest?.versionCode);
        const packageAsset = manifest?.editions?.[packageId];
        const releaseNotes = Array.isArray(manifest?.releaseNotes)
          ? manifest.releaseNotes.map((line: unknown) => String(line).trim()).filter(Boolean)
          : [];

        if (
          manifest?.schemaVersion !== 1 ||
          !/^\d+\.\d+\.\d+$/.test(versionName) ||
          !Number.isSafeInteger(versionCode) ||
          versionCode < 1 ||
          !packageAsset ||
          packageAsset.packageId !== packageId ||
          !Array.isArray(manifest.releaseNotes) ||
          releaseNotes.length === 0
        ) {
          throw new Error('Update metadata is missing required fields.');
        }

        if (versionCode <= installedCode) {
          if (!cancelled) setStatus('current');
          return;
        }

        const downloadUrl = String(packageAsset.downloadUrl || '');
        const sha256 = String(packageAsset.sha256 || '').toLowerCase();
        const sizeBytes = Number(packageAsset.sizeBytes);
        if (
          !downloadUrl.startsWith('https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/') ||
          !/^[a-f0-9]{64}$/.test(sha256) ||
          !Number.isSafeInteger(sizeBytes) ||
          sizeBytes < 1
        ) {
          throw new Error('Release APK metadata is invalid.');
        }

        const nextRelease: ApkUpdateRelease = {
          appName: String(manifest.appName || 'OnlyUs'),
          versionName,
          versionCode,
          publishedAt: String(manifest.publishedAt || ''),
          releaseNotes,
          packageId,
          assetName: String(packageAsset.assetName || ''),
          downloadUrl,
          sha256,
          sizeBytes
        };
        if (!cancelled) {
          setRelease(nextRelease);
          setStatus('available');
        }
      } catch (error) {
        if (cancelled) return;
        // Fail open: nothing is cached; the next app run retries the check.
        setRelease(null);
        setStatus('offline');
        setErrorMessage(error instanceof Error ? error.message : 'Update check unavailable.');
      }

      return () => {
        void progressListener?.remove();
      };
    };

    let removeProgressListener: (() => void) | undefined;
    void checkForUpdate().then(cleanup => {
      removeProgressListener = cleanup;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
      removeProgressListener?.();
    };
  }, [enabled]);

  const closeApp = useCallback(() => {
    void OnlyUsUpdater.closeApp().catch(() => {
      // Web previews have no native Android app to close.
    });
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

  return {
    release,
    currentVersionName,
    status,
    progress,
    errorMessage,
    startUpdate,
    retryUpdate,
    closeApp
  };
}
