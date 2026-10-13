import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

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

interface NativeApkUpdateBridge {
  getPackageName: () => string;
  getInstalledVersionName: () => string;
  getInstalledVersionCode: () => number;
  closeApp: () => void;
  downloadAndInstallUpdate: (
    downloadUrl: string,
    expectedPackageId: string,
    expectedVersionName: string,
    expectedVersionCode: string,
    expectedSha256: string,
    expectedSizeBytes: string
  ) => boolean;
  installPendingUpdate?: () => boolean;
}

interface NativeProgress {
  status: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

declare global {
  interface Window {
    OnlyUsUpdate?: NativeApkUpdateBridge;
    __onlyUsApkUpdateProgress?: (progress: NativeProgress) => void;
  }
}

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

      try {
        // MainActivity injects this bridge early; retry briefly for WebView startup timing.
        // Failure to reach the bridge or release server deliberately fails open.
        let bridge = window.OnlyUsUpdate;
        for (let attempt = 0; !bridge && attempt < 10; attempt += 1) {
          await new Promise(resolve => window.setTimeout(resolve, 150));
          bridge = window.OnlyUsUpdate;
        }
        if (!bridge) throw new Error('Native update bridge is unavailable.');

        const packageId = String(bridge.getPackageName() || '');
        const installedCode = Number(bridge.getInstalledVersionCode());
        const installedName = String(bridge.getInstalledVersionName() || '1.0.0')
          .replace(/-(rahul|nusrat)$/i, '');
        if (!packageId || !Number.isSafeInteger(installedCode) || installedCode < 1) {
          throw new Error('Installed app version could not be read.');
        }
        if (cancelled) return;
        setCurrentVersionName(installedName);

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
        // No failed result is persisted: next app launch retries from scratch.
        setRelease(null);
        setStatus('offline');
        setErrorMessage(error instanceof Error ? error.message : 'Update check unavailable.');
      }
    };

    void checkForUpdate();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled]);

  useEffect(() => {
    window.__onlyUsApkUpdateProgress = (event: NativeProgress) => {
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
    };
    return () => {
      delete window.__onlyUsApkUpdateProgress;
    };
  }, []);

  const closeApp = useCallback(() => {
    try {
      if (window.OnlyUsUpdate?.closeApp) {
        window.OnlyUsUpdate.closeApp();
        return;
      }
    } catch {
      // Fall through to Capacitor's exit hook.
    }
    try {
      void CapApp.exitApp();
    } catch {
      // A browser preview has no native application to close.
    }
  }, []);

  const startUpdate = useCallback(() => {
    if (!release) return;
    const bridge = window.OnlyUsUpdate;
    if (!bridge) {
      setStatus('error');
      setErrorMessage('The native installer is unavailable. Please reopen the app and try again.');
      return;
    }
    setErrorMessage('');
    setProgress(0);
    setStatus('downloading');
    try {
      const started = bridge.downloadAndInstallUpdate(
        release.downloadUrl,
        release.packageId,
        release.versionName,
        String(release.versionCode),
        release.sha256,
        String(release.sizeBytes)
      );
      if (!started) {
        setStatus('error');
        setErrorMessage('The APK update could not be started. Tap Try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('The APK update could not be started. Tap Try again.');
    }
  }, [release]);

  const retryUpdate = useCallback(() => {
    try {
      if (window.OnlyUsUpdate?.installPendingUpdate?.()) {
        setStatus('installer');
        setErrorMessage('');
        return;
      }
    } catch {
      // If no verified staged APK exists, retry the download.
    }
    startUpdate();
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
