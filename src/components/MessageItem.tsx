import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { CornerUpLeft, Clock3, Check, Ban, Gamepad2 } from 'lucide-react';
import { Message, UserRole, UserProfile, MediaAttachment } from '../types';
import { getMillis, parseDate } from '../lib/dateUtils';
import { useOverlayBack } from '../lib/overlayManager';
import { WhatsAppMediaBubble } from './WhatsAppMediaBubble';
import { parseInstagramReel, extractTextWithoutInstagramUrl, InstagramReelInfo } from '../lib/instagram';
import { InstagramReelCard } from './InstagramReelCard';

interface MessageItemProps {
  msg: Message;
  role: UserRole;
  allMessages?: Message[];
  replyToMessage?: Message;
  onReact: (id: string, emoji: string) => Promise<void>;
  isSelected: boolean;
  selectionCount?: number;
  onToggleSelect: (msg: Message) => void;
  selectionActive: boolean;
  onReply: (msg: Message) => void;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onViewImage: (url: string) => void;
  onViewMedia?: (media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => void;
  isInteractionPoint?: boolean;
  showSeenText?: boolean;
  partnerLastReadAt: number;
  isPartnerOnline: boolean;
  onJoinGame?: (game: { id: string; type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' }) => void;
  onTriggerNudge?: (type: string) => void;
  onFocusInput?: () => void;
  onOpenReel?: (reel: InstagramReelInfo) => void;
}

function MessageItemComponent({
  msg,
  role,
  allMessages,
  replyToMessage,
  onReact,
  isSelected,
  selectionCount,
  onToggleSelect,
  selectionActive,
  onReply,
  userProfile,
  partnerProfile,
  onViewImage,
  onViewMedia,
  isInteractionPoint,
  showSeenText,
  partnerLastReadAt,
  isPartnerOnline,
  onJoinGame,
  onTriggerNudge,
  onFocusInput,
  onOpenReel,
}: MessageItemProps) {
  const isOwn = msg.sender_role === role;
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredTimeRef = useRef<number>(0);
  const lastHapticTimeRef = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const emojis = ['❤️', '😂', '😮', '😢', '😡', '👍'];
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('top');
  const [isSwiping, setIsSwiping] = useState(false);
  const hasTriggeredReplyThreshold = useRef(false);

  // Close reaction picker on back button
  useOverlayBack(showPicker, () => setShowPicker(false), `message-reaction-picker-${msg.id}`);

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

  const resolvedReplyTo = useMemo(() => {
    const replyId = msg.replyTo?.id || (msg as any).reply_to;
    if (!replyId && !msg.replyTo) return null;

    const original = replyToMessage || (replyId && allMessages ? allMessages.find((m) => m.id === replyId) : undefined);
    if (original) {
      const isOrigDeletedByMe = original.deletedBy ? original.deletedBy === role : original.sender_role === role;
      return {
        id: original.id,
        text: original.deleted
          ? isOrigDeletedByMe
            ? 'You deleted this message'
            : 'This message was deleted'
          : original.text || (original.media ? '📷 Photo' : 'Original message'),
        sender_role: original.sender_role,
      };
    }

    if (msg.replyTo && msg.replyTo.text && msg.replyTo.text !== 'Replied Message') {
      return msg.replyTo;
    }

    return msg.replyTo || null;
  }, [msg.replyTo, (msg as any).reply_to, replyToMessage, allMessages, role]);

  const detectedReel = useMemo(() => {
    if (msg.deleted || !msg.text) return null;
    return parseInstagramReel(msg.text);
  }, [msg.deleted, msg.text]);

  const textWithoutUrl = useMemo(() => {
    if (!detectedReel || !msg.text) return msg.text;
    return extractTextWithoutInstagramUrl(msg.text);
  }, [detectedReel, msg.text]);

  useEffect(() => {
    if (!showPicker) return;
    const handleOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node;
      if (itemRef.current && itemRef.current.contains(target)) {
        return;
      }
      setShowPicker(false);
    };
    window.addEventListener('scroll', () => setShowPicker(false), true);
    document.addEventListener('pointerup', handleOutside, true);
    return () => {
      window.removeEventListener('scroll', () => setShowPicker(false), true);
      document.removeEventListener('pointerup', handleOutside, true);
    };
  }, [showPicker]);

  const getSenderName = (r: UserRole) => {
    if (r === role) return 'You';
    if (userProfile?.partnerNicknames) {
      const keys = Object.keys(userProfile.partnerNicknames);
      if (keys.length > 0) return userProfile.partnerNicknames[keys[0]];
    }
    return r === 'owner' ? 'Rahul' : 'Nusrat';
  };

  const triggerLongPress = () => {
    if (isSwiping) return;
    const now = Date.now();
    if (now - longPressTriggeredTimeRef.current < 800) return;
    longPressTriggeredTimeRef.current = now;

    if (typeof window !== 'undefined' && window.getSelection) {
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_) {}
    }

    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      if (rect.top < 140) {
        setPickerPosition('bottom');
      } else {
        setPickerPosition('top');
      }
    }

    triggerHaptic(24, 220);

    if (!msg.deleted) setShowPicker(true);
    if (!isSelected) onToggleSelect(msg);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSwiping) return;

