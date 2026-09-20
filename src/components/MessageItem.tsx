import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { CornerUpLeft, Clock3, Check, Ban, Gamepad2, Archive, Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { Message, UserRole, UserProfile, MediaAttachment, CallType } from '../types';
import { getMillis, parseDate } from '../lib/dateUtils';
import { useOverlayBack } from '../lib/overlayManager';
import { WhatsAppMediaBubble } from './WhatsAppMediaBubble';
import { parseInstagramReel, extractTextWithoutInstagramUrl, InstagramReelInfo } from '../lib/instagram';
import { InstagramReelCard } from './InstagramReelCard';
import { formatCallDuration } from '../lib/callLogService';

interface MessageItemProps {
  msg: Message;
  role: UserRole;
  allMessages?: Message[];
  replyToMessage?: Message;
  onReact: (id: string, emoji: string) => Promise<void>;
  isSelected: boolean;
  selectionCount?: number;
  onToggleSelect: (msg: Message) => void;
  selectionActive?: boolean;
  isSelectionActiveRef?: React.RefObject<boolean>;
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
  onStartCall?: (type: CallType) => void;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
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
  selectionActive = false,
  isSelectionActiveRef,
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
  onStartCall,
  showAvatar,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageItemProps) {
  const isOwn = msg.sender_role === role;
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredTimeRef = useRef<number>(0);
  const lastHapticTimeRef = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastDoubleTapTimeRef = useRef<number>(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartBurstTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkSelectionActive = () => Boolean(isSelectionActiveRef?.current ?? selectionActive);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (heartBurstTimerRef.current) clearTimeout(heartBurstTimerRef.current);
    };
  }, []);

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
      const isOrigMedia = Boolean(
        original.deleted_from_media ||
        (original as any).media_deleted_by ||
        Boolean((original as any).attachment_url) ||
        Boolean(original.media) ||
        Boolean(original.mediaList && original.mediaList.length > 0)
      );
      const isOrigArchived = Boolean(original.deleted_from_media && !original.deleted);
      const origArchiverName = (original.deleted_from_media_by || original.sender_role) === 'owner' ? 'Rahul' : 'Nusrat';
      const origDeleterName = (original.deletedBy || (original as any).media_deleted_by || original.deleted_from_media_by || original.sender_role) === 'owner' ? 'Rahul' : 'Nusrat';

      let replyText = original.text || (original.media ? '📷 Photo' : 'Original message');
      if (original.deleted) {
        replyText = isOrigMedia ? `${origDeleterName} Deleted` : (isOrigDeletedByMe ? 'You deleted this message' : 'This message was deleted');
      } else if (isOrigArchived) {
        replyText = `${origArchiverName} Archived`;
      }

      return {
        id: original.id,
        text: replyText,
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

    const isArchivedMedia = Boolean(msg.deleted_from_media && !msg.deleted);
    if (!msg.deleted && !isArchivedMedia) setShowPicker(true);
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

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const isClosePos =
      lastTapPosRef.current &&
      Math.abs(e.clientX - lastTapPosRef.current.x) < 32 &&
      Math.abs(e.clientY - lastTapPosRef.current.y) < 32;

    // Double-tap ❤️ detection
    if (timeSinceLastTap > 30 && timeSinceLastTap < 330 && isClosePos && !checkSelectionActive()) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      lastTapTimeRef.current = 0;
      lastTapPosRef.current = null;
      touchStartPos.current = null;
      lastDoubleTapTimeRef.current = now;

      if (!msg.deleted) {
        triggerHaptic(30, 100);
        setShowHeartBurst(true);
        if (heartBurstTimerRef.current) clearTimeout(heartBurstTimerRef.current);
        heartBurstTimerRef.current = setTimeout(() => setShowHeartBurst(false), 700);
        onReact(msg.id, '❤️');
      }
      return;
    }

    lastTapTimeRef.current = now;
    lastTapPosRef.current = { x: e.clientX, y: e.clientY };
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (checkSelectionActive()) return;

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

  const handleClick = () => {
    const now = Date.now();
    if (now - longPressTriggeredTimeRef.current < 350) {
      return;
    }

    // Ignore click event if triggered as part of double-tap
    if (now - lastDoubleTapTimeRef.current < 380) {
      return;
    }

    if (isSwiping) return;

    if (showPicker) {
      setShowPicker(false);
    }

    if (checkSelectionActive() || isSelected) {
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

  const isArchivedMedia = Boolean(msg.deleted_from_media && !msg.deleted);

  const renderReceipt = (onDarkOverlay: boolean = false) => {
    if (!isOwn || msg.deleted || isArchivedMedia) return null;
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
    !msg.deleted_from_media &&
    ((msg.media && (msg.media.url || (msg.media.mediaList && msg.media.mediaList.length > 0))) ||
      (msg.mediaList && msg.mediaList.length > 0))
  );
  const isAudioMedia = Boolean(msg.media?.type === 'audio');
  const isMediaOnly = hasMedia && !isAudioMedia && !msg.text && !msg.gameInvite && !resolvedReplyTo && !msg.deleted && !msg.deleted_from_media;
  const isDeletedByMe = Boolean((msg.deletedBy && msg.deletedBy === role) || (!msg.deletedBy && msg.sender_role === role));
  const isMediaDeletedByMe = Boolean(
    (msg.deleted_from_media_by && msg.deleted_from_media_by === role) ||
    (!msg.deleted_from_media_by && msg.sender_role === role)
  );

  const isDeletedMedia = Boolean(
    msg.deleted &&
    (msg.deleted_from_media ||
     (msg as any).media_deleted_by ||
     Boolean((msg as any).attachment_url) ||
     Boolean(msg.media) ||
     Boolean(msg.mediaList && msg.mediaList.length > 0))
  );

  const archiverRole = msg.deleted_from_media_by || msg.sender_role;
  const archiverName = archiverRole === 'owner' ? 'Rahul' : 'Nusrat';

  const deleterRole = msg.deletedBy || (msg as any).media_deleted_by || msg.deleted_from_media_by || msg.sender_role;
  const deleterName = deleterRole === 'owner' ? 'Rahul' : 'Nusrat';
  const hasReactions = Boolean(msg.reactions && !msg.deleted && !isArchivedMedia && Object.keys(msg.reactions).length > 0);
  const isFirst = isFirstInGroup;
  const shouldShowAvatar = showAvatar ?? (!isOwn && isFirst);
  const rowMarginTop = isFirst ? 'mt-2 sm:mt-2.5' : 'mt-[2px] sm:mt-[3px]';
  const rowPadding = hasReactions ? 'pt-[1px] pb-1' : 'py-[1px]';

  return (
    <div
      ref={itemRef}
      id={`msg-${msg.id}`}
      className={`chat-message-row relative w-full flex transition-all duration-200 select-none ${rowMarginTop} ${rowPadding} cursor-default rounded-2xl ${
        isSelected ? 'is-active-row bg-[var(--theme-accent)]/20 backdrop-blur-[1px]' : 'hover:bg-[var(--theme-accent)]/5'
      } ${showPicker ? 'is-active-row z-[60]' : 'z-auto'} ${isOwn ? 'justify-end' : 'justify-start'}`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!msg.deleted && !isArchivedMedia && !checkSelectionActive()) {
          const now = Date.now();
          if (now - lastDoubleTapTimeRef.current > 400) {
            lastDoubleTapTimeRef.current = now;
            triggerHaptic(30, 100);
            setShowHeartBurst(true);
            if (heartBurstTimerRef.current) clearTimeout(heartBurstTimerRef.current);
            heartBurstTimerRef.current = setTimeout(() => setShowHeartBurst(false), 700);
            onReact(msg.id, '❤️');
          }
        }
      }}
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
        drag={!msg.deleted && !isArchivedMedia ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragSnapToOrigin
        dragElastic={isOwn ? { left: 0.38, right: 0 } : { left: 0, right: 0.38 }}
        dragMomentum={false}
        dragDirectionLock
        dragListener={!showPicker && !selectionActive && !msg.deleted && !isArchivedMedia}
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

          if (passedThreshold && !msg.deleted && !isArchivedMedia) {
            onReply(msg);
            triggerHaptic(26, 120);
            const inputEl = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
            inputEl?.focus({ preventScroll: true });
            onFocusInput?.();
          }
          hasTriggeredReplyThreshold.current = false;
        }}
        className="relative w-full flex items-start px-2 lg:px-4 select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {!isOwn && (
          shouldShowAvatar ? (
            <div
              className="flex-shrink-0 w-8 mr-2 self-start mt-0.5 cursor-pointer active:scale-95 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                if (checkSelectionActive() || isSelected) {
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
          ) : (
            <div className="flex-shrink-0 w-8 mr-2 pointer-events-none" aria-hidden="true" />
          )
        )}

        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} z-10`}>
          <div className={`relative group max-w-full min-w-0 ${hasReactions ? 'mb-[18px]' : ''}`}>
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
                  } z-50 bg-[var(--theme-surface)] shadow-[0_4px_20px_rgba(0,0,0,0.16)] border border-[var(--theme-border)] p-1 sm:p-1.5 rounded-full flex items-center gap-0.5 sm:gap-1 w-max ${
                    isOwn ? 'right-0' : 'left-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {emojis.map((e) => {
                    const isActive = msg.reactions?.[role] === e;
                    return (
                      <motion.button
                        key={e}
                        whileTap={{ scale: 0.85 }}
                        onPointerDown={(eDown) => eDown.preventDefault()}
                        onClick={(eClick) => {
                          eClick.stopPropagation();
                          onReact(msg.id, e);
                          setShowPicker(false);
                        }}
                        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg rounded-full transition-all relative ${
                          isActive ? 'bg-[var(--theme-accent)]/20 scale-110' : 'hover:bg-[var(--theme-accent)]/10'
                        }`}
                      >
                        {e}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <div
              data-msg-id={msg.id}
              className={`leading-relaxed shadow-sm relative transition-all select-none max-w-full min-w-0 break-words ${
                isMediaOnly
                  ? 'p-[3px] rounded-[18px]'
                  : hasReactions
                  ? 'px-3 pt-2 pb-2.5 lg:px-4 lg:pt-2.5 lg:pb-3 text-[15px] lg:text-[16px]'
                  : 'px-3 py-2 lg:px-4 lg:py-2.5 text-[15px] lg:text-[16px]'
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
                  id={`chat-reply-quote-${msg.id}`}
                  data-reply-quote-id={msg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`msg-${resolvedReplyTo.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('theme-message-focus');
                      setTimeout(() => el.classList.remove('theme-message-focus'), 1400);
                    }
                  }}
                  className={`theme-reply-context chat-reply-perch ${
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
              {(msg.media || msg.mediaList) && !msg.deleted && !msg.deleted_from_media && (
                <div className={!isMediaOnly ? 'mb-2' : ''}>
                  <WhatsAppMediaBubble
                    media={msg.media || msg.mediaList![0]}
                    mediaList={msg.mediaList || msg.media?.mediaList}
                    isOwn={isOwn}
                    selectionActive={checkSelectionActive() || isSelected}
                    onToggleSelect={() => onToggleSelect(msg)}
                    onOpenViewer={(media, fullList, initialIndex) => {
                      if (checkSelectionActive() || isSelected) {
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
                      <span>{isDeletedMedia ? `${deleterName} Deleted` : isDeletedByMe ? 'You deleted this message' : 'This message was deleted'}</span>
                    </div>
                  ) : isArchivedMedia ? (
                    <div className="flex items-center gap-1.5 py-0.5 select-none text-[13.5px] lg:text-[14.5px] italic opacity-75 font-normal tracking-tight">
                      <Archive className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span>{`${archiverName} Archived`}</span>
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
                        selectionActive={checkSelectionActive() || isSelected}
                      />
                    </div>
                  ) : (msg.callLog || (msg as any).call_log) ? (
                    (() => {
                      const callLog = msg.callLog || (msg as any).call_log;
                      const isMissed = callLog.status === 'missed';
                      const isRejected = callLog.status === 'rejected' || callLog.status === 'declined' || callLog.status === 'busy';
                      const isCompleted = callLog.status === 'completed';
                      const isVideo = callLog.type === 'video';

                      return (
                        <div className="flex items-center gap-3 py-1 pr-1 select-none min-w-[200px] sm:min-w-[220px]">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                              isMissed
                                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                : isRejected
                                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                            }`}
                          >
                            {isMissed ? (
                              <PhoneMissed className="w-5 h-5" />
                            ) : isVideo ? (
                              <Video className="w-5 h-5" />
                            ) : isOwn ? (
                              <PhoneOutgoing className="w-5 h-5" />
                            ) : (
                              <PhoneIncoming className="w-5 h-5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13.5px] font-bold tracking-tight text-[var(--theme-text)] truncate">
                                {isMissed
                                  ? `Missed ${isVideo ? 'video' : 'voice'} call`
                                  : isRejected
                                  ? `Declined ${isVideo ? 'video' : 'voice'} call`
                                  : `${isOwn ? 'Outgoing' : 'Incoming'} ${isVideo ? 'video' : 'voice'} call`}
                              </span>
                            </div>
                            <div className="text-[11.5px] font-medium mt-0.5 opacity-75">
                              {isCompleted ? (
                                <span>{formatCallDuration(callLog.duration)}</span>
                              ) : (
                                <span className={isMissed ? 'text-rose-500 font-semibold' : 'text-amber-500 font-semibold'}>
                                  {isMissed ? (isOwn ? 'No answer' : 'Missed') : 'Declined'}
                                </span>
                              )}
                            </div>
                          </div>

                          {onStartCall && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartCall(callLog.type);
                              }}
                              className="p-2 rounded-xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-white active:scale-95 transition-all ml-1 shrink-0 cursor-pointer"
                              title={`Call back (${isVideo ? 'video' : 'voice'})`}
                            >
                              {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })()
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
                      if (checkSelectionActive() || isSelected) {
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
              {/* Romantic GPU Heartwave Shockwave & Stardust Embers on double tap */}
              <AnimatePresence>
                {showHeartBurst && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    {/* Expanding Radial Light Shockwave */}
                    <motion.div
                      initial={{ scale: 0.1, opacity: 0.95 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute w-24 h-24 rounded-full border-2 border-rose-300/80 shadow-[0_0_25px_6px_rgba(244,63,94,0.55)] pointer-events-none"
                    />

                    {/* Secondary Subtle Color Dispersion Ring */}
                    <motion.div
                      initial={{ scale: 0.2, opacity: 0.8 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                      className="absolute w-20 h-20 rounded-full border border-pink-200/60 shadow-[0_0_15px_rgba(255,255,255,0.7)] pointer-events-none"
                    />

                    {/* Stardust Embers Radiating Outward */}
                    {[
                      { x: -32, y: -28, delay: 0 },
                      { x: 30, y: -26, delay: 0.04 },
                      { x: -35, y: 14, delay: 0.07 },
                      { x: 33, y: 16, delay: 0.03 },
                      { x: 0, y: -38, delay: 0.02 },
                      { x: -20, y: 32, delay: 0.09 },
                      { x: 22, y: 34, delay: 0.06 },
                    ].map((ember, i) => (
                      <motion.span
                        key={i}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                        animate={{
                          scale: [0, 1.25, 0.7],
                          x: ember.x,
                          y: ember.y,
                          opacity: [1, 0.9, 0],
                        }}
                        transition={{ duration: 0.6, delay: ember.delay, ease: 'easeOut' }}
                        className="absolute text-xs select-none pointer-events-none drop-shadow-[0_0_8px_#FFE082]"
                      >
                        ✨
                      </motion.span>
                    ))}

                    {/* Central Glowing Pop Heart */}
                    <motion.div
                      initial={{ scale: 0.2, y: 8, opacity: 0 }}
                      animate={{ scale: [0.2, 1.45, 1.15], y: [8, -4, 0], opacity: [0, 1, 0] }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="relative flex items-center justify-center select-none"
                    >
                      <span className="text-4xl sm:text-5xl select-none drop-shadow-[0_0_22px_rgba(244,63,94,0.9)]">
                        ❤️
                      </span>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Reactions display - WhatsApp-style attached badge with Emissive Liquid Core */}
            {hasReactions && (
              <div
                className={`absolute top-[calc(100%-5px)] flex items-center z-20 pointer-events-auto select-none ${
                  isOwn ? 'right-4 justify-end' : 'left-4 justify-start'
                }`}
              >
                <motion.div
                  layout
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`relative flex items-center gap-1 h-[22px] sm:h-[24px] px-1.5 sm:px-2 rounded-full border-2 transition-all ${
                    msg.reactions?.[role]
                      ? 'ring-1 ring-[var(--theme-accent)]/50 shadow-[0_0_14px_-1px_var(--theme-accent),0_2px_6px_rgba(0,0,0,0.18)]'
                      : 'shadow-[0_0_10px_-2px_rgba(244,63,94,0.25),0_2px_6px_rgba(0,0,0,0.18)]'
                  }`}
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-bg)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {/* Subtle specular glass highlight along top rim */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  {Object.entries(
                    Object.values(msg.reactions!).reduce((acc: Record<string, number>, emoji: any) => {
                      const key = String(emoji);
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([emoji, count]: [string, any]) => {
                    const userReactedThis = msg.reactions?.[role] === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReact(msg.id, emoji);
                        }}
                        className="flex items-center gap-0.5 cursor-pointer hover:scale-110 active:scale-90 transition-transform select-none"
                        title={userReactedThis ? `Remove ${emoji} reaction` : `React with ${emoji}`}
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
                    );
                  })}
                </motion.div>
              </div>
            )}
          </div>

          {/* Read Receipt Area - Dynamic interaction point, cleanly separated below the bubble and reaction */}
          {isInteractionPoint && (
            <motion.div
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-1.5 opacity-65 select-none mt-1.5 ${
                isOwn ? 'justify-end pr-1' : 'justify-start pl-1'
              }`}
            >
              {partnerProfile?.photo_url ? (
                <img
                  src={partnerProfile.photo_url}
                  alt="S"
                  className="w-3.5 h-3.5 rounded-full object-cover grayscale opacity-70"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-3 h-3 rounded-full bg-gray-300" />
              )}
              {showSeenText && (
                <span className="text-[10px] font-medium tracking-tight text-[var(--theme-text)]/65">
                  {partnerProfile?.last_read_at ? formatSeenTime(partnerProfile.last_read_at) : 'Seen'}
                </span>
              )}
            </motion.div>
          )}
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

  // 2. Selection states & grouping
  if (prev.isSelected !== next.isSelected) return false;
  // Note: selectionActive / isSelectionActiveRef is intentionally excluded from the equality check
  // to avoid O(N) re-rendering of all messages when selection mode starts/ends.
  if (prev.showAvatar !== next.showAvatar) return false;
  if (prev.isFirstInGroup !== next.isFirstInGroup) return false;
  if (prev.isLastInGroup !== next.isLastInGroup) return false;

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
