import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Smile, Heart, Send, X } from 'lucide-react';
import { Message, UserProfile } from '../types';
import { useOverlayBack } from '../lib/overlayManager';

interface ChatInputBarProps {
  role: 'owner' | 'partner';
  replyingTo: Message | null;
  onClearReply: () => void;
  editingMessage: Message | null;
  onClearEditing: () => void;
  onSendMessage: (text: string) => Promise<void> | void;
  onEditMessage: (id: string, text: string) => Promise<void> | void;
  onBroadcastTyping: (isTyping: boolean) => void;
  onOpenAttachmentMenu: () => void;
  onOpenNudgeMenu: () => void;
  userProfile: UserProfile | null;
}

const POPULAR_EMOJIS = [
  '❤️', '😂', '🥺', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨',
  '🤍', '😍', '😘', '🫂', '🌹', '🌸', '🤤', '🤭', '🔥', '💯',
  '👍', '💫', '🌙', '💌'
];

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(({
  role,
  replyingTo,
  onClearReply,
  editingMessage,
  onClearEditing,
  onSendMessage,
  onEditMessage,
  onBroadcastTyping,
  onOpenAttachmentMenu,
  onOpenNudgeMenu,
  userProfile,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useOverlayBack(showEmojiPicker, () => setShowEmojiPicker(false), 'chat-emoji-picker');

  const adjustTextareaHeight = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 144; // ~6-7 rows
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(44, newHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  useEffect(() => {
    if (replyingTo) {
      if (typeof document !== 'undefined' && document.activeElement !== messageInputRef.current) {
        requestAnimationFrame(() => {
          messageInputRef.current?.focus({ preventScroll: true });
        });
      }
    }
  }, [replyingTo]);

  useEffect(() => {
    if (editingMessage) {
      setInputText(editingMessage.text);
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        messageInputRef.current?.focus({ preventScroll: true });
      });
    } else {
      setInputText('');
      requestAnimationFrame(() => {
        adjustTextareaHeight();
      });
    }
  }, [editingMessage, adjustTextareaHeight]);

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      messageInputRef.current?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!userProfile) return;

    if (inputText.length > 0 && !editingMessage) {
      onBroadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onBroadcastTyping(false);
      }, 3000);
    } else {
      onBroadcastTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText, userProfile?.uid, editingMessage, onBroadcastTyping]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend) return;

    setShowEmojiPicker(false);

    if (editingMessage) {
      await onEditMessage(editingMessage.id, textToSend);
      setInputText('');
      onClearEditing();
      requestAnimationFrame(() => {
        adjustTextareaHeight();
        messageInputRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    setInputText('');
    requestAnimationFrame(() => {
      adjustTextareaHeight();
    });

    // Soft keyboard reset to alphabets (WhatsApp behavior)
    if (messageInputRef.current) {
      messageInputRef.current.blur();
      requestAnimationFrame(() => {
        messageInputRef.current?.focus({ preventScroll: true });
      });
    }

    await onSendMessage(textToSend);
  };

  return (
    <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/80 backdrop-blur-md">
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[var(--theme-accent)]/10 rounded-t-2xl border-l-4 border-[var(--theme-accent)] flex items-center justify-between mb-1 mx-2"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold text-[var(--theme-accent)] uppercase tracking-wider mb-0.5">
                Replying to {replyingTo.sender_role === 'owner' ? 'Rahul' : 'Nusrat'}
              </p>
              <p className="text-xs text-[var(--theme-text)] truncate italic opacity-80">"{replyingTo.text}"</p>
            </div>
            <button
              onClick={onClearReply}
              className="p-1 hover:bg-[var(--theme-accent)]/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-[var(--theme-text)]/40" />
            </button>
          </motion.div>
        )}
        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[var(--theme-accent)]/10 rounded-t-2xl border-l-4 border-[var(--theme-accent)] flex items-center justify-between mb-1 mx-2"
          >
            <div className="flex-1 min-w-0 pr-4 text-[var(--theme-accent)]">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Editing Private Message</p>
              <p className="text-xs truncate italic opacity-80 text-[var(--theme-text)]">"{editingMessage.text}"</p>
            </div>
            <button
              onClick={onClearEditing}
              className="p-1 hover:bg-[var(--theme-accent)]/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-[var(--theme-accent)]/40" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp-style Quick Emoji Picker Drawer / Shelf */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="px-4 py-2.5 bg-[var(--theme-surface)]/95 backdrop-blur-md border-t border-[var(--theme-border)] flex items-center gap-2 overflow-x-auto custom-scrollbar select-none"
            onPointerDown={(e) => e.preventDefault()}
          >
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleInsertEmoji(emoji)}
                className="text-2xl p-1.5 hover:bg-[var(--theme-accent)]/15 rounded-xl hover:scale-125 transition-all active:scale-95 shrink-0"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="relative flex items-end px-3 lg:px-4 gap-2 pb-3.5 pt-1.5">
        {/* Plus attachment button */}
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onOpenAttachmentMenu}
          className="flex-shrink-0 w-10 h-10 mb-0.5 flex items-center justify-center bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-accent)] rounded-full hover:bg-[var(--theme-accent)]/10 transition-all active:scale-95 shadow-sm cursor-pointer"
          aria-label="Open attachments menu"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* WhatsApp-style Input Container */}
        <div className="relative flex-1 flex items-end bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-[1.6rem] shadow-sm focus-within:ring-4 focus-within:ring-[var(--theme-accent)]/15 focus-within:border-[var(--theme-accent)]/40 transition-[box-shadow,border-color] duration-150 overflow-hidden">
          {/* WhatsApp emoji toggle button */}
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 mb-0.5 shrink-0 transition-colors cursor-pointer ${
              showEmojiPicker ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text)]/50 hover:text-[var(--theme-accent)]'
            }`}
            aria-label="Toggle emoji picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Auto-expanding textarea */}
          <textarea
            ref={messageInputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            inputMode="text"
            autoCapitalize="sentences"
            autoComplete="on"
            autoCorrect="on"
            spellCheck={true}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                  e.preventDefault();
                  handleSubmit();
                }
              }
            }}
            placeholder={editingMessage ? 'Edit message...' : `Whisper to ${role === 'owner' ? 'Nusrat' : 'Rahul'}...`}
            className="w-full py-2.5 px-1 bg-transparent text-[var(--theme-text)] text-sm focus:outline-none placeholder-[var(--theme-text)]/40 resize-none custom-scrollbar leading-relaxed"
            style={{ minHeight: '44px', maxHeight: '144px', boxSizing: 'border-box' }}
          />

          {/* Feelings / Nudge Heart button inside container */}
          <div className="pr-2 mb-1.5 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenNudgeMenu}
              className="p-1.5 text-[var(--theme-accent)]/70 hover:text-[var(--theme-accent)] transition-colors active:scale-90 cursor-pointer"
              aria-label="Send a feeling"
            >
              <Heart className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Send button */}
        <button
          type="submit"
          onPointerDown={(event) => event.preventDefault()}
          disabled={!inputText.trim()}
          className="flex-shrink-0 w-10 h-10 lg:w-11 lg:h-11 mb-0.5 flex items-center justify-center text-white rounded-full hover:opacity-90 disabled:opacity-30 transition-transform duration-100 active:scale-95 shadow-lg touch-manipulation cursor-pointer"
          style={{
            background: 'var(--theme-accent)',
            boxShadow: '0 8px 20px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
          }}
          aria-label="Send message"
        >
          <Send className="w-4 h-4 lg:w-5 lg:h-5 fill-white" />
        </button>
      </form>
    </div>
  );
});
