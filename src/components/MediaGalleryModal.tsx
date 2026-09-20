import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  Image as ImageIcon, 
  Film, 
  Mic, 
  Link2, 
  ExternalLink, 
  Copy, 
  Check, 
  Play, 
  Pause, 
  Calendar, 
  Clock, 
  Sparkles, 
  FolderHeart, 
  User, 
  Filter,
  Volume2
} from 'lucide-react';
import { Message, MediaAttachment, UserProfile, UserRole } from '../types';
import { hydrateMessageMedia, parseDate, getMillis } from '../lib/dateUtils';
import { getLocalMedia, downloadAndCacheRemoteMedia } from '../lib/mediaStore';
import { useOverlayBack } from '../lib/overlayManager';

export interface ExtractedMediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  caption?: string;
  duration?: number;
  timestamp: any;
  senderRole: UserRole;
  messageId: string;
}

export interface ExtractedLinkItem {
  id: string;
  url: string;
  domain: string;
  contextText: string;
  timestamp: any;
  senderRole: UserRole;
  messageId: string;
}

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  myProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onViewMedia: (media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => void;
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
}> = React.memo(({ item, senderName, senderPhoto, isMe }) => {
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

  const togglePlay = () => {
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

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--theme-surface)]/90 border border-[var(--theme-border)]/70 hover:border-[var(--theme-accent)]/40 shadow-xs transition-all space-y-2.5">
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

      {/* Header with sender and timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
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

        <div className="flex items-center gap-1 text-[11px] text-[var(--theme-text)]/50">
          <Clock className="w-3 h-3" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Player row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
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

        {/* Waveform & Scrubber */}
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

            {/* Hidden seek input over waveform */}
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

        {/* Speed toggle */}
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
 * Photo/Video Thumbnail Cell
 */
const MediaGridCell: React.FC<{
  item: ExtractedMediaItem;
  onClick: () => void;
}> = React.memo(({ item, onClick }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))
      ? item.url
      : null
  );

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

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group aspect-square rounded-xl overflow-hidden relative cursor-pointer bg-[var(--theme-bg)] border border-[var(--theme-border)]/50 shadow-2xs"
    >
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
            {/* Center Play Badge */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </div>
            </div>
            {/* Duration pill */}
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
    </motion.div>
  );
});

/**
 * Shared Link Card Component
 */
