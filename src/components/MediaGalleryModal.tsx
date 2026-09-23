import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Film, 
  Mic, 
  Link2, 
  ExternalLink, 
  Copy, 
  Check, 
  Play, 
  Pause, 
  Clock, 
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  Flame,
  Archive
} from 'lucide-react';
import { Message, MediaAttachment, UserProfile, UserRole } from '../types';
import { hydrateMessageMedia, parseDate, getMillis } from '../lib/dateUtils';
import { getLocalMedia, downloadAndCacheRemoteMedia } from '../lib/mediaStore';
import { useOverlayBack } from '../lib/overlayManager';
import { supabase } from '../lib/supabase';
import { deleteFromCloudinary, extractAllCloudinaryIds, extractPublicIdFromUrl } from '../lib/cloudinary';
import { GlowEffect } from './ui/glow-effect';

export interface ExtractedMediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  caption?: string;
  duration?: number;
  public_id?: string;
  timestamp: any;
  senderRole: UserRole;
  messageId: string;
  deleted_from_media?: boolean;
  deleted_from_media_by?: UserRole;
  deleted_from_media_at?: any;
  media_deletion_consent?: { [role: string]: boolean };
}

export interface ExtractedLinkItem {
  id: string;
  url: string;
  domain: string;
  contextText: string;
  timestamp: any;
  senderRole: UserRole;
  messageId: string;
  deleted_from_media?: boolean;
  deleted_from_media_by?: UserRole;
  deleted_from_media_at?: any;
  media_deletion_consent?: { [role: string]: boolean };
}

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  myProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onViewMedia: (media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => void;
  onUpdateMessages?: (updatedMessages: Message[]) => void;
}

// Fixed pseudo-random waveform bar heights for audio notes
const WAVEFORM_HEIGHTS = [
  0.35, 0.55, 0.85, 0.45, 0.95, 0.65, 0.75, 1.0, 0.7, 0.85,
  0.4, 0.6, 0.95, 0.7, 0.55, 0.85, 0.65, 0.9, 0.35, 0.6,
  0.8, 0.7, 0.45, 0.85, 0.6, 0.95, 0.75, 0.5, 0.7, 0.4
];

/**
 * Audio Item Player Component with Waveform, Play/Pause, and Speed Toggle
 */
