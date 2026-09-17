import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smile, 
  Send, 
  X, 
  Image as ImageIcon, 
  RefreshCw,
  CornerUpLeft
} from 'lucide-react';
import { TelegramVaultMessage } from '../lib/telegramService';
import { useOverlayBack } from '../lib/overlayManager';

interface TelegramChatInputBarProps {
  myRole: 'owner' | 'partner';
  partnerName: string;
  replyTarget: TelegramVaultMessage | null;
  onClearReply: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onSendImage?: (file: File) => Promise<void>;
  isSending: boolean;
}

const POPULAR_EMOJIS = [
  '❤️', '😂', '🥺', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨',
  '🤍', '😍', '😘', '🫂', '🌹', '🌸', '🤤', '🤭', '🔥', '💯',
  '👍', '💫', '🌙', '💌'
];

export const TelegramChatInputBar: React.FC<TelegramChatInputBarProps> = ({
  myRole,
  partnerName,
  replyTarget,
  onClearReply,
  onSendMessage,
  onSendImage,
  isSending
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dedicated single-line placeholder ticker
  const placeholderContainerRef = useRef<HTMLDivElement>(null);
  const placeholderTextRef = useRef<HTMLSpanElement>(null);
  const [placeholderOverflow, setPlaceholderOverflow] = useState<number>(0);

  const placeholderText = `Whisper to ${partnerName} in Vault...`;

  useOverlayBack(showEmojiPicker, () => setShowEmojiPicker(false), 'telegram-emoji-picker');

  useEffect(() => {
    const checkOverflow = () => {
      if (placeholderContainerRef.current && placeholderTextRef.current) {
        const containerWidth = placeholderContainerRef.current.clientWidth;
        const textWidth = placeholderTextRef.current.scrollWidth;
        const diff = textWidth - containerWidth;
        setPlaceholderOverflow(diff > 2 ? diff + 12 : 0);
      }
    };
    checkOverflow();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && placeholderContainerRef.current) {
      ro = new ResizeObserver(() => checkOverflow());
      ro.observe(placeholderContainerRef.current);
    }
    window.addEventListener('resize', checkOverflow);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [placeholderText]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;
    setInputText('');
    setShowEmojiPicker(false);
    await onSendMessage(text);
  }, [inputText, isSending, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendImage) {
      await onSendImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <footer className="bg-[var(--theme-bg)] border-t border-[var(--theme-border)]/70 relative z-30 transition-colors">
      {/* Reply Context Banner */}
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-[var(--theme-surface)] border-b border-[var(--theme-border)] flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CornerUpLeft className="w-3.5 h-3.5 text-[var(--theme-accent)] shrink-0" />
              <div className="truncate">
                <span className="font-bold text-[var(--theme-accent)]">
                  Replying to {replyTarget.sender_role === myRole ? 'yourself' : partnerName}:
                </span>{' '}
                <span className="text-[var(--theme-text)]/70 italic">{replyTarget.text}</span>
              </div>
            </div>
            <button
              onClick={onClearReply}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[var(--theme-text)]/60 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Row */}
      <div className="p-2 sm:p-3 max-w-4xl mx-auto flex items-end gap-2">
        {/* Hidden photo file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Media Attach Button */}
        {onSendImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full bg-[var(--theme-surface)] text-[var(--theme-text)]/60 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 border border-[var(--theme-border)] transition-colors active:scale-95 cursor-pointer shadow-2xs shrink-0"
            title="Send Photo"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        )}

        {/* WhatsApp-style Input Container with Ticker */}
        <div className="relative flex-1 flex items-end bg-[var(--theme-input-bg,var(--theme-surface))] backdrop-blur-md border border-[var(--theme-border)] rounded-[1.6rem] shadow-2xs focus-within:ring-3 focus-within:ring-[var(--theme-accent)]/20 focus-within:border-[var(--theme-accent)]/50 transition-all duration-150 overflow-hidden">
          {/* WhatsApp Emoji Toggle Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 mb-0.5 shrink-0 transition-colors cursor-pointer ${
              showEmojiPicker ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text)]/50 hover:text-[var(--theme-accent)]'
            }`}
            title="Insert Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Marquee whisper placeholder ticker */}
          <div className="relative flex-1 min-w-0 flex items-center self-center my-auto">
            {!inputText && (
              <div
                ref={placeholderContainerRef}
                className="absolute inset-y-0 left-1 right-1 pointer-events-none select-none flex items-center overflow-hidden z-10"
              >
                <span
                  ref={placeholderTextRef}
                  className="text-[12px] sm:text-[13px] font-sans font-normal tracking-tight text-[var(--theme-text)]/40 whitespace-nowrap will-change-transform leading-none"
                  style={
                    placeholderOverflow > 0
                      ? ({
                          animation: 'whisperTicker 6.5s ease-in-out infinite',
                          '--marquee-shift': `-${placeholderOverflow}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {placeholderText}
                </span>
              </div>
            )}

            <textarea
              id="vault-message-input"
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowEmojiPicker(false)}
              className="w-full bg-transparent text-[var(--theme-text)] text-[14px] sm:text-[15px] focus:outline-hidden resize-none py-2.5 px-1 min-h-[42px] max-h-[120px] leading-snug"
            />
          </div>
        </div>

        {/* Rounded Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputText.trim() || isSending}
          className="w-11 h-11 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md shrink-0 cursor-pointer"
        >
          {isSending ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </div>

      {/* Quick Emoji Drawer */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="border-t border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3"
          >
            <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center sm:justify-start">
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-[var(--theme-accent)]/15 active:scale-90 transition-all cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
};
