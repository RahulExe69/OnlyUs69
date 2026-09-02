import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Mic, Image as ImageIcon } from 'lucide-react';
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

  // When a new partner message arrives, display it
  useEffect(() => {
    if (!latestPartnerMessage) return;
    
    // Only show if it was sent by partner and is recent (within last 30s)
    const isFromPartner = latestPartnerMessage.sender_role !== role;
    if (!isFromPartner) return;

    setVisibleMessage(latestPartnerMessage);
    setShowReplyInput(false);

    // Auto-hide after 8 seconds if user doesn't interact
    const timer = setTimeout(() => {
      setVisibleMessage((current) => (current?.id === latestPartnerMessage.id ? null : current));
      setShowReplyInput(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [latestPartnerMessage?.id, role]);

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
    <div className="absolute top-16 left-0 right-0 z-30 pointer-events-none flex justify-center px-4">
      <AnimatePresence>
        {visibleMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="pointer-events-auto w-full max-w-sm bg-[var(--theme-surface)]/95 backdrop-blur-xl border border-[var(--theme-accent)]/30 rounded-3xl p-3.5 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.3)] shadow-[var(--theme-accent)]/15 text-[var(--theme-text)]"
          >
            {/* Header: Partner badge + Dismiss */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  {partnerPhoto ? (
                    <img
                      src={partnerPhoto}
                      alt={partnerName}
                      className="w-7 h-7 rounded-full object-cover border border-[var(--theme-accent)]/40"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">
                      {partnerName.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">
                    💭
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black tracking-tight text-[var(--theme-text)]">
                      {partnerName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] rounded-full font-bold">
                      Main Chat
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setVisibleMessage(null);
                  setShowReplyInput(false);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--theme-text)]/40 hover:text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message Content Preview */}
            <div className="pl-9 pr-1">
              <p className="text-xs font-medium text-[var(--theme-text)] leading-relaxed break-words line-clamp-2">
                {visibleMessage.media?.type === 'audio' ? (
                  <span className="flex items-center gap-1.5 text-[var(--theme-accent)] font-semibold">
                    <Mic className="w-3.5 h-3.5" /> Voice Note (
                    {visibleMessage.media.duration || 0}s)
                  </span>
                ) : visibleMessage.media?.type === 'image' ? (
                  <span className="flex items-center gap-1.5 text-[var(--theme-accent)] font-semibold">
                    <ImageIcon className="w-3.5 h-3.5" /> Sent a Photo
                  </span>
                ) : (
                  visibleMessage.text || '...'
                )}
              </p>

              {/* Reply trigger button */}
              {!showReplyInput ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setShowReplyInput(true)}
                    className="text-[11px] font-bold text-[var(--theme-accent)] hover:underline flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    <MessageSquare className="w-3 h-3" /> Quick Reply
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSendReply}
                  className="mt-2.5 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${partnerName}...`}
                    autoFocus
                    className="flex-1 bg-[var(--theme-input-bg)] text-xs text-[var(--theme-text)] rounded-xl px-3 py-1.5 border border-[var(--theme-border)] focus:outline-none focus:border-[var(--theme-accent)]"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className="p-1.5 bg-[var(--theme-accent)] text-white rounded-xl active:scale-95 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
