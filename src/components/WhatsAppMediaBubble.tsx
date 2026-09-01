import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Maximize2, AlertCircle, FileVideo, Image as ImageIcon, FileAudio, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MediaAttachment, UserRole } from '../types';
import { getLocalMedia, saveLocalMedia, formatFileSize } from '../lib/mediaStore';

interface WhatsAppMediaBubbleProps {
  media: MediaAttachment;
  isOwn: boolean;
  onOpenViewer: (media: MediaAttachment) => void;
  deleted?: boolean;
}

export const WhatsAppMediaBubble: React.FC<WhatsAppMediaBubbleProps> = ({
  media,
  isOwn,
  onOpenViewer,
  deleted
}) => {
  const [localUrl, setLocalUrl] = useState<string | null>(media.url || null);
  const [isLoading, setIsLoading] = useState<boolean>(!media.url);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadMedia() {
      try {
        if (media.storagePath) {
          const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(media.storagePath, 60 * 60);
          if (error) throw error;
          if (isMounted && data?.signedUrl) { setLocalUrl(data.signedUrl); setIsLoading(false); }
          return;
        }
        if (media.url && media.url.length > 50) {
          setLocalUrl(media.url);
          setIsLoading(false);
          saveLocalMedia(media.id, media.url);
          return;
        }
        const cached = await getLocalMedia(media.id);
        if (isMounted && cached) {
          setLocalUrl(cached);
          setIsLoading(false);
        } else {
          if (isMounted) setIsLoading(false);
        }
      } catch (e) {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMedia();
    return () => {
      isMounted = false;
    };
  }, [media.id, media.url, media.storagePath]);

  if (deleted) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div 
      onClick={() => onOpenViewer({ ...media, url: localUrl || media.url })}
      className="relative rounded-2xl overflow-hidden cursor-pointer group select-none max-w-[280px] sm:max-w-[320px] bg-black/10 transition-transform active:scale-[0.99]"
      style={{ aspectRatio: media.width && media.height ? `${media.width}/${media.height}` : '4/3', maxHeight: '340px' }}
    >
      {/* Thumbnail or Blurred placeholder */}
      {media.thumbnail && !localUrl && (
        <img 
          src={media.thumbnail} 
          alt="Preview" 
          className="w-full h-full object-cover filter blur-sm scale-105"
        />
      )}

      {/* Actual Media */}
      {media.type === 'image' ? (
        localUrl ? (
          <img 
            src={localUrl} 
            alt={media.fileName || 'Shared photo'} 
            className="w-full h-full object-cover rounded-2xl group-hover:brightness-95 transition-all duration-200"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 text-white p-4">
            <ImageIcon className="w-8 h-8 opacity-60 mb-2" />
            <span className="text-xs font-semibold opacity-80">Photo</span>
          </div>
        )
      ) : media.type === 'video' ? (
        /* Video Media */
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          {localUrl ? (
            <video 
              ref={videoRef}
              src={localUrl}
              className="w-full h-full object-cover rounded-2xl"
              playsInline
              muted={isMuted}
              loop
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/70">
              <FileVideo className="w-8 h-8 opacity-60 mb-1" />
              <span className="text-xs font-bold">Video</span>
            </div>
          )}

          {/* Video Controls overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex flex-col justify-between p-2.5">
            {/* Top row: Video badge & Mute toggle */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                <FileVideo className="w-3 h-3" />
                {media.duration ? `${Math.round(media.duration)}s` : 'Video'}
              </span>
              {isPlaying && (
                <button 
                  onClick={toggleMute}
                  className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Center Play Button */}
            {!isPlaying && (
              <button 
                onClick={togglePlay}
                className="self-center w-12 h-12 rounded-full bg-white/30 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg border border-white/40"
              >
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </button>
            )}

            {/* Bottom row: File size info */}
            <div className="flex items-center justify-between text-[10px] text-white/80 font-medium">
              {media.fileSize ? <span>{formatFileSize(media.fileSize)}</span> : <span />}
              <span className="opacity-70 group-hover:opacity-100 flex items-center gap-0.5">
                <Maximize2 className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      ) : media.type === 'audio' ? (
        <div className="min-w-[220px] p-4 text-[var(--theme-text)]" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-2 mb-2"><FileAudio className="w-5 h-5" /><span className="text-sm font-semibold truncate">{media.fileName || 'Audio'}</span></div>{localUrl ? <audio controls src={localUrl} className="w-full" onError={() => setHasError(true)} /> : <span className="text-xs">Loading audio…</span>}<span className="mt-2 block text-[10px] opacity-70">{formatFileSize(media.fileSize || 0)}</span></div>
      ) : (
        <div className="min-w-[220px] p-4 text-[var(--theme-text)]"><div className="flex items-center gap-2"><FileText className="w-5 h-5" /><span className="text-sm font-semibold truncate">{media.fileName || 'File'}</span></div><p className="mt-2 text-xs opacity-70">{formatFileSize(media.fileSize || 0)} · Tap to open</p></div>
      )}

      {/* Fullscreen hover badge on desktop */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm text-white p-1 rounded-full pointer-events-none">
        <Maximize2 className="w-3.5 h-3.5" />
      </div>

      {hasError && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-4 text-center">
          <AlertCircle className="w-6 h-6 text-rose-400 mb-1" />
          <span className="text-[11px] font-medium opacity-90">Media unavailable</span>
        </div>
      )}
    </div>
  );
};
