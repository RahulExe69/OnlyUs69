import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import {
  CharacterAssetPack,
  RAHUL_CHARACTER,
  SequenceConfig,
} from './typing-peek/typingPeekConfig';

export type CharacterVisualState =
  | 'hidden'
  | 'presence_peek'
  | 'composer_peek'
  | 'typing'
  | 'thinking'
  | 'reacting';

interface TypingPeekAvatarProps {
  /** Character asset pack to render (defaults to Rahul) */
  character?: CharacterAssetPack;
  /** Whether the remote partner is currently online and active in the chat */
  isPartnerInChat?: boolean;
  /** Whether the remote partner has focused the message composer / opened keyboard */
  isPartnerComposerFocused?: boolean;
  /** Whether the remote partner is actively typing text */
  isPartnerTyping?: boolean;
  /** Backwards compatibility alias for isPartnerTyping */
  isTyping?: boolean;
  /** Optional pulse signal when a new message from partner arrives */
  partnerJustSentMessage?: boolean;
  /** Whether the feature is enabled in user preferences */
  enabled?: boolean;
  /** Scale factor (default 1.0 -> ~48-52px in-chat Bitmoji scale) */
  scale?: number;
  /** Optional label or partner display name */
  label?: string;
  /** Optional extra CSS classes */
  className?: string;
  /** Optional tap callback */
  onTap?: () => void;
}

