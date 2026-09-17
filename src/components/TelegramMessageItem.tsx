import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Reply, 
  Trash2, 
  RefreshCw, 
  CheckCheck, 
  CornerUpLeft 
} from 'lucide-react';
import { TelegramVaultMessage } from '../lib/telegramService';
import { UserProfile } from '../types';
import { useOverlayBack } from '../lib/overlayManager';

interface TelegramMessageItemProps {
  msg: TelegramVaultMessage;
  myRole: 'owner' | 'partner';
  partnerName: string;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  shouldShowAvatar: boolean;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onReply: (msg: TelegramVaultMessage) => void;
  onReact: (msg: TelegramVaultMessage, emoji: string) => void;
  onDelete: (msg: TelegramVaultMessage) => void;
  onScrollToMessage: (id: string) => void;
  onViewImage: (url: string) => void;
}

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export const TelegramMessageItem: React.FC<TelegramMessageItemProps> = React.memo(({
  msg,
  myRole,
  partnerName,
  isFirstInGroup,
  isLastInGroup,
  shouldShowAvatar,
  partnerProfile,
  onReply,
  onReact,
  onDelete,
  onScrollToMessage,
  onViewImage
}) => {
  const isMe = msg.sender_role === myRole;
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Floating emoji reaction picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('top');
  
  // Double-tap & heart burst state
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartBurstTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastDoubleTapTimeRef = useRef<number>(0);
  
  // Long-press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredTimeRef = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastHapticTimeRef = useRef<number>(0);

  // Swipe-to-reply motion values
  const swipeX = useMotionValue(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const hasTriggeredReplyThreshold = useRef(false);

  // Close reaction picker on Android back button or escape
  useOverlayBack(showPicker, () => setShowPicker(false), `telegram-reaction-picker-${msg.id}`);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (heartBurstTimerRef.current) clearTimeout(heartBurstTimerRef.current);
    };
  }, []);

  const triggerHaptic = (duration: number = 24, minGapMs: number = 140) => {
    const now = Date.now();
    if (now - lastHapticTimeRef.current < minGapMs) return;
    lastHapticTimeRef.current = now;
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(duration);
      } catch (_) {}
    }
  };

  const triggerLongPress = () => {
    if (isSwiping) return;
    const now = Date.now();
    if (now - longPressTriggeredTimeRef.current < 800) return;
    longPressTriggeredTimeRef.current = now;

    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      if (rect.top < 140) {
        setPickerPosition('bottom');
      } else {
        setPickerPosition('top');
      }
    }

    triggerHaptic(24, 200);
    setShowPicker(true);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSwiping) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const isClosePos =
      lastTapPosRef.current &&
      Math.abs(e.clientX - lastTapPosRef.current.x) < 32 &&
      Math.abs(e.clientY - lastTapPosRef.current.y) < 32;

    // Double-tap ❤️ detection
    if (timeSinceLastTap > 30 && timeSinceLastTap < 330 && isClosePos) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      lastTapTimeRef.current = 0;
      lastTapPosRef.current = null;
      touchStartPos.current = null;
      lastDoubleTapTimeRef.current = now;

      triggerHaptic(30, 100);
      setShowHeartBurst(true);
      if (heartBurstTimerRef.current) clearTimeout(heartBurstTimerRef.current);
      heartBurstTimerRef.current = setTimeout(() => setShowHeartBurst(false), 700);
      onReact(msg, '❤️');
      return;
    }

    lastTapTimeRef.current = now;
    lastTapPosRef.current = { x: e.clientX, y: e.clientY };
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      triggerLongPress();
    }, 360);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.clientX - touchStartPos.current.x);
    const dy = Math.abs(e.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      lastTapTimeRef.current = 0;
      lastTapPosRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  // Swipe animation interpolations
  const swipeOpacity = useTransform(swipeX, [0, 8, 24], [0, 0.5, 1]);
  const replyIconScale = useTransform(swipeX, [0, 8, 24, 44], [0.4, 0.75, 1, 1.15]);
  const replyIconTranslateX = useTransform(swipeX, [0, 24], [-12, 0]);

  // Own message reversed swipe (drag to the left)
  const ownSwipeOpacity = useTransform(swipeX, [0, -8, -24], [0, 0.5, 1]);
  const ownReplyIconScale = useTransform(swipeX, [0, -8, -24, -44], [0.4, 0.75, 1, 1.15]);
  const ownReplyIconTranslateX = useTransform(swipeX, [0, -24], [12, 0]);

  const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

  // Conversational grouping margins
  const verticalMargin = isFirstInGroup ? 'mt-2 sm:mt-2.5' : 'mt-[2px] sm:mt-[3px]';

  // WhatsApp-tail corner styling
  const bubbleCorners = isMe
    ? `${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${isLastInGroup ? 'rounded-br-xs' : 'rounded-br-md'} rounded-l-2xl`
    : `${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${isLastInGroup ? 'rounded-bl-xs' : 'rounded-bl-md'} rounded-r-2xl`;

  return (
    <div 
      id={`vault-msg-${msg.id}`}
      ref={itemRef}
      className={`relative w-full flex flex-col ${verticalMargin} select-none transition-colors duration-300`}
    >
      {/* Swipe to reply reveal indicator */}
      {!isMe ? (
        <motion.div
          style={{
            opacity: swipeOpacity,
            scale: replyIconScale,
            x: replyIconTranslateX,
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-md flex items-center justify-center pointer-events-none z-0"
        >
          <CornerUpLeft className="w-4 h-4 text-[var(--theme-accent)]" />
        </motion.div>
      ) : (
        <motion.div
          style={{
            opacity: ownSwipeOpacity,
            scale: ownReplyIconScale,
            x: ownReplyIconTranslateX,
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-md flex items-center justify-center pointer-events-none z-0"
        >
          <CornerUpLeft className="w-4 h-4 text-[var(--theme-accent)]" />
        </motion.div>
      )}

      {/* Swipeable content row */}
      <motion.div
        style={{ x: swipeX }}
        drag="x"
        dragDirectionLock
        dragConstraints={isMe ? { left: -60, right: 0 } : { left: 0, right: 60 }}
        dragElastic={0.2}
        dragMomentum={false}
        onDragStart={() => {
          setIsSwiping(true);
          hasTriggeredReplyThreshold.current = false;
        }}
        onDrag={(_e, info) => {
          const currentX = swipeX.get();
          const isPast = isMe
            ? (currentX <= -26 || info.offset.x <= -26)
            : (currentX >= 26 || info.offset.x >= 26);

          if (isPast && !hasTriggeredReplyThreshold.current) {
            hasTriggeredReplyThreshold.current = true;
            triggerHaptic(24, 120);
          } else if (!isPast && hasTriggeredReplyThreshold.current && (isMe ? currentX > -16 : currentX < 16)) {
            hasTriggeredReplyThreshold.current = false;
          }
        }}
        onDragEnd={(_e, info) => {
          setTimeout(() => setIsSwiping(false), 60);
          const currentX = swipeX.get();
          const passedThreshold = isMe
            ? (currentX <= -24 || info.offset.x <= -50 || hasTriggeredReplyThreshold.current)
            : (currentX >= 24 || info.offset.x >= 50 || hasTriggeredReplyThreshold.current);

          if (passedThreshold) {
            onReply(msg);
            triggerHaptic(26, 120);
            const inputEl = document.getElementById('vault-message-input') as HTMLInputElement | null;
            inputEl?.focus({ preventScroll: true });
          }
          hasTriggeredReplyThreshold.current = false;
        }}
        className={`relative w-full flex items-start px-1 sm:px-2 select-none ${isMe ? 'justify-end' : 'justify-start'}`}
      >
        {/* Partner Avatar clustering (first message only, zero shift spacer for subsequent) */}
        {!isMe && (
          shouldShowAvatar ? (
            <div
              className="flex-shrink-0 w-8 mr-2 self-start mt-0.5 cursor-pointer active:scale-95 transition-transform"
              onClick={() => partnerProfile?.photo_url && onViewImage(partnerProfile.photo_url)}
            >
              {partnerProfile?.photo_url ? (
                <img
                  src={partnerProfile.photo_url}
                  alt="P"
                  className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-accent)]/30 ring-1 ring-[var(--theme-accent)]/20 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/15 flex items-center justify-center text-[var(--theme-accent)] font-bold text-xs border-2 border-[var(--theme-accent)]/30 ring-1 ring-[var(--theme-accent)]/20">
                  {partnerName?.[0] || 'P'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 w-8 mr-2 pointer-events-none" aria-hidden="true" />
          )
        )}

        {/* Bubble wrapper */}
        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] min-w-0 ${isMe ? 'items-end' : 'items-start'} z-10`}>
          <div className={`relative group max-w-full min-w-0 ${hasReactions ? 'mb-[18px]' : ''}`}>
            
            {/* Long-press floating emoji reaction picker */}
            <AnimatePresence>
              {showPicker && !isSwiping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: pickerPosition === 'bottom' ? -6 : 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: pickerPosition === 'bottom' ? -6 : 6 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
                  className={`absolute ${
                    pickerPosition === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                  } z-50 bg-[var(--theme-surface)] shadow-[0_4px_20px_rgba(0,0,0,0.18)] border border-[var(--theme-border)] p-1 sm:p-1.5 rounded-full flex items-center gap-0.5 sm:gap-1 w-max ${
                    isMe ? 'right-0' : 'left-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {EMOJIS.map((e) => (
                    <motion.button
                      key={e}
                      whileTap={{ scale: 0.85 }}
                      onPointerDown={(eDown) => eDown.preventDefault()}
                      onClick={(eClick) => {
                        eClick.stopPropagation();
                        onReact(msg, e);
                        setShowPicker(false);
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg rounded-full hover:bg-[var(--theme-accent)]/10 active:scale-90 transition-all cursor-pointer"
                    >
                      {e}
                    </motion.button>
                  ))}
                  
                  {/* Quick Delete button in reaction bar for own messages */}
                  {isMe && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(eClick) => {
                        eClick.stopPropagation();
                        setShowPicker(false);
                        onDelete(msg);
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-red-500/15 text-red-500 transition-all ml-0.5 cursor-pointer"
                      title="Delete from Vault"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Chat Bubble */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`leading-relaxed shadow-xs relative transition-all select-none max-w-full min-w-0 break-words px-3.5 py-2 text-[14.5px] sm:text-[15.5px] ${bubbleCorners}`}
              style={{
                backgroundColor: isMe ? 'var(--theme-bubble-owner)' : 'var(--theme-bubble-partner)',
                color: isMe ? 'var(--theme-bubble-owner-text)' : 'var(--theme-bubble-partner-text)',
                borderColor: isMe ? 'transparent' : 'var(--theme-border)',
                borderWidth: isMe ? '0px' : '1px',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
              {/* Reply Quote context */}
              {msg.replyTo && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrollToMessage(msg.replyTo!.id);
                  }}
                  className="mb-1.5 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all select-none w-full max-w-full min-w-0 overflow-hidden"
                  style={{
                    backgroundColor: isMe ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.06)',
                    borderColor: 'var(--theme-accent)',
                    color: isMe ? 'var(--theme-bubble-owner-text)' : 'var(--theme-bubble-partner-text)',
                  }}
                >
                  <p className="font-bold mb-0.5 opacity-80 truncate max-w-full">
                    {msg.replyTo.sender_role === myRole ? 'You' : partnerName}
                  </p>
                  <p className="italic truncate opacity-90 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    "{msg.replyTo.text}"
                  </p>
                </div>
              )}

              {/* Media Attachment if available */}
              {msg.media && msg.media.url && (
                <div className="mb-2 rounded-xl overflow-hidden cursor-pointer" onClick={() => onViewImage(msg.media!.url)}>
                  <img
                    src={msg.media.url}
                    alt="Media Attachment"
                    className="max-h-64 sm:max-h-80 w-full object-cover rounded-xl transition-transform hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Message Text & Inline Timestamp */}
              <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1 min-w-[65px] select-none">
                <span 
                  className="whitespace-pre-wrap flex-1 break-words font-normal"
                  style={{ color: isMe ? 'var(--theme-bubble-owner-text)' : 'var(--theme-bubble-partner-text)' }}
                >
                  {msg.text}
                </span>

                <div 
                  className="ml-auto flex shrink-0 items-center justify-end gap-1 overflow-visible whitespace-nowrap text-[10px] leading-none tracking-tight font-medium select-none opacity-70"
                  style={{ color: isMe ? 'var(--theme-bubble-owner-text)' : 'var(--theme-bubble-partner-text)' }}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                    msg.id.startsWith('temp_') ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-80" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                    )
                  )}
                </div>
              </div>

              {/* Instagram-style floating heart pop on double-tap */}
              <AnimatePresence>
                {showHeartBurst && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.35, 1], opacity: [0, 1, 0] }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                  >
                    <span className="text-4xl sm:text-5xl select-none drop-shadow-md">❤️</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reactions display - WhatsApp-style attached badge */}
            {hasReactions && (
              <div
                className={`absolute top-[calc(100%-5px)] flex items-center z-20 pointer-events-auto select-none ${
                  isMe ? 'right-4 justify-end' : 'left-4 justify-start'
                }`}
              >
                <motion.div
                  layout
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="flex items-center gap-1 h-[22px] sm:h-[24px] px-1.5 sm:px-2 rounded-full border-2 shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-all"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-bg)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {Object.entries(msg.reactions || {}).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact(msg, emoji);
                      }}
                      className="flex items-center gap-0.5 cursor-pointer hover:scale-110 active:scale-90 transition-transform select-none"
                      title={`React with ${emoji}`}
                    >
                      <span className="text-[12px] sm:text-[13px] leading-none select-none">
                        {emoji}
                      </span>
                      {count > 1 && (
                        <span className="text-[10px] font-bold leading-none select-none text-[var(--theme-text)]/75">
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
              </div>
            )}

            {/* Desktop Hover Quick Action Buttons */}
            <div className={`hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 ${isMe ? '-left-16' : '-right-16'} items-center gap-1 z-10`}>
              <button
                onClick={() => onReply(msg)}
                className="p-1.5 rounded-full bg-[var(--theme-surface)] hover:bg-[var(--theme-accent)] hover:text-white border border-[var(--theme-border)] text-xs transition-colors shadow-2xs cursor-pointer"
                title="Reply"
              >
                <Reply className="w-3 h-3" />
              </button>
              {isMe && (
                <button
                  onClick={() => onDelete(msg)}
                  className="p-1.5 rounded-full bg-[var(--theme-surface)] hover:bg-red-500 hover:text-white border border-[var(--theme-border)] text-xs transition-colors text-red-500 shadow-2xs cursor-pointer"
                  title="Delete from Vault"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
});
