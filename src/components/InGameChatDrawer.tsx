import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
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
  const lastViewedCountRef = useRef(messages.length);
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
      lastViewedCountRef.current = messages.length;
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
    latestMessage && Date.now() - latestMessage.timestamp < 4500;

  return (
    <div className="w-full flex flex-col items-center select-none pointer-events-auto">
      {/* Floating latest banter banner if drawer is closed */}
      <AnimatePresence>
        {!isOpen && isRecentLatest && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={`mb-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 backdrop-blur-md ${
              latestMessage.senderRole === role
                ? 'bg-[var(--theme-accent)] text-white'
                : 'bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-accent)]/30'
            }`}
          >
            <span>{latestMessage.senderName}:</span>
            <span>{latestMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal Quick Banter Strip */}
      <div className="w-full max-w-md px-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {QUICK_BANTERS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickReaction(item.text)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:border-[var(--theme-accent)] active:scale-95 transition-all shadow-sm flex items-center gap-1"
          >
            <span>{item.text}</span>
          </button>
        ))}

        {/* Chat Drawer Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
            isOpen || unreadCount > 0
              ? 'bg-[var(--theme-accent)] text-white'
              : 'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
          {unreadCount > 0 && !isOpen && (
            <span className="w-4 h-4 rounded-full bg-white text-[var(--theme-accent)] flex items-center justify-center text-[10px] font-black">
              {unreadCount}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Expandable Slide-up Temporary In-Game Chat Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 260 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md bg-[var(--theme-surface)] border-t border-[var(--theme-border)] rounded-t-3xl mt-2 flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--theme-border)]/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
                <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
                  Temporary Game Chat
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--theme-text)]/60 hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-6">
                  <p className="font-semibold">No game chats yet</p>
                  <p className="text-[10px]">Send a quick tease or banter!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.senderRole === role;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        isOwn ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-2xl break-words ${
                          isOwn
                            ? 'bg-[var(--theme-accent)] text-white rounded-br-none'
                            : 'bg-[var(--theme-input-bg)] text-[var(--theme-text)] rounded-bl-none border border-[var(--theme-border)]'
                        }`}
                      >
                        <span className="block text-[10px] font-bold opacity-75 mb-0.5">
                          {m.senderName}
                        </span>
                        <span className="font-medium text-xs leading-tight">
                          {m.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSend}
              className="p-2 border-t border-[var(--theme-border)]/50 flex items-center gap-2 bg-[var(--theme-surface)]"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a playful message..."
                className="flex-1 bg-[var(--theme-input-bg)] text-xs text-[var(--theme-text)] rounded-xl px-3 py-2 border border-[var(--theme-border)] focus:outline-none focus:border-[var(--theme-accent)]"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 bg-[var(--theme-accent)] text-white rounded-xl active:scale-95 disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
