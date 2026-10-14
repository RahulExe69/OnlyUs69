import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Moon, Sun, X } from 'lucide-react';
import type { ApkUpdateRelease, ApkUpdateStatus } from '../hooks/useApkForceUpdate';

interface ApkForceUpdateModalProps {
  release: ApkUpdateRelease;
  currentVersionName: string;
  status: ApkUpdateStatus;
  progress: number;
  errorMessage: string;
  onUpdate: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function ApkForceUpdateModal({
  release,
  currentVersionName,
  status,
  progress,
  errorMessage,
  onUpdate,
  onRetry,
  onClose
}: ApkForceUpdateModalProps) {
  const [isDark, setIsDark] = useState(false);
  const busy = status === 'downloading' || status === 'installer' || status === 'permission';
  const formattedDate = useMemo(() => {
    const date = release.publishedAt ? new Date(release.publishedAt) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Recently';
  }, [release.publishedAt]);
  const sizeLabel = (release.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const isDownloadError = status === 'error' || status === 'ready';

  const playIcon = (
    <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 1.8 13 12 3.5 22.2a1.35 1.35 0 0 1-.45-1.05V2.85c0-.42.16-.78.45-1.05Z" fill="#4285F4" />
      <path d="m13 12 3.4-3.35 4.1 2.35c.72.41.72 1.17 0 1.58l-4.1 2.35L13 12Z" fill="#FBBC04" />
      <path d="m3.5 22.2 13-10.2 3.9 2.23c.46.27.46.72 0 .99L5.2 23.05a1.3 1.3 0 0 1-1.7-.85Z" fill="#34A853" />
      <path d="M3.5 1.8a1.3 1.3 0 0 1 1.7-.85l15.2 8.03c.46.27.46.72 0 .99L16.5 12 3.5 1.8Z" fill="#EA4335" />
    </svg>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onlyus-force-update-title"
      className="fixed inset-0 z-[10000] flex flex-col overflow-y-auto select-none"
      style={{
        background: isDark ? '#131314' : '#ffffff',
        color: isDark ? '#e8eaed' : '#202124',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pb-3 pt-5">
        <div className="flex items-center gap-2">
          {playIcon}
          <span className="text-base font-medium tracking-tight" style={{ color: isDark ? '#e3e3e3' : '#5f6368' }}>
            Google Play
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsDark(value => !value)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close app"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}
          >
            <X size={21} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-8 pt-4">
        <h1 id="onlyus-force-update-title" className="mb-2 text-2xl font-normal tracking-tight">
          Update available
        </h1>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>
          To keep using this app, download the latest version.
        </p>

        <div className="mb-7 flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-1"
            style={{ background: isDark ? '#1e1f20' : '#f1f3f4' }}
          >
            <img src="/favicon.webp" alt="OnlyUs" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-medium">OnlyUs</div>
            <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] font-bold" style={{ borderColor: isDark ? '#e8eaed' : '#202124' }}>E</span>
              <span>Everyone</span>
              <span aria-hidden="true">·</span>
              <span>{sizeLabel}</span>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl py-4" style={{ borderTop: '1px solid ' + (isDark ? '#303134' : '#e8eaed'), borderBottom: '1px solid ' + (isDark ? '#303134' : '#e8eaed') }}>
          <div>
            <div className="mb-1 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>Version</div>
            <div className="text-sm font-medium">v{release.versionName}</div>
            <div className="mt-1 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>
              Installed v{currentVersionName.replace(/-(rahul|nusrat)$/i, '')}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>Updated on</div>
            <div className="text-sm font-medium">{formattedDate}</div>
            <div className="mt-1 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>Version code {release.versionCode}</div>
          </div>
        </div>

        <section className="mb-7">
          <h2 className="mb-3 text-base font-medium">What’s new</h2>
          <div className="space-y-5">
            {release.releaseNotes.map((section, sectionIndex) => (
              <div key={section.title + sectionIndex}>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: isDark ? '#e8eaed' : '#202124' }}>{section.title}</h3>
                <ul className="space-y-2 text-sm leading-relaxed" style={{ color: isDark ? '#bdc1c6' : '#3c4043' }}>
                  {section.items.map((note, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: isDark ? '#9aa0a6' : '#5f6368' }} />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {busy && (
          <div className="mb-5 rounded-2xl p-4" style={{ background: isDark ? '#1e1f20' : '#f8f9fa' }}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span>
                {status === 'downloading' ? 'Downloading update…' : status === 'permission' ? 'Waiting for install permission…' : 'Open Android installer to finish'}
              </span>
              {status === 'downloading' && <span>{Math.round(progress)}%</span>}
            </div>
            {status === 'downloading' && (
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: isDark ? '#3c4043' : '#dadce0' }}>
                <div className="h-full rounded-full transition-[width]" style={{ width: Math.max(0, Math.min(100, progress)) + '%', background: isDark ? '#81c995' : '#01875f' }} />
              </div>
            )}
            <p className="mt-2 text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>
              The update will open Android’s system installer. You can cancel the installation there, then retry here.
            </p>
          </div>
        )}

        {isDownloadError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: isDark ? '#3c2020' : '#fce8e6', color: isDark ? '#f28b82' : '#b3261e' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{errorMessage || 'The update did not finish. Please try again.'}</span>
          </div>
        )}

        {status === 'installed' && (
          <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: isDark ? '#81c995' : '#137333' }}>
            <CheckCircle2 size={18} /> Update installed. Reopen OnlyUs to continue.
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-md px-6 pb-6 pt-2">
        <button
          type="button"
          onClick={status === 'installed' ? onClose : isDownloadError || status === 'permission' ? onRetry : onUpdate}
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60"
          style={{ background: isDark ? '#00a878' : '#01875f', color: isDark ? '#062016' : '#ffffff' }}
        >
          <Download size={18} />
          {status === 'downloading' ? 'Downloading…' : status === 'installer' ? 'Installer opened' : status === 'installed' ? 'Close and reopen app' : isDownloadError || status === 'permission' ? 'Try again' : 'Update'}
        </button>
        <p className="mt-3 text-center text-xs" style={{ color: isDark ? '#9aa0a6' : '#5f6368' }}>
          Android may ask you to allow installs from this app.
        </p>
      </footer>
    </div>
  );
}
