import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, X } from 'lucide-react';

export interface FrameRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  baselineOffset?: number;
}

// Exact pixel coordinates extracted and measured from /public/Rahul-Sprite-Sheet.webp
export const RAHUL_SPRITE_FRAMES = {
  peek_up: [
    { sx: 219, sy: 133, sw: 163, sh: 68 },  // 01: Top of hair emerging
    { sx: 382, sy: 100, sw: 168, sh: 101 }, // 02: Forehead & eyebrows
    { sx: 550, sy: 80, sw: 181, sh: 121 },  // 03: Glasses & eyes looking up
    { sx: 731, sy: 52, sw: 186, sh: 150 },  // 04: Nose & hands gripping ledge
    { sx: 917, sy: 38, sw: 190, sh: 165 },  // 05: Beard & upper torso emerge
    { sx: 1107, sy: 30, sw: 187, sh: 173 }, // 06: Full face upright
    { sx: 1294, sy: 18, sw: 173, sh: 185 }, // 07: Settled pose
    { sx: 1467, sy: 26, sw: 172, sh: 177 }, // 08: Alert pop with accent sparks
  ],
  idle: [
    { sx: 220, sy: 252, sw: 176, sh: 147 }, // 01: Neutral resting pose looking left
    { sx: 396, sy: 245, sw: 168, sh: 154 }, // 02: Slight head tilt left
    { sx: 564, sy: 244, sw: 176, sh: 155 }, // 03: Look straight ahead
    { sx: 740, sy: 244, sw: 168, sh: 155 }, // 04: Head tilt right
    { sx: 908, sy: 247, sw: 183, sh: 152 }, // 05: Looking right
    { sx: 1091, sy: 244, sw: 169, sh: 155 }, // 06: Sway back
    { sx: 1260, sy: 248, sw: 201, sh: 151 }, // 07: Blinking with question mark (?)
    { sx: 1461, sy: 249, sw: 171, sh: 150 }, // 08: Cute wink smile
  ],
  thinking: [
    { sx: 222, sy: 433, sw: 169, sh: 159 }, // 01: Hand under chin contemplative
    { sx: 391, sy: 436, sw: 177, sh: 156 }, // 02: Eyes glance up-left in thought
    { sx: 568, sy: 432, sw: 171, sh: 160 }, // 03: Hand on chin focusing
    { sx: 739, sy: 428, sw: 188, sh: 164 }, // 04: Thought bubble forming
    { sx: 927, sy: 427, sw: 176, sh: 165 }, // 05: Glowing lightbulb idea (💡)
    { sx: 1103, sy: 436, sw: 174, sh: 156 }, // 06: Focused concentration
    { sx: 1277, sy: 439, sw: 177, sh: 153 }, // 07: Brow scratch / deep thought
    { sx: 1454, sy: 436, sw: 188, sh: 156 }, // 08: Drowsy / deep ponder
  ],
  expressions: [
    { sx: 219, sy: 624, sw: 174, sh: 150 }, // 01: Cute smile + heart ❤️
    { sx: 393, sy: 620, sw: 163, sh: 154 }, // 02: Closed-eyes happy blush
    { sx: 556, sy: 629, sw: 175, sh: 145 }, // 03: Excited laugh >v<
    { sx: 731, sy: 625, sw: 169, sh: 149 }, // 04: Pout / mock stern
    { sx: 900, sy: 623, sw: 193, sh: 151 }, // 05: Sweet sleep zzz
    { sx: 1093, sy: 630, sw: 163, sh: 144 }, // 06: Wide-eyed curiosity
    { sx: 1256, sy: 632, sw: 182, sh: 142 }, // 07: Blushing double hearts 💕
    { sx: 1438, sy: 625, sw: 180, sh: 149 }, // 08: Shy ellipsis ...
  ],
  peek_down: [
    { sx: 220, sy: 805, sw: 170, sh: 121 }, // 01: Lowering head from ledge
    { sx: 390, sy: 811, sw: 164, sh: 115 }, // 02: Ducking down
    { sx: 554, sy: 815, sw: 179, sh: 111 }, // 03: Shoulders dropping
    { sx: 733, sy: 816, sw: 179, sh: 110 }, // 04: Eyes level with ledge
    { sx: 912, sy: 818, sw: 179, sh: 108 }, // 05: Forehead dipping down
    { sx: 1091, sy: 841, sw: 189, sh: 85 },  // 06: Top of hair dipping
    { sx: 1280, sy: 852, sw: 215, sh: 74 },  // 07: Final hair tip before vanishing
  ],
};

