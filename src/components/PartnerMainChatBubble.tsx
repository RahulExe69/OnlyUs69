import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Mic, Image as ImageIcon } from 'lucide-react';
import { Message, UserProfile, UserRole } from '../types';

interface PartnerMainChatBubbleProps {
  latestPartnerMessage: Message | null;
  partnerProfile: UserProfile | null;
  role: UserRole;
  onSendMainChatMessage: (text: string) => Promise<void> | void;
}

export const PartnerMainChatBubble: React.FC<PartnerMainChatBubbleProps> = ({
  latestPartnerMessage,
  partnerProfile,
  role,
  onSendMainChatMessage,
}) => {
  const [visibleMessage, setVisibleMessage] = useState<Message | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  // Track mount time so historical messages prior to joining do NOT trigger the bubble
  const joinTimestampRef = useRef<number>(Date.now());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Only display messages that arrive AFTER joining the game
  useEffect(() => {
    if (!latestPartnerMessage) return;

    // Check sender is partner
    const isFromPartner = latestPartnerMessage.sender_role !== role;
    if (!isFromPartner) return;

    // Verify message was created after joining
    const msgTime = new Date(
      latestPartnerMessage.created_at || latestPartnerMessage.timestamp || Date.now()
    ).getTime();

    // Ignore if sent before joining or already shown
    if (msgTime < joinTimestampRef.current || seenMessageIdsRef.current.has(latestPartnerMessage.id)) {
      return;
    }

    seenMessageIdsRef.current.add(latestPartnerMessage.id);
    setVisibleMessage(latestPartnerMessage);
    setShowReplyInput(false);

    // Auto-hide after 5 seconds to keep the game screen clean
    const timer = setTimeout(() => {
      setVisibleMessage((current) => (current?.id === latestPartnerMessage.id ? null : current));
      setShowReplyInput(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [latestPartnerMessage, role]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSendMainChatMessage(replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
      setVisibleMessage(null);
    } catch (err) {
      console.error('Failed to reply from game bubble:', err);
    } finally {
      setIsSending(false);
    }
  };

  const partnerName =
    partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');
  const partnerPhoto = partnerProfile?.photo_url;

  return (
    <div className="fixed top-3 left-0 right-0 z-50 pointer-events-none flex justify-center px-4">
      <AnimatePresence>
        {visibleMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 380 }}
            className="pointer-events-auto max-w-[260px] bg-[var(--theme-surface)]/95 backdrop-blur-md border border-[var(--theme-accent)]/40 rounded-full px-2.5 py-1.5 shadow-lg shadow-[var(--theme-accent)]/15 text-[var(--theme-text)] flex flex-col items-center"
          >
            {!showReplyInput ? (
              <div 
                onClick={() => setShowReplyInput(true)}
                className="w-full flex items-center gap-2 cursor-pointer select-none"
                title="Tap to reply"
              >
                {/* Avatar with thought bubble */}
                <div className="relative shrink-0">
                  {partnerPhoto ? (
                    <img
                      src={partnerPhoto}
                      alt={partnerName}
                      className="w-6 h-6 rounded-full object-cover border border-[var(--theme-accent)]/50"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-[10px]">
                      {partnerName.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 text-[9px] leading-none select-none">
                    💭
                  </span>
                </div>

                {/* Compact Text Preview */}
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-[11px] font-semibold text-[var(--theme-text)] truncate leading-tight">
                    {visibleMessage.media?.type === 'audio' ? (
                      <span className="flex items-center gap-1 text-[var(--theme-accent)]">
                        <Mic className="w-3 h-3" /> Voice
                      </span>
                    ) : visibleMessage.media?.type === 'image' ? (
                      <span className="flex items-center gap-1 text-[var(--theme-accent)]">
                        <ImageIcon className="w-3 h-3" /> Photo
                      </span>
                    ) : (
                      visibleMessage.text || '...'
                    )}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleMessage(null);
                    setShowReplyInput(false);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--theme-text)]/40 hover:text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/15 transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSendReply}
                className="w-full flex items-center gap-1.5 pl-1"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply...`}
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent text-[11px] text-[var(--theme-text)] focus:outline-none placeholder:text-[var(--theme-text)]/40"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="p-1 bg-[var(--theme-accent)] text-white rounded-full active:scale-95 disabled:opacity-40 transition-all shrink-0"
                >
                  <Send className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplyInput(false)}
                  className="p-1 text-[var(--theme-text)]/50 hover:text-[var(--theme-text)] shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