const LinkCard: React.FC<{
  item: ExtractedLinkItem;
  senderName: string;
  senderPhoto?: string;
  isMe: boolean;
  onCopy: (text: string) => void;
}> = React.memo(({ item, senderName, senderPhoto, isMe, onCopy }) => {
  const [copied, setCopied] = useState(false);

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

  // Platform badges
  const isInstagram = item.domain.includes('instagram.com');
  const isYoutube = item.domain.includes('youtube.com') || item.domain.includes('youtu.be');
  const isSpotify = item.domain.includes('spotify.com');

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--theme-surface)]/90 border border-[var(--theme-border)]/70 hover:border-[var(--theme-accent)]/40 shadow-xs transition-all flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
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

        <span className="text-[10px] text-[var(--theme-text)]/50">
          {formattedDate}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {/* Domain Icon Badge */}
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

        {/* Link Info */}
        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
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

        {/* Actions: Open & Copy */}
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
}) => {
  // Overlay management for hardware back / gesture support
  useOverlayBack(isOpen, onClose, 'media-gallery-modal');

  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio' | 'links'>('photos');
  const [searchQuery, setSearchQuery] = useState('');
  const [senderFilter, setSenderFilter] = useState<'all' | 'me' | 'partner'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const myRole = myProfile?.role || 'owner';
  const partnerName = myProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (myRole === 'owner' ? 'Nusrat' : 'Rahul');
  const myName = myProfile?.display_name || (myRole === 'owner' ? 'Rahul' : 'Nusrat');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Extract all media items from messages
  const { photos, videos, audios, links } = useMemo(() => {
    const pList: ExtractedMediaItem[] = [];
    const vList: ExtractedMediaItem[] = [];
    const aList: ExtractedMediaItem[] = [];
    const lList: ExtractedLinkItem[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    messages.forEach((msg) => {
      if (msg.deleted) return;
      if (myRole === 'owner' && msg.hidden_for_owner) return;
      if (myRole === 'partner' && msg.hidden_for_partner) return;

      const media = msg.media || hydrateMessageMedia(msg);

      // Photos & Videos extraction
      if (media?.mediaList && media.mediaList.length > 0) {
        media.mediaList.forEach((item) => {
          const u = item.url || item.thumbnailUrl;
          if (!u && !item.id) return;
          const extracted: ExtractedMediaItem = {
            id: item.id || `${msg.id}_${Math.random().toString(36).substr(2, 9)}`,
            type: item.type || 'image',
            url: u || '',
            thumbnailUrl: item.thumbnailUrl,
            fileName: item.fileName,
            caption: item.caption || msg.text,
            duration: item.duration,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
          };
          if (item.type === 'video') vList.push(extracted);
          else if (item.type === 'audio') aList.push(extracted);
          else pList.push(extracted);
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
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
          };
          if (media.type === 'video') vList.push(extracted);
          else if (media.type === 'audio') aList.push(extracted);
          else pList.push(extracted);
        }
      }

      // Voice note attachments check in raw legacy format
      const rawAtt = (msg as any).attachment_url;
      if (typeof rawAtt === 'string' && rawAtt.trim()) {
        const isAudio = /^data:audio\//.test(rawAtt) || /\.(mp3|wav|ogg|m4a|aac|weba|webm)(?:\?|$)/i.test(rawAtt);
        const isVideo = !isAudio && (/^data:video\//.test(rawAtt) || /\.(mp4|mov|webm)(?:\?|$)/i.test(rawAtt));
        if (isAudio && !aList.some((x) => x.messageId === msg.id)) {
          aList.push({
            id: msg.id,
            type: 'audio',
            url: rawAtt,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
          });
        } else if (isVideo && !vList.some((x) => x.messageId === msg.id)) {
          vList.push({
            id: msg.id,
            type: 'video',
            url: rawAtt,
            timestamp: msg.timestamp || msg.created_at,
            senderRole: msg.sender_role,
            messageId: msg.id,
          });
        }
      }

      // Extract shared web links from text
      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
            let domain = '';
            try {
              domain = new URL(url).hostname.replace('www.', '');
            } catch {
              domain = 'web';
            }
            lList.push({
              id: `${msg.id}_${url}`,
              url,
              domain,
              contextText: msg.text,
              timestamp: msg.timestamp || msg.created_at,
              senderRole: msg.sender_role,
              messageId: msg.id,
            });
          });
        }
      }
    });

    // Reverse chronological sort (newest first)
    const sortByTime = (a: { timestamp: any }, b: { timestamp: any }) => getMillis(b.timestamp) - getMillis(a.timestamp);
    pList.sort(sortByTime);
    vList.sort(sortByTime);
    aList.sort(sortByTime);
    lList.sort(sortByTime);

    return { photos: pList, videos: vList, audios: aList, links: lList };
  }, [messages, myRole]);

  // Sender filtering helper
  const filterBySender = useCallback((item: { senderRole: UserRole }) => {
    if (senderFilter === 'all') return true;
    if (senderFilter === 'me') return item.senderRole === myRole;
    return item.senderRole !== myRole;
  }, [senderFilter, myRole]);

  // Query filtering helper
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (!filterBySender(p)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (p.caption && p.caption.toLowerCase().includes(q)) ||
             (p.fileName && p.fileName.toLowerCase().includes(q));
    });
  }, [photos, filterBySender, searchQuery]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (!filterBySender(v)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (v.caption && v.caption.toLowerCase().includes(q)) ||
             (v.fileName && v.fileName.toLowerCase().includes(q));
    });
  }, [videos, filterBySender, searchQuery]);

  const filteredAudios = useMemo(() => {
    return audios.filter((a) => {
      if (!filterBySender(a)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sName = a.senderRole === myRole ? myName : partnerName;
      return sName.toLowerCase().includes(q);
    });
  }, [audios, filterBySender, searchQuery, myRole, myName, partnerName]);

  const filteredLinks = useMemo(() => {
    return links.filter((l) => {
      if (!filterBySender(l)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return l.url.toLowerCase().includes(q) ||
             l.contextText.toLowerCase().includes(q) ||
             l.domain.toLowerCase().includes(q);
    });
  }, [links, filterBySender, searchQuery]);

  // Open photo/video in FullscreenMediaViewer
  const handleOpenViewer = (item: ExtractedMediaItem, list: ExtractedMediaItem[]) => {
    const mediaAttachments: MediaAttachment[] = list.map((x) => ({
      id: x.id,
      type: x.type,
      url: x.url,
      thumbnailUrl: x.thumbnailUrl,
      fileName: x.fileName,
      caption: x.caption,
      duration: x.duration,
    }));
    const index = list.findIndex((x) => x.id === item.id);
    onViewMedia(mediaAttachments[index >= 0 ? index : 0], mediaAttachments, index >= 0 ? index : 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden animate-in fade-in duration-150">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a]/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 border-b border-[var(--theme-border)]/60 bg-[var(--theme-surface)]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all -ml-1 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[var(--theme-text)] leading-tight flex items-center gap-2">
              <span>Media & Memories</span>
              <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
            </h1>
            <p className="text-[11px] text-[var(--theme-text)]/60">
              {photos.length} photos • {videos.length} videos • {audios.length} audios • {links.length} links
            </p>
          </div>
        </div>

        {/* Sender Filter Toggle */}
        <div className="flex items-center gap-1 bg-[var(--theme-bg)]/80 p-1 rounded-xl border border-[var(--theme-border)]/60">
          <button
            type="button"
            onClick={() => setSenderFilter('all')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              senderFilter === 'all'
                ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSenderFilter('me')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              senderFilter === 'me'
                ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            You
          </button>
          <button
            type="button"
            onClick={() => setSenderFilter('partner')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              senderFilter === 'partner'
                ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            {partnerName.split(' ')[0]}
          </button>
        </div>
      </header>

      {/* Search & Tabs Row */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--theme-border)]/40 bg-[var(--theme-surface)]/80 space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--theme-text)]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/70 text-xs text-[var(--theme-text)] placeholder-[var(--theme-text)]/40 focus:outline-hidden focus:border-[var(--theme-accent)] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text)]/40 hover:text-[var(--theme-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 4 Clean Segmented Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/60">
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              activeTab === 'photos'
                ? 'bg-[var(--theme-surface)] text-[var(--theme-accent)] shadow-xs border border-[var(--theme-border)]/60'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos</span>
            <span className="text-[10px] font-mono opacity-70">({filteredPhotos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              activeTab === 'videos'
                ? 'bg-[var(--theme-surface)] text-[var(--theme-accent)] shadow-xs border border-[var(--theme-border)]/60'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Videos</span>
            <span className="text-[10px] font-mono opacity-70">({filteredVideos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              activeTab === 'audio'
                ? 'bg-[var(--theme-surface)] text-[var(--theme-accent)] shadow-xs border border-[var(--theme-border)]/60'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio</span>
            <span className="text-[10px] font-mono opacity-70">({filteredAudios.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              activeTab === 'links'
                ? 'bg-[var(--theme-surface)] text-[var(--theme-accent)] shadow-xs border border-[var(--theme-border)]/60'
                : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Links</span>
            <span className="text-[10px] font-mono opacity-70">({filteredLinks.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content Viewport */}
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
                    onClick={() => handleOpenViewer(item, filteredPhotos)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No photos found</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No photos matched your search term.'
                    : 'Photos sent in OnlyUs chat will be safely organized here.'}
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
                    onClick={() => handleOpenViewer(item, filteredVideos)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Film className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No videos found</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No videos matched your search term.'
                    : 'Videos recorded or shared in chat will be collected here.'}
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
                  />
                );
              })
            ) : (
              <div className="py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Mic className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No audio notes</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No audio notes matched your search query.'
                    : 'Voice messages sent in chat will appear here with full waveform playback.'}
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
                    onCopy={() => showToast('Link copied to clipboard!')}
                  />
                );
              })
            ) : (
              <div className="py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto mb-3">
                  <Link2 className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--theme-text)]">No links shared</h3>
                <p className="text-xs text-[var(--theme-text)]/60 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No web links matched your search term.'
                    : 'Links to Instagram, YouTube, Spotify, and web pages sent in chat will appear here.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
