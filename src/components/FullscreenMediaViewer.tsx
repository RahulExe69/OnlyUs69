import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { ArrowLeft, X, Play, Pause, Volume2, VolumeX, Download, ZoomIn, ZoomOut, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaAttachment } from '../types';
import { formatFileSize, getLocalMedia, downloadAndCacheRemoteMedia } from '../lib/mediaStore';

interface FullscreenMediaViewerProps {
  media: MediaAttachment | null;
  mediaList?: MediaAttachment[];
  initialIndex?: number;
  onClose: () => void;
}

export const FullscreenMediaViewer: React.FC<FullscreenMediaViewerProps> = ({
  media,
  mediaList,
  initialIndex = 0,
  onClose
}) => {
  const items = (mediaList && mediaList.length > 0) 
    ? mediaList 
    : (media?.mediaList && media.mediaList.length > 0 ? media.mediaList : (media ? [media] : []));
    
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, media, mediaList]);

  const activeItem: MediaAttachment | null = items[currentIndex] || media;

  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [scale, setScale] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Motion drag value for gestures
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  // Resolve local or cached url when currentIndex changes
  useEffect(() => {
    if (!activeItem) return;
    let isMounted = true;

    async function loadItem() {
      if (activeItem.url && (activeItem.url.startsWith('blob:') || activeItem.url.startsWith('data:'))) {
        setActiveUrl(activeItem.url);
        return;
      }
      const cached = await getLocalMedia(activeItem.id);
      if (isMounted && cached) {
        setActiveUrl(cached);
        return;
      }
      if (activeItem.url && activeItem.url.startsWith('http')) {
        const dl = await downloadAndCacheRemoteMedia(activeItem.id, activeItem.url);
        if (isMounted) setActiveUrl(dl || activeItem.url);
      } else if (activeItem.url && isMounted) {
        setActiveUrl(activeItem.url);
      }
    }

    loadItem();
    setScale(1);

    return () => {
      isMounted = false;
    };
  }, [activeItem?.id, activeItem?.url]);

  // Support hardware back button & keyboard escape/arrows
  useEffect(() => {
    if (!activeItem) return;

    window.history.pushState({ modal: 'media_viewer' }, '');

    const handlePopState = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < items.length - 1) setCurrentIndex(i => i + 1);
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    (window as any).__onCloseActiveMediaViewer = onClose;

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      delete (window as any).__onCloseActiveMediaViewer;
    };
  }, [activeItem, currentIndex, items.length, onClose]);

  if (!activeItem) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl = activeUrl || activeItem.url;
    if (!targetUrl) return;

    try {
      const res = await fetch(targetUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const ext = activeItem.type === 'video' ? 'mp4' : 'jpg';
      const filename = activeItem.fileName || `OnlyUs_${Date.now()}.${ext}`;

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
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = activeItem.fileName || `OnlyUs_${Date.now()}.${activeItem.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  // Pointer event tracking to distinguish single tap/click from swipe
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isSwipingRef.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    const dt = Date.now() - pointerStartRef.current.time;

    // If movement is minimal (< 8px) and short (< 400ms), it's a tap/click -> toggle controls
    if (dx < 8 && dy < 8 && dt < 400) {
      setShowControls(prev => !prev);
    }
    pointerStartRef.current = null;
  };

  const handleDragEnd = (_: any, info: { offset: { x: number; y: number }, velocity: { x: number; y: number } }) => {
    const { offset, velocity } = info;
    
    // Vertical swipe to dismiss
    if (Math.abs(offset.y) > 130 || Math.abs(velocity.y) > 550) {
      onClose();
      return;
    }

    // Horizontal swipe to change photos
    if (items.length > 1 && scale === 1) {
      if (offset.x < -50 || velocity.x < -300) {
        if (currentIndex < items.length - 1) {
          setCurrentIndex(i => i + 1);
        }
      } else if (offset.x > 50 || velocity.x > 300) {
        if (currentIndex > 0) {
          setCurrentIndex(i => i - 1);
        }
      }
    }
  };

  const content = (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ backgroundColor: '#000000' }}
        className="fixed inset-0 z-[99999] select-none overflow-hidden touch-none w-screen h-screen max-w-none max-h-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Floating Top Header Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 inset-x-0 z-[100000] px-4 pt-4 pb-4 flex items-center justify-between bg-gradient-to-b from-black/95 via-black/80 to-transparent"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 text-white">
                {/* Back Arrow button (<-) */}
                <button 
                  onClick={onClose}
                  className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer backdrop-blur-md flex items-center justify-center text-white"
                  aria-label="Back / Close viewer"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px] sm:max-w-[280px]">
                      {activeItem.fileName || (activeItem.type === 'video' ? 'Video' : 'Photo')}
                    </span>
                    {items.length > 1 && (
                      <span className="text-[10px] sm:text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold text-white shadow-sm">
                        {currentIndex + 1} / {items.length}
                      </span>
                    )}
                  </div>
                  {activeItem.fileSize ? (
                    <span className="text-[10px] text-white/70 font-medium">
                      {formatFileSize(activeItem.fileSize)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 text-white">
                {activeItem.type === 'image' && (
                  <div className="hidden sm:flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full px-1.5 py-0.5 border border-white/10">
                    <button 
                      onClick={() => setScale(s => Math.min(s + 0.4, 3))}
                      className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setScale(s => Math.max(s - 0.4, 1))}
                      className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Direct Save to Device / Gallery Download Button */}
                <button 
                  onClick={handleDownload}
                  className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xl active:scale-95 cursor-pointer backdrop-blur-md ${
                    isSaved 
                      ? 'bg-emerald-500 text-white shadow-emerald-500/40 ring-2 ring-emerald-300' 
                      : 'bg-white text-black hover:bg-white/90 shadow-black/50'
                  }`}
                  title="Save to Gallery / Downloads"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Photo/Video Stage (Maximum Space to Breathe) */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          {/* Desktop/Mouse navigation buttons */}
          {showControls && items.length > 1 && currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i => i - 1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute left-3 sm:left-6 z-40 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 active:scale-90 transition-all cursor-pointer backdrop-blur-md shadow-2xl"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}

          {showControls && items.length > 1 && currentIndex < items.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i => i + 1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute right-3 sm:right-6 z-40 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 active:scale-90 transition-all cursor-pointer backdrop-blur-md shadow-2xl"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}

          {activeItem.type === 'image' ? (
            <motion.img 
              key={activeItem.id || currentIndex}
              src={activeUrl || activeItem.url} 
              alt="Fullscreen media"
              style={{ scale }}
              drag={scale === 1 ? true : false}
              dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
              dragElastic={0.65}
              onDragEnd={handleDragEnd}
              className="w-full h-full max-h-[100dvh] max-w-[100dvw] object-contain cursor-grab active:cursor-grabbing select-none"
            />
          ) : (
            <motion.div 
              key={activeItem.id || currentIndex}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              className="w-full h-full max-h-[100dvh] max-w-[100dvw] flex items-center justify-center relative p-2"
            >
              <video 
                ref={videoRef}
                src={activeUrl || activeItem.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full max-h-[100dvh] max-w-[100dvw] object-contain rounded-lg"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </motion.div>
          )}
        </div>

        {/* Floating Bottom-Edged Mini Thumbnails Overlay */}
        <AnimatePresence>
          {showControls && items.length > 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 inset-x-0 z-[100000] px-4 pb-6 pt-4 flex items-center justify-center bg-gradient-to-t from-black/95 via-black/75 to-transparent"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1.5 px-3 no-scrollbar rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
                {items.map((item, idx) => (
                  <ViewerThumbnail
                    key={item.id || idx}
                    item={item}
                    isActive={idx === currentIndex}
                    onClick={() => setCurrentIndex(idx)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};

// Sub-thumbnail in viewer strip with IndexedDB / remote caching
const ViewerThumbnail: React.FC<{
  item: MediaAttachment;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(
    item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:')) ? item.url : (item.thumbnailUrl || null)
  );

  useEffect(() => {
    let isMounted = true;
    async function resolveThumb() {
      if (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:'))) {
        setThumbUrl(item.url);
        return;
      }
      const cached = await getLocalMedia(item.id);
      if (isMounted && cached) {
        setThumbUrl(cached);
        return;
      }
      if (item.url && item.url.startsWith('http')) {
        const dl = await downloadAndCacheRemoteMedia(item.id, item.url);
        if (isMounted && dl) setThumbUrl(dl);
        else if (isMounted && item.url) setThumbUrl(item.url);
      } else if (item.thumbnailUrl && isMounted) {
        setThumbUrl(item.thumbnailUrl);
      }
    }
    resolveThumb();
    return () => {
      isMounted = false;
    };
  }, [item.id, item.url, item.thumbnailUrl]);

  return (
    <div
      onClick={onClick}
      className={`w-11 h-11 sm:w-13 sm:h-13 rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 relative bg-black/60 ${
        isActive 
          ? 'border-white scale-105 opacity-100 shadow-[0_0_12px_rgba(255,255,255,0.5)] ring-2 ring-white/50' 
          : 'border-white/20 opacity-50 hover:opacity-90'
      }`}
    >
      {thumbUrl ? (
        <img 
          src={thumbUrl} 
          alt="thumb" 
          className="w-full h-full object-cover" 
          loading="lazy"
          onError={() => {
            if (item.thumbnailUrl && thumbUrl !== item.thumbnailUrl) {
              setThumbUrl(item.thumbnailUrl);
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/60">
          <Download className="w-4 h-4" />
        </div>
      )}
      {item.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="w-3 h-3 fill-white text-white" />
        </div>
      )}
    </div>
  );
};