export const TypingPeekAvatar: React.FC<TypingPeekAvatarProps> = ({
  character = RAHUL_CHARACTER,
  isPartnerInChat = false,
  isPartnerComposerFocused = false,
  isPartnerTyping = false,
  isTyping = false,
  partnerJustSentMessage = false,
  enabled = true,
  scale = 1.0,
  label,
  className = '',
  onTap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Effective status calculation supporting both new and legacy callers
  const effectiveIsTyping = isPartnerTyping || isTyping;
  const effectiveInChat = isPartnerInChat || isTyping || isPartnerComposerFocused;

  // High-level visual presence state
  const [visualState, setVisualState] = useState<CharacterVisualState>('hidden');

  // Interactive bubbles & easter eggs
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);

  // Animation sequence runner refs
  const currentSequenceKeyRef = useRef<keyof CharacterAssetPack['sequences']>('presence_idle');
  const sequenceStartRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const idleActionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pauseDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Preload all 7 sprite strips for this character
  useEffect(() => {
    let isCancelled = false;
    const sequences = character.sequences;
    const urls = Object.values(sequences).map((s) => s.src);
    let loadedCount = 0;

    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (isCancelled) return;
        loadedImagesRef.current.set(url, img);
        loadedCount++;
        if (loadedCount === urls.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        if (isCancelled) return;
        loadedCount++;
        if (loadedCount === urls.length) {
          setImagesLoaded(true);
        }
      };
    });

    return () => {
      isCancelled = true;
    };
  }, [character]);

  // Helper to switch active animation sequence cleanly
  const playSequence = useCallback(
    (seqKey: keyof CharacterAssetPack['sequences']) => {
      currentSequenceKeyRef.current = seqKey;
      sequenceStartRef.current = performance.now();
    },
    []
  );

  // State derivation based on partner realtime status
  useEffect(() => {
    if (!enabled || !effectiveInChat) {
      setVisualState('hidden');
      setBubbleText(null);
      return;
    }

    if (partnerJustSentMessage) {
      setVisualState('reacting');
      playSequence('blink');
      setBubbleText('✨');
      const timer = setTimeout(() => {
        setBubbleText(null);
      }, 1600);
      return () => clearTimeout(timer);
    }

    if (effectiveIsTyping) {
      if (pauseDebounceTimerRef.current) {
        clearTimeout(pauseDebounceTimerRef.current);
        pauseDebounceTimerRef.current = null;
      }
      setVisualState('typing');
      playSequence('typing');
      return;
    }

    // If partner was typing and just paused, transition to thinking before returning to composer idle
    if (visualState === 'typing' && !effectiveIsTyping && isPartnerComposerFocused) {
      setVisualState('thinking');
      playSequence('thinking');
      pauseDebounceTimerRef.current = setTimeout(() => {
        setVisualState('composer_peek');
        playSequence('presence_idle');
      }, 2200);
      return () => {
        if (pauseDebounceTimerRef.current) clearTimeout(pauseDebounceTimerRef.current);
      };
    }

    if (isPartnerComposerFocused) {
      setVisualState('composer_peek');
      playSequence('presence_idle');
      return;
    }

    // Default resting presence: partner is in chat
    setVisualState('presence_peek');
    playSequence('presence_idle');
  }, [
    enabled,
    effectiveInChat,
    isPartnerComposerFocused,
    effectiveIsTyping,
    partnerJustSentMessage,
    playSequence,
    visualState,
  ]);

  // Occasional random blinking & subtle looking around while resting in chat
  useEffect(() => {
    if (visualState !== 'presence_peek' && visualState !== 'composer_peek') {
      if (idleActionTimerRef.current) clearTimeout(idleActionTimerRef.current);
      return;
    }

    const scheduleNextIdleAction = () => {
      const nextDelay = 3200 + Math.random() * 3800; // 3.2s - 7.0s
      idleActionTimerRef.current = setTimeout(() => {
        if (visualState !== 'presence_peek' && visualState !== 'composer_peek') return;

        const pickBlink = Math.random() > 0.45;
        const actionSeq = pickBlink ? 'blink' : 'look_around';
        const seqConfig = character.sequences[actionSeq];

        playSequence(actionSeq);

        setTimeout(() => {
          if (visualState === 'presence_peek' || visualState === 'composer_peek') {
            playSequence('presence_idle');
            scheduleNextIdleAction();
          }
        }, seqConfig.durationMs);
      }, nextDelay);
    };

    scheduleNextIdleAction();

    return () => {
      if (idleActionTimerRef.current) clearTimeout(idleActionTimerRef.current);
    };
  }, [visualState, character, playSequence]);

  // Main Canvas animation render loop
  const renderFrame = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !imagesLoaded || visualState === 'hidden') {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const seqKey = currentSequenceKeyRef.current;
      const seqConfig: SequenceConfig = character.sequences[seqKey] || character.sequences.presence_idle;
      const img = loadedImagesRef.current.get(seqConfig.src);

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const baseWidth = 48 * scale;
      const baseHeight = 48 * scale;

      if (canvas.width !== Math.round(baseWidth * dpr) || canvas.height !== Math.round(baseHeight * dpr)) {
        canvas.width = Math.round(baseWidth * dpr);
        canvas.height = Math.round(baseHeight * dpr);
        canvas.style.width = `${baseWidth}px`;
        canvas.style.height = `${baseHeight}px`;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (img && img.complete && img.naturalWidth > 0) {
        const elapsed = now - sequenceStartRef.current;
        const totalDuration = seqConfig.durationMs || 1000;
        const frameCount = seqConfig.frames || 1;

        let frameIndex = 0;
        if (seqConfig.loop) {
          const progress = (elapsed % totalDuration) / totalDuration;
          frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
        } else {
          const progress = Math.min(1, elapsed / totalDuration);
          frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
        }

        const fw = character.frameWidth || 128;
        const fh = character.frameHeight || 128;
        const sx = frameIndex * fw;
        const sy = 0;

        ctx.drawImage(img, sx, sy, fw, fh, 0, 0, baseWidth, baseHeight);
      }

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    },
    [imagesLoaded, visualState, character, scale]
  );

  useEffect(() => {
    if (visualState !== 'hidden' && imagesLoaded) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [visualState, imagesLoaded, renderFrame]);

  // Tap handler: trigger cute blush easter egg reaction
  const handleAvatarTap = () => {
    if (visualState === 'hidden') return;

    playSequence('blink');
    const emojis = ['❤️', '🥰', '✨', '👀', '🤭', '💕'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    setBubbleText(randomEmoji);
    setHeartBurst(Date.now());

    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setHeartBurst(null);
      setBubbleText(null);
      if (visualState === 'presence_peek' || visualState === 'composer_peek') {
        playSequence('presence_idle');
      }
    }, 1400);

    onTap?.();
  };

  // Compute smooth vertical translation according to state
  // hidden: translateY(48px) (fully submerged behind composer)
  // presence_peek: translateY(18px) (eyes & hair peeking over ledge ~26px)
  // composer_peek: translateY(4px) (forehead, glasses, beard, hands resting on ledge ~42px)
  // typing: translateY(0px) (fully raised, lively typing action)
  const verticalTranslateY = useMemo(() => {
    switch (visualState) {
      case 'hidden':
        return 52;
      case 'presence_peek':
        return 18;
      case 'composer_peek':
        return 4;
      case 'typing':
        return 0;
      case 'thinking':
        return 3;
      case 'reacting':
        return -2;
      default:
        return 52;
    }
  }, [visualState]);

  if (!enabled) return null;

  const isVisible = visualState !== 'hidden';

  return (
    <div
      className={`relative select-none pointer-events-none transition-all duration-350 ease-out ${className}`}
      style={{
        transform: `translateY(${verticalTranslateY}px)`,
        opacity: isVisible ? 1 : 0,
        zIndex: 1, // Sits directly behind the chat composer capsule (which is z-10)
      }}
    >
      {/* Speech / Reaction Bubble */}
      <AnimatePresence>
        {isVisible && bubbleText && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.8 }}
            transition={{ duration: 0.16 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--theme-surface)]/95 backdrop-blur-md px-2 py-0.5 rounded-full border border-[var(--theme-border)] shadow-xs flex items-center gap-1 z-20 pointer-events-none"
          >
            <span className="text-[10px] font-bold text-[var(--theme-accent)] leading-none">
              {bubbleText}
            </span>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[var(--theme-surface)] border-b border-r border-[var(--theme-border)] rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating heart burst on tap */}
      <AnimatePresence>
        {heartBurst && (
          <motion.div
            key={heartBurst}
            initial={{ opacity: 1, scale: 0.6, y: 0 }}
            animate={{ opacity: 0, scale: 1.3, y: -22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-rose-500 pointer-events-none z-30"
          >
            <Heart className="w-4 h-4 fill-current" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Avatar Canvas */}
      <button
        type="button"
        onClick={handleAvatarTap}
        title={`${label || character.name} (Typing Peek)`}
        className="block relative p-0 m-0 bg-transparent border-0 outline-none cursor-pointer active:scale-95 transition-transform pointer-events-auto"
        style={{
          width: `${48 * scale}px`,
          height: `${48 * scale}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{
            imageRendering: 'auto',
          }}
        />
      </button>
    </div>
  );
};