    if (e.pointerType === 'touch') {
      if (typeof window !== 'undefined' && window.getSelection) {
        try {
          window.getSelection()?.removeAllRanges();
        } catch (_) {}
      }
    }
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (selectionActive) return;

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
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const handleClick = () => {
    const now = Date.now();
    if (now - longPressTriggeredTimeRef.current < 350) {
      return;
    }

    if (isSwiping) return;

    if (showPicker) {
      setShowPicker(false);
    }

    if (selectionActive || isSelected) {
      onToggleSelect(msg);
    }
  };

  const swipeX = useMotionValue(0);
  // Transforms for partner message (swiping to the right)
  const swipeOpacity = useTransform(swipeX, [0, 8, 24], [0, 0.5, 1]);
  const replyIconScale = useTransform(swipeX, [0, 8, 24, 44], [0.4, 0.75, 1, 1.15]);
  const replyIconTranslateX = useTransform(swipeX, [0, 24], [-12, 0]);

  // Transforms for own message (reversed swipe: swiping to the left)
  const ownSwipeOpacity = useTransform(swipeX, [0, -8, -24], [0, 0.5, 1]);
  const ownReplyIconScale = useTransform(swipeX, [0, -8, -24, -44], [0.4, 0.75, 1, 1.15]);
  const ownReplyIconTranslateX = useTransform(swipeX, [0, -24], [12, 0]);