const AudioPlayerCard: React.FC<{
  item: ExtractedMediaItem;
  senderName: string;
  senderPhoto?: string;
  isMe: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
  isArchivedView?: boolean;
}> = React.memo(({ 
  item, 
  senderName, 
  senderPhoto, 
  isMe, 
  isSelectionMode, 
  isSelected, 
  onToggleSelect, 
  onLongPress,
  onRestore,
  onDeletePermanent,
  isArchivedView
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))
      ? item.url
      : null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAudio() {
      if (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))) {
        setResolvedUrl(item.url);
        return;
      }
      if (item.id) {
        const cached = await getLocalMedia(item.id);
        if (isMounted && cached) {
          setResolvedUrl(cached);
          return;
        }
        if (item.url && item.url.startsWith('http')) {
          const dl = await downloadAndCacheRemoteMedia(item.id, item.url);
          if (isMounted && dl) {
            setResolvedUrl(dl);
            return;
          }
        }
      }
      if (item.url && isMounted) {
        setResolvedUrl(item.url);
      }
    }
    loadAudio();
    return () => {
      isMounted = false;
    };
  }, [item.id, item.url]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !resolvedUrl) return;
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

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formattedDate = useMemo(() => {
    const d = parseDate(item.timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [item.timestamp]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleTouchStart = () => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      if (onLongPress) onLongPress();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch (_) {}
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      onClick={() => {
        if (isSelectionMode && onToggleSelect) {
          onToggleSelect();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      className={`p-3.5 rounded-2xl bg-[var(--theme-surface)]/90 border transition-all space-y-2.5 relative select-none ${
        isSelected
          ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/20 shadow-md'
          : 'border-[var(--theme-border)]/70 hover:border-[var(--theme-accent)]/40 shadow-xs'
      }`}
    >
      {resolvedUrl && (
        <audio
          ref={audioRef}
          src={resolvedUrl}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration) {
              setDuration(audioRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      {/* Header with sender, timestamp, and quick actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* Selection indicator if active */}
          {isSelectionMode && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect();
              }}
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                isSelected
                  ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-white shadow-xs'
                  : 'bg-[var(--theme-bg)] border-[var(--theme-border)] text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--theme-accent)] border border-[var(--theme-accent)]/30">
            {senderPhoto ? (
              <img src={senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              senderName[0] || 'U'
            )}
          </div>
          <span className="text-xs font-semibold text-[var(--theme-text)] truncate">
            {senderName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] font-medium">
            {isMe ? 'You' : 'Partner'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isArchivedView && (
            <div className="flex items-center gap-1">
              {onRestore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                  title="Restore to gallery"
                  className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeletePermanent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePermanent();
                  }}
                  title="Delete forever"
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-[var(--theme-text)]/50">
            <Clock className="w-3 h-3" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Player row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="relative h-7 flex items-center gap-[2.5px] px-1">
            {WAVEFORM_HEIGHTS.map((height, i) => {
              const barProgress = i / WAVEFORM_HEIGHTS.length;
              const isPassed = barProgress <= progress;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-150"
                  style={{
                    height: `${Math.max(18, height * 100)}%`,
                    backgroundColor: isPassed
                      ? 'var(--theme-accent)'
                      : 'color-mix(in srgb, var(--theme-border) 80%, transparent)',
                    transform: isPlaying && isPassed ? 'scaleY(1.15)' : 'scaleY(1)',
                  }}
                />
              );
            })}

            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--theme-text)]/60 px-0.5">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          className="px-2 py-1 rounded-lg bg-[var(--theme-surface)] border border-[var(--theme-border)]/80 text-[10px] font-bold text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 transition-colors shrink-0"
        >
          {playbackSpeed}x
        </button>
      </div>
    </div>
  );
});

/**
 * Photo/Video Thumbnail Cell with Long-Press & Multi-Select Checkmark
 */
const MediaGridCell: React.FC<{
  item: ExtractedMediaItem;
  onClick: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
  isArchivedView?: boolean;
}> = React.memo(({ 
  item, 
  onClick, 
  isSelectionMode, 
  isSelected, 
  onToggleSelect, 
  onLongPress,
  onRestore,
  onDeletePermanent,
  isArchivedView
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))
      ? item.url
      : null
  );
  const longPressTimerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadThumb() {
      if (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))) {
        setResolvedUrl(item.url);
        return;
      }
      if (item.id) {
        const cached = await getLocalMedia(item.id);
        if (isMounted && cached) {
          setResolvedUrl(cached);
          return;
        }
      }
      if (item.url && isMounted) {
        setResolvedUrl(item.url);
      }
    }
    loadThumb();
    return () => {
      isMounted = false;
    };
  }, [item.id, item.url]);

  const formatSeconds = (sec?: number) => {
    if (!sec || isNaN(sec)) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTouchStart = () => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      if (onLongPress) onLongPress();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch (_) {}
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        if (isSelectionMode) {
          if (onToggleSelect) onToggleSelect();
        } else {
          onClick();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      className={`group aspect-square rounded-xl overflow-hidden relative cursor-pointer bg-[var(--theme-bg)] border transition-all select-none ${
        isSelected
          ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)] shadow-md scale-[0.98]'
          : 'border-[var(--theme-border)]/50 shadow-2xs'
      }`}
    >
      {/* Top Right Checkmark Badge */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleSelect) onToggleSelect();
        }}
        className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-[var(--theme-accent)] text-white shadow-md scale-100 ring-2 ring-white/80'
            : isSelectionMode
            ? 'bg-black/45 border-2 border-white/80 text-transparent scale-100'
            : 'opacity-0 group-hover:opacity-100 bg-black/45 border-2 border-white/80 text-transparent'
        }`}
      >
        <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* Top Left Quick Action Badges in Archived View */}
      {isArchivedView && !isSelectionMode && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          {onRestore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              title="Restore to gallery"
              className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs text-emerald-400 flex items-center justify-center hover:bg-black/80 hover:scale-110 active:scale-95 transition-all shadow-xs"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.5]" />
            </button>
          )}
          {onDeletePermanent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePermanent();
              }}
              title="Delete permanently"
              className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs text-rose-400 flex items-center justify-center hover:bg-black/80 hover:scale-110 active:scale-95 transition-all shadow-xs"
            >
              <Trash2 className="w-3 h-3 stroke-[2.5]" />
            </button>
          )}
        </div>
      )}

      {resolvedUrl ? (
        item.type === 'video' ? (
          <div className="w-full h-full relative bg-black/90 flex items-center justify-center">
            <video
              src={resolvedUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </div>
            </div>
            {item.duration ? (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono font-medium text-white shadow-xs">
                {formatSeconds(item.duration)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="w-full h-full relative">
            <img
              src={resolvedUrl}
              alt={item.caption || 'Shared photo'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/75 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate font-medium">{item.caption}</p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--theme-text)]/30">
          {item.type === 'video' ? <Film className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
        </div>
      )}

      {isSelected && (
        <div className="absolute inset-0 bg-[var(--theme-accent)]/15 pointer-events-none" />
      )}
    </motion.div>
  );
});

/**
 * Shared Link Card Component with Multi-Select
 */
const LinkCard: React.FC<{
  item: ExtractedLinkItem;
  senderName: string;
  senderPhoto?: string;
  isMe: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onCopy: (text: string) => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
  isArchivedView?: boolean;
}> = React.memo(({ 
  item, 
  senderName, 
  senderPhoto, 
  isMe, 
  isSelectionMode, 
  isSelected, 
  onToggleSelect, 
  onLongPress, 
  onCopy,
  onRestore,
  onDeletePermanent,
  isArchivedView
}) => {
  const [copied, setCopied] = useState(false);
  const longPressTimerRef = useRef<any>(null);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = useMemo(() => {
    const d = parseDate(item.timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }, [item.timestamp]);

  const isInstagram = item.domain.includes('instagram.com');
  const isYoutube = item.domain.includes('youtube.com') || item.domain.includes('youtu.be');
  const isSpotify = item.domain.includes('spotify.com');

  const handleTouchStart = () => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      if (onLongPress) onLongPress();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch (_) {}
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      onClick={() => {
        if (isSelectionMode && onToggleSelect) {
          onToggleSelect();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      className={`p-3.5 rounded-2xl bg-[var(--theme-surface)]/90 border transition-all flex flex-col gap-2 relative select-none ${
        isSelected
          ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/20 shadow-md'
          : 'border-[var(--theme-border)]/70 hover:border-[var(--theme-accent)]/40 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {isSelectionMode && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect();
              }}
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                isSelected
                  ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-white shadow-xs'
                  : 'bg-[var(--theme-bg)] border-[var(--theme-border)] text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <div className="w-5 h-5 rounded-full overflow-hidden bg-[var(--theme-accent)]/15 shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--theme-accent)]">
            {senderPhoto ? (
              <img src={senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              senderName[0] || 'U'
            )}
          </div>
          <span className="text-[11px] font-semibold text-[var(--theme-text)] truncate">
            {senderName}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
            {isMe ? 'You' : 'Partner'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isArchivedView && (
            <div className="flex items-center gap-1">
              {onRestore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                  title="Restore to gallery"
                  className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeletePermanent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePermanent();
                  }}
                  title="Delete forever"
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <span className="text-[10px] text-[var(--theme-text)]/50">
            {formattedDate}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
          isInstagram
            ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white'
            : isYoutube
            ? 'bg-red-600 text-white'
            : isSpotify
            ? 'bg-[#1DB954] text-white'
            : 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'
        }`}>
          <Link2 className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (isSelectionMode) e.preventDefault();
            }}
            className="text-xs sm:text-sm font-semibold text-[var(--theme-accent)] hover:underline truncate block leading-snug"
          >
            {item.url}
          </a>
          {item.contextText && item.contextText !== item.url && (
            <p className="text-[11px] text-[var(--theme-text)]/70 line-clamp-2 mt-0.5">
              {item.contextText}
            </p>
          )}
          <span className="inline-block mt-1 text-[10px] font-mono text-[var(--theme-text)]/50">
            {item.domain}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy URL"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--theme-text)]/60 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--theme-text)]/60 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
});

/**
 * Main Media Gallery & Vault Modal
 */
export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  isOpen,
  onClose,
  messages,
  myProfile,
  partnerProfile,
  onViewMedia,
  onUpdateMessages,
}) => {
  useOverlayBack(isOpen, onClose, 'media-gallery-modal');

  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio' | 'links' | 'archived'>('photos');
  const [archivedSubFilter, setArchivedSubFilter] = useState<'all' | 'photos' | 'videos' | 'audio' | 'links'>('all');
  const [senderFilter, setSenderFilter] = useState<'all' | 'rahul' | 'nusrat'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Deletion Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'move_to_archived' | 'restore' | 'permanent_delete';
    targetIds: string[];
  }>({
    isOpen: false,
    type: 'move_to_archived',
    targetIds: []
  });

  const myRole = myProfile?.role || 'owner';
  const isOwner = myRole === 'owner';
  const partnerRole = isOwner ? 'partner' : 'owner';
  const partnerName = myProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul');
  const myName = myProfile?.display_name || (isOwner ? 'Rahul' : 'Nusrat');

  const rahulLabel = isOwner ? (myName.split(' ')[0] || 'Rahul') : (partnerName.split(' ')[0] || 'Rahul');
  const nusratLabel = isOwner ? (partnerName.split(' ')[0] || 'Nusrat') : (myName.split(' ')[0] || 'Nusrat');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleTabChange = (tab: 'photos' | 'videos' | 'audio' | 'links' | 'archived') => {
    setActiveTab(tab);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  // Extract all media items from messages (active + archived)
  const { photos, videos, audios, links, archivedItems } = useMemo(() => {
    const pList: ExtractedMediaItem[] = [];
    const vList: ExtractedMediaItem[] = [];
    const aList: ExtractedMediaItem[] = [];
    const lList: ExtractedLinkItem[] = [];
    const archList: (ExtractedMediaItem | ExtractedLinkItem)[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    messages.forEach((msg) => {
      // If permanently deleted or hidden for me, skip completely
      if (msg.deleted) return;
      if (myRole === 'owner' && msg.hidden_for_owner) return;
      if (myRole === 'partner' && msg.hidden_for_partner) return;

      const isArchived = Boolean(msg.deleted_from_media && !msg.deleted);
      const media = msg.media || hydrateMessageMedia(msg);

      // Photos & Videos extraction
      if (media?.mediaList && media.mediaList.length > 0) {
        media.mediaList.forEach((item) => {
          const u = item.url || item.thumbnailUrl;
          if (!u && !item.id) return;
          const itemIsArchived = isArchived || Boolean(item.deleted_from_media);
          const extracted: ExtractedMediaItem = {
            id: item.id || `${msg.id}_${Math.random().toString(36).substr(2, 9)}`,
            type: item.type || 'image',
            url: u || '',
            thumbnailUrl: item.thumbnailUrl,
            fileName: item.fileName,
            caption: item.caption || msg.text,
            duration: item.duration,
            public_id: item.public_id || (media as any).public_id,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
            deleted_from_media: itemIsArchived,
            deleted_from_media_by: item.deleted_from_media_by || msg.deleted_from_media_by,
            deleted_from_media_at: item.deleted_from_media_at || msg.deleted_from_media_at,
            media_deletion_consent: msg.media_deletion_consent || {},
          };

          if (itemIsArchived) {
            archList.push(extracted);
          } else {
            if (item.type === 'video') vList.push(extracted);
            else if (item.type === 'audio') aList.push(extracted);
            else pList.push(extracted);
          }
        });
      } else if (media) {
        const u = media.url || media.thumbnailUrl;
        if (u || media.id) {
          const extracted: ExtractedMediaItem = {
            id: media.id || msg.id,
            type: media.type || 'image',
            url: u || '',
            thumbnailUrl: media.thumbnailUrl,
            fileName: media.fileName,
            caption: media.caption || msg.text,
            duration: media.duration,
            public_id: media.public_id,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
            deleted_from_media: isArchived,
            deleted_from_media_by: msg.deleted_from_media_by,
            deleted_from_media_at: msg.deleted_from_media_at,
            media_deletion_consent: msg.media_deletion_consent || {},
          };

          if (isArchived) {
            archList.push(extracted);
          } else {
            if (media.type === 'video') vList.push(extracted);
            else if (media.type === 'audio') aList.push(extracted);
            else pList.push(extracted);
          }
        }
      }

      // Voice note attachments check in raw legacy format
      const rawAtt = (msg as any).attachment_url;
      if (typeof rawAtt === 'string' && rawAtt.trim()) {
        const isAudio = /^data:audio\//.test(rawAtt) || /\.(mp3|wav|ogg|m4a|aac|weba|webm)(?:\?|$)/i.test(rawAtt);
        const isVideo = !isAudio && (/^data:video\//.test(rawAtt) || /\.(mp4|mov|webm)(?:\?|$)/i.test(rawAtt));
        if (isAudio && !aList.some((x) => x.messageId === msg.id)) {
          const item: ExtractedMediaItem = {
            id: msg.id,
            type: 'audio',
            url: rawAtt,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
            deleted_from_media: isArchived,
            deleted_from_media_by: msg.deleted_from_media_by,
            deleted_from_media_at: msg.deleted_from_media_at,
            media_deletion_consent: msg.media_deletion_consent || {},
          };
          if (isArchived) archList.push(item);
          else aList.push(item);
        } else if (isVideo && !vList.some((x) => x.messageId === msg.id)) {
          const item: ExtractedMediaItem = {
            id: msg.id,
            type: 'video',
            url: rawAtt,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
            deleted_from_media: isArchived,
            deleted_from_media_by: msg.deleted_from_media_by,
            deleted_from_media_at: msg.deleted_from_media_at,
            media_deletion_consent: msg.media_deletion_consent || {},
          };
          if (isArchived) archList.push(item);
          else vList.push(item);
        }
      }

      // Extract shared web links from text
      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
            if (msg.permanently_deleted_links?.includes(url)) return;
            const isLinkArchived = isArchived || Boolean(msg.deleted_links_from_media?.includes(url));
            let domain = '';
            try {
              domain = new URL(url).hostname.replace('www.', '');
            } catch {
              domain = 'web';
            }
            const linkItem: ExtractedLinkItem = {
              id: `${msg.id}_${url}`,
              url,
              domain,
              contextText: msg.text,
              timestamp: msg.timestamp || msg.created_at,
              senderRole: msg.sender_role,
              messageId: msg.id,
              deleted_from_media: isLinkArchived,
              deleted_from_media_by: msg.deleted_from_media_by,
              deleted_from_media_at: msg.deleted_from_media_at,
              media_deletion_consent: msg.media_deletion_consent || {},
            };
            if (isLinkArchived) archList.push(linkItem);
            else lList.push(linkItem);
          });
        }
      }
    });

    const sortByTime = (a: { timestamp: any }, b: { timestamp: any }) => getMillis(b.timestamp) - getMillis(a.timestamp);
    pList.sort(sortByTime);
    vList.sort(sortByTime);
    aList.sort(sortByTime);
    lList.sort(sortByTime);
    archList.sort(sortByTime);

    return { photos: pList, videos: vList, audios: aList, links: lList, archivedItems: archList };
  }, [messages, myRole]);

  // Sender filtering helper
  const filterBySender = useCallback((item: { senderRole: UserRole }) => {
    if (senderFilter === 'all') return true;
    if (senderFilter === 'rahul') return item.senderRole === 'owner';
    if (senderFilter === 'nusrat') return item.senderRole === 'partner';
    return true;
  }, [senderFilter]);

  const filteredPhotos = useMemo(() => photos.filter(filterBySender), [photos, filterBySender]);
  const filteredVideos = useMemo(() => videos.filter(filterBySender), [videos, filterBySender]);
  const filteredAudios = useMemo(() => audios.filter(filterBySender), [audios, filterBySender]);
  const filteredLinks = useMemo(() => links.filter(filterBySender), [links, filterBySender]);

  const filteredArchivedItems = useMemo(() => {
    return archivedItems.filter((item) => {
      if (!filterBySender(item)) return false;
      if (archivedSubFilter === 'photos' && ('type' in item ? item.type !== 'image' : true)) return false;
      if (archivedSubFilter === 'videos' && ('type' in item ? item.type !== 'video' : true)) return false;
      if (archivedSubFilter === 'audio' && ('type' in item ? item.type !== 'audio' : true)) return false;
      if (archivedSubFilter === 'links' && !('domain' in item)) return false;
      return true;
    });
  }, [archivedItems, filterBySender, archivedSubFilter]);

  // Counts for sub-filters inside Archived tab
  const archivedPhotosCount = useMemo(() => archivedItems.filter((x) => 'type' in x && x.type === 'image').length, [archivedItems]);
  const archivedVideosCount = useMemo(() => archivedItems.filter((x) => 'type' in x && x.type === 'video').length, [archivedItems]);
  const archivedAudiosCount = useMemo(() => archivedItems.filter((x) => 'type' in x && x.type === 'audio').length, [archivedItems]);
  const archivedLinksCount = useMemo(() => archivedItems.filter((x) => 'domain' in x).length, [archivedItems]);

  const currentViewItems = useMemo(() => {
    if (activeTab === 'photos') return filteredPhotos;
    if (activeTab === 'videos') return filteredVideos;
    if (activeTab === 'audio') return filteredAudios;
    if (activeTab === 'links') return filteredLinks;
    if (activeTab === 'archived') return filteredArchivedItems;
    return [];
  }, [activeTab, filteredPhotos, filteredVideos, filteredAudios, filteredLinks, filteredArchivedItems]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      return next;
    });
  };

  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === currentViewItems.length) {
      setSelectedIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedIds(currentViewItems.map((x) => x.id));
      setIsSelectionMode(true);
    }
  };

  const handleOpenViewer = (item: ExtractedMediaItem, list: ExtractedMediaItem[]) => {
    if (isSelectionMode) return;
    const mediaAttachments: MediaAttachment[] = list.map((x) => ({
      id: x.id,
      type: x.type,
      url: x.url,
      thumbnailUrl: x.thumbnailUrl,
      fileName: x.fileName,
      caption: x.caption,
      duration: x.duration,
      public_id: x.public_id,
    }));
    const index = list.findIndex((x) => x.id === item.id);
    onViewMedia(mediaAttachments[index >= 0 ? index : 0], mediaAttachments, index >= 0 ? index : 0);
  };

  // Group selected item IDs by parent messageId and extract details
  const getSelectedItemsMap = (ids: string[]) => {
    const allItems = [...photos, ...videos, ...audios, ...links, ...archivedItems];
    const map = new Map<string, Array<ExtractedMediaItem | ExtractedLinkItem>>();
    ids.forEach((id) => {
      const it = allItems.find((x) => x.id === id);
      if (it) {
        const list = map.get(it.messageId) || [];
        list.push(it);
        map.set(it.messageId, list);
      }
    });
    return map;
  };

  // 1. Move to Archived (Granular: isolates individual media items & links without destroying parent messages)
  const handleMoveToArchived = async (ids: string[]) => {
    const selectedItemMap = getSelectedItemsMap(ids);
    if (selectedItemMap.size === 0) return;

    setIsProcessingAction(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedMessagesMap = new Map<string, Message>();

      for (const [msgId, itemsForMsg] of selectedItemMap.entries()) {
        const origMsg = messages.find((m) => m.id === msgId);
        if (!origMsg) continue;

        let nextMsg: Message = { ...origMsg };
        const linkItems = itemsForMsg.filter((x): x is ExtractedLinkItem => 'domain' in x);
        const mediaItems = itemsForMsg.filter((x): x is ExtractedMediaItem => !('domain' in x));

        // Archive selected links
        if (linkItems.length > 0) {
          const archivedUrls = linkItems.map((l) => l.url);
          const existingDeletedLinks = nextMsg.deleted_links_from_media || [];
          nextMsg.deleted_links_from_media = Array.from(new Set([...existingDeletedLinks, ...archivedUrls]));
        }

        // Archive selected media
        if (mediaItems.length > 0) {
          const selectedMediaIds = new Set(mediaItems.map((m) => m.id));

          if (Array.isArray(nextMsg.mediaList) && nextMsg.mediaList.length > 0) {
            const nextMediaList = nextMsg.mediaList.map((m) => {
              if (selectedMediaIds.has(m.id)) {
                return {
                  ...m,
                  deleted_from_media: true,
                  deleted_from_media_by: myRole,
                  deleted_from_media_at: nowIso,
                };
              }
              return m;
            });
            nextMsg.mediaList = nextMediaList;
            const allArchived = nextMediaList.every((m) => Boolean(m.deleted_from_media));
            if (allArchived) {
              nextMsg.deleted_from_media = true;
              nextMsg.deleted_from_media_by = myRole;
              nextMsg.deleted_from_media_at = nowIso;
            }
          } else {
            // Single media item or voice note
            nextMsg.deleted_from_media = true;
            nextMsg.deleted_from_media_by = myRole;
            nextMsg.deleted_from_media_at = nowIso;
          }
        }

        // Build updated attachment_url if mediaList was modified
        let nextAttachmentUrl: string | undefined = undefined;
        if (nextMsg.mediaList && nextMsg.mediaList.length > 0) {
          nextAttachmentUrl = JSON.stringify({
            ...(nextMsg.media || {}),
            mediaList: nextMsg.mediaList,
          });
        }

        // Persist to Supabase
        const updatePayload: any = {
          deleted_from_media: nextMsg.deleted_from_media ?? false,
          deleted_from_media_by: nextMsg.deleted_from_media_by ?? null,
          deleted_from_media_at: nextMsg.deleted_from_media_at ?? null,
          deleted_links_from_media: nextMsg.deleted_links_from_media ?? [],
        };
        if (nextAttachmentUrl !== undefined) {
          updatePayload.attachment_url = nextAttachmentUrl;
        }

        const { error: updateErr } = await supabase
          .from('messages')
          .update(updatePayload)
          .eq('id', msgId);

        if (updateErr) {
          console.error('[MediaGallery] Error archiving items in Supabase:', updateErr);
          throw updateErr;
        }

        updatedMessagesMap.set(msgId, nextMsg);
      }

      const updated = messages.map((m) => updatedMessagesMap.get(m.id) || m);
      onUpdateMessages?.(updated);

      showToast(`Archived ${ids.length} item${ids.length > 1 ? 's' : ''}`);
      setSelectedIds([]);
      setIsSelectionMode(false);
      setConfirmDialog({ isOpen: false, type: 'move_to_archived', targetIds: [] });
    } catch (err) {
      console.error('Error moving to archived:', err);
      showToast('Could not archive items');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 2. Restore from Archived to active gallery
  const handleRestoreItems = async (ids: string[]) => {
    const selectedItemMap = getSelectedItemsMap(ids);
    if (selectedItemMap.size === 0) return;

    setIsProcessingAction(true);
    try {
      const updatedMessagesMap = new Map<string, Message>();

      for (const [msgId, itemsForMsg] of selectedItemMap.entries()) {
        const origMsg = messages.find((m) => m.id === msgId);
        if (!origMsg) continue;

        let nextMsg: Message = { ...origMsg };
        const linkItems = itemsForMsg.filter((x): x is ExtractedLinkItem => 'domain' in x);
        const mediaItems = itemsForMsg.filter((x): x is ExtractedMediaItem => !('domain' in x));

        // Restore selected links
        if (linkItems.length > 0) {
          const restoredUrls = new Set(linkItems.map((l) => l.url));
          nextMsg.deleted_links_from_media = (nextMsg.deleted_links_from_media || []).filter(
            (u) => !restoredUrls.has(u)
          );
        }

        // Restore selected media
        if (mediaItems.length > 0) {
          const selectedMediaIds = new Set(mediaItems.map((m) => m.id));

          if (Array.isArray(nextMsg.mediaList) && nextMsg.mediaList.length > 0) {
            const nextMediaList = nextMsg.mediaList.map((m) => {
              if (selectedMediaIds.has(m.id)) {
                return {
                  ...m,
                  deleted_from_media: false,
                  deleted_from_media_by: undefined,
                  deleted_from_media_at: undefined,
                };
              }
              return m;
            });
            nextMsg.mediaList = nextMediaList;
          }
          nextMsg.deleted_from_media = false;
          nextMsg.deleted_from_media_by = undefined;
          nextMsg.deleted_from_media_at = undefined;
        }

        // Build updated attachment_url if mediaList was modified
        let nextAttachmentUrl: string | undefined = undefined;
        if (nextMsg.mediaList && nextMsg.mediaList.length > 0) {
          nextAttachmentUrl = JSON.stringify({
            ...(nextMsg.media || {}),
            mediaList: nextMsg.mediaList,
          });
        }

        // Persist to Supabase
        const updatePayload: any = {
          deleted_from_media: nextMsg.deleted_from_media ?? false,
          deleted_from_media_by: null,
          deleted_from_media_at: null,
          deleted_links_from_media: nextMsg.deleted_links_from_media ?? [],
        };
        if (nextAttachmentUrl !== undefined) {
          updatePayload.attachment_url = nextAttachmentUrl;
        }

        const { error: restoreErr } = await supabase
          .from('messages')
          .update(updatePayload)
          .eq('id', msgId);

        if (restoreErr) {
          console.error('[MediaGallery] Error restoring items in Supabase:', restoreErr);
          throw restoreErr;
        }

        updatedMessagesMap.set(msgId, nextMsg);
      }

      const updated = messages.map((m) => updatedMessagesMap.get(m.id) || m);
      onUpdateMessages?.(updated);

      showToast(`Restored ${ids.length} item${ids.length > 1 ? 's' : ''} to Gallery`);
      setSelectedIds([]);
      setIsSelectionMode(false);
      setConfirmDialog({ isOpen: false, type: 'restore', targetIds: [] });
    } catch (err) {
      console.error('Error restoring items:', err);
      showToast('Could not restore items');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 3. Permanent Deletion (Targeted Cloudinary destruction without wiping chat text or unrelated media)
  const handlePermanentDelete = async (ids: string[]) => {
    const selectedItemMap = getSelectedItemsMap(ids);
    if (selectedItemMap.size === 0) return;

    setIsProcessingAction(true);
    try {
      const nowIso = new Date().toISOString();
      // 1. Collect Cloudinary public IDs or asset URLs strictly for selected media items
      const publicIdsToPurge: string[] = [];
      for (const [, itemsForMsg] of selectedItemMap.entries()) {
        const mediaItems = itemsForMsg.filter((x): x is ExtractedMediaItem => !('domain' in x));
        for (const mItem of mediaItems) {
          if (mItem.public_id) {
            publicIdsToPurge.push(mItem.public_id);
          }
          if (mItem.url && mItem.url.includes('cloudinary.com')) {
            const extracted = extractPublicIdFromUrl(mItem.url);
            if (extracted) publicIdsToPurge.push(extracted);
            publicIdsToPurge.push(mItem.url);
          }
        }
      }

      if (publicIdsToPurge.length > 0) {
        await deleteFromCloudinary(Array.from(new Set(publicIdsToPurge)));
      }

      // 2. Perform targeted, safe message updates without collateral damage
      const updatedMessagesMap = new Map<string, Message>();

      for (const [msgId, itemsForMsg] of selectedItemMap.entries()) {
        const origMsg = messages.find((m) => m.id === msgId);
        if (!origMsg) continue;

        let nextMsg: Message = { ...origMsg };
        const linkItems = itemsForMsg.filter((x): x is ExtractedLinkItem => 'domain' in x);
        const mediaItems = itemsForMsg.filter((x): x is ExtractedMediaItem => !('domain' in x));

        // Handle Links permanent deletion
        if (linkItems.length > 0) {
          const purgedUrls = linkItems.map((l) => l.url);
          nextMsg.deleted_links_from_media = (nextMsg.deleted_links_from_media || []).filter(
            (u) => !purgedUrls.includes(u)
          );
          nextMsg.permanently_deleted_links = Array.from(
            new Set([...(nextMsg.permanently_deleted_links || []), ...purgedUrls])
          );

          // If the message text was exclusively this link URL and has no other media, safely delete message
          const trimmedText = (nextMsg.text || '').trim();
          const wasOnlyLink = purgedUrls.some((u) => trimmedText === u || trimmedText === u + '/');
          const hasOtherMedia = Boolean(
            nextMsg.media || (Array.isArray(nextMsg.mediaList) && nextMsg.mediaList.length > 0)
          );

          if (wasOnlyLink && !hasOtherMedia) {
            nextMsg.deleted = true;
            nextMsg.deletedBy = myRole;
            nextMsg.deleted_from_media = true;
            nextMsg.deleted_from_media_by = myRole;
            nextMsg.deleted_from_media_at = nowIso;
            nextMsg.text = '';
          }
        }

        // Handle Media permanent deletion
        if (mediaItems.length > 0) {
          const selectedMediaIds = new Set(mediaItems.map((m) => m.id));

          if (Array.isArray(nextMsg.mediaList) && nextMsg.mediaList.length > 0) {
            const remainingMedia = nextMsg.mediaList.filter((m) => !selectedMediaIds.has(m.id));
            nextMsg.mediaList = remainingMedia.length > 0 ? remainingMedia : undefined;

            if (remainingMedia.length === 0) {
              nextMsg.media = undefined;
              nextMsg.attachment_url = undefined;
              nextMsg.deleted_from_media = true;
              nextMsg.deleted_from_media_by = myRole;
              nextMsg.deleted_from_media_at = nowIso;
              nextMsg.deleted = true;
              nextMsg.deletedBy = myRole;
              nextMsg.text = '';
            }
          } else {
            // Single media or audio attachment
            nextMsg.media = undefined;
            nextMsg.mediaList = undefined;
            nextMsg.attachment_url = undefined;
            nextMsg.deleted_from_media = true;
            nextMsg.deleted_from_media_by = myRole;
            nextMsg.deleted_from_media_at = nowIso;
            nextMsg.deleted = true;
            nextMsg.deletedBy = myRole;
            nextMsg.text = '';
          }
        }

        // Build updated attachment_url if mediaList still has items
        let nextAttachmentUrl: string | null = null;
        if (nextMsg.mediaList && nextMsg.mediaList.length > 0) {
          nextAttachmentUrl = JSON.stringify({
            ...(nextMsg.media || {}),
            mediaList: nextMsg.mediaList,
          });
        }

        // Persist to Supabase
        const updatePayload: any = {
          text: nextMsg.text ?? '',
          attachment_url: nextAttachmentUrl,
          deleted: nextMsg.deleted ?? false,
          deletedBy: nextMsg.deletedBy ?? null,
          deleted_from_media: nextMsg.deleted_from_media ?? false,
          deleted_from_media_by: nextMsg.deleted_from_media_by ?? null,
          deleted_from_media_at: nextMsg.deleted_from_media_at ?? null,
          deleted_links_from_media: nextMsg.deleted_links_from_media ?? [],
          permanently_deleted_links: nextMsg.permanently_deleted_links ?? [],
        };

        if (nextMsg.deleted) {
          updatePayload.ciphertext = null;
          updatePayload.iv = null;
          updatePayload.attachment_url = null;
          updatePayload.text = '';
          updatePayload.reactions = {};
          updatePayload.gameInvite = null;
        }

        const { error: deleteErr } = await supabase
          .from('messages')
          .update(updatePayload)
          .eq('id', msgId);

        if (deleteErr) {
          console.error('[MediaGallery] Error permanently deleting items in Supabase:', deleteErr);
          throw deleteErr;
        }

        updatedMessagesMap.set(msgId, nextMsg);
      }

      const updated = messages.map((m) => updatedMessagesMap.get(m.id) || m);
      onUpdateMessages?.(updated);

      showToast(`Deleted ${ids.length} item${ids.length > 1 ? 's' : ''} permanently`);
      setSelectedIds([]);
      setIsSelectionMode(false);
      setConfirmDialog({ isOpen: false, type: 'permanent_delete', targetIds: [] });
    } catch (err) {
      console.error('Error during permanent deletion:', err);
      showToast('Error permanently deleting items');
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden animate-in fade-in duration-150">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[140] bg-[#1a1a1a]/95 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border)]/60 bg-[var(--theme-surface)]/95 backdrop-blur-md z-20">
        <div className="relative flex items-center justify-between gap-2 min-h-[36px]">
          {/* Top Left: Navigation */}
          <div className="flex items-center gap-1.5 shrink-0 z-10">
            {activeTab === 'archived' ? (
              <button
                type="button"
                onClick={() => handleTabChange('photos')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--theme-surface)] border border-[var(--theme-border)]/80 text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all cursor-pointer"
                title="Back to gallery"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                <span>Gallery</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all -ml-1 cursor-pointer shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}
          </div>

          {/* Center Title - Perfectly Centered */}
          <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none px-16 sm:px-24">
            <h1 className="text-base sm:text-lg font-bold text-[var(--theme-text)] leading-tight truncate text-center pointer-events-auto">
              {activeTab === 'archived' ? 'Archived Media' : 'Media Gallery'}
            </h1>
          </div>

          {/* Action Controls: Multi-select button, Recycle Bin Icon & Sender Filter */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
            {currentViewItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelectionMode
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'bg-[var(--theme-bg)] border border-[var(--theme-border)]/70 text-[var(--theme-text)]/80 hover:text-[var(--theme-text)]'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isSelectionMode ? 'Done' : 'Select'}</span>
              </button>
            )}

            {/* Recycle Bin Icon Button at top right (only in main gallery) */}
            {activeTab !== 'archived' && (
              <button
                type="button"
                onClick={() => handleTabChange('archived')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-[var(--theme-text)]/80 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Archived Media (Recycle Bin)"
                aria-label="Archived Media"
              >
                <Trash2 className="w-5 h-5 stroke-[2]" />
                {archivedItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-mono font-bold bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-xs">
                    {archivedItems.length}
                  </span>
                )}
              </button>
            )}

            {/* Sender Filter Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-[var(--theme-bg)]/90 p-1 rounded-xl border border-[var(--theme-border)]/60 shrink-0">
              <button
                type="button"
                onClick={() => setSenderFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                  senderFilter === 'all'
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)]'
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setSenderFilter(isOwner ? 'nusrat' : 'rahul')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                  senderFilter === (isOwner ? 'nusrat' : 'rahul')
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)]'
                }`}
              >
                {isOwner ? nusratLabel : rahulLabel}
              </button>

              <button
                type="button"
                onClick={() => setSenderFilter(isOwner ? 'rahul' : 'nusrat')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                  senderFilter === (isOwner ? 'rahul' : 'nusrat')
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)]'
                }`}
              >
                {isOwner ? rahulLabel : nusratLabel}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Multi-Select Action Bar */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 bg-[var(--theme-surface)] border-b border-[var(--theme-border)] px-4 py-2.5 flex items-center justify-between overflow-hidden shadow-xs z-20"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-[var(--theme-accent)] hover:underline cursor-pointer flex items-center gap-1.5"
              >
                {selectedIds.length === currentViewItems.length && currentViewItems.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Select All ({currentViewItems.length})</span>
                  </>
                )}
              </button>
              <span className="text-xs font-medium text-[var(--theme-text)]/60">
                {selectedIds.length} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'archived' ? (
                <>
                  <button
                    type="button"
                    disabled={selectedIds.length === 0 || isProcessingAction}
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        type: 'restore',
                        targetIds: selectedIds,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedIds.length === 0 || isProcessingAction}
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        type: 'permanent_delete',
                        targetIds: selectedIds,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Forever</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={selectedIds.length === 0 || isProcessingAction}
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      type: 'move_to_archived',
                      targetIds: selectedIds,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive ({selectedIds.length})</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-filters row when in Archived view */}
      {activeTab === 'archived' && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-2 border-b border-[var(--theme-border)]/40 bg-[var(--theme-surface)]/80">
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full max-w-lg mx-auto">
            {(['all', 'photos', 'videos', 'audio', 'links'] as const).map((sub) => {
              const count =
                sub === 'all'
                  ? archivedItems.length
                  : sub === 'photos'
                  ? archivedPhotosCount
                  : sub === 'videos'
                  ? archivedVideosCount
                  : sub === 'audio'
                  ? archivedAudiosCount
                  : archivedLinksCount;
              const label =
                sub === 'all'
                  ? 'All'
                  : sub === 'photos'
                  ? 'Photos'
                  : sub === 'videos'
                  ? 'Videos'
                  : sub === 'audio'
                  ? 'Audios'
                  : 'Links';
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setArchivedSubFilter(sub)}
                  className={`py-1.5 px-0.5 sm:px-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 text-center whitespace-nowrap min-w-0 ${
                    archivedSubFilter === sub
                      ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                      : 'bg-[var(--theme-bg)] border border-[var(--theme-border)]/60 text-[var(--theme-text)]/70 hover:text-[var(--theme-text)]'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <span className="text-[10px] font-mono opacity-80 font-normal shrink-0">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 max-w-4xl mx-auto w-full">
        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div>
            {filteredPhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {filteredPhotos.map((item) => (
                  <MediaGridCell
                    key={item.id}
                    item={item}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    onClick={() => handleOpenViewer(item, filteredPhotos)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No photos yet</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  Photos sent in OnlyUs chat will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIDEOS TAB */}
        {activeTab === 'videos' && (
          <div>
            {filteredVideos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredVideos.map((item) => (
                  <MediaGridCell
                    key={item.id}
                    item={item}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    onClick={() => handleOpenViewer(item, filteredVideos)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Film className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No videos yet</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  Videos shared in chat will be collected here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AUDIO TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-3 max-w-xl mx-auto">
            {filteredAudios.length > 0 ? (
              filteredAudios.map((item) => {
                const isMe = item.senderRole === myRole;
                const senderName = isMe ? myName : partnerName;
                const senderPhoto = isMe ? myProfile?.photo_url : partnerProfile?.photo_url;
                return (
                  <AudioPlayerCard
                    key={item.id}
                    item={item}
                    senderName={senderName}
                    senderPhoto={senderPhoto}
                    isMe={isMe}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                  />
                );
              })
            ) : (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Mic className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No audio notes</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  Voice notes sent in chat will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <div className="space-y-3 max-w-2xl mx-auto">
            {filteredLinks.length > 0 ? (
              filteredLinks.map((item) => {
                const isMe = item.senderRole === myRole;
                const senderName = isMe ? myName : partnerName;
                const senderPhoto = isMe ? myProfile?.photo_url : partnerProfile?.photo_url;
                return (
                  <LinkCard
                    key={item.id}
                    item={item}
                    senderName={senderName}
                    senderPhoto={senderPhoto}
                    isMe={isMe}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    onCopy={() => showToast('Link copied to clipboard!')}
                  />
                );
              })
            ) : (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Link2 className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No links shared</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  Shared web links and media links will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ARCHIVED TAB */}
        {activeTab === 'archived' && (
          <div>
            {filteredArchivedItems.length > 0 ? (
              <div className="space-y-4">
                {/* Media grid for photos/videos */}
                {filteredArchivedItems.some((x) => 'type' in x && (x.type === 'image' || x.type === 'video')) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {filteredArchivedItems
                      .filter((x): x is ExtractedMediaItem => 'type' in x && (x.type === 'image' || x.type === 'video'))
                      .map((item) => (
                        <MediaGridCell
                          key={item.id}
                          item={item}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedIds.includes(item.id)}
                          onToggleSelect={() => handleToggleSelect(item.id)}
                          onLongPress={() => handleLongPress(item.id)}
                          onClick={() => {
                            if (!isSelectionMode) {
                              const photoList = filteredArchivedItems.filter(
                                (x): x is ExtractedMediaItem => 'type' in x && (x.type === 'image' || x.type === 'video')
                              );
                              handleOpenViewer(item, photoList);
                            }
                          }}
                          isArchivedView
                          onRestore={() => {
                            setConfirmDialog({
                              isOpen: true,
                              type: 'restore',
                              targetIds: [item.id],
                            });
                          }}
                          onDeletePermanent={() => {
                            setConfirmDialog({
                              isOpen: true,
                              type: 'permanent_delete',
                              targetIds: [item.id],
                            });
                          }}
                        />
                      ))}
                  </div>
                )}

                {/* Audio notes list */}
                {filteredArchivedItems
                  .filter((x): x is ExtractedMediaItem => 'type' in x && x.type === 'audio')
                  .map((item) => {
                    const isMe = item.senderRole === myRole;
                    const senderName = isMe ? myName : partnerName;
                    const senderPhoto = isMe ? myProfile?.photo_url : partnerProfile?.photo_url;
                    return (
                      <AudioPlayerCard
                        key={item.id}
                        item={item}
                        senderName={senderName}
                        senderPhoto={senderPhoto}
                        isMe={isMe}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(item.id)}
                        onToggleSelect={() => handleToggleSelect(item.id)}
                        onLongPress={() => handleLongPress(item.id)}
                        isArchivedView
                        onRestore={() => {
                          setConfirmDialog({
                            isOpen: true,
                            type: 'restore',
                            targetIds: [item.id],
                          });
                        }}
                        onDeletePermanent={() => {
                          setConfirmDialog({
                            isOpen: true,
                            type: 'permanent_delete',
                            targetIds: [item.id],
                          });
                        }}
                      />
                    );
                  })}

                {/* Links list */}
                {filteredArchivedItems
                  .filter((x): x is ExtractedLinkItem => 'domain' in x)
                  .map((item) => {
                    const isMe = item.senderRole === myRole;
                    const senderName = isMe ? myName : partnerName;
                    const senderPhoto = isMe ? myProfile?.photo_url : partnerProfile?.photo_url;
                    return (
                      <LinkCard
                        key={item.id}
                        item={item}
                        senderName={senderName}
                        senderPhoto={senderPhoto}
                        isMe={isMe}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(item.id)}
                        onToggleSelect={() => handleToggleSelect(item.id)}
                        onLongPress={() => handleLongPress(item.id)}
                        onCopy={() => showToast('Link copied!')}
                        isArchivedView
                        onRestore={() => {
                          setConfirmDialog({
                            isOpen: true,
                            type: 'restore',
                            targetIds: [item.id],
                          });
                        }}
                        onDeletePermanent={() => {
                          setConfirmDialog({
                            isOpen: true,
                            type: 'permanent_delete',
                            targetIds: [item.id],
                          });
                        }}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <Archive className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">Archived is Empty</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  Media archived from the gallery will appear here. You can restore or permanently delete anytime.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      {activeTab !== 'archived' && (
        <nav className="flex-shrink-0 border-t border-[var(--theme-border)]/60 bg-[var(--theme-surface)]/95 backdrop-blur-md px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-20">
          <div className="max-w-md mx-auto grid grid-cols-4 gap-1.5">
            {/* Photos Option */}
            <div className="relative flex items-center justify-center">
              {activeTab === 'photos' && (
                <GlowEffect
                  theme={myProfile?.theme}
                  mode="colorShift"
                  blur="soft"
                  duration={4}
                  scale={1.12}
                  className="rounded-xl opacity-80 pointer-events-none"
                />
              )}
              <button
                type="button"
                onClick={() => handleTabChange('photos')}
                className={`relative z-10 w-full py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'photos'
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)]/60'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-[11px] leading-none">Photos</span>
                <span className={`text-[10px] font-mono leading-none ${activeTab === 'photos' ? 'text-white/80' : 'opacity-60'}`}>
                  ({photos.length})
                </span>
              </button>
            </div>

            {/* Videos Option */}
            <div className="relative flex items-center justify-center">
              {activeTab === 'videos' && (
                <GlowEffect
                  theme={myProfile?.theme}
                  mode="colorShift"
                  blur="soft"
                  duration={4}
                  scale={1.12}
                  className="rounded-xl opacity-80 pointer-events-none"
                />
              )}
              <button
                type="button"
                onClick={() => handleTabChange('videos')}
                className={`relative z-10 w-full py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'videos'
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)]/60'
                }`}
              >
                <Film className="w-4 h-4" />
                <span className="text-[11px] leading-none">Videos</span>
                <span className={`text-[10px] font-mono leading-none ${activeTab === 'videos' ? 'text-white/80' : 'opacity-60'}`}>
                  ({videos.length})
                </span>
              </button>
            </div>

            {/* Audio Option */}
            <div className="relative flex items-center justify-center">
              {activeTab === 'audio' && (
                <GlowEffect
                  theme={myProfile?.theme}
                  mode="colorShift"
                  blur="soft"
                  duration={4}
                  scale={1.12}
                  className="rounded-xl opacity-80 pointer-events-none"
                />
              )}
              <button
                type="button"
                onClick={() => handleTabChange('audio')}
                className={`relative z-10 w-full py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'audio'
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)]/60'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span className="text-[11px] leading-none">Audio</span>
                <span className={`text-[10px] font-mono leading-none ${activeTab === 'audio' ? 'text-white/80' : 'opacity-60'}`}>
                  ({audios.length})
                </span>
              </button>
            </div>

            {/* Links Option */}
            <div className="relative flex items-center justify-center">
              {activeTab === 'links' && (
                <GlowEffect
                  theme={myProfile?.theme}
                  mode="colorShift"
                  blur="soft"
                  duration={4}
                  scale={1.12}
                  className="rounded-xl opacity-80 pointer-events-none"
                />
              )}
              <button
                type="button"
                onClick={() => handleTabChange('links')}
                className={`relative z-10 w-full py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'links'
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'text-[var(--theme-text)]/65 hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)]/60'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span className="text-[11px] leading-none">Links</span>
                <span className={`text-[10px] font-mono leading-none ${activeTab === 'links' ? 'text-white/80' : 'opacity-60'}`}>
                  ({links.length})
                </span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-2xl p-5 space-y-4 select-none"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'permanent_delete'
                    ? 'bg-rose-500/15 text-rose-500'
                    : confirmDialog.type === 'restore'
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-amber-500/15 text-amber-500'
                }`}>
                  {confirmDialog.type === 'permanent_delete' ? (
                    <Flame className="w-5 h-5" />
                  ) : confirmDialog.type === 'restore' ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <Archive className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--theme-text)]">
                    {confirmDialog.type === 'permanent_delete'
                      ? 'Delete Forever?'
                      : confirmDialog.type === 'restore'
                      ? 'Restore Selected Media?'
                      : 'Move to Archived?'}
                  </h3>
                  <p className="text-xs text-[var(--theme-text)]/60">
                    {confirmDialog.targetIds.length} item{confirmDialog.targetIds.length > 1 ? 's' : ''} selected
                  </p>
                </div>
              </div>

              <div className="text-xs text-[var(--theme-text)]/80 leading-relaxed bg-[var(--theme-bg)]/80 p-3 rounded-2xl border border-[var(--theme-border)]/50">
                {confirmDialog.type === 'permanent_delete' ? (
                  <p>
                    This permanently deletes the selected files from <strong>Cloudinary server storage</strong> and your database.
                  </p>
                ) : confirmDialog.type === 'restore' ? (
                  <p>
                    Selected items will be restored to your active Photos, Videos, Audio, or Links gallery.
                  </p>
                ) : (
                  <p>
                    Items will be moved to <strong>Archived</strong>. They won&apos;t appear in the main gallery and will show as archived in chat.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => setConfirmDialog({ isOpen: false, type: 'move_to_archived', targetIds: [] })}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text)]/70 hover:bg-[var(--theme-bg)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => {
                    if (confirmDialog.type === 'permanent_delete') {
                      handlePermanentDelete(confirmDialog.targetIds);
                    } else if (confirmDialog.type === 'restore') {
                      handleRestoreItems(confirmDialog.targetIds);
                    } else {
                      handleMoveToArchived(confirmDialog.targetIds);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    confirmDialog.type === 'permanent_delete'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : confirmDialog.type === 'restore'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isProcessingAction ? (
                    <span>Processing...</span>
                  ) : (
                    <span>
                      {confirmDialog.type === 'permanent_delete'
                        ? 'Delete Forever'
                        : confirmDialog.type === 'restore'
                        ? 'Restore'
                        : 'Archive'}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
