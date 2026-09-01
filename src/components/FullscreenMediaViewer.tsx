import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { X, Play, Pause, Volume2, VolumeX, Download, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { MediaAttachment } from '../types';
import { formatFileSize } from '../lib/mediaStore';

interface FullscreenMediaViewerProps {
  media: MediaAttachment | null;
  onClose: () => void;
}

export const FullscreenMediaViewer: React.FC<FullscreenMediaViewerProps> = ({
  media,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [scale, setScale] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Motion drag value for vertical swipe down/up to dismiss
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [-200, 0, 200], [0.4, 1, 0.4]);
  const backdropOpacity = useTransform(dragY, [-200, 0, 200], [0.3, 0.98, 0.3]);

  // Support hardware back button & keyboard escape to close viewer
  useEffect(() => {
    if (!media) return;

    // Push a dummy history state so hardware back button or Android back closes the viewer
    window.history.pushState({ modal: 'media_viewer' }, '');

    const handlePopState = (e: PopStateEvent) => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    // Also register on window for Android Webview native bridge if available
    (window as any).__onCloseActiveMediaViewer = onClose;

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      delete (window as any).__onCloseActiveMediaViewer;
    };
  }, [media, onClose]);

  if (!media) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!media.url) return;

    try {
      // 1. Try to download or save to gallery using Blob / HTML5 anchor
      const res = await fetch(media.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const filename = media.fileName || `OnlyUs_${Date.now()}.${ext}`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      // Fallback
      const a = document.createElement('a');
      a.href = media.url;
      a.download = media.fileName || `OnlyUs_${Date.now()}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleDragEnd = (_: any, info: { offset: { y: number }, velocity: { y: number } }) => {
    // If user dragged up or down by more than 100px or with high vertical velocity -> close viewer
    if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 400) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.96)' }}
        className="fixed inset-0 z-[200] flex flex-col justify-between select-none backdrop-blur-2xl"
        onClick={onClose}
      >
        {/* Top Control Bar */}
        <motion.div 
          className="h-16 px-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/90 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 text-white">
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
              aria-label="Close viewer"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/90 truncate max-w-[180px] sm:max-w-[280px]">
                {media.fileName || (media.type === 'video' ? 'Video' : 'Photo')}
              </span>
              {media.fileSize ? (
                <span className="text-[10px] text-white/60 font-medium">{formatFileSize(media.fileSize)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 text-white">
            {media.type === 'image' && (
              <>
                <button 
                  onClick={() => setScale(s => Math.min(s + 0.4, 3))}
                  className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/80 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setScale(s => Math.max(s - 0.4, 1))}
                  className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/80 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Direct Save to Gallery / Local Download Button */}
            <button 
              onClick={handleDownload}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
                isSaved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-[var(--theme-accent)] text-white hover:brightness-110'
              }`}
              title="Save to Gallery / Downloads"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Save to Gallery</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Media Container with Swipe Down / Up to Dismiss */}
        <div 
          className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {media.type === 'image' ? (
            <motion.img 
              src={media.url} 
              alt="Fullscreen media"
              style={{ y: dragY, scale }}
              drag={scale === 1 ? "y" : true}
              dragConstraints={{ top: 0, bottom: 0, left: scale > 1 ? -150 : 0, right: scale > 1 ? 150 : 0 }}
              dragElastic={scale === 1 ? 0.7 : 0.2}
              onDragEnd={scale === 1 ? handleDragEnd : undefined}
              className="max-h-[82vh] max-w-[95vw] object-contain rounded-2xl shadow-2xl transition-transform duration-100 cursor-grab active:cursor-grabbing select-none"
            />
          ) : (
            <motion.div 
              style={{ y: dragY }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              className="relative max-h-[82vh] max-w-[95vw] flex items-center justify-center"
            >
              <video 
                ref={videoRef}
                src={media.url}
                controls
                autoPlay
                playsInline
                className="max-h-[82vh] max-w-[95vw] rounded-2xl shadow-2xl"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </motion.div>
          )}
        </div>

        {/* Bottom bar with gesture cue */}
        <motion.div 
          className="h-14 px-6 flex items-center justify-center text-[11px] text-white/50 font-medium bg-gradient-to-t from-black/90 to-transparent gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span>Swipe up or down to close</span>
          <span>•</span>
          <span>Saved directly on your device</span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
