import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { InGameChatMessage, UserProfile, UserRole } from '../types';

interface InGameChatDrawerProps {
  messages: InGameChatMessage[];
  onSendMessage: (text: string, isQuickReaction?: boolean) => void;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
}

const QUICK_BANTERS = [
  { text: 'Your turn! ⏳', emoji: '⏳' },
  { text: 'Thinking... 🤔', emoji: '🤔' },
  { text: 'Nice move! 👏', emoji: '👏' },
  { text: 'Cheater! 😂', emoji: '😂' },
  { text: 'Love you ❤️', emoji: '❤️' },
  { text: 'Rematch! 🔥', emoji: '🔥' },
  { text: 'Oops! 🙈', emoji: '🙈' },
  { text: 'Too easy! 😎', emoji: '😎' },
];

export const InGameChatDrawer: React.FC<InGameChatDrawerProps> = ({
  messages,
  onSendMessage,
  role,
  userProfile,
  partnerProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgLengthRef = useRef(messages.length);

  // Track unread messages when drawer is closed
  useEffect(() => {
    if (messages.length > prevMsgLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.senderRole !== role && !isOpen) {
        setUnreadCount((c) => c + 1);
      }
    }
    prevMsgLengthRef.current = messages.length;
    if (isOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, role]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickReaction = (text: string) => {
    onSendMessage(text, true);
  };

  // Latest reaction banner (shows the latest message if sent in last 4 seconds)
  const latestMessage = messages[messages.length - 1];
  const isRecentLatest =
    latestMessage && Date.now() - latestMessage.timestamp < 4000;

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none pointer-events-auto">
      {/* Floating latest banter banner if popover is closed */}
      <AnimatePresence>
        {!isOpen && isRecentLatest && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.85 }}
            className={`absolute bottom-14 right-0 mb-1 max-w-[220px] px-3 py-1.5 rounded-2xl text-[11px] font-bold shadow-xl flex items-center gap-1.5 backdrop-blur-xl border border-white/20 whitespace-nowrap overflow-hidden text-ellipsis ${
              latestMessage.senderRole === role
                ? 'bg-[var(--theme-accent)] text-white'
                : 'bg-[var(--theme-surface)] text-[var(--theme-text)] border-[var(--theme-border)] ring-1 ring-[var(--theme-accent)]/30'
            }`}
          >
            <span className="opacity-80">{latestMessage.senderName}:</span>
            <span className="truncate">{latestMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Popover Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute bottom-14 right-0 w-[290px] sm:w-[320px] bg-[var(--theme-surface)]/95 backdrop-blur-2xl border border-[var(--theme-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-50 text-[var(--theme-text)] ring-1 ring-black/5"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--theme-border)]/50 bg-[var(--theme-surface)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
                <span className="text-xs font-black uppercase tracking-wider text-[var(--theme-text)]">
                  In-Game Chat
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--theme-text)]/50 hover:text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/15 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Banter 2x4 Grid (No horizontal scrolling!) */}
            <div className="p-2.5 bg-[var(--theme-surface)]/40 border-b border-[var(--theme-border)]/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-text)]/50 mb-1.5 px-0.5">
                Quick Reactions
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_BANTERS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickReaction(item.text)}
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] text-xs font-semibold text-[var(--theme-text)] active:scale-95 transition-all text-left truncate flex items-center gap-1.5 shadow-sm hover:shadow"
                  >
                    <span>{item.emoji}</span>
                    <span className="truncate">{item.text.replace(item.emoji, '').trim()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Banter Message Feed */}
            <div className="max-h-[140px] overflow-y-auto px-3 py-2 space-y-1.5 text-xs custom-scrollbar">
              {messages.length === 0 ? (
                <div className="py-4 text-center opacity-40 text-[11px] font-medium">
                  Tap any quick banter or send a chat!
                </div>
              ) : (
                messages.slice(-6).map((m) => {
                  const isOwn = m.senderRole === role;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-2.5 py-1 rounded-2xl text-[11px] break-words ${
                          isOwn
                            ? 'bg-[var(--theme-accent)] text-white rounded-br-none'
                            : 'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-bl-none shadow-sm'
                        }`}
                      >
                        <span className="font-semibold">{m.text}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSend}
              className="p-2 border-t border-[var(--theme-border)]/50 flex items-center gap-1.5 bg-[var(--theme-surface)]"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-[var(--theme-input-bg)] text-xs text-[var(--theme-text)] rounded-xl px-3 py-1.5 border border-[var(--theme-border)] focus:outline-none focus:border-[var(--theme-accent)]"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 bg-[var(--theme-accent)] text-white rounded-xl active:scale-95 disabled:opacity-40 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all relative border border-white/20 cursor-pointer ${
          isOpen
            ? 'bg-[var(--theme-text)] text-[var(--theme-surface)] rotate-90'
            : 'bg-[var(--theme-accent)] text-white hover:shadow-[var(--theme-accent)]/30'
        }`}
        title="Quick Chat & Reactions"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}

        {/* Unread Counter Badge */}
        {unreadCount > 0 && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md border-2 border-[var(--theme-surface)]"
          >
            {unreadCount}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
};
