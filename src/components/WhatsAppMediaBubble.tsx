import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Eye, Maximize2, AlertCircle, FileVideo, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { MediaAttachment, UserRole } from '../types';
import { getLocalMedia, saveLocalMedia, formatFileSize, downloadAndCacheRemoteMedia, requestPeerMediaRestore } from '../lib/mediaStore';
import { supabase } from '../lib/supabase';
import { VoiceNoteBubble } from './VoiceNoteBubble';

interface WhatsAppMediaBubbleProps {
  media: MediaAttachment;
  mediaList?: MediaAttachment[];
  isOwn: boolean;
  onOpenViewer: (media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => void;
  deleted?: boolean;
  messageId?: string;
  senderRole?: UserRole;
  currentRole?: UserRole;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  timestampOverlay?: React.ReactNode;
  selectionActive?: boolean;
  onToggleSelect?: () => void;
}

export const WhatsAppMediaBubble = React.memo<WhatsAppMediaBubbleProps>(function WhatsAppMediaBubble({
  media,
  mediaList,
  isOwn,
  onOpenViewer,
  deleted,
  messageId,
  senderRole,
  currentRole = 'owner',
  deliveryStatus,
  timestampOverlay,
  selectionActive = false,
  onToggleSelect
}) {
  const items = (mediaList && mediaList.length > 0) 
    ? mediaList 
    : ((media?.mediaList && media.mediaList.length > 0) ? media.mediaList : [media]);
  const isCollage = items.length > 1;

  if (deleted) return null;

  if (media?.type === 'audio') {
    return (
      <VoiceNoteBubble
        media={media}
        isOwn={isOwn}
        messageId={messageId}
        senderRole={senderRole}
        currentRole={currentRole}
        deliveryStatus={deliveryStatus}
        timestampOverlay={timestampOverlay}
        selectionActive={selectionActive}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  if (isCollage) {
    return (
      <CollageMediaBubble
        items={items}
        isOwn={isOwn}
        onOpenViewer={onOpenViewer}
        messageId={messageId}
        currentRole={currentRole}
        deliveryStatus={deliveryStatus}
        timestampOverlay={timestampOverlay}
        selectionActive={selectionActive}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  return (
    <SingleMediaBubble
      media={media}
      isOwn={isOwn}
      onOpenViewer={(m) => onOpenViewer(m, [m], 0)}
      messageId={messageId}
      currentRole={currentRole}
      deliveryStatus={deliveryStatus}
      timestampOverlay={timestampOverlay}
      selectionActive={selectionActive}
      onToggleSelect={onToggleSelect}
    />
  );
});

// -------------------------------------------------------------
// Single Media Item (WhatsApp Uniform Aspect Ratio & Layout)
// -------------------------------------------------------------
const SingleMediaBubble: React.FC<{
  media: MediaAttachment;
  isOwn: boolean;
  onOpenViewer: (media: MediaAttachment) => void;
  messageId?: string;
  currentRole: UserRole;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  timestampOverlay?: React.ReactNode;
  selectionActive?: boolean;
  onToggleSelect?: () => void;
}> = ({ media, isOwn, onOpenViewer, messageId, currentRole, deliveryStatus, timestampOverlay, selectionActive, onToggleSelect }) => {
  const [localUrl, setLocalUrl] = useState<string | null>(media.url || media.thumbnailUrl || null);
  const [isLoading, setIsLoading] = useState<boolean>(!media.url && !media.thumbnailUrl);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isRequestingRestore, setIsRequestingRestore] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveMedia() {
      // 1. If direct data URL or blob URL is already provided, use it and cache to IndexedDB
      if (media.url && (media.url.startsWith('data:') || media.url.startsWith('blob:'))) {
        if (isMounted) {
          setLocalUrl(media.url);
          setIsLoading(false);
          setHasError(false);
        }
        saveLocalMedia(media.id, media.url).catch(() => {});
        return;
      }

      // 2. Check local device IndexedDB first
      const cached = await getLocalMedia(media.id);
      if (isMounted && cached) {
        setLocalUrl(cached);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      // 3. If not in local IndexedDB but remote HTTP URL is present -> download & cache
      if (media.url && media.url.startsWith('http')) {
        const downloadedLocalUrl = await downloadAndCacheRemoteMedia(media.id, media.url);
        if (isMounted) {
          setLocalUrl(downloadedLocalUrl || media.url);
          setIsLoading(false);
          setHasError(false);
        }
        return;
      }

      if (media.url) {
        if (isMounted) {
          setLocalUrl(media.url);
          setIsLoading(false);
          setHasError(false);
        }
        return;
      }

      // 4. Fallback to thumbnail URL if available
      if (media.thumbnailUrl) {
        if (isMounted) {
          setLocalUrl(media.thumbnailUrl);
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

    resolveMedia();

    // Listen for peer sync events if this media gets restored by partner
    const handlePeerRestored = (e: any) => {
      const { mediaId, localUrl: restoredLocalUrl } = e.detail || {};
      if (mediaId === media.id && isMounted) {
        setLocalUrl(restoredLocalUrl);
        setIsRequestingRestore(false);
        setHasError(false);
      }
    };

    window.addEventListener(`onlyus_media_synced_${media.id}`, handlePeerRestored);

    return () => {
      isMounted = false;
      window.removeEventListener(`onlyus_media_synced_${media.id}`, handlePeerRestored);
    };
  }, [media.id, media.url, media.thumbnailUrl]);

  const handleRequestRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    setIsRequestingRestore(true);
    await requestPeerMediaRestore(supabase, media.id, messageId, currentRole);
    setTimeout(() => {
      setIsRequestingRestore(false);
    }, 15000);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleQuickSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    const targetUrl = localUrl || media.url;
    if (!targetUrl) return;
    try {
      const res = await fetch(targetUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = media.fileName || `OnlyUs_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = media.fileName || `OnlyUs_${Date.now()}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (selectionActive) {
          e.stopPropagation();
          onToggleSelect?.();
          return;
        }
        onOpenViewer(media);
      }}
      className="relative rounded-[16px] overflow-hidden cursor-pointer group select-none w-[260px] sm:w-[300px] h-[210px] sm:h-[240px] bg-black/15 shadow-sm transition-transform active:scale-[0.99]"
    >
      {/* Thumbnail or Blurred placeholder */}
      {media.thumbnailUrl && !localUrl && (
        <img 
          src={media.thumbnailUrl} 
          alt="Preview" 
          className="w-full h-full object-cover filter blur-md scale-105"
        />
      )}

      {/* Actual Media Container */}
      {media.type === 'image' ? (
        (localUrl || media.url || media.thumbnailUrl) ? (
          <img 
            src={localUrl || media.url || media.thumbnailUrl} 
            alt={media.fileName || 'Shared photo'} 
            className="w-full h-full object-cover group-hover:brightness-95 transition-all duration-200"
            loading="lazy"
            onError={() => {
              if (!localUrl && !media.url && !media.thumbnailUrl) {
                setHasError(true);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 text-white p-4">
            <ImageIcon className="w-8 h-8 opacity-60 mb-2" />
            <span className="text-xs font-semibold opacity-80">Photo</span>
          </div>
        )
      ) : (
        /* Video Media */
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          {(localUrl || media.url) ? (
            <video 
              ref={videoRef}
              src={localUrl || media.url}
              className="w-full h-full object-cover"
              playsInline
              muted={isMuted}
              loop
              onEnded={() => setIsPlaying(false)}
              onError={() => {
                if (!localUrl && !media.url) {
                  setHasError(true);
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/70">
              <FileVideo className="w-8 h-8 opacity-60 mb-1" />
              <span className="text-xs font-bold">Video</span>
            </div>
          )}

          {/* Video Controls overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex flex-col justify-between p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                <FileVideo className="w-3 h-3" />
                {media.duration ? `${Math.round(media.duration)}s` : 'Video'}
              </span>
              {isPlaying && (
                <button 
                  onClick={toggleMute}
                  className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {!isPlaying && (
              <button 
                onClick={togglePlay}
                className="self-center w-12 h-12 rounded-full bg-white/30 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg border border-white/40"
              >
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </button>
            )}

            <div className="flex items-center justify-between text-[10px] text-white/80 font-medium">
              {media.fileSize ? <span>{formatFileSize(media.fileSize)}</span> : <span />}
              <span className="opacity-70 group-hover:opacity-100 flex items-center gap-0.5">
                <Maximize2 className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Live Circular Upload Indicator */}
      {deliveryStatus === 'sending' && (
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center z-30 pointer-events-none transition-all">
          <div className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
            <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        </div>
      )}

      {/* Top right quick save icon on hover */}
      <button 
        onClick={handleQuickSave}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white p-1.5 rounded-full z-20 active:scale-90"
        title="Download / Save"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>

      {/* WhatsApp-style Floating Timestamp Overlay */}
      {timestampOverlay && (
        <div className="absolute bottom-1.5 right-1.5 z-20 pointer-events-none">
          {timestampOverlay}
        </div>
      )}

      {/* Re-download from partner's cache banner if missing or expired */}
      {(hasError || (!localUrl && !media.url && !media.thumbnailUrl && !isLoading)) && (
        <div 
          onClick={handleRequestRestore}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center cursor-pointer hover:bg-black/85 transition-all z-20"
        >
          {isRequestingRestore ? (
            <>
              <RefreshCw className="w-6 h-6 text-[var(--theme-accent)] animate-spin mb-2" />
              <span className="text-[11px] font-bold text-white">Asking partner's device...</span>
              <span className="text-[9px] text-white/60 mt-0.5">Restoring from local cache</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2 border border-white/20">
                <Download className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold text-white">Re-download</span>
              <span className="text-[9px] text-white/60 mt-0.5">Fetch from partner's storage</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Multi-Photo WhatsApp Collage Grid (Authentic Dimensions & Split)
// -------------------------------------------------------------
const CollageMediaBubble: React.FC<{
  items: MediaAttachment[];
  isOwn: boolean;
  onOpenViewer: (media: MediaAttachment, fullList: MediaAttachment[], initialIndex: number) => void;
  messageId?: string;
  currentRole: UserRole;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  timestampOverlay?: React.ReactNode;
  selectionActive?: boolean;
  onToggleSelect?: () => void;
}> = ({ items, isOwn, onOpenViewer, messageId, currentRole, deliveryStatus, timestampOverlay, selectionActive, onToggleSelect }) => {
  const totalCount = items.length;
  const displayItems = items.slice(0, 4);
  const remainingCount = totalCount - 4;

  const handleMediaClick = (media: MediaAttachment, idx: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (selectionActive) {
      onToggleSelect?.();
      return;
    }
    onOpenViewer(media, items, idx);
  };

  return (
    <div 
      onClick={(e) => {
        if (selectionActive) {
          e.stopPropagation();
          onToggleSelect?.();
        }
      }}
      className="relative rounded-[16px] overflow-hidden select-none w-[260px] sm:w-[300px] bg-black/10 shadow-sm cursor-pointer"
    >
      {/* 2 Photos Layout: 2 side-by-side columns */}
      {totalCount === 2 && (
        <div className="grid grid-cols-2 gap-[2px] w-full h-[190px] sm:h-[220px]">
          {items.map((item, idx) => (
            <CollageThumbnail
              key={item.id || idx}
              media={item}
              onClick={(e) => handleMediaClick(item, idx, e)}
            />
          ))}
        </div>
      )}

      {/* 3 Photos Layout: 1 large left (50% w, 100% h) + 2 stacked right (50% w, 50% h each) */}
      {totalCount === 3 && (
        <div className="flex gap-[2px] w-full h-[270px] sm:h-[310px]">
          <div className="w-1/2 h-full">
            <CollageThumbnail
              media={items[0]}
              onClick={(e) => handleMediaClick(items[0], 0, e)}
            />
          </div>
          <div className="w-1/2 h-full flex flex-col gap-[2px]">
            <div className="h-1/2 w-full">
              <CollageThumbnail
                media={items[1]}
                onClick={(e) => handleMediaClick(items[1], 1, e)}
              />
            </div>
            <div className="h-1/2 w-full">
              <CollageThumbnail
                media={items[2]}
                onClick={(e) => handleMediaClick(items[2], 2, e)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4+ Photos Layout: 2x2 grid with +N on the 4th item */}
      {totalCount >= 4 && (
        <div className="grid grid-cols-2 grid-rows-2 gap-[2px] w-full h-[270px] sm:h-[310px]">
          {displayItems.map((item, idx) => {
            const isLast = idx === 3;
            return (
              <div key={item.id || idx} className="relative w-full h-full overflow-hidden">
                <CollageThumbnail
                  media={item}
                  onClick={(e) => handleMediaClick(item, idx, e)}
                />
                {isLast && remainingCount > 0 && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMediaClick(item, idx, e);
                    }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center text-white cursor-pointer hover:bg-black/70 transition-all z-10"
                  >
                    <span className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                      +{remainingCount}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp Live Circular Upload Indicator for Collage */}
      {deliveryStatus === 'sending' && (
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center z-30 pointer-events-none transition-all">
          <div className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
            <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        </div>
      )}

      {/* Floating timestamp overlay */}
      {timestampOverlay && (
        <div className="absolute bottom-1.5 right-1.5 z-20 pointer-events-none">
          {timestampOverlay}
        </div>
      )}
    </div>
  );
};

// Sub-thumbnail inside collage
const CollageThumbnail: React.FC<{
  media: MediaAttachment;
  onClick: (e: React.MouseEvent) => void;
}> = ({ media, onClick }) => {
  const [localUrl, setLocalUrl] = useState<string | null>(
    media.url && (media.url.startsWith('blob:') || media.url.startsWith('data:')) ? media.url : null
  );

  useEffect(() => {
    let isMounted = true;
    async function fetchLocal() {
      if (media.url && (media.url.startsWith('blob:') || media.url.startsWith('data:'))) {
        setLocalUrl(media.url);
        return;
      }
      const cached = await getLocalMedia(media.id);
      if (isMounted && cached) {
        setLocalUrl(cached);
        return;
      }
      if (media.url && media.url.startsWith('http')) {
        const dl = await downloadAndCacheRemoteMedia(media.id, media.url);
        if (isMounted && dl) setLocalUrl(dl);
        else if (isMounted && media.url) setLocalUrl(media.url);
      } else if (media.url && isMounted) {
        setLocalUrl(media.url);
      }
    }
    fetchLocal();
    return () => {
      isMounted = false;
    };
  }, [media.id, media.url]);

  return (
    <div 
      onClick={onClick}
      className="relative w-full h-full overflow-hidden bg-black/15 group hover:brightness-95 transition-all cursor-pointer"
    >
      {localUrl ? (
        <img 
          src={localUrl} 
          alt={media.fileName || 'Photo'} 
          className="w-full h-full object-cover" 
          loading="lazy"
        />
      ) : media.thumbnailUrl ? (
        <img 
          src={media.thumbnailUrl} 
          alt="Thumb" 
          className="w-full h-full object-cover filter blur-sm scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black/20 text-white">
          <ImageIcon className="w-5 h-5 opacity-60" />
        </div>
      )}
      {media.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
};