  const formatSeenTime = (timestamp: any) => {
    if (!timestamp) return 'Seen';
    const date = parseDate(timestamp);
    const now = new Date();
    const diff = Math.max(0, (now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Seen just now';
    if (diff < 3600) return `Seen ${Math.floor(diff / 60)}m ago`;
    return `Seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const displayTime = () => {
    if (!msg.timestamp) return '';
    const date = parseDate(msg.timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderReceipt = (onDarkOverlay: boolean = false) => {
    if (!isOwn || msg.deleted) return null;
    if (msg.deliveryStatus === 'sending') {
      return <Clock3 aria-label="Sending" className={`w-3 h-3 ${onDarkOverlay ? 'text-white/80' : 'text-current'}`} />;
    }
    if (msg.deliveryStatus === 'failed') {
      return <Clock3 aria-label="Send failed" className="w-3 h-3 text-red-500" />;
    }

    const wasRead = getMillis(msg.timestamp) > 0 && getMillis(msg.timestamp) <= partnerLastReadAt;
    if (wasRead) {
      return (
        <span
          aria-label="Read"
          className="inline-flex items-center relative w-[19px] h-4 flex-none overflow-visible select-none"
        >
          <Check
            aria-hidden="true"
            className={`w-4 h-4 absolute left-0 top-0 block flex-none ${
              onDarkOverlay ? 'text-sky-300' : 'text-[#34B7F1]'
            }`}
            strokeWidth={2.4}
          />
          <Check
            aria-hidden="true"
            className={`w-4 h-4 absolute left-[5px] top-0 block flex-none ${
              onDarkOverlay ? 'text-sky-300' : 'text-[#34B7F1]'
            }`}
            strokeWidth={2.4}
          />
        </span>
      );
    }
    if (isPartnerOnline) {
      return (
        <span
          aria-label="Delivered"
          className={`inline-flex items-center relative w-[19px] h-4 flex-none overflow-visible select-none ${
            onDarkOverlay ? 'text-white/90' : 'text-current opacity-70'
          }`}
        >
          <Check
            aria-hidden="true"
            className="w-4 h-4 absolute left-0 top-0 block flex-none"
            strokeWidth={2.4}
          />
          <Check
            aria-hidden="true"
            className="w-4 h-4 absolute left-[5px] top-0 block flex-none"
            strokeWidth={2.4}
          />
        </span>
      );
    }
    return (
      <Check
        aria-label="Sent"
        className={`block w-4 h-4 flex-none overflow-visible ${
          onDarkOverlay ? 'text-white/90' : 'text-current opacity-70'
        }`}
        strokeWidth={2.4}
      />
    );
  };

  const hasMedia = Boolean(
    (msg.media && (msg.media.url || (msg.media.mediaList && msg.media.mediaList.length > 0))) ||
      (msg.mediaList && msg.mediaList.length > 0)
  );
  const isAudioMedia = Boolean(msg.media?.type === 'audio');
  const isMediaOnly = hasMedia && !isAudioMedia && !msg.text && !msg.gameInvite && !resolvedReplyTo && !msg.deleted;
  const isDeletedByMe = Boolean((msg.deletedBy && msg.deletedBy === role) || (!msg.deletedBy && msg.sender_role === role));

  return (
    <div
      ref={itemRef}
      id={`msg-${msg.id}`}
      className={`chat-message-row relative w-full flex transition-all duration-200 select-none py-1.5 cursor-default rounded-2xl ${
        isSelected ? 'is-active-row bg-[var(--theme-accent)]/20 backdrop-blur-[1px]' : 'hover:bg-[var(--theme-accent)]/5'
      } ${showPicker ? 'is-active-row z-[60]' : 'z-auto'} ${isOwn ? 'justify-end' : 'justify-start'}`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Absolute Rubber-band Reply Hint behind incoming message (swiped right) */}
      {!isOwn && (
        <motion.div
          style={{
            opacity: swipeOpacity,
            scale: replyIconScale,
            x: replyIconTranslateX,
          }}
          className="absolute left-3 lg:left-5 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/15 backdrop-blur-sm border border-[var(--theme-accent)]/25 flex items-center justify-center shadow-sm">
            <CornerUpLeft className="w-4 h-4 text-[var(--theme-accent)]" />
          </div>
        </motion.div>
      )}

      {/* Absolute Rubber-band Reply Hint behind outgoing message (swiped left) */}
      {isOwn && (
        <motion.div
          style={{
            opacity: ownSwipeOpacity,
            scale: ownReplyIconScale,
            x: ownReplyIconTranslateX,
          }}
          className="absolute right-3 lg:right-5 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/15 backdrop-blur-sm border border-[var(--theme-accent)]/25 flex items-center justify-center shadow-sm">
            <CornerUpLeft className="w-4 h-4 text-[var(--theme-accent)]" />
          </div>
        </motion.div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragSnapToOrigin
        dragElastic={isOwn ? { left: 0.38, right: 0 } : { left: 0, right: 0.38 }}
        dragMomentum={false}
        dragDirectionLock
        dragListener={!showPicker && !selectionActive}
        dragTransition={{
          bounceStiffness: 640,
          bounceDamping: 28,
          power: 0.1,
          timeConstant: 120,
        }}
        style={{
          x: swipeX,
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          touchAction: 'pan-y',
          willChange: isSwiping ? 'transform' : 'auto',
        }}
        onDragStart={() => {
          setIsSwiping(true);
          hasTriggeredReplyThreshold.current = false;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onDrag={(_e, info) => {
          const currentX = swipeX.get();
          const isPast = isOwn
            ? (currentX <= -25 || info.offset.x <= -65)
            : (currentX >= 25 || info.offset.x >= 65);

          if (isPast && !hasTriggeredReplyThreshold.current) {
            hasTriggeredReplyThreshold.current = true;
            triggerHaptic(18, 80);
          } else if (!isPast && hasTriggeredReplyThreshold.current && (isOwn ? currentX > -16 : currentX < 16)) {
            hasTriggeredReplyThreshold.current = false;
          }
        }}
        onDragEnd={(_e, info) => {
          setTimeout(() => setIsSwiping(false), 60);
          const currentX = swipeX.get();
          const passedThreshold = isOwn
            ? (currentX <= -24 ||
               info.offset.x <= -60 ||
               (info.offset.x <= -24 && info.velocity.x < -380) ||
               hasTriggeredReplyThreshold.current)
            : (currentX >= 24 ||
               info.offset.x >= 60 ||
               (info.offset.x >= 24 && info.velocity.x > 380) ||
               hasTriggeredReplyThreshold.current);

          if (passedThreshold) {
            onReply(msg);
            triggerHaptic(26, 120);
            const inputEl = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
            inputEl?.focus({ preventScroll: true });
            onFocusInput?.();
          }
          hasTriggeredReplyThreshold.current = false;
        }}
        className="relative w-full flex items-end px-2 lg:px-4 select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {!isOwn && (
          <div
            className="flex-shrink-0 mr-2 self-end mb-1 cursor-pointer active:scale-95 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              if (selectionActive || isSelected) {
                onToggleSelect(msg);
                return;
              }
              partnerProfile?.photo_url && onViewImage(partnerProfile.photo_url);
            }}
          >
            {partnerProfile?.photo_url ? (
              <img
                src={partnerProfile.photo_url}
                alt="P"
                className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-accent)]/30 ring-1 ring-[var(--theme-accent)]/20 shadow-sm"
                referrerPolicy="no-referrer"
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitTouchCallout: 'none' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/15 flex items-center justify-center text-[var(--theme-accent)] font-bold text-xs border-2 border-[var(--theme-accent)]/30 ring-1 ring-[var(--theme-accent)]/20">
                {partnerProfile?.display_name?.[0] || 'P'}
              </div>
            )}
          </div>
        )}

        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} z-10`}>
          <div className="relative group max-w-full min-w-0">
            <AnimatePresence>
              {showPicker && !isSwiping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: pickerPosition === 'bottom' ? -10 : 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: pickerPosition === 'bottom' ? -10 : 10 }}
                  className={`absolute ${
                    pickerPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
                  } z-50 bg-[var(--theme-surface)]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[var(--theme-border)] p-1.5 rounded-full flex gap-1 w-max ${
                    isOwn ? 'right-0' : 'left-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {emojis.map((e) => {
                    const isActive = msg.reactions?.[role] === e;
                    return (
                      <motion.button
                        key={e}
                        whileTap={{ scale: 0.8 }}
                        onPointerDown={(eDown) => eDown.preventDefault()}
                        onClick={(eClick) => {
                          eClick.stopPropagation();
                          onReact(msg.id, e);
                          setShowPicker(false);
                        }}
                        className={`w-10 h-10 flex items-center justify-center text-xl rounded-full transition-all relative ${
                          isActive ? 'bg-[var(--theme-accent)]/20 scale-110' : 'hover:bg-[var(--theme-accent)]/10'
                        }`}
                      >
                        {e}
                        {isActive && (
                          <motion.div
                            layoutId="reaction-bg"
                            className="absolute inset-0 bg-[var(--theme-accent)]/15 rounded-full -z-10"
                          />
                        )}
                      </motion.button>
                    );
                  })}
                  <div className="w-[1px] h-6 bg-[var(--theme-border)] self-center mx-0.5" />
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onPointerDown={(eDown) => eDown.preventDefault()}
                    onClick={(eClick) => {
                      eClick.stopPropagation();
                      setShowPicker(false);
                      onReply(msg);
                      triggerHaptic(24, 120);
                      const inputEl = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
                      inputEl?.focus({ preventScroll: true });
                      onFocusInput?.();
                    }}
                    className="h-10 px-2.5 flex items-center gap-1.5 rounded-full text-xs font-semibold text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 active:bg-[var(--theme-accent)]/20 transition-all cursor-pointer"
                    title="Reply to message"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Reply</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={`leading-relaxed shadow-sm relative transition-all select-none max-w-full min-w-0 break-words ${
                isMediaOnly ? 'p-[3px] rounded-[18px]' : 'px-3 py-2 lg:px-4 lg:py-2.5 text-[15px] lg:text-[16px]'
              } ${isOwn ? 'chat-bubble-owner' : 'chat-bubble-partner'}`}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {/* Show reply context */}
              {resolvedReplyTo && !msg.deleted && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`msg-${resolvedReplyTo.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('theme-message-focus');
                      setTimeout(() => el.classList.remove('theme-message-focus'), 1400);
                    }
                  }}
                  className={`theme-reply-context ${
                    isOwn ? 'theme-reply-context-owner' : 'theme-reply-context-partner'
                  } mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all select-none w-full max-w-full min-w-0 overflow-hidden`}
                >
                  <p className="font-bold mb-0.5 opacity-75 truncate max-w-full">
                    {getSenderName(resolvedReplyTo.sender_role)}
                  </p>
                  <p className="italic truncate opacity-90 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    "{resolvedReplyTo.text}"
                  </p>
                </div>
              )}

              {/* Media attachment */}
              {(msg.media || msg.mediaList) && !msg.deleted && (
                <div className={!isMediaOnly ? 'mb-2' : ''}>
                  <WhatsAppMediaBubble
                    media={msg.media || msg.mediaList![0]}
                    mediaList={msg.mediaList || msg.media?.mediaList}
                    isOwn={isOwn}
                    selectionActive={selectionActive || isSelected}
                    onToggleSelect={() => onToggleSelect(msg)}
                    onOpenViewer={(media, fullList, initialIndex) => {
                      if (selectionActive || isSelected) {
                        onToggleSelect(msg);
                        return;
                      }
                      onViewMedia?.(media, fullList, initialIndex);
                    }}
                    deleted={msg.deleted}
                    messageId={msg.id}
                    senderRole={msg.sender_role}
                    currentRole={role}
                    deliveryStatus={msg.deliveryStatus}
                    timestampOverlay={
                      isMediaOnly ? (
                        <div className="bg-black/45 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] text-white/95 font-medium shadow-md">
                          <span>{displayTime()}</span>
                          {renderReceipt(true)}
                        </div>
                      ) : undefined
                    }
                  />
                </div>
              )}

              {!isMediaOnly && (
                <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1 min-w-[70px] select-none">
                  {msg.deleted ? (
                    <div className="flex items-center gap-1.5 py-0.5 select-none text-[13.5px] lg:text-[14.5px] italic opacity-75 font-normal tracking-tight">
                      <Ban className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span>{isDeletedByMe ? 'You deleted this message' : 'This message was deleted'}</span>
                    </div>
                  ) : detectedReel ? (
                    <div className="flex-1 min-w-0 flex flex-col select-none">
                      {textWithoutUrl ? (
                        <span
                          className="whitespace-pre-wrap break-words mb-1"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                        >
                          {textWithoutUrl}
                          {msg.isEdited && <span className="text-[9px] opacity-40 ml-1 italic tracking-tight">(edited)</span>}
                        </span>
                      ) : null}
                      <InstagramReelCard
                        reel={detectedReel}
                        isOwn={isOwn}
                        onWatch={() => onOpenReel?.(detectedReel)}
                        selectionActive={selectionActive || isSelected}
                      />
                    </div>
                  ) : msg.text ? (
                    <span
                      className="whitespace-pre-wrap flex-1 break-words select-none"
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                    >
                      {msg.text}
                      {msg.isEdited && <span className="text-[9px] opacity-40 ml-1 italic tracking-tight">(edited)</span>}
                    </span>
                  ) : null}
                  <div
                    className="ml-auto flex shrink-0 items-center justify-end gap-1 overflow-visible whitespace-nowrap text-[10px] leading-none tracking-tight font-medium select-none"
                  >
                    <span className="opacity-60">{displayTime()}</span>
                    {renderReceipt(false)}
                  </div>
                </div>
              )}

              {msg.gameInvite && !msg.deleted && (
                <div className="mt-4 pt-4 border-t border-black/5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isOwn ? 'bg-white text-[var(--theme-accent)]' : 'bg-[var(--theme-accent)] text-white'
                      }`}
                    >
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[11px] font-bold ${isOwn ? 'text-white' : 'text-[var(--theme-text)]'}`}>
                        {msg.gameInvite?.gameType === 'connecthearts'
                          ? 'Connect Hearts 💖'
                          : msg.gameInvite?.gameType === 'dotsandboxes'
                          ? 'Dots & Hearts 💕'
                          : 'Tic Tac Toe 🎮'}
                      </p>
                      <p
                        className={`text-[9px] uppercase tracking-wider opacity-60 ${
                          isOwn ? 'text-white' : 'text-[var(--theme-text)]/70'
                        }`}
                      >
                        Match Challenge
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectionActive || isSelected) {
                        onToggleSelect(msg);
                        return;
                      }
                      if (msg.gameInvite?.status === 'closed') {
                        return;
                      }
                      onJoinGame?.({ id: msg.gameInvite!.sessionId, type: msg.gameInvite!.gameType });
                    }}
                    disabled={msg.gameInvite?.status === 'closed'}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-sm ${
                      msg.gameInvite?.status === 'closed'
                        ? 'bg-black/10 text-[var(--theme-text)]/40 cursor-not-allowed opacity-60'
                        : isOwn
                        ? 'bg-white text-[var(--theme-accent)] hover:bg-white/90 shadow-white/20 cursor-pointer'
                        : 'bg-[var(--theme-accent)] text-white hover:opacity-90 shadow-[var(--theme-accent)]/20 cursor-pointer'
                    }`}
                  >
                    {msg.gameInvite?.status === 'closed' ? 'Game Ended' : 'Play Now'}
                  </button>
                </div>
              )}
            </div>

            {/* Reactions display - Instagram Style */}
            {msg.reactions && !msg.deleted && Object.keys(msg.reactions).length > 0 && (
              <div className={`absolute -bottom-3 flex -space-x-1.5 ${isOwn ? 'right-2' : 'left-5'} z-20`}>
                {Object.entries(
                  Object.values(msg.reactions).reduce((acc: Record<string, number>, emoji: any) => {
                    const key = String(emoji);
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]: [string, any]) => {
                  const userReacted = msg.reactions?.[role] === emoji;
                  return (
                    <motion.div
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={emoji}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact(msg.id, emoji);
                      }}
                      className={`flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-[var(--theme-surface)] border shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:scale-110 transition-transform cursor-pointer text-[13px] ${
                        userReacted
                          ? 'border-[var(--theme-accent)]/70 ring-1 ring-[var(--theme-accent)]/40 z-10'
                          : 'border-[var(--theme-border)] z-0'
                      }`}
                    >
                      <span>{emoji}</span>
                      {count > 1 && <span className="ml-1 text-[10px] font-bold text-[var(--theme-text)]/70">{count}</span>}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Read Receipt Area - Dynamic interaction point */}
            {isInteractionPoint && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-1.5 flex items-center gap-1.5 opacity-50 select-none ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}
              >
                {partnerProfile?.photo_url ? (
                  <img
                    src={partnerProfile.photo_url}
                    alt="S"
                    className="w-3.5 h-3.5 rounded-full object-cover grayscale opacity-60 grayscale-[0.5]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                )}
                {showSeenText && (
                  <span className="text-[10px] font-bold tracking-tight text-[#6E6E6E]">
                    {partnerProfile?.last_read_at ? formatSeenTime(partnerProfile.last_read_at) : 'Seen'}
                  </span>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function areMessagePropsEqual(prev: MessageItemProps, next: MessageItemProps): boolean {
  // 1. Message identity and content checks
  if (prev.msg !== next.msg) {
    const p = prev.msg;
    const n = next.msg;
    if (
      p.id !== n.id ||
      p.text !== n.text ||
      p.deleted !== n.deleted ||
      p.deletedBy !== n.deletedBy ||
      p.deliveryStatus !== n.deliveryStatus ||
      p.isEdited !== n.isEdited ||
      p.timestamp !== n.timestamp ||
      p.media !== n.media ||
      p.gameInvite !== n.gameInvite ||
      JSON.stringify(p.reactions) !== JSON.stringify(n.reactions) ||
      p.replyTo?.id !== n.replyTo?.id ||
      p.replyTo?.text !== n.replyTo?.text
    ) {
      return false;
    }
  }

  // 2. Selection states
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.selectionActive !== next.selectionActive) return false;

  // 3. Interaction frontier & read status
  if (prev.isInteractionPoint !== next.isInteractionPoint) return false;
  if (prev.showSeenText !== next.showSeenText) return false;

  // Read receipts: if partnerLastReadAt crossed this message's timestamp
  if (prev.partnerLastReadAt !== next.partnerLastReadAt && prev.msg.sender_role === prev.role) {
    const msgTs = getMillis(prev.msg.timestamp);
    const prevSeen = msgTs > 0 && msgTs <= prev.partnerLastReadAt;
    const nextSeen = msgTs > 0 && msgTs <= next.partnerLastReadAt;
    if (prevSeen !== nextSeen) return false;
  }

  // Partner online state affects delivery double ticks
  if (prev.isPartnerOnline !== next.isPartnerOnline && prev.msg.sender_role === prev.role) {
    return false;
  }

  // 4. Role & profile display changes
  if (prev.role !== next.role) return false;
  if (prev.partnerProfile?.photo_url !== next.partnerProfile?.photo_url) return false;
  if (prev.partnerProfile?.display_name !== next.partnerProfile?.display_name) return false;
  if (prev.partnerProfile?.last_read_at !== next.partnerProfile?.last_read_at && prev.isInteractionPoint) return false;
  if (prev.userProfile?.partnerNicknames !== next.userProfile?.partnerNicknames) return false;

  // 5. Replied message updates
  if (prev.replyToMessage !== next.replyToMessage) {
    if (
      prev.replyToMessage?.deleted !== next.replyToMessage?.deleted ||
      prev.replyToMessage?.text !== next.replyToMessage?.text
    ) {
      return false;
    }
  }

  return true;
}

export const MessageItem = React.memo<MessageItemProps>(MessageItemComponent, areMessagePropsEqual);
