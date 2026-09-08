import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Instagram, Loader2, Play } from 'lucide-react';
import { InstagramReelInfo } from '../lib/instagram';
import { useOverlayBack } from '../lib/overlayManager';

interface InstagramReelModalProps {
  reel: InstagramReelInfo | null;
  onClose: () => void;
}

export const InstagramReelModal: React.FC<InstagramReelModalProps> = ({ reel, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);

  useOverlayBack(!!reel, onClose, 'instagram-reel-modal');

  useEffect(() => {
    if (reel) {
      setIsLoading(true);
    }
  }, [reel?.code, reel?.embedUrl]);

  if (!reel) return null;

  const handleOpenExternal = () => {
    window.open(reel.cleanUrl, '_blank', 'noopener,noreferrer');
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
        {/* Dark backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md transform-gpu"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[440px] h-[86vh] max-h-[760px] bg-neutral-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Instagram className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  Instagram Reel
                </span>
                <span className="text-[10px] text-white/50 font-mono truncate">
                  {reel.code}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenExternal}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
                title="Open in Instagram App"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open App</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/15 transition-colors active:scale-95"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Reel Embed Content */}
          <div className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 text-white z-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center animate-pulse shadow-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
                <p className="text-xs text-white/70 font-medium tracking-wide">
                  Loading Reel...
                </p>
              </div>
            )}

            <iframe
              key={reel.embedUrl}
              src={reel.embedUrl}
              className="w-full h-full border-0"
              scrolling="no"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {/* Bottom Persistent Action Bar */}
          <div className="px-4 py-2.5 bg-neutral-900/90 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 truncate">
              <Play className="w-3 h-3 text-white/40 shrink-0" />
              <span className="truncate">Public video playback</span>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-3 py-1 bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] text-white text-[11px] font-bold rounded-lg hover:brightness-105 active:scale-95 transition-all flex items-center gap-1 shrink-0 shadow-sm"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Watch in App</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

