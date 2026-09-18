import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Music, Volume2, AlertCircle } from 'lucide-react';
import { MediaAttachment, UserRole } from '../types';
import { getLocalMedia, saveLocalMedia, downloadAndCacheRemoteMedia } from '../lib/mediaStore';

interface VoiceNoteBubbleProps {
  media: MediaAttachment;
  isOwn: boolean;
  messageId?: string;
  senderRole?: UserRole;
  currentRole?: UserRole;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  timestampOverlay?: React.ReactNode;
  selectionActive?: boolean;
  onToggleSelect?: () => void;
}

// Fixed pseudo-random waveform bar heights (normalized 0.15 to 1.0)
const WAVEFORM_HEIGHTS = [
  0.3, 0.5, 0.8, 0.4, 0.9, 0.6, 0.75, 1.0, 0.7, 0.85,
  0.4, 0.6, 0.95, 0.7, 0.5, 0.8, 0.65, 0.9, 0.35, 0.6,
  0.8, 0.7, 0.45, 0.85, 0.6, 0.95, 0.75, 0.5, 0.7, 0.4
];

export const VoiceNoteBubble = React.memo<VoiceNoteBubbleProps>(function VoiceNoteBubble({
  media,
  isOwn,
  messageId,
  currentRole = 'owner',
  deliveryStatus,
  timestampOverlay,
  selectionActive = false,
  onToggleSelect,
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(media.url || null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(media.duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(!media.url);
  const [hasError, setHasError] = useState<boolean>(false);
  const [animTime, setAnimTime] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Smooth 60fps animation frame loop while audio is actively playing for fluid liquid ripples
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let start = performance.now();
    const updateLoop = (now: number) => {
      setAnimTime((now - start) * 0.001);
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    let isMounted = true;

    async function resolveAudio() {
      // 1. If direct data URL or blob URL is already provided
      if (media.url && (media.url.startsWith('data:') || media.url.startsWith('blob:'))) {
        if (isMounted) {
          setAudioUrl(media.url);
          setIsLoading(false);
          setHasError(false);
        }
        saveLocalMedia(media.id, media.url).catch(() => {});
        return;
      }

      // 2. Check local device IndexedDB first
      const cached = await getLocalMedia(media.id);
      if (isMounted && cached) {
        setAudioUrl(cached);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      // 3. If remote URL present, download and cache
      if (media.url && media.url.startsWith('http')) {
        const downloadedLocalUrl = await downloadAndCacheRemoteMedia(media.id, media.url);
        if (isMounted) {
          setAudioUrl(downloadedLocalUrl || media.url);
          setIsLoading(false);
          setHasError(false);
        }
        return;
      }

      if (media.url) {
        if (isMounted) {
          setAudioUrl(media.url);
          setIsLoading(false);
          setHasError(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(false);
        setHasError(true);
      }
    }

    resolveAudio();

    return () => {
      isMounted = false;
    };
  }, [media.id, media.url]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio play failed:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!duration || duration <= 0)) {
      if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    if (!waveformRef.current || !audioRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const fraction = clickX / rect.width;
    const effectiveDuration = duration > 0 ? duration : (audioRef.current.duration || 1);
    const targetTime = fraction * effectiveDuration;

    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const progressFraction = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <div className="w-full max-w-[280px] sm:max-w-[320px] py-1 select-none">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={() => setHasError(true)}
        />
      )}

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Play/Pause Button with Pulsing Acoustic Aura */}
        <div className="relative shrink-0">
          {isPlaying && (
            <div
              className={`absolute -inset-1 rounded-full pointer-events-none animate-ping opacity-35 ${
                isOwn ? 'bg-white' : 'bg-[var(--theme-accent)]'
              }`}
            />
          )}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoading || hasError}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 shadow-md shrink-0 cursor-pointer ${
              isOwn
                ? 'bg-white/25 hover:bg-white/35 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                : 'bg-[var(--theme-accent)] hover:opacity-90 text-white shadow-[0_0_12px_var(--theme-accent)]'
            }`}
            style={{
              touchAction: 'manipulation'
            }}
            aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : hasError ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Waveform and Timer Container */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Interactive Liquid Mercury / Neon Plasma Waveform */}
          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="h-8 flex items-center gap-[2px] sm:gap-[3px] cursor-pointer py-1.5 px-0.5 relative group"
            title="Tap to scrub voice note"
          >
            {WAVEFORM_HEIGHTS.map((heightFraction, index) => {
              const barFraction = index / WAVEFORM_HEIGHTS.length;
              const nextBarFraction = (index + 1) / WAVEFORM_HEIGHTS.length;
              const isPlayed = barFraction <= progressFraction;
              const isCurrentHead = progressFraction >= barFraction && progressFraction < nextBarFraction;

              // Dynamic liquid ripple factor during playback
              const wave = isPlaying
                ? Math.sin(index * 0.45 - animTime * 7) * 0.16 + Math.cos(index * 0.25 + animTime * 4) * 0.08
                : 0;
              const calculatedHeight = Math.max(16, Math.min(100, (heightFraction + wave * (isPlayed ? 1.0 : 0.45)) * 100));

              return (
                <div
                  key={index}
                  className="flex-1 min-w-[2px] max-w-[4px] h-full flex items-center justify-center relative"
                >
                  <div
                    className={`w-full rounded-full transition-all duration-75 ${
                      isPlayed
                        ? isOwn
                          ? 'bg-gradient-to-t from-white/90 via-white to-pink-100 shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                          : 'bg-gradient-to-t from-[var(--theme-accent)] via-pink-400 to-rose-300 shadow-[0_0_6px_var(--theme-accent)]'
                        : isOwn
                          ? 'bg-white/30 group-hover:bg-white/40'
                          : 'bg-[var(--theme-text)]/20 group-hover:bg-[var(--theme-text)]/30'
                    }`}
                    style={{
                      height: `${calculatedHeight}%`,
                    }}
                  />
                  {/* Glowing Playhead Bead at current playback head */}
                  {isCurrentHead && isPlaying && (
                    <div
                      className={`absolute w-2 h-2 rounded-full -top-1 pointer-events-none ${
                        isOwn
                          ? 'bg-white shadow-[0_0_10px_2px_#ffffff]'
                          : 'bg-white shadow-[0_0_12px_3px_var(--theme-accent)]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Time & Speed Controls Row */}
          <div className="flex items-center justify-between text-[11px] leading-tight mt-0.5 font-medium opacity-80">
            <div className="flex items-center gap-1.5 min-w-0">
              {media.fileName && !media.fileName.toLowerCase().startsWith('voice note') ? (
                <Music className="w-3 h-3 opacity-70 shrink-0 text-current" />
              ) : (
                <Mic className="w-3 h-3 opacity-70 shrink-0" />
              )}
              <span className="truncate">{isPlaying ? formatSeconds(currentTime) : (media.fileName && !media.fileName.toLowerCase().startsWith('voice note') ? media.fileName : formatSeconds(duration || currentTime))}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCycleSpeed}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all active:scale-95 ${
                  isOwn
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-[var(--theme-accent)]/15 hover:bg-[var(--theme-accent)]/25 text-[var(--theme-accent)]'
                }`}
                title="Change playback speed"
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>
        </div>
      </div>

      {timestampOverlay && (
        <div className="mt-1 flex justify-end">
          {timestampOverlay}
        </div>
      )}
    </div>
  );
});
