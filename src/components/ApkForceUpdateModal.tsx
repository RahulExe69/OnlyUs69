import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Moon, Sun, X, NotebookPen } from 'lucide-react';
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
  release, currentVersionName, status, progress, errorMessage, onUpdate, onRetry, onClose
}: ApkForceUpdateModalProps) {
  const [isDark, setIsDark] = useState(false);
  const busy = status === 'downloading' || status === 'installer' || status === 'permission';
  const isNotesEdition = release.packageId === 'com.onlyus.notes';
  const appName = isNotesEdition ? 'Notes' : 'OnlyUs';
  const formattedDate = useMemo(() => {
    const date = release.publishedAt ? new Date(release.publishedAt) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Recently';
  }, [release.publishedAt]);
  const sizeLabel = (release.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const isDownloadError = status === 'error' || status === 'ready';
  const muted = isDark ? '#9aa0a6' : '#5f6368';
  const border = isDark ? '#303134' : '#e8eaed';

  const playIcon = (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 1.8 13 12 3.5 22.2a1.35 1.35 0 0 1-.45-1.05V2.85c0-.42.16-.78.45-1.05Z" fill="#4285F4" />
      <path d="m13 12 3.4-3.35 4.1 2.35c.72.41.72 1.17 0 1.58l-4.1 2.35L13 12Z" fill="#FBBC04" />
      <path d="m3.5 22.2 13-10.2 3.9 2.23c.46.27.46.72 0 .99L5.2 23.05a1.3 1.3 0 0 1-1.7-.85Z" fill="#34A853" />
      <path d="M3.5 1.8a1.3 1.3 0 0 1 1.7-.85l15.2 8.03c.46.27.46.72 0 .99L16.5 12 3.5 1.8Z" fill="#EA4335" />
    </svg>
  );

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="onlyus-force-update-title"
      className="fixed inset-0 z-[10000] flex h-[100dvh] flex-col overflow-hidden select-none"
      style={{
        background: isDark ? '#131314' : '#ffffff',
        color: isDark ? '#e8eaed' : '#202124',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <header className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between px-5 py-2">
        <div className="flex items-center gap-2">
          {playIcon}
          <span className="text-sm font-medium tracking-tight" style={{ color: muted }}>Google Play</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setIsDark(value => !value)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: muted }}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close app"
            className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: muted }}>
            <X size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-2">
        <h1 id="onlyus-force-update-title" className="mb-1 text-xl font-normal tracking-tight">
          Update available
        </h1>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: muted }}>
          To keep using this app, download the latest version.
        </p>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: isDark ? '#1e1f20' : isNotesEdition ? '#e8f0fe' : '#f1f3f4', color: isDark ? '#e8eaed' : '#202124' }}>
            {isNotesEdition
              ? <NotebookPen size={27} strokeWidth={1.7} aria-label="Notes app icon" />
              : <img src="/favicon.webp" alt="OnlyUs app icon" className="h-full w-full object-contain p-1" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-medium">{appName}</div>
            <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: muted }}>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] font-bold"
                style={{ borderColor: isDark ? '#e8eaed' : '#202124' }}>E</span>
              <span>Everyone</span><span aria-hidden="true">·</span><span>{sizeLabel}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl py-3"
          style={{ borderTop: '1px solid ' + border, borderBottom: '1px solid ' + border }}>
          <div>
            <div className="mb-1 text-xs" style={{ color: muted }}>Version</div>
            <div className="text-sm font-medium">v{release.versionName}</div>
            <div className="mt-1 text-[11px]" style={{ color: muted }}>Installed v{currentVersionName.replace(/-(rahul|nusrat)$/i, '')}</div>
          </div>
          <div>
            <div className="mb-1 text-xs" style={{ color: muted }}>Updated on</div>
            <div className="text-sm font-medium">{formattedDate}</div>
            <div className="mt-1 text-[11px]" style={{ color: muted }}>Version code {release.versionCode}</div>
          </div>
        </div>

        <section className="mb-3">
          <h2 className="mb-2 text-sm font-semibold">What’s new</h2>
          <div className="max-h-32 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {release.releaseNotes.map((section, sectionIndex) => (
              <div key={section.title + sectionIndex}>
                <h3 className="mb-1 text-xs font-semibold" style={{ color: isDark ? '#e8eaed' : '#202124' }}>{section.title}</h3>
                <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: isDark ? '#bdc1c6' : '#3c4043' }}>
                  {section.items.map((note, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: muted }} />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {busy && (
          <div className="mb-3 rounded-xl p-3" style={{ background: isDark ? '#1e1f20' : '#f8f9fa' }}>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span>{status === 'downloading' ? 'Downloading update…' : status === 'permission' ? 'Waiting for install permission…' : 'Open Android installer to finish'}</span>
              {status === 'downloading' && <span>{Math.round(progress)}%</span>}
            </div>
            {status === 'downloading' && (
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: isDark ? '#3c4043' : '#dadce0' }}>
                <div className="h-full rounded-full transition-[width]" style={{ width: Math.max(0, Math.min(100, progress)) + '%', background: isDark ? '#81c995' : '#01875f' }} />
              </div>
            )}
            <p className="mt-2 text-[11px]" style={{ color: muted }}>
              Android’s system installer will open to finish the update.
            </p>
          </div>
        )}

        {isDownloadError && (
          <div className="mb-3 flex items-start gap-2 rounded-xl p-3 text-xs"
            style={{ background: isDark ? '#3c2020' : '#fce8e6', color: isDark ? '#f28b82' : '#b3261e' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{errorMessage || 'The update did not finish. Please try again.'}</span>
          </div>
        )}
        {status === 'installed' && (
          <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: isDark ? '#81c995' : '#137333' }}>
            <CheckCircle2 size={16} /> Update installed. Reopen {appName} to continue.
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-md shrink-0 px-5 pb-3 pt-2">
        <button type="button"
          onClick={status === 'installed' ? onClose : isDownloadError || status === 'permission' ? onRetry : onUpdate}
          disabled={busy}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60"
          style={{ background: isDark ? '#00a878' : '#01875f', color: isDark ? '#062016' : '#ffffff' }}>
          <Download size={17} />
          {status === 'downloading' ? 'Downloading…' : status === 'installer' ? 'Installer opened' : status === 'installed' ? 'Close and reopen app' : isDownloadError || status === 'permission' ? 'Try again' : 'Update'}
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: muted }}>
          Android may ask you to allow installs from this app.
        </p>
      </footer>
    </div>
  );
}