const SPRITE_URL = '/Rahul-Sprite-Sheet.webp';

export type AvatarAnimState = 'hidden' | 'peeking_up' | 'looping' | 'reacting' | 'peeking_down';

interface TypingPeekAvatarProps {
  /** Whether Rahul is currently typing (or forced active via preview/test) */
  isTyping: boolean;
  /** Whether the feature is enabled in user settings */
  enabled?: boolean;
  /** Optional custom label or hint text */
  label?: string;
  /** Position offset or style tweaks */
  className?: string;
  /** Scale multiplier (default 1.0 for ~84px height) */
  scale?: number;
  /** Callback when user taps Rahul */
  onTap?: () => void;
}

export const TypingPeekAvatar: React.FC<TypingPeekAvatarProps> = ({
  isTyping,
  enabled = true,
  label,
  className = '',
  scale = 1.0,
  onTap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [animState, setAnimState] = useState<AvatarAnimState>('hidden');
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);

  // Internal state tracking for animation loop
  const animFrameIdRef = useRef<number | null>(null);
  const currentFrameIndexRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const animStateRef = useRef<AvatarAnimState>('hidden');
  const activeSequenceRef = useRef<FrameRect[]>([]);
  const loopStepRef = useRef<'idle' | 'thinking'>('idle');
  const loopRepCountRef = useRef<number>(0);
  const delayHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep animStateRef in sync
  useEffect(() => {
    animStateRef.current = animState;
  }, [animState]);

  // Preload sprite image
  useEffect(() => {
    const img = new Image();
    img.src = SPRITE_URL;
    img.onload = () => {
      spriteImageRef.current = img;
      setImageLoaded(true);
    };
    return () => {
      spriteImageRef.current = null;
    };
  }, []);

  // Canvas drawing helper for a specific frame
  const drawFrame = useCallback((frame: FrameRect) => {
    const canvas = canvasRef.current;
    const img = spriteImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const targetW = 86 * scale;
    const targetH = 86 * scale;

    if (canvas.width !== targetW * dpr || canvas.height !== targetH * dpr) {
      canvas.width = targetW * dpr;
      canvas.height = targetH * dpr;
      canvas.style.width = `${targetW}px`;
      canvas.style.height = `${targetH}px`;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Scale calculation: max avatar height is 185px
    const s = targetH / 185;
    const dw = frame.sw * s;
    const dh = frame.sh * s;
    const dx = (targetW - dw) / 2;
    // Bottom-aligned to canvas so avatar rests naturally behind input ledge
    const dy = targetH - dh;

    ctx.drawImage(
      img,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      dx,
      dy,
      dw,
      dh
    );
    ctx.restore();
  }, [scale]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Main animation frame driver
  const runAnimation = useCallback((time: number) => {
    if (!imageLoaded) return;

    const state = animStateRef.current;
    if (state === 'hidden') {
      clearCanvas();
      return;
    }

    // Frame rates: ~85ms per frame for peek up/down (smooth 12fps), ~120ms for idle loop
    const isLooping = state === 'looping';
    const interval = isLooping ? 130 : 85;

    if (time - lastFrameTimeRef.current >= interval) {
      lastFrameTimeRef.current = time;
      const sequence = activeSequenceRef.current;

      if (!sequence || sequence.length === 0) return;

      if (state === 'peeking_up') {
        const nextIdx = currentFrameIndexRef.current + 1;
        if (nextIdx < sequence.length) {
          currentFrameIndexRef.current = nextIdx;
          drawFrame(sequence[nextIdx]);
        } else {
          // Finished peeking up! Transition to idle/thinking loop
          setAnimState('looping');
          animStateRef.current = 'looping';
          currentFrameIndexRef.current = 0;
          loopStepRef.current = 'idle';
          loopRepCountRef.current = 0;
          activeSequenceRef.current = RAHUL_SPRITE_FRAMES.idle;
          drawFrame(activeSequenceRef.current[0]);
          setBubbleText(label || 'Typing...');
        }
      } else if (state === 'looping') {
        const nextIdx = currentFrameIndexRef.current + 1;
        if (nextIdx < sequence.length) {
          currentFrameIndexRef.current = nextIdx;
          drawFrame(sequence[nextIdx]);

          // Dynamic subtle bubbles based on current action frame
          if (loopStepRef.current === 'thinking') {
            if (nextIdx === 4) setBubbleText('💡 Idea!');
            else if (nextIdx === 6) setBubbleText('Hmm...');
          } else {
            if (nextIdx === 6) setBubbleText('🤔');
            else if (nextIdx === 7) setBubbleText('✨');
          }
        } else {
          // Loop around! Switch between idle and thinking smoothly
          loopRepCountRef.current += 1;
          const nextStep = loopStepRef.current === 'idle' ? 'thinking' : 'idle';
          loopStepRef.current = nextStep;
          activeSequenceRef.current = nextStep === 'idle' ? RAHUL_SPRITE_FRAMES.idle : RAHUL_SPRITE_FRAMES.thinking;
          currentFrameIndexRef.current = 0;
          drawFrame(activeSequenceRef.current[0]);
          setBubbleText(label || (nextStep === 'thinking' ? 'Thinking...' : 'Typing...'));
        }
      } else if (state === 'reacting') {
        const nextIdx = currentFrameIndexRef.current + 1;
        if (nextIdx < sequence.length) {
          currentFrameIndexRef.current = nextIdx;
          drawFrame(sequence[nextIdx]);
        } else {
          // Finished reaction, return to looping
          setAnimState('looping');
          animStateRef.current = 'looping';
          activeSequenceRef.current = RAHUL_SPRITE_FRAMES.idle;
          currentFrameIndexRef.current = 0;
          drawFrame(activeSequenceRef.current[0]);
        }
      } else if (state === 'peeking_down') {
        const nextIdx = currentFrameIndexRef.current + 1;
        if (nextIdx < sequence.length) {
          currentFrameIndexRef.current = nextIdx;
          drawFrame(sequence[nextIdx]);
        } else {
          // Completely submerged behind input bar
          setAnimState('hidden');
          animStateRef.current = 'hidden';
          setBubbleText(null);
          clearCanvas();
          return;
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(runAnimation);
  }, [imageLoaded, drawFrame, clearCanvas, label]);

  // Handle typing state changes
  useEffect(() => {
    if (!enabled) {
      setAnimState('hidden');
      setBubbleText(null);
      clearCanvas();
      return;
    }

    if (isTyping) {
      if (delayHideTimerRef.current) {
        clearTimeout(delayHideTimerRef.current);
        delayHideTimerRef.current = null;
      }

      // If currently hidden or peeking down, start peeking up
      if (animStateRef.current === 'hidden' || animStateRef.current === 'peeking_down') {
        setAnimState('peeking_up');
        animStateRef.current = 'peeking_up';
        currentFrameIndexRef.current = 0;
        activeSequenceRef.current = RAHUL_SPRITE_FRAMES.peek_up;
        lastFrameTimeRef.current = performance.now();
        drawFrame(RAHUL_SPRITE_FRAMES.peek_up[0]);
        setBubbleText(label || '...');
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = requestAnimationFrame(runAnimation);
      }
    } else {
      // When typing ceases, add a natural slight delay (800ms) before ducking down
      if (animStateRef.current !== 'hidden' && animStateRef.current !== 'peeking_down') {
        if (delayHideTimerRef.current) clearTimeout(delayHideTimerRef.current);
        delayHideTimerRef.current = setTimeout(() => {
          setAnimState('peeking_down');
          animStateRef.current = 'peeking_down';
          currentFrameIndexRef.current = 0;
          activeSequenceRef.current = RAHUL_SPRITE_FRAMES.peek_down;
          lastFrameTimeRef.current = performance.now();
          drawFrame(RAHUL_SPRITE_FRAMES.peek_down[0]);
          setBubbleText(null);
          if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = requestAnimationFrame(runAnimation);
        }, 750);
      }
    }

    return () => {
      if (delayHideTimerRef.current) {
        clearTimeout(delayHideTimerRef.current);
      }
    };
  }, [isTyping, enabled, drawFrame, runAnimation, clearCanvas, label]);

  // Start animation loop when state transitions to looping or peeking
  useEffect(() => {
    if (animState !== 'hidden' && imageLoaded) {
      if (!animFrameIdRef.current) {
        lastFrameTimeRef.current = performance.now();
        animFrameIdRef.current = requestAnimationFrame(runAnimation);
      }
    } else if (animState === 'hidden') {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      clearCanvas();
    }
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [animState, imageLoaded, runAnimation, clearCanvas]);

  // Tap handler to trigger cute easter egg expression
  const handleAvatarClick = () => {
    if (animStateRef.current === 'hidden') return;

    // Pick a random expression from row 4
    const exprIdx = Math.floor(Math.random() * RAHUL_SPRITE_FRAMES.expressions.length);
    const exprFrame = RAHUL_SPRITE_FRAMES.expressions[exprIdx];

    setAnimState('reacting');
    animStateRef.current = 'reacting';
    activeSequenceRef.current = [exprFrame, exprFrame, exprFrame, exprFrame]; // hold for ~500ms
    currentFrameIndexRef.current = 0;
    drawFrame(exprFrame);

    const reactionText = ['❤️', '🥰', '✨', '👀', '🤭', '💕'][Math.floor(Math.random() * 6)];
    setBubbleText(reactionText);
    setHeartBurst(Date.now());

    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setHeartBurst(null);
    }, 1200);

    onTap?.();
  };

  if (!enabled) return null;

  const isVisible = animState !== 'hidden';

  return (
    <div
      className={`relative select-none pointer-events-auto transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${className}`}
      style={{
        zIndex: 5, // Sits above background, tucked right behind the chat input capsule border
      }}
    >
      {/* Speech / Thought Bubble */}
      <AnimatePresence>
        {isVisible && bubbleText && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--theme-surface)]/95 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-[var(--theme-border)] shadow-xs flex items-center gap-1 z-20 pointer-events-none"
          >
            <span className="text-[10px] font-bold text-[var(--theme-accent)] tracking-tight">
              {bubbleText}
            </span>
            {/* Small speech bubble point */}
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
            animate={{ opacity: 0, scale: 1.4, y: -24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 text-rose-500 pointer-events-none z-30"
          >
            <Heart className="w-5 h-5 fill-current" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Avatar Canvas */}
      <button
        type="button"
        onClick={handleAvatarClick}
        title="Rahul (Typing Peek)"
        className="block relative p-0 m-0 bg-transparent border-0 outline-none cursor-pointer active:scale-95 transition-transform"
        style={{
          width: `${86 * scale}px`,
          height: `${86 * scale}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{
            imageRendering: 'crisp-edges',
          }}
        />
      </button>
    </div>
  );
};
