import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Instagram, Send, Clipboard, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseInstagramReel } from '../lib/instagram';
import { useOverlayBack } from '../lib/overlayManager';

interface ShareReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => Promise<void> | void;
  recipientName: string;
}

export const ShareReelModal: React.FC<ShareReelModalProps> = ({
  isOpen,
  onClose,
  onSend,
  recipientName,
}) => {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useOverlayBack(isOpen, onClose, 'share-reel-modal');

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      setError('Could not access clipboard. Please paste the link manually.');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter an Instagram Reel or Post link.');
      return;
    }

    const reelInfo = parseInstagramReel(trimmed);
    if (!reelInfo) {
      setError('Please enter a valid Instagram link (e.g. instagram.com/reel/...)');
      return;
    }

    try {
      setIsSubmitting(true);
      const messageText = caption.trim()
        ? `${caption.trim()}\n${reelInfo.cleanUrl}`
        : reelInfo.cleanUrl;
      await onSend(messageText);
      setUrl('');
      setCaption('');
      onClose();
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedReel = parseInstagramReel(url.trim());

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transform-gpu"
        />

        {/* Sheet / Dialog */}
        <motion.div
          initial={{ y: '100%', opacity: 0.95 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.95 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 z-10"
        >
          {/* Top Drag Handle (Mobile) */}
          <div className="w-12 h-1 bg-[var(--theme-text)]/15 rounded-full mx-auto mb-3 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--theme-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-md">
                <Instagram className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--theme-text)] tracking-tight">
                  Share Instagram Reel
                </h3>
                <p className="text-[11px] text-[var(--theme-text)]/60">
                  Send to {recipientName} with zero-login playback
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--theme-border)]/50 transition-colors text-[var(--theme-text)]/70 hover:text-[var(--theme-text)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-3">
            {/* URL Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text)]/70">
                Instagram Link
              </label>
              <div className="relative flex items-center">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste https://instagram.com/reel/..."
                  className="w-full pl-3 pr-20 py-2.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl text-xs text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] transition-colors placeholder-[var(--theme-text)]/40"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-2 px-2 py-1 bg-[var(--theme-surface)] hover:bg-[var(--theme-border)]/50 border border-[var(--theme-border)] rounded-lg text-[10px] font-bold text-[var(--theme-accent)] flex items-center gap-1 transition-all active:scale-95"
                >
                  <Clipboard className="w-3 h-3" />
                  Paste
                </button>
              </div>
            </div>

            {/* Valid Link Feedback Badge */}
            {detectedReel && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Reel detected: <code className="font-mono font-bold">{detectedReel.code}</code></span>
              </div>
            )}

            {/* Optional Note/Caption */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text)]/70">
                Sweet Note / Caption (Optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Watch this haha! ❤️"
                className="w-full px-3 py-2 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl text-xs text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] transition-colors placeholder-[var(--theme-text)]/40"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="mt-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sharing...' : 'Share Reel to Chat'}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

