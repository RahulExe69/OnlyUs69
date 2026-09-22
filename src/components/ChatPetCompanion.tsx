import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PetSettings, PetBreed, PetAccessory } from '../types';

interface ChatPetCompanionProps {
  settings: PetSettings;
  onUpdateSettings?: (newSettings: PetSettings) => void;
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageSender?: string;
  isTyping?: boolean;
  partnerName?: string;
  currentUserRole?: 'owner' | 'partner';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  size: number;
  alpha: number;
}

interface Platform {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  isBubble: boolean;
  isReplyQuote?: boolean;
  isInputBar?: boolean;
  isOwner?: boolean;
  element?: Element;
}

export type CatState = 
  | 'idle' 
  | 'walking' 
  | 'running' 
  | 'pre_jump' 
  | 'jumping' 
  | 'landing' 
  | 'peeking' 
  | 'loaf' 
  | 'grooming'
  | 'stretching'
  | 'clinging'
  | 'purring' 
  | 'alert'
  | 'typing_wait'
  | 'chasing';

const PURR_SPEECHES = [
  "Purrr~ ❤️",
  "Meow! 🐾",
  "Nusrat is so sweet! ✨",
  "Rahul + Nusrat 💖",
  "Scratch my ears~ 🥰",
  "I love our cozy hub! 🌸",
  "Warm cuddles~ 🐱",
  "Nya nya! 💕",
  "Best couple ever! 🐾"
];

const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 116;
const PET_OFFSET_X = 80;
const PET_OFFSET_Y = 100;
const CHAT_BOTTOM_ANCHOR_ID = 'chat-messages-bottom-anchor';
const BUBBLE_EDGE_INSET = 24; // Safe margin preventing paws hanging off rounded corners

const getPlatformInset = (platform?: Platform | null): number => {
  if (!platform) return 16;
  if (platform.isBubble) return BUBBLE_EDGE_INSET;
  return 16;
};

const getPlatformTargetRatio = (platform?: Platform | null): number => {
  if (!platform) return 0.5;
  if (platform.isBubble) return 0.30 + Math.random() * 0.40;
  return 0.25 + Math.random() * 0.50;
};

export const ChatPetCompanion: React.FC<ChatPetCompanionProps> = ({
  settings,
  onUpdateSettings,
  lastMessageId,
  lastMessageText,
  lastMessageSender,
  isTyping,
  partnerName,
  currentUserRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hitButtonRef = useRef<HTMLButtonElement | null>(null);

  // Position and Physics in message-container content scroll space
  const posRef = useRef<{ x: number; y: number }>({ x: 160, y: 300 });
  const facingRightRef = useRef<boolean>(true);
  const stateRef = useRef<CatState>('idle');
  const stateTimerRef = useRef<number>(0);

  // Platform Anchor (Message bubbles, Replied card bottom rims, or Bottom anchor)
  const attachedPlatformIdRef = useRef<string>(CHAT_BOTTOM_ANCHOR_ID);
  const platformOffsetRatioRef = useRef<number>(0.5);
  const offscreenTimerRef = useRef<number>(0);
  // Sequential navigation destination goal (e.g. latest message to jump to one-by-one)
  const targetGoalIdRef = useRef<string | null>(null);

  // Jump physics & continuous trajectory
  interface JumpPlan {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    targetPlatformId: string;
    targetRatio: number;
    duration: number;
    arcHeight: number;
  }
  const jumpPlanRef = useRef<JumpPlan | null>(null);
  const jumpProgressRef = useRef<number>(0);

  // Animation Timers & Physics
  const walkPhaseRef = useRef<number>(0);
  const blinkTimerRef = useRef<number>(0);
  const isBlinkingRef = useRef<boolean>(false);
  const earTwitchTimerRef = useRef<number>(0);
  const tailWaveRef = useRef<number>(0);
  const buttWiggleRef = useRef<number>(0);
  const squashRef = useRef<{ sx: number; sy: number }>({ sx: 1, sy: 1 });
  const bodyAngleRef = useRef<number>(0);
  const groomPhaseRef = useRef<number>(0);
  const stretchPhaseRef = useRef<number>(0);

  // Pointer & Interactive Curiosity
  const pointerPosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const pointerLastActiveRef = useRef<number>(0);
  const eyeOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const targetEyeOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const idleGazeTimerRef = useRef<number>(0);
  const breathePhaseRef = useRef<number>(0);
  const yawProgressRef = useRef<number>(0); // 0.0 (2.0D front-facing) -> 1.0 (2.5D 3/4 profile)

  // Floating particles (hearts, zzz, sparkles)
  const particlesRef = useRef<Particle[]>([]);
  const speechBubbleRef = useRef<{ text: string; timer: number; isThought?: boolean } | null>(null);

  // Element and platform caching for zero-flicker sub-millisecond tracking
  const attachedElementRef = useRef<HTMLElement | null>(null);
  const platformsCacheRef = useRef<Platform[]>([]);
  const lastScanTimeRef = useRef<number>(0);
  const lastEscapeJumpTimeRef = useRef<number>(0);
  const lastHopTimeRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  const initAttemptsRef = useRef<number>(0);

  // Sound & Haptic
  const triggerHaptic = useCallback((duration: number = 25) => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(duration);
      } catch (_) {}
    }
  }, []);

  // Quick speech or thought trigger
  const showSpeech = useCallback((text: string, durationFrames: number = 130, isThought: boolean = false) => {
    speechBubbleRef.current = { text, timer: durationFrames, isThought };
  }, []);

  // Add floating particles relative to Mochi in local canvas coordinates
  const addParticle = useCallback((text: string, count: number = 1) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: PET_OFFSET_X + (Math.random() - 0.5) * 20,
        y: PET_OFFSET_Y - 32 + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.8 - Math.random() * 1.0,
        life: 0,
        maxLife: 42 + Math.floor(Math.random() * 20),
        text,
        size: 13 + Math.random() * 5,
        alpha: 1,
      });
    }
  }, []);

  // Helper to resolve live physical position of any platform in message-container content scroll space
  const getPlatformRect = useCallback((platformId?: string | null): Platform | null => {
    if (!platformId) return null;
    const container = document.getElementById('message-container');
    if (!container) return null;

    const cleanId = platformId.replace(/^msg-/, '');
    let el: HTMLElement | null = null;

    // 1. Direct query by data-msg-id
    el = (container.querySelector(`[data-msg-id="${cleanId}"]`) ||
          container.querySelector(`[data-msg-id="${platformId}"]`)) as HTMLElement;

    // 2. Query by message row wrapper ID
    if (!el) {
      const row = document.getElementById(`msg-${cleanId}`) || document.getElementById(platformId);
      if (row) {
        el = row.querySelector('.chat-bubble-owner, .chat-bubble-partner') as HTMLElement;
      }
    }

    // 3. Bottom anchor (for empty chat)
    if (!el && (cleanId === CHAT_BOTTOM_ANCHOR_ID || cleanId === 'chat-messages-bottom-anchor' || cleanId === 'bottom-anchor')) {
      el = document.getElementById('chat-messages-bottom-anchor');
    }

    // 4. Fallback search through all bubbles
    if (!el) {
      const bubbles = container.querySelectorAll('.chat-bubble-owner, .chat-bubble-partner');
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i] as HTMLElement;
        const bMsgId = b.dataset?.msgId;
        const rowId = b.closest('.chat-message-row')?.id?.replace(/^msg-/, '');
        if (bMsgId === cleanId || rowId === cleanId) {
          el = b;
          break;
        }
      }
    }

    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    // Content-space coordinates (solidly anchored inside message-container scroll stream)
    const left = rect.left - contRect.left + container.scrollLeft;

    // Check if message bubble contains a replied message quote card
    const replyQuote = el.querySelector('.chat-reply-perch, [id^="chat-reply-quote-"]') as HTMLElement | null;
    let top = rect.top - contRect.top + container.scrollTop + 1;
    let isReplyQuote = false;

    if (replyQuote) {
      const rqRect = replyQuote.getBoundingClientRect();
      // Land at the bottom of the replied message card (just below it, on the message body)
      top = rqRect.bottom - contRect.top + container.scrollTop + 2;
      isReplyQuote = true;
    }

    return {
      id: cleanId,
      left,
      right: left + rect.width,
      top,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height,
      isBubble: el.id !== 'chat-messages-bottom-anchor',
      isReplyQuote,
      isOwner: el.classList.contains('chat-bubble-owner'),
      element: el,
    };
  }, []);

  // Scan visible DOM platforms inside message-container in content space
  const scanPlatforms = useCallback((force: boolean = false): Platform[] => {
    const container = document.getElementById('message-container');
    if (!container) return [];

    const contRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const platforms: Platform[] = [];

    // 1. Message bubbles as jumping obstacles and play platforms
    const bubbles = container.querySelectorAll('.chat-bubble-owner, .chat-bubble-partner');
    bubbles.forEach((b, idx) => {
      const el = b as HTMLElement;
      const bRect = el.getBoundingClientRect();
      const left = bRect.left - contRect.left + scrollLeft;

      const replyQuote = el.querySelector('.chat-reply-perch, [id^="chat-reply-quote-"]') as HTMLElement | null;
      let top = bRect.top - contRect.top + scrollTop + 1;
      let isReplyQuote = false;

      if (replyQuote) {
        const rqRect = replyQuote.getBoundingClientRect();
        // Land at the bottom rim of the replied message card so Mochi sits below it without obscuring it
        top = rqRect.bottom - contRect.top + scrollTop + 2;
        isReplyQuote = true;
      }

      const width = bRect.width;
      const height = bRect.height;
      const isOwner = el.classList.contains('chat-bubble-owner');
      const rowId = el.closest('.chat-message-row')?.id?.replace(/^msg-/, '');
      const rawMsgId = el.dataset?.msgId || rowId || `bubble-${idx}`;
      const msgId = rawMsgId.replace(/^msg-/, '');

      if (width >= 40 && height >= 18) {
        platforms.push({
          id: msgId,
          left: Math.max(8, left),
          right: left + width,
          top,
          bottom: top + height,
          width,
          height,
          isBubble: true,
          isReplyQuote,
          isOwner,
          element: el,
        });
      }
    });

    // 2. Bottom anchor (for empty chat or bottom boundary)
    const bottomAnchor = document.getElementById('chat-messages-bottom-anchor');
    if (bottomAnchor) {
      const aRect = bottomAnchor.getBoundingClientRect();
      const left = aRect.left - contRect.left + scrollLeft;
      const top = aRect.top - contRect.top + scrollTop;
      platforms.push({
        id: CHAT_BOTTOM_ANCHOR_ID,
        left: Math.max(8, left),
        right: left + (aRect.width || 200),
        top,
        bottom: top + 20,
        width: aRect.width || 200,
        height: 20,
        isBubble: false,
        isReplyQuote: false,
        element: bottomAnchor,
      });
    }

    // Sort platforms strictly by physical top coordinate in content space
    platforms.sort((a, b) => a.top - b.top);
    platformsCacheRef.current = platforms;
    return platforms;
  }, []);

  // Helper to plan and launch a jump with seamless cosine arc and ZERO teleport on landing
  // isSkipJump is true when Mochi is off-screen (skipping directly into visible screen)
  // isEscapeJump is true when escaping collision with the typing box (immediate launch with zero delay)
  const startJump = useCallback(
    (targetPlatform: Platform, isSkipJump: boolean = false, isEscapeJump: boolean = false) => {
      if (!targetPlatform || !Number.isFinite(targetPlatform.left) || !Number.isFinite(targetPlatform.top)) {
        return;
      }

      const cleanTargetId = targetPlatform.id.replace(/^msg-/, '');

      // Only clear navigation goal if reaching destination or emergency escaping
      if (isEscapeJump || isSkipJump || cleanTargetId === targetGoalIdRef.current) {
        targetGoalIdRef.current = null;
      }

      const inset = getPlatformInset(targetPlatform);
      const targetRatio = getPlatformTargetRatio(targetPlatform);
      const minX = targetPlatform.left + inset;
      const maxX = targetPlatform.right - inset;
      const targetX =
        maxX > minX ? minX + (maxX - minX) * targetRatio : (targetPlatform.left + targetPlatform.right) / 2;
      const targetY = targetPlatform.top;

      let startX = Number.isFinite(posRef.current.x) ? posRef.current.x : targetX;
      let startY = Number.isFinite(posRef.current.y) ? posRef.current.y : targetY;

      // When skipping across large distances or recovering from off-screen,
      // leap in gracefully from just above the visible target bubble
      if (isSkipJump) {
        startX = targetX + (facingRightRef.current ? -24 : 24);
        startY = targetY - 65;
        posRef.current.x = startX;
        posRef.current.y = startY;
      }

      const dx = targetX - startX;
      const dy = targetY - startY;
      const dist = Math.hypot(dx, dy);

      facingRightRef.current = dx >= 0;

      // Fast, agile duration for hops (~14-22 frames)
      const duration = isEscapeJump
        ? Math.max(14, Math.min(18, Math.round(dist / 9)))
        : isSkipJump
        ? 16
        : Math.max(16, Math.min(24, Math.round(dist / 8)));

      const arcHeight = isEscapeJump
        ? Math.max(25, Math.min(55, Math.abs(dy) * 0.3 + 20))
        : isSkipJump
        ? 15
        : Math.max(22, Math.min(60, Math.abs(dy) * 0.32 + 20));

      lastHopTimeRef.current = Date.now();
      jumpPlanRef.current = {
        startX,
        startY,
        targetX,
        targetY,
        targetPlatformId: cleanTargetId,
        targetRatio,
        duration,
        arcHeight,
      };

      if (isSkipJump || isEscapeJump) {
        stateRef.current = 'jumping';
        jumpProgressRef.current = 0;
        stateTimerRef.current = 0;
        squashRef.current = { sx: 0.88, sy: 1.25 };
        addParticle(isEscapeJump ? '💨' : '✨', 2);
      } else {
        stateRef.current = 'pre_jump';
        stateTimerRef.current = 7; // Brief cute butt-wiggle crouch
        buttWiggleRef.current = 0;
      }
    },
    [addParticle]
  );

  // React to new message: perk up and navigate one-by-one towards the new message
  const prevMsgRef = useRef<string | undefined>(lastMessageId);
  useEffect(() => {
    if (lastMessageId && lastMessageId !== prevMsgRef.current) {
      prevMsgRef.current = lastMessageId;
      stateRef.current = 'alert';
      stateTimerRef.current = 24;
      squashRef.current = { sx: 0.88, sy: 1.28 };
      showSpeech('New whisper! 🐾', 80, false);
      addParticle('✨', 2);

      const goalIdClean = lastMessageId.replace(/^msg-/, '');
      targetGoalIdRef.current = goalIdClean;

      // Start the sequential one-by-one journey towards the new message
      const timer = setTimeout(() => {
        const platforms = scanPlatforms(true);
        const curIdClean = (attachedPlatformIdRef.current || '').replace(/^msg-/, '');
        if (curIdClean !== goalIdClean) {
          const currentIdx = platforms.findIndex((p) => p.id === curIdClean);
          const goalIdx = platforms.findIndex((p) => p.id === goalIdClean);
          if (currentIdx !== -1 && goalIdx !== -1) {
            const stepDir = goalIdx > currentIdx ? 1 : -1;
            const nextPlat = platforms[currentIdx + stepDir];
            if (nextPlat) {
              startJump(nextPlat, false);
            }
          }
        } else {
          targetGoalIdRef.current = null;
        }
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [lastMessageId, showSpeech, addParticle, scanPlatforms, startJump]);

  // React to typing: Mochi shows loving attention WITHOUT shifting or teleporting!
  // Position is preserved so keyboard opening does not displace Mochi on either phone.
  const prevTypingRef = useRef<boolean | undefined>(isTyping);
  useEffect(() => {
    if (isTyping && !prevTypingRef.current) {
      prevTypingRef.current = isTyping;
      stateRef.current = 'alert';
      stateTimerRef.current = 40;
      squashRef.current = { sx: 0.94, sy: 1.12 };
      showSpeech('Whispering with love~ 🐾', 80, false);
      addParticle('❤️', 2);
    } else if (!isTyping && prevTypingRef.current) {
      prevTypingRef.current = isTyping;
    }
  }, [isTyping, showSpeech, addParticle]);

  // Petting interaction on click/tap: triggers purrs and hearts
  const handlePet = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    triggerHaptic(35);
    stateRef.current = 'purring';
    stateTimerRef.current = 100;
    squashRef.current = { sx: 1.3, sy: 0.72 };

    const phrases = [
      'Purrr~ ❤️',
      'Meow! 🐾',
      'Warm cuddles~ ✨',
      'I love you! 💕',
      'Soft purrs~ 🐱'
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    showSpeech(phrase, 120, false);
    addParticle('❤️', 4);
    addParticle('✨', 3);
  };

  // Checks if Mochi's bottom hits or nears the typing box during scrolling or movement,
  // triggering an agile jump up to another message bubble above!
  const checkTypingBoxCollision = useCallback(() => {
    // Only check if Mochi is on an actual message bubble/perch and not already airborne
    if (
      stateRef.current === 'jumping' ||
      attachedPlatformIdRef.current === CHAT_BOTTOM_ANCHOR_ID
    ) {
      return;
    }

    // Debounce to prevent multiple jump triggers during rapid continuous scrolling
    if (Date.now() - lastEscapeJumpTimeRef.current < 600) {
      return;
    }

    const msgCont = document.getElementById('message-container');
    const inputCapsule =
      document.getElementById('chat-input-capsule') ||
      (document.querySelector('.chat-input-perch') as HTMLElement);

    if (!msgCont || !inputCapsule) return;

    const contRect = msgCont.getBoundingClientRect();
    const inputRect = inputCapsule.getBoundingClientRect();
    const viewportHeight = msgCont.clientHeight;
    const typingBoxScreenY = inputRect.top - contRect.top;
    const mochiScreenY = posRef.current.y - msgCont.scrollTop;

    // Viewport coordinates check: Mochi approaching or hitting the typing box at the bottom
    const isHittingTypingBox = mochiScreenY >= typingBoxScreenY - 18 && mochiScreenY <= viewportHeight + 40;

    if (isHittingTypingBox) {
      lastEscapeJumpTimeRef.current = Date.now();
      const platforms = scanPlatforms(true);
      const curIdClean = (attachedPlatformIdRef.current || '').replace(/^msg-/, '');

      // Pick strictly the immediate message bubble directly above (no skipping!)
      const currentIdx = platforms.findIndex((p) => p.id === curIdClean);
      let targetPlatform: Platform | null = null;
      if (currentIdx > 0 && platforms[currentIdx - 1]?.isBubble) {
        targetPlatform = platforms[currentIdx - 1];
      } else {
        // Fallback to closest bubble above
        const safeBubbles = platforms.filter(
          (p) => p.isBubble && p.id.replace(/^msg-/, '') !== curIdClean && p.top < posRef.current.y - 30
        );
        if (safeBubbles.length > 0) {
          safeBubbles.sort((a, b) => b.top - a.top);
          targetPlatform = safeBubbles[0];
        } else {
          lastEscapeJumpTimeRef.current = Date.now() + 1500;
        }
      }

      if (targetPlatform) {
        targetGoalIdRef.current = null;
        const funnyPhrases = [
          'Whoops! Jumping up! 🐾',
          'Watch out! Hop! ✨',
          'Too close to the typing box! 💨',
          'Up I go! 😸',
          'Safe paws! 💕',
          'Hop hop! 🐾'
        ];
        const phrase = funnyPhrases[Math.floor(Math.random() * funnyPhrases.length)];
        showSpeech(phrase, 90, false);
        triggerHaptic(28);
        startJump(targetPlatform, false, true /* isEscapeJump */);
      }
    }
  }, [scanPlatforms, startJump, showSpeech, triggerHaptic]);

  // Main animation loop, physics simulation, zero-flicker scroll coordinates
  useEffect(() => {
    if (!settings.enabled) return;

    let animFrameId: number;
    let isDestroyed = false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina / High-DPI Canvas Scaling
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    // Initial placement: Start perched on latest visible message bubble or bottom anchor
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const platforms = scanPlatforms(true);
      const visibleBubbles = platforms.filter((p) => p.isBubble);
      if (visibleBubbles.length > 0) {
        const lastB = visibleBubbles[visibleBubbles.length - 1];
        attachedPlatformIdRef.current = lastB.id;
        platformOffsetRatioRef.current = 0.5;
        const inset = BUBBLE_EDGE_INSET;
        const minW = lastB.left + inset;
        const maxW = lastB.right - inset;
        posRef.current = {
          x: maxW > minW ? (minW + maxW) / 2 : (lastB.left + lastB.right) / 2,
          y: lastB.top,
        };
      } else {
        attachedPlatformIdRef.current = CHAT_BOTTOM_ANCHOR_ID;
        const bottomPlat = getPlatformRect(CHAT_BOTTOM_ANCHOR_ID);
        posRef.current = {
          x: bottomPlat ? (bottomPlat.left + bottomPlat.right) / 2 : 160,
          y: bottomPlat ? bottomPlat.top : 200,
        };
      }
    }

    // Pointer & Touch listener for curious gaze tracking in sticky viewport space
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const msgCont = document.getElementById('message-container');
      if (!msgCont) return;
      const rect = msgCont.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      if (clientX !== undefined && clientY !== undefined) {
        pointerPosRef.current = {
          x: clientX - rect.left,
          y: clientY - rect.top,
          active: true,
        };
        pointerLastActiveRef.current = Date.now();
      }
    };

    const handlePointerEnd = () => {
      pointerPosRef.current.active = false;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchstart', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerEnd, { passive: true });
    window.addEventListener('touchcancel', handlePointerEnd, { passive: true });
    window.addEventListener('mouseleave', handlePointerEnd);

    // Scroll listener on message container to check collisions when near typing box
    const handleMsgScroll = () => {
      checkTypingBoxCollision();
    };
    const msgContainerEl = document.getElementById('message-container');
    if (msgContainerEl) {
      msgContainerEl.addEventListener('scroll', handleMsgScroll, { passive: true });
    }
    window.addEventListener('resize', handleMsgScroll, { passive: true });

    // Main tick loop
    const tick = () => {
      if (isDestroyed) return;

      try {
        if (!Number.isFinite(posRef.current.x)) posRef.current.x = 160;
        if (!Number.isFinite(posRef.current.y)) posRef.current.y = 200;

        const msgCont = document.getElementById('message-container');
        const now = performance.now();
        if (now - lastScanTimeRef.current > 750 || platformsCacheRef.current.length === 0) {
          lastScanTimeRef.current = now;
          scanPlatforms(false);
        }
        const scrollPlatforms = platformsCacheRef.current;

        // Initial Mount Anchor: Find a comfortable visible message bubble to spawn on immediately with zero flicker
        if (!hasInitializedRef.current) {
          if (msgCont) {
            const viewTop = msgCont.scrollTop;
            const viewBottom = msgCont.scrollTop + msgCont.clientHeight;
            const allBubbles = scrollPlatforms.filter((p) => p.isBubble);
            const visibleBubbles = allBubbles.filter(
              (p) => p.top >= viewTop + 30 && p.top <= viewBottom - 85
            );

            const candidateList = visibleBubbles.length > 0 ? visibleBubbles : allBubbles;

            if (candidateList.length > 0) {
              // Pick a bubble safely in the middle/lower visible area (away from the typing box!)
              const pickIdx = visibleBubbles.length > 0 ? Math.max(0, visibleBubbles.length - 2) : candidateList.length - 1;
              const initialPlat = candidateList[pickIdx];
              const inset = getPlatformInset(initialPlat);
              const minX = initialPlat.left + inset;
              const maxX = initialPlat.right - inset;
              const ratio = 0.45 + Math.random() * 0.1;

              attachedPlatformIdRef.current = initialPlat.id;
              attachedElementRef.current = (initialPlat.element as HTMLElement) || null;
              platformOffsetRatioRef.current = ratio;
              posRef.current.x = maxX > minX ? minX + (maxX - minX) * ratio : (initialPlat.left + initialPlat.right) / 2;
              posRef.current.y = initialPlat.top;
              stateRef.current = 'idle';
              stateTimerRef.current = 50 + Math.floor(Math.random() * 30);
              jumpPlanRef.current = null;
              hasInitializedRef.current = true;
            } else {
              initAttemptsRef.current++;
              if (initAttemptsRef.current > 45) {
                // If ~0.75s passed with zero bubbles, chat is empty; anchor to bottom anchor
                const bottomAnchor = getPlatformRect(CHAT_BOTTOM_ANCHOR_ID);
                if (bottomAnchor) {
                  attachedPlatformIdRef.current = CHAT_BOTTOM_ANCHOR_ID;
                  attachedElementRef.current = (bottomAnchor.element as HTMLElement) || null;
                  posRef.current.x = (bottomAnchor.left + bottomAnchor.right) / 2;
                  posRef.current.y = bottomAnchor.top;
                  hasInitializedRef.current = true;
                }
              }
              if (!hasInitializedRef.current) {
                // Keep container hidden off-screen until messages mount
                if (containerRef.current) {
                  containerRef.current.style.transform = 'translate3d(-9999px, -9999px, 0)';
                }
                return;
              }
            }
          }
        }

        // 1. Continuous Platform Anchor Sync
        const isAirborne = stateRef.current === 'jumping';

        if (!isAirborne) {
          let livePlat = getPlatformRect(attachedPlatformIdRef.current);

          // If current platform is missing (e.g. message removed or initial load):
          if (!livePlat) {
            const bubbles = scrollPlatforms.filter((p) => p.isBubble);
            if (bubbles.length > 0) {
              // Pick bubble closest to Mochi's current height (never forcibly pull to bottom message!)
              const nearest = bubbles.reduce(
                (prev, curr) =>
                  Math.abs(curr.top - posRef.current.y) < Math.abs(prev.top - posRef.current.y) ? curr : prev,
                bubbles[0]
              );
              attachedPlatformIdRef.current = nearest.id;
              attachedElementRef.current = (nearest.element as HTMLElement) || null;
              platformOffsetRatioRef.current = 0.5;
              livePlat = getPlatformRect(nearest.id);
            } else {
              attachedPlatformIdRef.current = CHAT_BOTTOM_ANCHOR_ID;
              livePlat = getPlatformRect(CHAT_BOTTOM_ANCHOR_ID);
            }
          }

          if (livePlat) {
            posRef.current.y = livePlat.top;
            const inset = getPlatformInset(livePlat);
            const minWalk = livePlat.left + inset;
            const maxWalk = livePlat.right - inset;

            if (maxWalk <= minWalk) {
              posRef.current.x = (livePlat.left + livePlat.right) / 2;
            } else {
              const targetPx = minWalk + (maxWalk - minWalk) * platformOffsetRatioRef.current;
              posRef.current.x = Math.max(minWalk, Math.min(maxWalk, targetPx));
            }

            if (msgCont) {
              const maxSafeX = Math.max(28, msgCont.clientWidth - 28);
              posRef.current.x = Math.max(28, Math.min(maxSafeX, posRef.current.x));
            }

            // Check typing box collision when scrolling pushes Mochi down towards the input box
            checkTypingBoxCollision();
          }

          // Off-screen recovery: If user scrolled far away and Mochi has been off-screen for > 3s,
          // softly skip-jump onto a currently visible bubble right in front of the user!
          if (msgCont) {
            const viewTop = msgCont.scrollTop;
            const viewBottom = msgCont.scrollTop + msgCont.clientHeight;
            const isMochiInView = posRef.current.y >= viewTop - 40 && posRef.current.y <= viewBottom + 40;

            if (!isMochiInView) {
              offscreenTimerRef.current++;
              if (offscreenTimerRef.current > 180) {
                const visiblePlatforms = scrollPlatforms.filter(
                  (p) => p.isBubble && p.top >= viewTop + 45 && p.top <= viewBottom - 85
                );
                if (visiblePlatforms.length > 0) {
                  const pickIdx = Math.floor(visiblePlatforms.length / 2);
                  const target = visiblePlatforms[pickIdx] || visiblePlatforms[0];
                  const recoveryPhrases = ['Found you! ✨', 'Here I am! 🐾', 'Meow! 🐱', 'Catch me! 💕'];
                  showSpeech(recoveryPhrases[Math.floor(Math.random() * recoveryPhrases.length)], 90);
                  startJump(target, true /* isSkipJump */);
                }
                offscreenTimerRef.current = 0;
              }
            } else {
              offscreenTimerRef.current = 0;
            }
          }
        }

        // 2. Update 160x116 container position via subpixel GPU translate3d in message-container scroll coordinates
        if (containerRef.current) {
          const safeX = Number.isFinite(posRef.current.x) ? posRef.current.x : 160;
          const safeY = Number.isFinite(posRef.current.y) ? posRef.current.y : 300;
          containerRef.current.style.transform = `translate3d(${(safeX - PET_OFFSET_X).toFixed(1)}px, ${(safeY - PET_OFFSET_Y).toFixed(1)}px, 0)`;
        }

      // 3. Decrement state timers
      if (stateTimerRef.current > 0) {
        stateTimerRef.current--;
      }

      // 4. Blinking logic
      blinkTimerRef.current++;
      if (blinkTimerRef.current > 240) {
        isBlinkingRef.current = true;
        if (blinkTimerRef.current > 254) {
          isBlinkingRef.current = false;
          blinkTimerRef.current = Math.floor(Math.random() * 80);
        }
      }

      // 5. Ear twitching
      earTwitchTimerRef.current++;

      // 6. Squash and stretch decay & realistic feline flight pitch
      squashRef.current.sx += (1 - squashRef.current.sx) * 0.18;
      squashRef.current.sy += (1 - squashRef.current.sy) * 0.18;

      if (stateRef.current === 'jumping') {
        bodyAngleRef.current = (jumpProgressRef.current - 0.45) * 0.35;
      } else {
        bodyAngleRef.current = 0;
      }

      // 6b. Subtle, organic feline breathing cycle (calm rhythm in idle/loaf, purr vibration when petted)
      const isRelaxedForBreath = stateRef.current === 'idle' || stateRef.current === 'loaf' || stateRef.current === 'purring' || stateRef.current === 'peeking';
      const breathSpeed = stateRef.current === 'purring' ? 0.075 : (stateRef.current === 'loaf' ? 0.024 : 0.036);
      breathePhaseRef.current += isRelaxedForBreath ? breathSpeed : 0.02;

      // 7. Dynamic Gaze Tracking & Curious Eye Intelligence
      // Auto-deactivate touch/mouse tracking if inactive for > 1.4s
      if (pointerPosRef.current.active && Date.now() - pointerLastActiveRef.current > 1400) {
        pointerPosRef.current.active = false;
      }

      let desiredEyeX = 0;
      let desiredEyeY = 0;

      if (pointerPosRef.current.active) {
        const curX = posRef.current.x;
        const curY = posRef.current.y - 20;
        const pX = pointerPosRef.current.x;
        const pY = pointerPosRef.current.y;

        const dx = pX - curX;
        const dy = pY - curY;
        const dist = Math.hypot(dx, dy);

        if (dist < 380 && dist > 1) {
          const normX = Math.max(-1, Math.min(1, dx / dist));
          const normY = Math.max(-1, Math.min(1, dy / dist));
          // In local cat space: when facing left (!facingRight), scale(-1, 1) inverts local X.
          desiredEyeX = (facingRightRef.current ? normX : -normX) * 1.6;
          desiredEyeY = normY * 1.5;
        } else {
          pointerPosRef.current.active = false;
        }
      }

      if (!pointerPosRef.current.active) {
        // Natural state-driven gaze intelligence so pupils are always alive and purposeful
        const currState = stateRef.current;
        if (currState === 'walking') {
          // When walking: focus forward along walking direction, slightly down at platform path
          desiredEyeX = 1.3;
          desiredEyeY = 0.5;
        } else if (currState === 'peeking') {
          // Peeking down over the bubble edge
          desiredEyeX = 0.8;
          desiredEyeY = 1.6;
        } else if (currState === 'pre_jump') {
          // Crouched down looking up at target jump trajectory with focused dilated eyes
          desiredEyeX = 0.6;
          desiredEyeY = -1.6;
        } else if (currState === 'jumping') {
          // In flight: look up during ascent, look down at landing surface during descent
          if (jumpProgressRef.current < 0.5) {
            desiredEyeX = 0.8;
            desiredEyeY = -1.6;
          } else {
            desiredEyeX = 0.4;
            desiredEyeY = 1.6;
          }
        } else if (currState === 'alert' || currState === 'typing_wait') {
          // Looking up curiously at incoming messages / typing
          desiredEyeX = 0.1;
          desiredEyeY = -1.4;
        } else if (currState === 'grooming') {
          desiredEyeX = 0.3;
          desiredEyeY = 1.2;
        } else {
          // IDLE / LOAF / PURRING: Lifelike Saccadic Gaze Controller
          idleGazeTimerRef.current++;
          if (idleGazeTimerRef.current > 120) {
            idleGazeTimerRef.current = Math.floor(Math.random() * 45);
            const roll = Math.random();
            if (roll < 0.32) {
              // Calm, direct forward gaze
              targetEyeOffsetRef.current = { dx: 0, dy: 0 };
            } else if (roll < 0.52) {
              // Glance down at paws / current bubble
              targetEyeOffsetRef.current = { dx: 0.2, dy: 1.4 };
            } else if (roll < 0.72) {
              // Glance up curiously towards the chat conversation
              targetEyeOffsetRef.current = { dx: 0.1, dy: -1.5 };
            } else if (roll < 0.86) {
              // Glance ahead in front of her
              targetEyeOffsetRef.current = { dx: 1.4, dy: -0.2 };
            } else {
              // Glance back behind her
              targetEyeOffsetRef.current = { dx: -1.3, dy: -0.2 };
            }
          }
          desiredEyeX = targetEyeOffsetRef.current.dx;
          desiredEyeY = targetEyeOffsetRef.current.dy;
        }
      }

      // Smooth, silky eye lerping (natural fluid saccades without robotic snapping)
      eyeOffsetRef.current.dx += (desiredEyeX - eyeOffsetRef.current.dx) * 0.15;
      eyeOffsetRef.current.dy += (desiredEyeY - eyeOffsetRef.current.dy) * 0.15;

      // 8. STATE MACHINE & COMPANION INTELLIGENCE
      const state = stateRef.current;

      if (state === 'idle') {
        tailWaveRef.current += 0.04;
        walkPhaseRef.current = 0;

        if (stateTimerRef.current <= 0) {
          const msgCont = document.getElementById('message-container');
          const contRect = msgCont?.getBoundingClientRect();
          const inputCapsule =
            document.getElementById('chat-input-capsule') ||
            (document.querySelector('.chat-input-perch') as HTMLElement);
          const typingBoxScreenY = (inputCapsule && contRect)
            ? inputCapsule.getBoundingClientRect().top - contRect.top
            : (msgCont ? msgCont.clientHeight - 65 : 600);

          const curIdClean = (attachedPlatformIdRef.current || '').replace(/^msg-/, '');

          // Filter for valid, visible, safe message bubbles in viewport (comfortably clear of typing box)
          // In content space:
          const viewTop = msgCont ? msgCont.scrollTop : 0;
          const viewBottom = msgCont ? viewTop + msgCont.clientHeight : 800;
          const safeTop = viewTop + 25;
          const safeBottom = Math.min(viewBottom - 75, viewTop + typingBoxScreenY - 35);

          const visibleBubbles = scrollPlatforms.filter((p) => {
            if (!p.isBubble) return false;
            return p.top >= safeTop && p.top <= safeBottom;
          });
          const otherBubbles = visibleBubbles.filter((p) => p.id.replace(/^msg-/, '') !== curIdClean);

          // Sequential navigation towards new message goal (deliberate, cat-like pacing)
          if (targetGoalIdRef.current && targetGoalIdRef.current !== curIdClean) {
            // Only hop towards goal if she has rested/explored on this platform for at least 2.5s
            if (Date.now() - lastHopTimeRef.current > 2500) {
              const allBubbles = scrollPlatforms.filter((p) => p.isBubble);
              const currentIdx = allBubbles.findIndex((p) => p.id.replace(/^msg-/, '') === curIdClean);
              const goalIdx = allBubbles.findIndex(
                (p) => p.id.replace(/^msg-/, '') === targetGoalIdRef.current?.replace(/^msg-/, '')
              );

              if (currentIdx !== -1 && goalIdx !== -1 && currentIdx !== goalIdx) {
                const stepDir = goalIdx > currentIdx ? 1 : -1;
                const nextPlat = allBubbles[currentIdx + stepDir];
                if (nextPlat) {
                  startJump(nextPlat, false);
                  return;
                }
              }
              targetGoalIdRef.current = null;
            }
          }

          const roll = Math.random();

          // 1. Walking along current message platform (~55% chance - cats love to stroll & patrol!)
          if (roll < 0.55) {
            stateRef.current = 'walking';
            stateTimerRef.current = 80 + Math.floor(Math.random() * 80);
            facingRightRef.current = Math.random() > 0.5;
            return;
          }

          // 2. Cozy bread loaf nap (~15% chance - relaxed feline bread loaf)
          if (roll < 0.70) {
            stateRef.current = 'loaf';
            stateTimerRef.current = 140 + Math.floor(Math.random() * 120);
            addParticle('zzz', 1);
            return;
          }

          // 3. Face grooming (~10% chance)
          if (roll < 0.80) {
            stateRef.current = 'grooming';
            stateTimerRef.current = 75 + Math.floor(Math.random() * 40);
            groomPhaseRef.current = 0;
            return;
          }

          // 4. Cat stretch (~8% chance)
          if (roll < 0.88) {
            stateRef.current = 'stretching';
            stateTimerRef.current = 65;
            stretchPhaseRef.current = 0;
            squashRef.current = { sx: 1.25, sy: 0.78 };
            return;
          }

          // 5. Deliberate, rare cat hop strictly between adjacent message bubbles (~12% chance with 4s cooldown)
          if (otherBubbles.length > 0 && Date.now() - lastHopTimeRef.current > 4000) {
            const allBubbles = scrollPlatforms.filter((p) => p.isBubble);
            const curIdx = allBubbles.findIndex((p) => p.id.replace(/^msg-/, '') === curIdClean);

            const adjacentCandidates: Platform[] = [];
            if (curIdx > 0) {
              const above = allBubbles[curIdx - 1];
              if (above.top >= safeTop) adjacentCandidates.push(above);
            }
            if (curIdx < allBubbles.length - 1) {
              const below = allBubbles[curIdx + 1];
              if (below.top <= safeBottom) adjacentCandidates.push(below);
            }

            if (adjacentCandidates.length > 0) {
              const targetP = adjacentCandidates[Math.floor(Math.random() * adjacentCandidates.length)];
              startJump(targetP, false);
              return;
            }
          }

          // Default fallback: continue leisurely sitting and looking around
          stateRef.current = 'idle';
          stateTimerRef.current = 80 + Math.floor(Math.random() * 60);
        }
      } else if (state === 'walking') {
        tailWaveRef.current += 0.08;
        walkPhaseRef.current += 0.22;

        let livePlat = getPlatformRect(attachedPlatformIdRef.current);
        if (livePlat) {
          const inset = getPlatformInset(livePlat);
          const walkWidth = Math.max(30, livePlat.width - 2 * inset);
          // Constant, natural walking speed of ~0.65 pixels per frame
          const speedRatio = 0.65 / walkWidth;

          let ratio = platformOffsetRatioRef.current;
          const msgCont = document.getElementById('message-container');
          const isAtRightBound = Boolean(msgCont && posRef.current.x >= msgCont.clientWidth - 32);
          const isAtLeftBound = Boolean(msgCont && posRef.current.x <= 32);

          if (facingRightRef.current) {
            ratio += speedRatio;
            if (ratio >= 0.95 || isAtRightBound) {
              ratio = Math.min(0.95, ratio);
              facingRightRef.current = false;
              stateRef.current = 'peeking';
              stateTimerRef.current = 35;
            }
          } else {
            ratio -= speedRatio;
            if (ratio <= 0.05 || isAtLeftBound) {
              ratio = Math.max(0.05, ratio);
              facingRightRef.current = true;
              stateRef.current = 'peeking';
              stateTimerRef.current = 35;
            }
          }
          platformOffsetRatioRef.current = ratio;
        }

        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 45 + Math.floor(Math.random() * 60);
        }
      } else if (state === 'pre_jump') {
        buttWiggleRef.current += 0.55;
        squashRef.current = { sx: 1.18, sy: 0.82 };

        if (stateTimerRef.current <= 0) {
          stateRef.current = 'jumping';
          jumpProgressRef.current = 0;
          if (jumpPlanRef.current) {
            jumpPlanRef.current.startX = posRef.current.x;
            jumpPlanRef.current.startY = posRef.current.y;
          }
          squashRef.current = { sx: 0.8, sy: 1.28 };
          addParticle('✨', 1);
        }
      } else if (state === 'jumping') {
        if (jumpPlanRef.current) {
          const plan = jumpPlanRef.current;

          // Dynamically adjust target coordinates if target message shifted
          const liveTarget = getPlatformRect(plan.targetPlatformId);
          if (liveTarget) {
            plan.targetY = liveTarget.top;
            const inset = getPlatformInset(liveTarget);
            const minW = liveTarget.left + inset;
            const maxW = liveTarget.right - inset;
            if (maxW > minW) {
              plan.targetX = minW + (maxW - minW) * plan.targetRatio;
            } else {
              plan.targetX = (liveTarget.left + liveTarget.right) / 2;
            }
          }

          jumpProgressRef.current += 1 / plan.duration;
          const t = Math.min(1, jumpProgressRef.current);

          // Continuous cosine easing for X
          const easeX = 0.5 - 0.5 * Math.cos(t * Math.PI);
          posRef.current.x = plan.startX + (plan.targetX - plan.startX) * easeX;

          // Parabolic trajectory for Y
          const linearY = plan.startY + (plan.targetY - plan.startY) * t;
          const arc = 4 * plan.arcHeight * t * (1 - t);
          posRef.current.y = linearY - arc;

          // Mid-air squash & stretch
          squashRef.current = t < 0.5 ? { sx: 0.82, sy: 1.22 } : { sx: 0.94, sy: 1.06 };

          if (t >= 1) {
            // LANDING: Firmly lock position and anchor to targetPlatform
            posRef.current.x = plan.targetX;
            posRef.current.y = plan.targetY;
            attachedPlatformIdRef.current = plan.targetPlatformId;
            platformOffsetRatioRef.current = plan.targetRatio;
            jumpPlanRef.current = null;
            stateRef.current = 'landing';
            stateTimerRef.current = 10;
            squashRef.current = { sx: 1.25, sy: 0.76 };
            addParticle('✨', 1);

            if (targetGoalIdRef.current === plan.targetPlatformId) {
              targetGoalIdRef.current = null;
            }
          }
        } else {
          stateRef.current = 'idle';
          stateTimerRef.current = 30;
        }
      } else if (state === 'landing') {
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          if (targetGoalIdRef.current && targetGoalIdRef.current !== attachedPlatformIdRef.current) {
            stateTimerRef.current = 75 + Math.floor(Math.random() * 40); // Calm cat pause to look around before considering next hop
          } else {
            targetGoalIdRef.current = null;
            stateTimerRef.current = 80 + Math.floor(Math.random() * 60);
          }
        }
      } else if (state === 'peeking') {
        tailWaveRef.current += 0.05;
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40;
        }
      } else if (state === 'grooming') {
        groomPhaseRef.current += 0.16;
        squashRef.current = { sx: 1.05, sy: 0.95 };
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40;
        }
      } else if (state === 'stretching') {
        stretchPhaseRef.current += 0.08;
        squashRef.current = { sx: 1.25, sy: 0.8 };
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40;
        }
      } else if (state === 'loaf') {
        tailWaveRef.current += 0.02;
        squashRef.current.sy = 0.9 + Math.sin(Date.now() * 0.003) * 0.04;
        squashRef.current.sx = 1.08 - Math.sin(Date.now() * 0.003) * 0.04;

        if (Math.random() < 0.015) {
          addParticle('zzz', 1);
        }

        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 50;
        }
      } else if (state === 'purring') {
        tailWaveRef.current += 0.18;
        squashRef.current.sy = 0.88 + Math.sin(Date.now() * 0.012) * 0.06;
        squashRef.current.sx = 1.12 - Math.sin(Date.now() * 0.012) * 0.06;

        if (Math.random() < 0.12) {
          addParticle('❤️', 1);
        }

        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 50;
        }
      } else if (state === 'alert') {
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40;
        }
      } else if (state === 'typing_wait') {
        tailWaveRef.current += 0.06;
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40;
        }
      }

      // Continuous Multi-Perspective Yaw Interpolation:
      // Smoothly blends across 2.0D (0.0) -> 2.1D (0.25) -> 2.2D (0.50) -> 2.3D (0.75) -> 2.4D-2.5D (1.0)
      const isLookingAtUser =
        stateRef.current === 'purring' ||
        stateRef.current === 'alert' ||
        stateRef.current === 'peeking' ||
        stateRef.current === 'typing_wait' ||
        stateRef.current === 'loaf' ||
        (stateRef.current === 'idle' && Math.sin(breathePhaseRef.current * 0.35) > -0.65);

      const targetYaw = isLookingAtUser ? 0.0 : 1.0;
      // Butter-smooth spring easing transition
      yawProgressRef.current += (targetYaw - yawProgressRef.current) * 0.10;

      // --- RENDERING TO LOCAL 160x140 CANVAS ---
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render the Cat (Centered at PET_OFFSET_X, PET_OFFSET_Y)
      ctx.save();
      ctx.translate(PET_OFFSET_X, PET_OFFSET_Y);

      if (!facingRightRef.current) {
        ctx.scale(-1, 1);
      }

      const safeAngle = Number.isFinite(bodyAngleRef.current) ? bodyAngleRef.current : 0;
      const safeSx = Number.isFinite(squashRef.current.sx) && squashRef.current.sx > 0 ? squashRef.current.sx : 1;
      const safeSy = Number.isFinite(squashRef.current.sy) && squashRef.current.sy > 0 ? squashRef.current.sy : 1;

      ctx.rotate(safeAngle);
      ctx.scale(safeSx, safeSy);

      drawCuteKitten(
        ctx,
        stateRef.current,
        settings.breed,
        settings.accessory,
        walkPhaseRef.current,
        tailWaveRef.current,
        buttWiggleRef.current,
        isBlinkingRef.current,
        earTwitchTimerRef.current,
        groomPhaseRef.current,
        stretchPhaseRef.current,
        eyeOffsetRef.current,
        breathePhaseRef.current,
        settings.is25D || false,
        yawProgressRef.current
      );

      ctx.restore();

      // Render Floating Particles (Hearts, zzz, sparkles)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.font = `bold ${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(i, 1);
        }
      }

      // Render Speech / Thought Bubble
      if (speechBubbleRef.current) {
        speechBubbleRef.current.timer--;
        const alpha = Math.min(1, speechBubbleRef.current.timer / 15);
        if (alpha > 0) {
          drawSpeechBubble(
            ctx,
            PET_OFFSET_X,
            36,
            speechBubbleRef.current.text,
            alpha,
            speechBubbleRef.current.isThought || false
          );
        }
        if (speechBubbleRef.current.timer <= 0) {
          speechBubbleRef.current = null;
        }
      }
      } catch (err) {
        // Unbreakable heartbeat guarantee: Log and recover seamlessly in next frame
        console.error('[Mochi Animation Recovered]', err);
      } finally {
        if (!isDestroyed) {
          animFrameId = requestAnimationFrame(tick);
        }
      }
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchstart', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerEnd);
      window.removeEventListener('touchcancel', handlePointerEnd);
      window.removeEventListener('mouseleave', handlePointerEnd);
      window.removeEventListener('resize', handleMsgScroll);
      if (msgContainerEl) {
        msgContainerEl.removeEventListener('scroll', handleMsgScroll);
      }
    };
  }, [settings.enabled, settings.breed, settings.accessory, settings.is25D, getPlatformRect, scanPlatforms, startJump, checkTypingBoxCollision, addParticle]);

  if (!settings.enabled) return null;

  return (
    <div
      ref={containerRef}
      id="chat-pet-companion-layer"
      className="absolute top-0 left-0 pointer-events-none z-30 select-none"
      style={{
        width: `${CANVAS_WIDTH}px`,
        height: `${CANVAS_HEIGHT}px`,
        willChange: 'transform',
        transform: 'translate3d(-9999px, -9999px, 0)',
        overflowAnchor: 'none',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        contain: 'layout style',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
        className="block pointer-events-none"
      />

      {/* Interactive Hit Target directly over Mochi's body for Petting */}
      <button
        ref={hitButtonRef}
        type="button"
        aria-label={`Pet ${settings.name}`}
        title={`Pet ${settings.name} 🐾`}
        onClick={handlePet}
        onTouchEnd={handlePet}
        className="absolute left-[54px] top-[66px] w-[52px] h-[52px] pointer-events-auto cursor-pointer rounded-full opacity-0 hover:opacity-10 active:opacity-20 transition-opacity bg-[var(--theme-accent)] border-0 focus:outline-none"
        style={{ touchAction: 'manipulation' }}
      />
    </div>
  );
};

// -------------------------------------------------------------
// 🎨 HAND-CRAFTED 2D VECTOR KITTEN RENDERER (Catalyststuff Vector Aesthetic)
// -------------------------------------------------------------
export interface KittenPalette {
  bodyColor: string;
  bellyColor: string;
  outlineColor: string;
  earPink: string;
  eyeHighlight: string;
  noseColor: string;
  padColor: string;
  whiskerColor: string;
  spotColor1: string | null;
  spotColor2: string | null;
  eyeColor: string;
  pawColor: string;
  farShadeColor: string;
}

export function getPetPalette(breed: PetBreed): KittenPalette {
  let bodyColor = '#FFFFFF';
  let bellyColor = '#FFF9FC';
  let outlineColor = '#2A2733';   // Crisp bold charcoal vector stroke
  let earPink = '#FFB2C3';        // Pastel peach-pink inner ear
  let eyeHighlight = '#FFFFFF';
  let noseColor = '#FF8DA5';       // Sweet pink nose triangle
  let padColor = '#FFAEC9';
  let whiskerColor = '#2A2733';
  let spotColor1: string | null = null;
  let spotColor2: string | null = null;
  let eyeColor = '#22202A';
  let pawColor = bodyColor;
  let farShadeColor = 'rgba(28, 25, 38, 0.16)';

  if (breed === 'mochi') {
    bodyColor = '#FFFFFF';
    bellyColor = '#FFF9FC';
    outlineColor = '#2A2733';
    earPink = '#FFB2C3';
    noseColor = '#FF8DA5';
    eyeColor = '#22202A';
    pawColor = '#FFFFFF';
    farShadeColor = 'rgba(28, 25, 38, 0.14)';
  } else if (breed === 'calico') {
    bodyColor = '#FCFAF8';
    bellyColor = '#FFF9FC';
    spotColor1 = '#F59E0B'; // warm apricot
    spotColor2 = '#452A1E'; // chocolate espresso
    outlineColor = '#2B221E';
    earPink = '#FCA5A5';
    noseColor = '#FB7185';
    eyeColor = '#22202A';
    pawColor = '#FCFAF8';
    farShadeColor = 'rgba(43, 34, 30, 0.16)';
  } else if (breed === 'caramel') {
    bodyColor = '#FB923C';
    bellyColor = '#FEF3C7';
    spotColor1 = '#C2410C'; // tabby stripes
    outlineColor = '#381A08';
    earPink = '#FCA5A5';
    noseColor = '#EA580C';
    eyeColor = '#22202A';
    pawColor = '#FB923C';
    farShadeColor = 'rgba(56, 26, 8, 0.18)';
  } else if (breed === 'luna') {
    bodyColor = '#23232B';
    bellyColor = '#2F2F3B';
    outlineColor = '#111116';
    earPink = '#6E4D5B';
    padColor = '#FFB6C1';
    noseColor = '#7A5463';
    whiskerColor = 'rgba(240, 240, 250, 0.7)';
    eyeColor = '#34D399';
    pawColor = '#FFFFFF';
    farShadeColor = 'rgba(0, 0, 0, 0.25)';
  } else if (breed === 'siamese') {
    bodyColor = '#F5EBE6';
    bellyColor = '#FAF5F0';
    outlineColor = '#3A2926';
    spotColor1 = '#4A3531'; // seal point chocolate
    earPink = '#5C4033';
    padColor = '#4A3531';
    noseColor = '#4A3531';
    whiskerColor = '#3A2926';
    eyeColor = '#0284C7'; // sapphire sky blue
    pawColor = '#4A3531';
    farShadeColor = 'rgba(58, 41, 38, 0.18)';
  } else if (breed === 'tuxedo') {
    bodyColor = '#1E1E24';
    bellyColor = '#FFFFFF';
    outlineColor = '#111116';
    earPink = '#F472B6';
    padColor = '#FFAEC9';
    noseColor = '#FB7185';
    whiskerColor = 'rgba(255, 255, 255, 0.85)';
    eyeColor = '#EAB308'; // golden topaz
    pawColor = '#FFFFFF';
    farShadeColor = 'rgba(0, 0, 0, 0.28)';
  } else if (breed === 'silver') {
    bodyColor = '#94A3B8';
    bellyColor = '#E2E8F0';
    outlineColor = '#334155';
    earPink = '#F9A8D4';
    padColor = '#FDA4AF';
    noseColor = '#BE185D';
    whiskerColor = '#1E293B';
    eyeColor = '#059669'; // seafoam emerald
    pawColor = '#94A3B8';
    farShadeColor = 'rgba(30, 41, 59, 0.18)';
  } else if (breed === 'cinnamon') {
    bodyColor = '#C27852';
    bellyColor = '#FEF3C7';
    spotColor1 = '#7C2D12';
    outlineColor = '#451A03';
    earPink = '#FCA5A5';
    padColor = '#F472B6';
    noseColor = '#9A3412';
    whiskerColor = '#451A03';
    eyeColor = '#D97706'; // honey amber
    pawColor = '#C27852';
    farShadeColor = 'rgba(69, 26, 3, 0.18)';
  } else if (breed === 'berry') {
    bodyColor = '#FDE8EF';
    bellyColor = '#FFF5F8';
    outlineColor = '#831843';
    earPink = '#F472B6';
    padColor = '#FB7185';
    noseColor = '#E11D48';
    whiskerColor = '#9D174D';
    eyeColor = '#BE185D'; // sparkling ruby
    pawColor = '#FDE8EF';
    farShadeColor = 'rgba(131, 24, 67, 0.14)';
  }

  return {
    bodyColor,
    bellyColor,
    outlineColor,
    earPink,
    eyeHighlight,
    noseColor,
    padColor,
    whiskerColor,
    spotColor1,
    spotColor2,
    eyeColor,
    pawColor,
    farShadeColor,
  };
}

const lerp = (a: number, b: number, factor: number) => a + (b - a) * factor;

/**
 * Draws an organic, gracefully curved and tapered whisker following facial curvature.
 * Tapers from a defined base thickness at the cheek root to a fine, delicate point at the tip.
 */
function drawTaperedWhisker(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cpX: number,
  cpY: number,
  endX: number,
  endY: number,
  baseWidth: number = 1.15,
  color: string = '#1E1B2E'
) {
  const dx = cpX - startX;
  const dy = cpY - startY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (baseWidth * 0.5);
  const ny = (dx / len) * (baseWidth * 0.5);

  ctx.beginPath();
  ctx.moveTo(startX + nx, startY + ny);
  ctx.quadraticCurveTo(cpX + nx * 0.35, cpY + ny * 0.35, endX, endY);
  ctx.quadraticCurveTo(cpX - nx * 0.35, cpY - ny * 0.35, startX - nx, startY - ny);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawCuteKitten2D(
  ctx: CanvasRenderingContext2D,
  state: CatState,
  breed: PetBreed,
  accessory: PetAccessory,
  walkPhase: number,
  tailWave: number,
  buttWiggle: number,
  isBlinking: boolean,
  earTwitchTimer: number,
  groomPhase: number = 0,
  stretchPhase: number = 0,
  eyeOffset: { dx: number; dy: number } = { dx: 0, dy: 0 },
  breathePhase: number = 0,
  palette: KittenPalette
) {
  const {
    bodyColor,
    bellyColor,
    outlineColor,
    earPink,
    eyeHighlight,
    noseColor,
    padColor,
    whiskerColor,
    spotColor1,
    spotColor2,
    eyeColor,
    pawColor,
  } = palette;

  // 1. Soft Dynamic Ground Drop Shadow (Oval beneath seated kitten)
  ctx.save();
  ctx.beginPath();
  const shadowScale = state === 'pre_jump' ? 1.2 : (state === 'loaf' ? 1.1 : (state === 'jumping' ? 0.65 : 1.0));
  const shadowAlpha = state === 'jumping' ? 0.08 : 0.22;
  ctx.ellipse(0, 0.5, 16 * shadowScale, 4.2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(32, 28, 42, ${shadowAlpha})`;
  ctx.fill();
  ctx.restore();

  // Butt wiggle offset (only active during pre-jump)
  const buttX = state === 'pre_jump' ? Math.sin(buttWiggle) * 3.2 : 0;
  const buttY = state === 'pre_jump' ? Math.abs(Math.cos(buttWiggle)) * 1.4 : 0;

  // 2. SMOOTH CURVED VECTOR TAIL (Sweeping up gracefully from right hip)
  ctx.save();
  const tailBaseX = 8.5 + buttX;
  const tailBaseY = -8.5 + buttY;

  ctx.beginPath();
  ctx.moveTo(tailBaseX, tailBaseY);

  if (state === 'loaf') {
    // Snug curled tail around paws
    const breathe = Math.sin(Date.now() * 0.003) * 0.6;
    ctx.bezierCurveTo(
      tailBaseX + 4, tailBaseY + 5,
      -4, tailBaseY + 7 + breathe,
      -10, tailBaseY + 2 + breathe
    );
  } else if (state === 'clinging') {
    // Dynamic counter-balance tail
    ctx.bezierCurveTo(
      tailBaseX + 8, tailBaseY - 6,
      tailBaseX + 16, tailBaseY - 4,
      tailBaseX + 22, tailBaseY - 8
    );
  } else {
    // Sweet, graceful upward-curling cartoon tail
    const wave = Math.sin(tailWave) * 4.0;
    ctx.bezierCurveTo(
      tailBaseX + 7, tailBaseY - 6 + wave * 0.3,
      tailBaseX + 10 + wave * 0.7, tailBaseY - 16,
      tailBaseX + 4 + wave * 1.1, tailBaseY - 23
    );
  }

  // Tail outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 4.8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Tail fur core
  ctx.strokeStyle = breed === 'siamese' ? '#4A3531' : bodyColor;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();

  // 3. SEATED HAUNCHES & REAR PAWS (Iconic chubby sitting pose)
  const stepOffset1 = state === 'walking' ? Math.sin(walkPhase) * 3.0 : 0;
  const stepOffset2 = state === 'walking' ? -Math.sin(walkPhase) * 3.0 : 0;

  if (state !== 'loaf') {
    ctx.save();

    // Left Haunch Bulge (Sitting hip)
    ctx.beginPath();
    ctx.ellipse(-9.2, -6.5, 5.2, 5.8, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Right Haunch Bulge (Sitting hip)
    ctx.beginPath();
    ctx.ellipse(9.2, -6.5, 5.2, 5.8, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Left Back Paw
    ctx.beginPath();
    ctx.ellipse(-9.5 + stepOffset1, -1.8, 4.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Right Back Paw
    ctx.beginPath();
    ctx.ellipse(9.5 + stepOffset2, -1.8, 4.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Pink toe bean peek when walking
    if (state === 'walking' && Math.abs(stepOffset1) > 1.6) {
      ctx.beginPath();
      ctx.arc(-9.5 + stepOffset1, -1.8, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = padColor;
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. ROUND CHUBBY PEAR-SHAPED BODY
  ctx.save();
  const isRelaxed = state === 'idle' || state === 'loaf' || state === 'purring' || state === 'peeking';
  const breath = isRelaxed ? Math.sin(breathePhase) : 0;
  const purrRumble = state === 'purring' ? Math.sin(breathePhase * 5) * 0.35 : 0;
  const bodyY = -12 + (state === 'pre_jump' ? 2.2 : 0) - breath * 0.35 + purrRumble;

  // Chubby Torso
  const bodyRadiusX = 13.2 - breath * 0.2;
  const bodyRadiusY = 10.8 + breath * 0.45;
  ctx.beginPath();
  ctx.ellipse(0 + buttX * 0.3, bodyY, bodyRadiusX, bodyRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Calico Body Patch
  if (spotColor1 && breed === 'calico') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-4 + buttX * 0.3, bodyY - 3, 5.0, 4.0, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor1;
    ctx.fill();
    ctx.restore();
  }

  // Caramel Tabby Back Stripes
  if (spotColor1 && breed === 'caramel') {
    ctx.save();
    ctx.strokeStyle = spotColor1;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-5 + buttX * 0.3, bodyY - 7);
    ctx.lineTo(-3 + buttX * 0.3, bodyY - 3);
    ctx.moveTo(0 + buttX * 0.3, bodyY - 8);
    ctx.lineTo(0 + buttX * 0.3, bodyY - 3);
    ctx.moveTo(5 + buttX * 0.3, bodyY - 7);
    ctx.lineTo(3 + buttX * 0.3, bodyY - 3);
    ctx.stroke();
    ctx.restore();
  }

  // Soft White Chest / Belly Patch
  ctx.beginPath();
  ctx.ellipse(0 + buttX * 0.2, bodyY + 1.2, 7.8 - breath * 0.2, 6.5 + breath * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();
  ctx.restore();

  // 5. ROUND CHIBI HEAD & FACIAL VECTOR FEATURES
  const headBob = state === 'walking' ? Math.sin(walkPhase * 2) * 0.6 : 0;
  const headY = -22.5 + (state === 'pre_jump' ? 3.0 : 0) + headBob - breath * 0.45 + purrRumble * 0.5;
  ctx.save();
  ctx.translate(0, headY);

  // EARS: Rounded triangular cartoon ears with pastel pink inner patches
  const twitchL = (earTwitchTimer % 180 < 12) ? Math.sin(earTwitchTimer) * 0.14 : 0;
  const twitchR = (earTwitchTimer % 240 < 12) ? Math.sin(earTwitchTimer) * 0.14 : 0;

  // Left Ear
  ctx.save();
  ctx.translate(-8.2, -7.5);
  ctx.rotate(-0.14 + twitchL);
  ctx.beginPath();
  ctx.moveTo(-1, 5);
  ctx.quadraticCurveTo(-6.8, 1, -6.8, -10.5);
  ctx.quadraticCurveTo(0, -8.5, 6.5, -4.5);
  ctx.quadraticCurveTo(3, 1.5, 1, 5);
  ctx.closePath();
  ctx.fillStyle = breed === 'siamese' ? '#4A3531' : (spotColor2 && breed === 'calico' ? spotColor2 : bodyColor);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Left Inner Ear Pastel Pink
  ctx.beginPath();
  ctx.moveTo(0.2, 2.5);
  ctx.lineTo(-4.0, -7.5);
  ctx.lineTo(4.2, -4.0);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(8.2, -7.5);
  ctx.rotate(0.14 + twitchR);
  ctx.beginPath();
  ctx.moveTo(1, 5);
  ctx.quadraticCurveTo(6.8, 1, 6.8, -10.5);
  ctx.quadraticCurveTo(0, -8.5, -6.5, -4.5);
  ctx.quadraticCurveTo(-3, 1.5, -1, 5);
  ctx.closePath();
  ctx.fillStyle = breed === 'siamese' ? '#4A3531' : (spotColor1 && breed === 'calico' ? spotColor1 : bodyColor);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Right Inner Ear Pastel Pink
  ctx.beginPath();
  ctx.moveTo(-0.2, 2.5);
  ctx.lineTo(4.0, -7.5);
  ctx.lineTo(-4.2, -4.0);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();
  ctx.restore();

  // HEAD BASE: Smooth, Chubby, Wide Rounded Cranium
  ctx.beginPath();
  ctx.ellipse(0, 0, 14.6, 12.0, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Soft Cheek Curves
  ctx.beginPath();
  ctx.moveTo(-12, -0.5);
  ctx.quadraticCurveTo(-15.2, 2.5, -12.5, 5.0);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(12, -0.5);
  ctx.quadraticCurveTo(15.2, 2.5, 12.5, 5.0);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Tabby Forehead 'M' Marking for Caramel & Cinnamon
  if (breed === 'caramel' || breed === 'cinnamon') {
    ctx.save();
    ctx.strokeStyle = spotColor1 || '#C2410C';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(-2, -3.5);
    ctx.lineTo(0, -5.5);
    ctx.lineTo(2, -3.5);
    ctx.lineTo(4, -7);
    ctx.stroke();
    ctx.restore();
  }

  // Calico Head Patch
  if (spotColor2 && breed === 'calico') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-6, -3.5, 5.0, 5.5, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor2;
    ctx.fill();
    ctx.restore();
  }

  // Siamese Seal Point Face Mask
  if (breed === 'siamese') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 1.0, 7.6, 5.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4A3531';
    ctx.fill();
    ctx.restore();
  }

  // Tuxedo White Muzzle / Chin
  if (breed === 'tuxedo') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 3.4, 6.4, 4.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  // CHEEKS: Pastel Rosy Blush Ovals
  ctx.beginPath();
  ctx.ellipse(-7.8, 3.5, 3.2, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(7.8, 3.5, 3.2, 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 140, 175, 0.48)';
  ctx.fill();

  // EYES: LARGE, SPARKLING GLOSSY CARTOON BUTTONS (Dual Specular Highlights)
  const eyeY = -0.4;
  const lookShiftX = Math.max(-1.4, Math.min(1.4, eyeOffset.dx));
  const lookShiftY = Math.max(-1.4, Math.min(1.4, eyeOffset.dy));

  if (isBlinking || state === 'loaf' || state === 'purring') {
    // Sweet happy smiling closed eye arcs (⌒   ⌒)
    ctx.beginPath();
    ctx.arc(-5.6, eyeY + 0.6, 3.4, 0.15, Math.PI - 0.15, false);
    ctx.arc(5.6, eyeY + 0.6, 3.4, 0.15, Math.PI - 0.15, false);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    // --- EYES: Classic Cute Circular Eyes 👁️👁️ (Never bent when facing user) ---
    const eyeXL = -5.6 + lookShiftX * 0.45;
    const eyeYL = eyeY + lookShiftY * 0.45;

    // --- LEFT EYE ---
    ctx.beginPath();
    ctx.ellipse(eyeXL, eyeYL, 3.6, 3.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Primary Specular Highlight (top right)
    ctx.beginPath();
    ctx.ellipse(eyeXL + 1.2, eyeYL - 1.1, 1.35, 1.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Secondary Specular Highlight (bottom left)
    ctx.beginPath();
    ctx.ellipse(eyeXL - 1.2, eyeYL + 1.2, 0.65, 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // --- RIGHT EYE ---
    const eyeXR = 5.6 + lookShiftX * 0.45;
    const eyeYR = eyeY + lookShiftY * 0.45;

    ctx.beginPath();
    ctx.ellipse(eyeXR, eyeYR, 3.6, 3.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Primary Specular Highlight (top right)
    ctx.beginPath();
    ctx.ellipse(eyeXR + 1.2, eyeYR - 1.1, 1.35, 1.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Secondary Specular Highlight (bottom left)
    ctx.beginPath();
    ctx.ellipse(eyeXR - 1.2, eyeYR + 1.2, 0.65, 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();
  }

  // NOSE: Cute Inverted Soft Pink Triangle
  ctx.beginPath();
  ctx.moveTo(-1.4, 1.8);
  ctx.lineTo(1.4, 1.8);
  ctx.lineTo(0, 3.2);
  ctx.closePath();
  ctx.fillStyle = noseColor;
  ctx.fill();

  // MOUTH: Smaller, delicate feline smile slightly separated from nose (not a big block)
  const mouthStemX = 0;
  const mouthSplitY = 4.1; // Cute ~0.9px gap below nose tip (3.2)

  // Subtle delicate center notch
  ctx.beginPath();
  ctx.moveTo(mouthStemX, 3.85);
  ctx.lineTo(mouthStemX, mouthSplitY);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Left curved lip arc (smaller, natural gentle curve)
  ctx.beginPath();
  ctx.ellipse(-1.2, 4.15, 1.2, 0.85, 0, 0.1, Math.PI - 0.1, false);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Right curved lip arc (smaller, natural gentle curve)
  ctx.beginPath();
  ctx.ellipse(1.2, 4.15, 1.2, 0.85, 0, 0.1, Math.PI - 0.1, false);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Sweet purr tongue peek (matching delicate mouth scale)
  if (state === 'purring') {
    ctx.beginPath();
    ctx.ellipse(mouthStemX, 4.75, 1.05, 0.8, 0, 0.1, Math.PI - 0.1, false);
    ctx.fillStyle = '#FB7185';
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.95;
    ctx.stroke();
  }

  // =========================================================
  // 🐱 WHISKERS (Slightly curved and tapered, following cheek contour)
  // =========================================================
  const whiskerTwitch = Math.sin(tailWave * 0.7) * 0.35;

  // Left Whiskers (curved & tapered from cheek root to fine tip)
  drawTaperedWhisker(ctx, -8.6, 3.2, -13.0, 2.7, -16.8, 3.6 + whiskerTwitch, 1.15, whiskerColor);
  drawTaperedWhisker(ctx, -8.4, 4.9, -12.6, 5.1, -16.2, 6.7 + whiskerTwitch, 1.15, whiskerColor);

  // Right Whiskers (curved & tapered from cheek root to fine tip)
  drawTaperedWhisker(ctx, 8.6, 3.2, 13.0, 2.7, 16.8, 3.6 - whiskerTwitch, 1.15, whiskerColor);
  drawTaperedWhisker(ctx, 8.4, 4.9, 12.6, 5.1, 16.2, 6.7 - whiskerTwitch, 1.15, whiskerColor);

  // ACCESSORIES (Rendered cleanly on head)
  drawAccessory(ctx, accessory, false);

  ctx.restore(); // end Head

  // 6. FRONT PAWS (Two sweet vertical mittens with toe notches resting centered in front of chest)
  ctx.save();
  if (state === 'grooming') {
    // Face wash paw animation
    const washAngle = Math.sin(groomPhase) * 0.6;
    ctx.save();
    ctx.translate(0, headY + 3);
    ctx.rotate(washAngle);
    ctx.beginPath();
    ctx.ellipse(3, -4, 4.0, 3.0, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Pink paw pad
    ctx.beginPath();
    ctx.arc(3, -4, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = padColor;
    ctx.fill();
    ctx.restore();
  } else if (state === 'stretching') {
    // Feline stretch
    const stretchX = Math.sin(stretchPhase) * 3.5;
    ctx.beginPath();
    ctx.ellipse(-4.5 + stretchX, -1.8, 4.2, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(4.5 + stretchX, -1.8, 4.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();
  } else if (state === 'loaf') {
    // True cat loaf: paws are tucked snugly under body!
  } else {
    // Normal front paws sitting snugly in front of chest
    const frontStep1 = state === 'walking' ? -Math.sin(walkPhase) * 2.8 : 0;
    const frontStep2 = state === 'walking' ? Math.sin(walkPhase) * 2.8 : 0;

    // Left Front Paw
    ctx.beginPath();
    ctx.ellipse(-3.6 + frontStep1, -2.0, 3.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Left paw toe notches
    ctx.beginPath();
    ctx.moveTo(-4.6 + frontStep1, -0.6);
    ctx.lineTo(-4.6 + frontStep1, 1.0);
    ctx.moveTo(-2.6 + frontStep1, -0.6);
    ctx.lineTo(-2.6 + frontStep1, 1.0);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Right Front Paw
    ctx.beginPath();
    ctx.ellipse(3.6 + frontStep2, -2.0, 3.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Right paw toe notches
    ctx.beginPath();
    ctx.moveTo(2.6 + frontStep2, -0.6);
    ctx.lineTo(2.6 + frontStep2, 1.0);
    ctx.moveTo(4.6 + frontStep2, -0.6);
    ctx.lineTo(4.6 + frontStep2, 1.0);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Tiny pink paw pad peek only during walk lift
    if (state === 'walking' && frontStep2 < -1.4) {
      ctx.beginPath();
      ctx.arc(3.6 + frontStep2, -1.8, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = padColor;
      ctx.fill();
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------
// 🌟 2.5D VOLUMETRIC KITTEN RENDERER (V2 Polish & True Trot Kinematics)
// Genuine 3/4 depth perspective, cohesive connected feline anatomy,
// authentic 4-beat diagonal trot (Zero Moonwalk: forward swing while lifted,
// grounded push while stance), large expressive sparkling eyes, and rich depth.
// -------------------------------------------------------------
export function drawCuteKitten25D(
  ctx: CanvasRenderingContext2D,
  state: CatState,
  breed: PetBreed,
  accessory: PetAccessory,
  walkPhase: number,
  tailWave: number,
  buttWiggle: number,
  isBlinking: boolean,
  earTwitchTimer: number,
  groomPhase: number = 0,
  stretchPhase: number = 0,
  eyeOffset: { dx: number; dy: number } = { dx: 0, dy: 0 },
  breathePhase: number = 0,
  palette: KittenPalette,
  yawProgress: number = 0
) {
  const {
    bodyColor,
    bellyColor,
    outlineColor,
    earPink,
    eyeHighlight,
    noseColor,
    padColor,
    whiskerColor,
    spotColor1,
    spotColor2,
    eyeColor,
    pawColor,
    farShadeColor,
  } = palette;

  const t = Math.max(0, Math.min(1, yawProgress));

  // 1. Soft Dynamic Ground Drop Shadow (Interpolates seamlessly with 2D)
  ctx.save();
  ctx.beginPath();
  const shadowScale = state === 'pre_jump' ? lerp(1.2, 1.25, t) : (state === 'loaf' ? lerp(1.1, 1.15, t) : (state === 'jumping' ? lerp(0.65, 0.55, t) : 1.0));
  const shadowAlpha = state === 'jumping' ? 0.08 : lerp(0.22, 0.20, t);
  const shadowOffsetX = lerp(0, (state === 'walking' ? Math.sin(walkPhase) * 0.6 : 0) - 0.5, t);
  const shadowWidth = lerp(16.0, 17.0, t) * shadowScale;
  ctx.ellipse(shadowOffsetX, 0.5, shadowWidth, 4.2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(30, 24, 40, ${shadowAlpha})`;
  ctx.fill();
  ctx.restore();

  // Butt wiggle offset (during pre_jump crouch)
  const buttX = state === 'pre_jump' ? Math.sin(buttWiggle) * 3.2 : 0;
  const buttY = state === 'pre_jump' ? Math.abs(Math.cos(buttWiggle)) * 1.4 : 0;

  // Rhythmic kinematics
  const isRelaxed = state === 'idle' || state === 'loaf' || state === 'purring' || state === 'peeking';
  const breath = isRelaxed ? Math.sin(breathePhase) : 0;
  const purrRumble = state === 'purring' ? Math.sin(breathePhase * 5) * 0.35 : 0;

  // Natural trot bounce & undulating feline spine / scapula kinematics
  const walkBob = state === 'walking' ? -Math.cos(walkPhase * 2) * 0.95 : 0;
  // Feline scapular / pelvic counter-undulation
  const shoulderBob = state === 'walking' ? Math.sin(walkPhase) * 0.75 : 0;
  const pelvisBob = state === 'walking' ? -Math.sin(walkPhase + 0.15) * 0.65 : 0;
  const walkPitch = state === 'walking' ? (shoulderBob - pelvisBob) * 0.038 : 0;

  // -------------------------------------------------------------
  // 🐾 SKELETAL GAIT KINEMATICS & FORWARD KINEMATICS (FK)
  // Articulated 2-bone joint bending, knuckle peel, and paw compression
  // -------------------------------------------------------------
  const stride = 3.6;
  const maxLift = 2.8;

  interface LegKinematics {
    stepX: number;
    liftY: number;
    isAirborne: boolean;
    pawAngle: number;
    pawSquashX: number;
    pawSquashY: number;
    kneeFlexX: number;
    kneeFlexY: number;
  }

  const calcLimbKinematics = (phaseOffset: number, isFrontLeg: boolean): LegKinematics => {
    if (state !== 'walking') {
      return {
        stepX: 0,
        liftY: 0,
        isAirborne: false,
        pawAngle: 0,
        pawSquashX: 1.0,
        pawSquashY: 1.0,
        kneeFlexX: 0,
        kneeFlexY: 0,
      };
    }
    let phi = (walkPhase + phaseOffset) % (Math.PI * 2);
    if (phi < 0) phi += Math.PI * 2;

    if (phi < Math.PI) {
      // --- SWING PHASE (Airborne, lifting up and advancing forward) ---
      const u = phi / Math.PI; // normalized 0..1 in swing
      const liftY = Math.sin(phi) * maxLift;
      // Advances forward in direction of travel from -stride to +stride
      const stepX = -Math.cos(phi) * stride;

      // Paw Knuckle Peel & Flexion:
      // Early swing: toes trail slightly; Mid/late swing: reaches forward for next foothold
      const pawAngle = isFrontLeg
        ? -Math.sin(u * Math.PI) * 0.28
        : -Math.sin(u * Math.PI) * 0.35;

      // 2-Bone Joint Articulation (Elbow/Knee Forward Kinematics):
      // Front leg: elbow tucks backward, wrist swings forward
      // Hind leg: knee flexes forward and up to pull paw through smoothly
      const jointSin = Math.sin(u * Math.PI);
      const kneeFlexX = isFrontLeg ? -jointSin * 1.3 : jointSin * 1.6;
      const kneeFlexY = -jointSin * (isFrontLeg ? 1.4 : 1.9);

      return {
        stepX,
        liftY,
        isAirborne: true,
        pawAngle,
        pawSquashX: 0.95,
        pawSquashY: 1.05,
        kneeFlexX,
        kneeFlexY,
      };
    } else {
      // --- STANCE PHASE (Grounded, bearing weight and pushing backward) ---
      const v = (phi - Math.PI) / Math.PI; // normalized 0..1 in stance
      const stepX = -Math.cos(phi) * stride; // pushes backward from +stride to -stride
      const weightFactor = Math.sin(v * Math.PI); // peak load at mid-stance

      // Paw compression & spread under kitten body weight
      const pawSquashX = 1.0 + weightFactor * 0.14;
      const pawSquashY = 1.0 - weightFactor * 0.12;

      // Leg straightens and extends as it propels the torso forward
      const kneeFlexX = stepX * 0.25;
      const kneeFlexY = weightFactor * 0.4;

      return {
        stepX,
        liftY: 0,
        isAirborne: false,
        pawAngle: 0,
        pawSquashX,
        pawSquashY,
        kneeFlexX,
        kneeFlexY,
      };
    }
  };

  // Diagonal trot pairs with authentic feline phase offset
  const nearFrontGait = calcLimbKinematics(0, true);
  const farHindGait = calcLimbKinematics(0.12, false);
  const farFrontGait = calcLimbKinematics(Math.PI, true);
  const nearHindGait = calcLimbKinematics(Math.PI + 0.12, false);

  let farHindStep = farHindGait.stepX;
  let farHindLift = farHindGait.liftY;
  let farFrontStep = farFrontGait.stepX;
  let farFrontLift = farFrontGait.liftY;
  let nearHindStep = nearHindGait.stepX;
  let nearHindLift = nearHindGait.liftY;
  let nearFrontStep = nearFrontGait.stepX;
  let nearFrontLift = nearFrontGait.liftY;

  if (state === 'stretching') {
    const stretchDist = Math.sin(stretchPhase) * 3.2;
    farFrontStep = 4.0 + stretchDist;
    nearFrontStep = 4.8 + stretchDist;
    farHindStep = -4.0 - stretchDist * 0.4;
    nearHindStep = -4.2 - stretchDist * 0.4;
  } else if (state === 'jumping') {
    farFrontStep = 3.8;
    farFrontLift = 2.2;
    nearFrontStep = 4.2;
    nearFrontLift = 2.6;
    farHindStep = -4.5;
    farHindLift = -1.2;
    nearHindStep = -4.0;
    nearHindLift = -1.0;
  }

  // -------------------------------------------------------------
  // 2. FAR LIMBS (Z < 0: BACKGROUND DEPTH LAYER)
  // Seamless continuous limb contours with soft depth shading
  // -------------------------------------------------------------
  if (state !== 'loaf') {
    ctx.save();

    if (state === 'walking') {
      // --- FAR HIND LEG & PAW (Continuous flowing limb during trot) ---
      const fHindPawX = -8.5 + farHindStep;
      const fHindPawY = -1.6 - farHindLift;
      const fKneeX = -8.5 + farHindStep * 0.45 + farHindGait.kneeFlexX - 1.2;
      const fKneeY = -8.0 + farHindGait.kneeFlexY;

      ctx.beginPath();
      ctx.moveTo(-9.5, -9.0);
      ctx.quadraticCurveTo(fKneeX - 1.8, fKneeY, fHindPawX - 2.6, fHindPawY - 0.4);
      ctx.quadraticCurveTo(fHindPawX - 3.0, fHindPawY + 2.4, fHindPawX, fHindPawY + 2.5);
      ctx.quadraticCurveTo(fHindPawX + 3.0, fHindPawY + 2.4, fHindPawX + 2.6, fHindPawY - 0.4);
      ctx.quadraticCurveTo(fKneeX + 1.8, fKneeY, -6.8, -8.0);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.fillStyle = farShadeColor;
      ctx.fill();

      // Open outline stroke without dividing lines
      ctx.beginPath();
      ctx.moveTo(-9.5, -9.0);
      ctx.quadraticCurveTo(fKneeX - 1.8, fKneeY, fHindPawX - 2.6, fHindPawY - 0.4);
      ctx.quadraticCurveTo(fHindPawX - 3.0, fHindPawY + 2.4, fHindPawX, fHindPawY + 2.5);
      ctx.quadraticCurveTo(fHindPawX + 3.0, fHindPawY + 2.4, fHindPawX + 2.6, fHindPawY - 0.4);
      ctx.quadraticCurveTo(fKneeX + 1.8, fKneeY, -6.8, -8.0);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // --- FAR FRONT LEG & PAW (Behind her, at the same place as her other front limb) ---
      const fFrontPawX = lerp(-3.8, 3.8, t) + farFrontStep + buttX * 0.3;
      const fFrontPawY = -1.6 - farFrontLift;
      const fShoulderX = lerp(-3.8, 4.0, t);
      const fShoulderY = -8.5;
      const fWristX = fFrontPawX;
      const fWristY = fFrontPawY - 1.2;
      const fElbowX = (fShoulderX + fWristX) * 0.5 + farFrontStep * 0.25 + farFrontGait.kneeFlexX - 0.4;
      const fElbowY = (fShoulderY + fWristY) * 0.5 + 0.6 + farFrontGait.kneeFlexY;

      ctx.beginPath();
      ctx.moveTo(fShoulderX - 2.4, fShoulderY);
      ctx.quadraticCurveTo(fElbowX - 2.0, fElbowY, fFrontPawX - 2.8, fWristY);
      ctx.quadraticCurveTo(fFrontPawX - 3.2, fFrontPawY + 2.6, fFrontPawX, fFrontPawY + 2.8);
      ctx.quadraticCurveTo(fFrontPawX + 3.2, fFrontPawY + 2.6, fFrontPawX + 2.8, fWristY);
      ctx.quadraticCurveTo(fElbowX + 2.0, fElbowY, fShoulderX + 2.4, fShoulderY);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.fillStyle = farShadeColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(fShoulderX - 2.4, fShoulderY);
      ctx.quadraticCurveTo(fElbowX - 2.0, fElbowY, fFrontPawX - 2.8, fWristY);
      ctx.quadraticCurveTo(fFrontPawX - 3.2, fFrontPawY + 2.6, fFrontPawX, fFrontPawY + 2.8);
      ctx.quadraticCurveTo(fFrontPawX + 3.2, fFrontPawY + 2.6, fFrontPawX + 2.8, fWristY);
      ctx.quadraticCurveTo(fElbowX + 2.0, fElbowY, fShoulderX + 2.4, fShoulderY);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (t > 0.08) {
        ctx.beginPath();
        ctx.moveTo(fFrontPawX - 0.9, fFrontPawY + 0.6);
        ctx.lineTo(fFrontPawX - 0.9, fFrontPawY + 2.4);
        ctx.moveTo(fFrontPawX + 0.9, fFrontPawY + 0.6);
        ctx.lineTo(fFrontPawX + 0.9, fFrontPawY + 2.4);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      if (farFrontGait.isAirborne && farFrontLift > 1.0) {
        ctx.beginPath();
        ctx.arc(fFrontPawX, fFrontPawY + 0.5, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = padColor;
        ctx.fill();
      }
    } else {
      // Seated Haunches & Rear Paws (Rendered behind torso in depth buffer, matching 2D symmetry at t=0)

      // Far / Left Haunch Bulge (Sitting hip) - aligns with 2D (-9.2) at t=0
      const haunchLX = lerp(-9.2, -7.6, t);
      const haunchLY = lerp(-6.5, -6.2, t);
      const haunchLRx = lerp(5.2, 4.6, t);
      const haunchLRy = lerp(5.8, 5.5, t);
      const haunchLRot = lerp(-0.18, -0.12, t);

      ctx.beginPath();
      ctx.ellipse(haunchLX, haunchLY, haunchLRx, haunchLRy, haunchLRot, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      if (t > 0.05) {
        ctx.save();
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = farShadeColor;
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Near / Right Haunch Bulge (Sitting hip) - aligns with 2D (+9.2) at t=0
      const haunchRX = lerp(9.2, 7.2, t) + buttX * 0.3;
      const haunchRY = lerp(-6.5, -6.0, t);
      const haunchRRx = lerp(5.2, 5.0, t);
      const haunchRRy = lerp(5.8, 5.6, t);
      const haunchRRot = lerp(0.18, 0.10, t);

      ctx.beginPath();
      ctx.ellipse(haunchRX, haunchRY, haunchRRx, haunchRRy, haunchRRot, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Far / Left Rear Paw - aligns with 2D (-9.5) at t=0
      const pawLRX = lerp(-9.5, -7.8, t);
      const pawLRY = -1.8;
      const pawLRRx = lerp(4.2, 3.5, t);
      const pawLRRy = lerp(2.6, 2.8, t);

      ctx.beginPath();
      ctx.ellipse(pawLRX, pawLRY, pawLRRx, pawLRRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = pawColor;
      ctx.fill();
      if (t > 0.05) {
        ctx.save();
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = farShadeColor;
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = lerp(1.5, 1.4, t);
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Near / Right Rear Paw - aligns with 2D (+9.5) at t=0
      const pawRRX = lerp(9.5, 7.4, t) + buttX * 0.3;
      const pawRRY = -1.8;
      const pawRRRx = lerp(4.2, 3.8, t);
      const pawRRRy = lerp(2.6, 2.8, t);

      ctx.beginPath();
      ctx.ellipse(pawRRX, pawRRY, pawRRRx, pawRRRy, lerp(0, 0.05, t), 0, Math.PI * 2);
      ctx.fillStyle = pawColor;
      ctx.fill();
      ctx.lineWidth = lerp(1.5, 1.4, t);
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Far rear toe notches only in 3D perspective
      if (t > 0.08) {
        ctx.beginPath();
        ctx.moveTo(pawLRX - 1.1, pawLRY + 0.3);
        ctx.lineTo(pawLRX - 1.1, pawLRY + 2.3);
        ctx.moveTo(pawLRX + 1.1, pawLRY + 0.3);
        ctx.lineTo(pawLRX + 1.1, pawLRY + 2.3);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 3. 3/4 VECTOR TAIL (Skeletal Multi-Segment Lagging Harmonic Pendulum)
  // Perfectly interpolates between 2D right-side tail (t=0) and 3/4 left-side tail (t=1)
  // -------------------------------------------------------------
  ctx.save();
  const tailBaseX = lerp(8.5, -7.8, t) + buttX;
  const tailBaseY = lerp(-8.5, -10.0, t) + buttY + (walkBob * 0.4 * t) + (pelvisBob * 0.5 * t);

  ctx.beginPath();
  ctx.moveTo(tailBaseX, tailBaseY);

  if (state === 'loaf') {
    // Cozy curled tail wrapping around flank
    const breatheNap = Math.sin(Date.now() * 0.003) * 0.5;
    ctx.bezierCurveTo(
      lerp(tailBaseX + 7, tailBaseX - 3, t), lerp(tailBaseY + 4, tailBaseY + 3, t),
      lerp(tailBaseX + 4, -2, t), lerp(tailBaseY + 7, tailBaseY + 7 + breatheNap, t),
      lerp(tailBaseX - 2, 7, t), lerp(tailBaseY + 4, tailBaseY + 4 + breatheNap, t)
    );
  } else if (state === 'clinging') {
    ctx.bezierCurveTo(
      tailBaseX - 5, tailBaseY - 5,
      tailBaseX - 12, tailBaseY - 3,
      tailBaseX - 18, tailBaseY - 7
    );
  } else {
    // 2D right-facing tail harmonic at t=0
    const wave2D = Math.sin(tailWave) * 6;
    const cp1x_2D = tailBaseX + 7;
    const cp1y_2D = tailBaseY - 6 + wave2D * 0.3;
    const cp2x_2D = tailBaseX + 10 + wave2D * 0.7;
    const cp2y_2D = tailBaseY - 16;
    const tipX_2D = tailBaseX + 4 + wave2D * 1.1;
    const tipY_2D = tailBaseY - 23;

    // 3/4 multi-segment lagging physics at t=1
    const waveBase = Math.sin(tailWave) * 2.2;
    const waveMid = Math.sin(tailWave - 0.45) * 4.2;
    const waveTip = Math.sin(tailWave - 0.95) * 6.8;

    const cp1x_3D = tailBaseX - 5.0 + waveBase * 0.35;
    const cp1y_3D = tailBaseY - 4.5;
    const cp2x_3D = tailBaseX - 9.2 + waveMid * 0.65;
    const cp2y_3D = tailBaseY - 15.0;
    const tipX_3D = tailBaseX - 4.2 + waveTip * 0.85;
    const tipY_3D = tailBaseY - 22.0 + Math.abs(waveTip) * 0.25;

    ctx.bezierCurveTo(
      lerp(cp1x_2D, cp1x_3D, t),
      lerp(cp1y_2D, cp1y_3D, t),
      lerp(cp2x_2D, cp2x_3D, t),
      lerp(cp2y_2D, cp2y_3D, t),
      lerp(tipX_2D, tipX_3D, t),
      lerp(tipY_2D, tipY_3D, t)
    );
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lerp(4.8, 4.6, t);
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.strokeStyle = breed === 'siamese' ? '#4A3531' : bodyColor;
  ctx.lineWidth = lerp(3.2, 3.0, t);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // -------------------------------------------------------------
  // 4. VOLUMETRIC 3/4 TORSO & FLANK (Plump, Chubby, Harmonious)
  // Seamlessly interpolates between 2D front view and 2.5D 3/4 perspective
  // -------------------------------------------------------------
  ctx.save();
  const bodyX = buttX * 0.3;
  const bodyY = lerp(-12.0, -12.2, t) + (state === 'pre_jump' ? 2.2 : 0) + walkBob * t - breath * 0.35 + purrRumble;

  ctx.translate(bodyX, bodyY);
  ctx.rotate(walkPitch * t);

  // Chubby Torso (Matches 2D dimensions at t=0, smoothly forms 3/4 volume)
  const bodyRadiusX = lerp(13.2, 13.5, t) - breath * 0.2;
  const bodyRadiusY = lerp(10.8, 10.6, t) + breath * 0.4;
  const bodyOffsetX = lerp(0, -1.0, t);
  const bodyRot = lerp(0, 0.06, t);
  ctx.beginPath();
  ctx.ellipse(bodyOffsetX, 0, bodyRadiusX, bodyRadiusY, bodyRot, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Soft Ambient Underbelly Shading (Only appears as 3D volume develops)
  if (t > 0.05) {
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(-1.0, 8.2, bodyRadiusX * 0.95, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(28, 22, 38, ${0.08 * t})`;
    ctx.fill();
    ctx.restore();
  }

  // Tabby Flank Stripes in Perspective
  if (spotColor1 && (breed === 'caramel' || breed === 'cinnamon')) {
    ctx.save();
    ctx.strokeStyle = spotColor1;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lerp(-5.0, -5.5, t), lerp(-7.0, -6.5, t));
    ctx.quadraticCurveTo(lerp(-4.0, -4.5, t), lerp(-5.0, -1.5, t), lerp(-3.0, -3.0, t), lerp(-3.0, 2.5, t));
    ctx.moveTo(lerp(0.0, -1.0, t), lerp(-8.0, -7.5, t));
    ctx.quadraticCurveTo(lerp(0.0, 0.2, t), lerp(-5.5, -1.5, t), lerp(0.0, 2.0, t), lerp(-3.0, 2.5, t));
    ctx.moveTo(lerp(5.0, 3.8, t), lerp(-7.0, -6.5, t));
    ctx.quadraticCurveTo(lerp(4.0, 4.8, t), lerp(-5.0, -1.5, t), lerp(3.0, 5.8, t), lerp(-3.0, 1.8, t));
    ctx.stroke();
    ctx.restore();
  }

  // Calico Body Patches in Perspective
  if (spotColor1 && breed === 'calico') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(lerp(-4.0, -4.2, t), -3.0, lerp(5.0, 4.8, t), lerp(4.0, 3.8, t), 0.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor1;
    ctx.fill();
    ctx.restore();
  }

  // Soft White Creamy Belly & Chest Bib (Smoothly gliding into 3/4 position)
  const bellyBibX = lerp(0, 3.0, t);
  const bellyBibRadiusX = lerp(7.8, 7.6, t) - breath * 0.2;
  const bellyBibRadiusY = lerp(6.5, 6.2, t) + breath * 0.38;
  const bellyBibRot = lerp(0, 0.16, t);
  ctx.beginPath();
  ctx.ellipse(bellyBibX, 1.2, bellyBibRadiusX, bellyBibRadiusY, bellyBibRot, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();

  ctx.restore(); // end Torso

  // -------------------------------------------------------------
  // 5. FOREGROUND LIMBS (Z > 0: NEAR HAUNCH & NEAR PAWS)
  // Seamlessly integrated limbs with natural organic folds & continuous contours
  // -------------------------------------------------------------
  if (state !== 'loaf') {
    ctx.save();

    // --- NEAR REAR HAUNCH (Seamless Thigh Fold) ---
    const haunchY = bodyY + 2.8 + pelvisBob * 0.4;
    ctx.save();
    if (state === 'walking') {
      // Gentle open crease curve suggesting where the chubby thigh naturally rests during trot
      ctx.beginPath();
      ctx.arc(-5.2 + buttX * 0.3, haunchY + 0.6, 3.8, -Math.PI * 0.42, Math.PI * 0.12);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (t > 0.15) {
      // Subtle open thigh fold crease on torso side in 3/4 perspective (zero closed borders over belly)
      ctx.beginPath();
      ctx.arc(lerp(6.5, 4.8, t) + buttX * 0.3, haunchY + 0.6, 3.4, Math.PI * 0.60, Math.PI * 1.15);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.0;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // --- NEAR REAR LEG & PAW (Active during walking trot) ---
    if (state === 'walking') {
      const nHindPawX = -6.0 + nearHindStep + buttX * 0.3;
      const nHindPawY = -1.5 - nearHindLift;
      const kneeX = -6.0 + nearHindStep * 0.5 + nearHindGait.kneeFlexX;
      const kneeY = haunchY + 3.2 + nearHindGait.kneeFlexY;

      // Single continuous flowing leg & paw contour (No line separating paw from leg)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-6.2 + buttX * 0.3 - 2.4, haunchY + 1.8);
      ctx.quadraticCurveTo(kneeX - 2.0, kneeY, nHindPawX - 2.8, nHindPawY - 0.6);
      ctx.quadraticCurveTo(nHindPawX - 3.2, nHindPawY + 2.8, nHindPawX, nHindPawY + 3.0);
      ctx.quadraticCurveTo(nHindPawX + 3.2, nHindPawY + 2.8, nHindPawX + 2.8, nHindPawY - 0.6);
      ctx.quadraticCurveTo(kneeX + 2.0, kneeY, -6.2 + buttX * 0.3 + 2.8, haunchY + 2.2);
      ctx.fillStyle = bodyColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-6.2 + buttX * 0.3 - 2.2, haunchY + 1.8);
      ctx.quadraticCurveTo(kneeX - 2.0, kneeY, nHindPawX - 2.8, nHindPawY - 0.6);
      ctx.quadraticCurveTo(nHindPawX - 3.2, nHindPawY + 2.8, nHindPawX, nHindPawY + 3.0);
      ctx.quadraticCurveTo(nHindPawX + 3.2, nHindPawY + 2.8, nHindPawX + 2.8, nHindPawY - 0.6);
      ctx.quadraticCurveTo(kneeX + 2.0, kneeY, -6.2 + buttX * 0.3 + 2.6, haunchY + 2.2);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Near rear toe notches
      ctx.beginPath();
      ctx.moveTo(nHindPawX - 1.1, nHindPawY + 0.6);
      ctx.lineTo(nHindPawX - 1.1, nHindPawY + 2.6);
      ctx.moveTo(nHindPawX + 1.1, nHindPawY + 0.6);
      ctx.lineTo(nHindPawX + 1.1, nHindPawY + 2.6);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Pink paw pad peek during trot swing lift
      if (nearHindGait.isAirborne && nearHindLift > 1.0) {
        ctx.beginPath();
        ctx.arc(nHindPawX, nHindPawY + 0.5, 1.25, 0, Math.PI * 2);
        ctx.fillStyle = padColor;
        ctx.fill();
      }
      ctx.restore();
    }

    // --- NEAR FRONT LEG & PAW ---
    if (state === 'grooming') {
      // Face wash paw animation in 3/4 perspective
      const washAngle = Math.sin(groomPhase) * 0.6;
      ctx.save();
      ctx.translate(3.5, -20);
      ctx.rotate(washAngle);
      ctx.beginPath();
      ctx.ellipse(3, -4, 4.0, 3.0, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(3, -4, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = padColor;
      ctx.fill();
      ctx.restore();
    } else if (state === 'walking') {
      // Organic feline foreground arm & paw
      const nFrontPawX = lerp(3.8, 5.4, t) + nearFrontStep + buttX * 0.3;
      const nFrontPawY = -1.5 - nearFrontLift;
      const shoulderX = lerp(3.8, 5.6, t);
      const shoulderY = bodyY + 3.0 + shoulderBob * 0.5;
      const outerShoulderX = shoulderX + lerp(2.8, 3.6, t);
      const outerShoulderY = shoulderY + 0.6;
      const armpitX = shoulderX - lerp(2.2, 1.8, t);
      const armpitY = shoulderY + 4.6;
      const wristX = nFrontPawX;
      const wristY = nFrontPawY - 1.2;
      const elbowX = (shoulderX + wristX) * 0.5 + nearFrontStep * 0.25 + nearFrontGait.kneeFlexX;
      const elbowY = (shoulderY + wristY) * 0.5 + 0.6 + nearFrontGait.kneeFlexY;

      ctx.save();
      // 1. Organic limb polygon (seamlessly merges with torso at shoulder and armpit)
      ctx.beginPath();
      ctx.moveTo(outerShoulderX, outerShoulderY);
      ctx.quadraticCurveTo(elbowX + 2.5, elbowY, nFrontPawX + 3.2, wristY);
      ctx.quadraticCurveTo(nFrontPawX + 3.4, nFrontPawY + 2.8, nFrontPawX, nFrontPawY + 3.0);
      ctx.quadraticCurveTo(nFrontPawX - 3.4, nFrontPawY + 2.8, nFrontPawX - 2.8, wristY);
      ctx.quadraticCurveTo(elbowX - 2.0, elbowY, armpitX, armpitY);
      ctx.quadraticCurveTo(shoulderX, shoulderY, outerShoulderX, outerShoulderY);
      ctx.closePath();
      ctx.fillStyle = bodyColor;
      ctx.fill();

      // 2. Outline stroke: flows from outer shoulder down around the paw and terminates at armpit
      // ZERO line cutting through the upper chest/neck!
      ctx.beginPath();
      ctx.moveTo(outerShoulderX, outerShoulderY);
      ctx.quadraticCurveTo(elbowX + 2.5, elbowY, nFrontPawX + 3.2, wristY);
      ctx.quadraticCurveTo(nFrontPawX + 3.4, nFrontPawY + 2.8, nFrontPawX, nFrontPawY + 3.0);
      ctx.quadraticCurveTo(nFrontPawX - 3.4, nFrontPawY + 2.8, nFrontPawX - 2.8, wristY);
      ctx.quadraticCurveTo(elbowX - 2.0, elbowY, armpitX, armpitY);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. Near front toe notches on paw
      ctx.beginPath();
      ctx.moveTo(nFrontPawX - 1.0, nFrontPawY + 0.6);
      ctx.lineTo(nFrontPawX - 1.0, nFrontPawY + 2.6);
      ctx.moveTo(nFrontPawX + 1.0, nFrontPawY + 0.6);
      ctx.lineTo(nFrontPawX + 1.0, nFrontPawY + 2.6);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // 4. Pink paw pad peek during trot swing lift
      if (nearFrontGait.isAirborne && nearFrontLift > 1.0) {
        ctx.beginPath();
        ctx.arc(nFrontPawX, nFrontPawY + 0.5, 1.35, 0, Math.PI * 2);
        ctx.fillStyle = padColor;
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Resting front paws nestled at the base of the creamy chest bib
      // EXACT 2D SYMMETRY AT t=0: Both paws in front of chest, matching 2D coordinates & strokes!

      // --- LEFT / FAR FRONT PAW ---
      const pawLFX = lerp(-3.6, 1.8, t) + buttX * 0.3;
      const pawLFY = -2.0;
      const pawLFRx = lerp(3.5, 3.2, t);
      const pawLFRy = lerp(3.8, 3.3, t);

      ctx.save();
      ctx.translate(pawLFX, pawLFY);
      ctx.beginPath();
      ctx.ellipse(0, 0, pawLFRx, pawLFRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = pawColor;
      ctx.fill();
      if (t > 0.08) {
        ctx.save();
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = farShadeColor;
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = lerp(1.5, 1.4, t);
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Left front toe notches (exact match with 2D: X at -1.0 and +1.0, Y from 1.4 to 3.0 relative to paw center)
      ctx.beginPath();
      ctx.moveTo(-1.0, 1.4);
      ctx.lineTo(-1.0, 3.0);
      ctx.moveTo(1.0, 1.4);
      ctx.lineTo(1.0, 3.0);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.restore();

      // --- RIGHT / NEAR FRONT PAW ---
      const nPawX = lerp(3.6, 5.8, t) + buttX * 0.3;
      const nPawY = -2.0;
      const nPawRx = lerp(3.5, 3.6, t);
      const nPawRy = lerp(3.8, 3.4, t);

      ctx.save();
      ctx.translate(nPawX, nPawY);
      ctx.beginPath();
      ctx.ellipse(0, 0, nPawRx, nPawRy, lerp(0, 0.05, t), 0, Math.PI * 2);
      ctx.fillStyle = pawColor;
      ctx.fill();
      ctx.lineWidth = lerp(1.5, 1.4, t);
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // Right front toe notches (exact match with 2D: X at -1.0 and +1.0, Y from 1.4 to 3.0 relative to paw center)
      ctx.beginPath();
      ctx.moveTo(-1.0, 1.4);
      ctx.lineTo(-1.0, 3.0);
      ctx.moveTo(1.0, 1.4);
      ctx.lineTo(1.0, 3.0);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 6. CHIBI HEAD, PERSPECTIVE FORESHORTENED EYES, SNOUT & ':3' MOUTH
  // Truly responds to 3D perspective rotation: as Mochi turns, the receding side
  // naturally foreshortens in width (far eye becomes a sleek perspective ellipse,
  // far lip and snout curve around the muzzle, far cheek recedes), while the near
  // foreground features remain large, open, luminous, and sparkling.
  // When t = 0, perfectly matches 2D Mochi for seamless transition without morphing!
  // -------------------------------------------------------------
  const headBob = state === 'walking' ? Math.sin(walkPhase * 2) * 0.45 * t : 0;
  const headX = lerp(0, 2.4, t);
  const headY = -22.5 + (state === 'pre_jump' ? 3.0 : 0) + headBob - breath * 0.45 + purrRumble * 0.5;

  ctx.save();
  ctx.translate(headX, headY);

  const twitchL = (earTwitchTimer % 180 < 12) ? Math.sin(earTwitchTimer) * 0.14 : 0;
  const twitchR = (earTwitchTimer % 240 < 12) ? Math.sin(earTwitchTimer) * 0.14 : 0;

  // =========================================================
  // 🐾 EARS (Strictly layered behind cranium - Canonical Mochi Anatomy)
  // Shared underlying geometry rotating in 3D perspective without morphing
  // =========================================================

  // Far/Left Ear (Rotates into depth, foreshortening horizontally)
  const earLX = lerp(-8.2, -3.6, t);
  const earLY = lerp(-7.5, -8.6, t);
  const earLRot = lerp(-0.14, -0.22, t) + twitchL;
  const earLSx = lerp(1.0, 0.72, t);
  const earLSy = lerp(1.0, 0.95, t);

  ctx.save();
  ctx.translate(earLX, earLY);
  ctx.rotate(earLRot);
  ctx.scale(earLSx, earLSy);

  // Canonical Mochi Ear Contour
  ctx.beginPath();
  ctx.moveTo(-1, 5);
  ctx.quadraticCurveTo(-6.8, 1, -6.8, -10.5);
  ctx.quadraticCurveTo(0, -8.5, 6.5, -4.5);
  ctx.quadraticCurveTo(3, 1.5, 1, 5);
  ctx.closePath();
  ctx.fillStyle = breed === "siamese" ? "#4A3531" : (spotColor2 && breed === "calico" ? spotColor2 : bodyColor);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Canonical Mochi Inner Ear Pastel Pink
  ctx.beginPath();
  ctx.moveTo(0.2, 2.5);
  ctx.lineTo(-4.0, -7.5);
  ctx.lineTo(4.2, -4.0);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();

  if (t > 0.05) {
    ctx.save();
    ctx.globalAlpha = t * 0.35;
    ctx.fillStyle = farShadeColor;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Near/Right Ear (Foreground Ear)
  const earRX = lerp(8.2, 7.4, t);
  const earRY = lerp(-7.5, -8.0, t);
  const earRRot = lerp(0.14, 0.18, t) + twitchR;
  const earRSx = lerp(1.0, 0.98, t);
  const earRSy = lerp(1.0, 0.98, t);

  ctx.save();
  ctx.translate(earRX, earRY);
  ctx.rotate(earRRot);
  ctx.scale(earRSx, earRSy);

  // Canonical Mochi Ear Contour
  ctx.beginPath();
  ctx.moveTo(1, 5);
  ctx.quadraticCurveTo(6.8, 1, 6.8, -10.5);
  ctx.quadraticCurveTo(0, -8.5, -6.5, -4.5);
  ctx.quadraticCurveTo(-3, 1.5, -1, 5);
  ctx.closePath();
  ctx.fillStyle = breed === "siamese" ? "#4A3531" : (spotColor1 && breed === "calico" ? spotColor1 : bodyColor);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Canonical Mochi Inner Ear Pastel Pink
  ctx.beginPath();
  ctx.moveTo(-0.2, 2.5);
  ctx.lineTo(4.0, -7.5);
  ctx.lineTo(-4.2, -4.0);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();
  ctx.restore();

  // =========================================================
  // 🐱 CRANIUM & CHUBBY CHEEKS (Canonical Head Shape in Perspective)
  // =========================================================
  const cranX = lerp(0, 1.4, t);
  const cranW = lerp(14.6, 13.8, t);
  const cranH = lerp(12.0, 11.8, t);
  const cranRot = lerp(0, 0.04, t);

  ctx.beginPath();
  ctx.ellipse(cranX, 0, cranW, cranH, cranRot, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Chubby Cheeks (Slightly foreshortened on far side, plumper in foreground)
  ctx.beginPath();
  ctx.moveTo(lerp(-12.0, -10.5, t), -0.5);
  ctx.quadraticCurveTo(lerp(-15.2, -12.4, t), 2.5, lerp(-12.5, -10.5, t), 5.0);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lerp(1.3, 1.1, t);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(lerp(12.0, 11.2, t), -0.5);
  ctx.quadraticCurveTo(lerp(15.2, 15.6, t), 2.5, lerp(12.5, 12.8, t), 5.0);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Breed Forehead Markings
  if (breed === "caramel" || breed === "cinnamon") {
    ctx.save();
    ctx.strokeStyle = spotColor1 || "#C2410C";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    const shiftM = lerp(0, 1.8, t);
    ctx.beginPath();
    ctx.moveTo(-4 + shiftM, -7);
    ctx.lineTo(-2 + shiftM, -3.5);
    ctx.lineTo(0 + shiftM, -5.5);
    ctx.lineTo(2 + shiftM, -3.5);
    ctx.lineTo(4 + shiftM, -7);
    ctx.stroke();
    ctx.restore();
  }

  if (spotColor2 && breed === "calico") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(lerp(-6.0, -3.8, t), -3.5, lerp(5.0, 4.5, t), lerp(5.5, 4.8, t), -0.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor2;
    ctx.fill();
    ctx.restore();
  }

  if (breed === "siamese") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(lerp(0, 2.2, t), 1.0, lerp(7.6, 6.8, t), lerp(5.6, 5.2, t), lerp(0, 0.05, t), 0, Math.PI * 2);
    ctx.fillStyle = "#4A3531";
    ctx.fill();
    ctx.restore();
  }

  if (breed === "tuxedo") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(lerp(0, 2.4, t), lerp(3.4, 3.2, t), lerp(6.4, 6.0, t), lerp(4.4, 4.2, t), lerp(0, 0.05, t), 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
  }

  // Rosy Blush Cheeks (Far blush naturally foreshortens against silhouette)
  ctx.beginPath();
  ctx.ellipse(lerp(-7.8, -3.8, t), lerp(3.5, 3.6, t), lerp(3.2, 1.6, t), lerp(1.8, 1.6, t), 0, 0, Math.PI * 2);
  ctx.ellipse(lerp(7.8, 7.8, t), lerp(3.5, 3.6, t), lerp(3.2, 3.4, t), lerp(1.8, 1.8, t), 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 140, 175, 0.48)";
  ctx.fill();

  // =========================================================
  // ✨ EYES: CIRCULAR CUTE EYES (👁️👁️) WHEN FACING US,
  // BENT SIDE-GLANCE WITH IDENTICAL EYE SIZE (👀) WHEN WALKING
  // =========================================================
  const eyeY = lerp(-0.4, -0.5, t);
  const lookShiftX = Math.max(-1.4, Math.min(1.4, eyeOffset.dx));
  const lookShiftY = Math.max(-1.4, Math.min(1.4, eyeOffset.dy));

  // Eye side-glance factor:
  // - NEVER active when facing the user (idle, sitting, loafing, purring, or looking at user) -> 100% unbent circular eyes 👁️👁️
  // - ONLY active when actively walking sideways in 3/4 perspective (state === 'walking' && t > 0.2)
  const isWalkingTurn = state === 'walking' && t > 0.2;
  const sideFactor = isWalkingTurn ? Math.min(1, (t - 0.2) / 0.8) : 0;

  // IDENTICAL EYE SIZE: When walking, both eyes have the EXACT same oval dimensions!
  const eyeWidth = lerp(3.6, 2.15, sideFactor);
  const eyeHeight = lerp(3.9, 4.25, sideFactor);

  // BENT IN PERSPECTIVE: When walking, both eyes bend/tilt together in direction of gaze like 👀
  const eyeTilt = lerp(0, 0.08, sideFactor);

  // Far Eye (Left) & Near Eye (Right) positions across face
  const eyeXL = lerp(-5.6, -1.2, t) + lookShiftX * 0.45;
  const eyeYL = eyeY + lookShiftY * 0.45;
  const eyeXR = lerp(5.6, 6.2, t) + lookShiftX * 0.45;
  const eyeYR = eyeY + lookShiftY * 0.45;

  if (isBlinking || state === "loaf" || state === "purring") {
    // Closed happy eye arcs (⌒   ⌒) bending together in perspective
    ctx.save();
    ctx.translate(eyeXL, eyeY + 0.6);
    ctx.rotate(eyeTilt);
    ctx.scale(lerp(1.0, 0.72, sideFactor), 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0.15, Math.PI - 0.15, false);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(eyeXR, eyeY + 0.6);
    ctx.rotate(eyeTilt);
    ctx.scale(lerp(1.0, 0.72, sideFactor), 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0.15, Math.PI - 0.15, false);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  } else {
    // Shared highlight parameters for identical anime gaze 👀
    const hl1X = lerp(1.2, 0.55, sideFactor);
    const hl1Y = lerp(-1.1, -1.2, sideFactor);
    const hl1Rx = lerp(1.35, 0.70, sideFactor);
    const hl1Ry = lerp(1.35, 1.25, sideFactor);

    const hl2X = lerp(-1.2, -0.45, sideFactor);
    const hl2Y = lerp(1.2, 1.25, sideFactor);
    const hl2Rx = lerp(0.65, 0.35, sideFactor);
    const hl2Ry = lerp(0.65, 0.55, sideFactor);

    // --- FAR EYE (LEFT): Same size & bent like 👀 ---
    ctx.save();
    ctx.translate(eyeXL, eyeYL);
    ctx.rotate(eyeTilt);

    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Primary highlight
    ctx.beginPath();
    ctx.ellipse(hl1X, hl1Y, hl1Rx, hl1Ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Secondary highlight
    ctx.beginPath();
    ctx.ellipse(hl2X, hl2Y, hl2Rx, hl2Ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();
    ctx.restore();

    // --- NEAR EYE (RIGHT): Same size & bent like 👀 ---
    ctx.save();
    ctx.translate(eyeXR, eyeYR);
    ctx.rotate(eyeTilt);

    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Primary highlight
    ctx.beginPath();
    ctx.ellipse(hl1X, hl1Y, hl1Rx, hl1Ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Secondary highlight
    ctx.beginPath();
    ctx.ellipse(hl2X, hl2Y, hl2Rx, hl2Ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();
    ctx.restore();
  }

  // =========================================================
  // 🐾 SNOUT, NOSE & 3D PERSPECTIVE ':3' FELINE SMILE
  // =========================================================
  const noseCenterX = lerp(0, 2.6, t);
  const noseTopY = 1.8;
  const noseTipY = 3.2;

  // 3D Nose Pad (Receding nostril foreshortens, near nostril projects forward)
  ctx.beginPath();
  ctx.moveTo(noseCenterX - lerp(1.4, 0.85, t), noseTopY);
  ctx.lineTo(noseCenterX + lerp(1.4, 1.55, t), noseTopY);
  ctx.lineTo(noseCenterX + lerp(0, 0.25, t), noseTipY);
  ctx.closePath();
  ctx.fillStyle = noseColor;
  ctx.fill();

  // Subtle gleam along 3D nose bridge ridge
  if (t > 0.15) {
    ctx.beginPath();
    ctx.moveTo(noseCenterX + 0.3, 2.0);
    ctx.lineTo(noseCenterX + 0.35, 3.0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.40)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Feline Smile: Smaller, delicate feline smile slightly separated from nose tip
  const mouthStemX = noseCenterX + lerp(0, 0.25, t);
  const mouthSplitY = lerp(4.1, 4.15, t); // Clear separation below nose tip (3.2)

  // Subtle delicate center notch
  ctx.beginPath();
  ctx.moveTo(mouthStemX, lerp(3.85, 3.9, t));
  ctx.lineTo(mouthStemX, mouthSplitY);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();

  // Far / Back lip arc (-X trailing side: gently foreshortens along receding muzzle)
  const farLipRx = lerp(1.2, 0.8, t);
  const farLipRy = lerp(0.85, 0.75, t);
  const farLipCenterX = mouthStemX - farLipRx;
  ctx.beginPath();
  ctx.ellipse(farLipCenterX, 4.15, farLipRx, farLipRy, 0, 0.08, Math.PI - lerp(0.1, 0.35, t), false);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();

  // Near / Front lip arc (+X leading side: natural delicate curve in direction of walking)
  const nearLipRx = lerp(1.2, 1.25, t);
  const nearLipRy = lerp(0.85, 0.95, t);
  const nearLipCenterX = mouthStemX + nearLipRx;
  ctx.beginPath();
  ctx.ellipse(nearLipCenterX, 4.15, nearLipRx, nearLipRy, 0, lerp(0.1, -0.15, t), Math.PI - 0.05, false);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();

  // Sweet purr tongue peek
  if (state === "purring") {
    ctx.beginPath();
    ctx.ellipse(mouthStemX + lerp(0, 0.3, t), 4.75, lerp(1.05, 1.1, t), lerp(0.8, 0.85, t), 0, 0.1, Math.PI - 0.1, false);
    ctx.fillStyle = "#FB7185";
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.95;
    ctx.stroke();
  }

  // =========================================================
  // 🐱 WHISKERS (Shifted forward along movement direction, curved & tapered)
  // =========================================================
  const whiskerTwitch = Math.sin(tailWave * 0.7) * 0.35;

  // Left / Back Whiskers (-X trailing cheek: shifted forward to wrap snugly along cheek contour)
  drawTaperedWhisker(
    ctx,
    lerp(-8.6, -4.0, t),
    lerp(3.2, 3.1, t),
    lerp(-13.0, -8.6, t),
    lerp(2.7, 2.8, t),
    lerp(-16.8, -13.0, t),
    lerp(3.6, 3.8, t) + whiskerTwitch,
    lerp(1.15, 1.10, t),
    whiskerColor
  );
  drawTaperedWhisker(
    ctx,
    lerp(-8.4, -3.8, t),
    lerp(4.9, 4.8, t),
    lerp(-12.6, -8.2, t),
    lerp(5.1, 5.2, t),
    lerp(-16.2, -12.4, t),
    lerp(6.7, 6.7, t) + whiskerTwitch,
    lerp(1.15, 1.10, t),
    whiskerColor
  );

  // Right / Front Whiskers (+X leading snout: shifted forward to project clearly from front cheek)
  drawTaperedWhisker(
    ctx,
    lerp(8.6, 10.2, t),
    lerp(3.2, 3.3, t),
    lerp(13.0, 14.6, t),
    lerp(2.7, 2.9, t),
    lerp(16.8, 17.8, t),
    lerp(3.6, 4.1, t) - whiskerTwitch,
    lerp(1.15, 1.05, t),
    whiskerColor
  );
  drawTaperedWhisker(
    ctx,
    lerp(8.4, 9.8, t),
    lerp(4.9, 5.0, t),
    lerp(12.6, 14.0, t),
    lerp(5.1, 5.4, t),
    lerp(16.2, 17.2, t),
    lerp(6.7, 6.9, t) - whiskerTwitch,
    lerp(1.15, 1.05, t),
    whiskerColor
  );

  // =========================================================
  // 🎀 ACCESSORIES (Smooth glide with perspective value t)
  // =========================================================
  drawAccessory(ctx, accessory, t);

  ctx.restore(); // end Head
}

// -------------------------------------------------------------
// 🐱 PRIMARY KITTEN RENDERER (Dispatches to 2D or 2.5D Mode)
// -------------------------------------------------------------
export function drawCuteKitten(
  ctx: CanvasRenderingContext2D,
  state: CatState,
  breed: PetBreed,
  accessory: PetAccessory,
  walkPhase: number,
  tailWave: number,
  buttWiggle: number,
  isBlinking: boolean,
  earTwitchTimer: number,
  groomPhase: number = 0,
  stretchPhase: number = 0,
  eyeOffset: { dx: number; dy: number } = { dx: 0, dy: 0 },
  breathePhase: number = 0,
  is25D: boolean = false,
  yawProgress: number = 0
) {
  const palette = getPetPalette(breed);
  if (is25D) {
    drawCuteKitten25D(
      ctx,
      state,
      breed,
      accessory,
      walkPhase,
      tailWave,
      buttWiggle,
      isBlinking,
      earTwitchTimer,
      groomPhase,
      stretchPhase,
      eyeOffset,
      breathePhase,
      palette,
      yawProgress
    );
  } else {
    drawCuteKitten2D(
      ctx,
      state,
      breed,
      accessory,
      walkPhase,
      tailWave,
      buttWiggle,
      isBlinking,
      earTwitchTimer,
      groomPhase,
      stretchPhase,
      eyeOffset,
      breathePhase,
      palette
    );
  }
}

// -------------------------------------------------------------
// 🎀 ACCESSORIES RENDERER (Supports both 2D and 2.5D perspective)
// -------------------------------------------------------------
function drawAccessory(ctx: CanvasRenderingContext2D, accessory: PetAccessory, is25D: boolean | number = false) {
  const t = typeof is25D === "number" ? Math.max(0, Math.min(1, is25D)) : (is25D ? 1 : 0);
  const lerp = (a: number, b: number, factor: number) => a + (b - a) * factor;
  if (accessory === 'bow') {
    // Cute Scarlet Ribbon Bow with Center Golden Pearl
    ctx.save();
    ctx.translate(lerp(0, 2.2, t), 11);
    ctx.beginPath();
    // Left loop
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-6, -6, -9, -1, -6, 3.5);
    ctx.closePath();
    // Right loop
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(6, -6, 9, -1, 6, 3.5);
    ctx.closePath();
    ctx.fillStyle = '#E11D48';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#881337';
    ctx.stroke();

    // Ribbon tails
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-2, 6.5);
    ctx.lineTo(0, 8);
    ctx.fillStyle = '#BE123C';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(5, 8);
    ctx.lineTo(2, 6.5);
    ctx.lineTo(0, 8);
    ctx.fillStyle = '#BE123C';
    ctx.fill();

    // Center knot with golden pearl
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#FBBF24';
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  } else if (accessory === 'bell') {
    // Golden Jingle Bell on Red Collar with Gleam
    ctx.save();
    ctx.translate(lerp(0, 2.2, t), 11);

    // Collar
    ctx.beginPath();
    ctx.rect(-8, -2, 16, 2.5);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Golden Bell
    ctx.beginPath();
    ctx.arc(0, 2.5, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FBBF24';
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#B45309';
    ctx.stroke();

    // Gleam
    ctx.beginPath();
    ctx.arc(-1.2, 1.2, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();

    // Bell eyelet & slot
    ctx.beginPath();
    ctx.arc(0, 3.2, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#78350F';
    ctx.fill();
    ctx.restore();
  } else if (accessory === 'sakura') {
    // Five-Petaled Sakura Blossom Clip behind ear with golden stamen
    ctx.save();
    ctx.translate(lerp(-7, 5.5, t), lerp(-8, -8.5, t));
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -3.8, 2.2, 3.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FCE7F3';
      ctx.fill();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = '#DB2777';
      ctx.stroke();
      ctx.restore();
    }
    // Flower center
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.restore();
  } else if (accessory === 'scarf') {
    // 🧣 Cozy Knitted Winter Scarf (Emoji 🧣 Style)
    ctx.save();
    ctx.translate(lerp(0, 1.8, t), 10.5);

    // 1. Back fold layer
    ctx.beginPath();
    ctx.ellipse(0, -1.2, 10.2, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#991B1B';
    ctx.fill();

    // 2. Draped Scarf Tail hanging down with dynamic curve and folds
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-6.8, 0.5);
    ctx.quadraticCurveTo(-8.2, 5.5, -6.8, 11.2);
    ctx.lineTo(-1.6, 11.2);
    ctx.quadraticCurveTo(-2.6, 5.0, -2.2, 1.2);
    ctx.closePath();
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Knitted vertical weave crease
    ctx.beginPath();
    ctx.moveTo(-4.2, 2.5);
    ctx.quadraticCurveTo(-5.0, 6.5, -4.0, 10.5);
    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // 🧣 Fringe tassels at bottom edge of tail
    const fringeY = 11.2;
    ctx.strokeStyle = '#FCA5A5';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let f = -6.2; f <= -2.0; f += 1.3) {
      ctx.beginPath();
      ctx.moveTo(f, fringeY);
      ctx.lineTo(f + 0.3, fringeY + 2.4);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Volumetric Main Front Neck Wrap (Plump, cozy 🧣 collar)
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 10.6, 4.2, -0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Top soft wool highlight sheen
    ctx.beginPath();
    ctx.ellipse(0.5, -0.8, 8.0, 2.0, -0.04, Math.PI * 0.9, Math.PI * 2.1);
    ctx.strokeStyle = 'rgba(254, 202, 202, 0.65)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Cozy wrap crossover fold ridge
    ctx.beginPath();
    ctx.moveTo(-2.2, -2.0);
    ctx.quadraticCurveTo(-4.0, 1.2, -6.2, 3.6);
    ctx.strokeStyle = '#7F1D1D';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  } else if (accessory === 'crown') {
    // Tiny Golden Royal Crown with Ruby Studs - Consistent 3D Perspective
    ctx.save();
    ctx.translate(lerp(0, 1.4, t), -11);
    ctx.rotate(lerp(0, 0.04, t));
    ctx.scale(lerp(1.0, 0.88, t), 1.0);
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(-6, -3);
    ctx.lineTo(-3, 0);
    ctx.lineTo(0, -4.5);
    ctx.lineTo(3, 0);
    ctx.lineTo(6, -3);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fillStyle = '#FBBF24';
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ruby studs on points
    ctx.beginPath();
    ctx.arc(-6, -3, 0.9, 0, Math.PI * 2);
    ctx.arc(0, -4.5, 1.1, 0, Math.PI * 2);
    ctx.arc(6, -3, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.restore();
  } else if (accessory === 'glasses') {
    // 👓 Cute Round Golden Wireframe Glasses (Aligned precisely with eye centers)
    ctx.save();
    ctx.translate(0, -0.4);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.2;

    const eyeLeftX = lerp(-5.6, -2.0, t);
    const eyeRightX = lerp(5.6, 6.1, t);

    // Left Lens Frame (Foreshortens horizontally with far eye)
    ctx.save();
    ctx.translate(eyeLeftX, 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, lerp(4.4, 2.5, t), lerp(4.4, 4.3, t), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right Lens Frame (Near foreground eye)
    ctx.save();
    ctx.translate(eyeRightX, 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, lerp(4.4, 4.5, t), lerp(4.4, 4.5, t), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Nose Bridge connecting lenses
    ctx.beginPath();
    ctx.moveTo(eyeLeftX + lerp(4.4, 2.5, t) * 0.8, -0.6);
    ctx.quadraticCurveTo(lerp(0, 2.2, t), -1.8, eyeRightX - lerp(4.4, 4.5, t) * 0.8, -0.6);
    ctx.stroke();

    // Side Temples
    ctx.beginPath();
    ctx.moveTo(eyeLeftX - lerp(4.4, 2.5, t), 0);
    ctx.lineTo(eyeLeftX - lerp(8.0, 5.5, t), -1.5);
    ctx.moveTo(eyeRightX + lerp(4.4, 4.5, t), 0);
    ctx.lineTo(eyeRightX + lerp(8.0, 7.0, t), -1.5);
    ctx.stroke();

    // Glass shine gleam
    ctx.beginPath();
    ctx.moveTo(eyeLeftX - lerp(2.0, 1.0, t), -2.2);
    ctx.lineTo(eyeLeftX + lerp(1.0, 0.5, t), -3.4);
    ctx.moveTo(eyeRightX - 2.0, -2.2);
    ctx.lineTo(eyeRightX + 1.0, -3.4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.restore();
  } else if (accessory === 'sprout') {
    // 🌱 Cute Little Green Plant Sprout on Head
    ctx.save();
    ctx.translate(lerp(0, 2.0, t), -11.5);

    // Tiny curved green stem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-1.5, -4.5, 0, -7.5);
    ctx.strokeStyle = '#16A34A';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Left rounded leaf
    ctx.save();
    ctx.translate(0, -7.5);
    ctx.beginPath();
    ctx.ellipse(-4.2, -2.2, 4.2, 2.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#22C55E';
    ctx.fill();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Right rounded leaf
    ctx.beginPath();
    ctx.ellipse(4.2, -2.2, 4.2, 2.2, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#4ADE80';
    ctx.fill();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  } else if (accessory === 'beanie') {
    // 🧶 Cozy Knitted Winter Beanie with Fluffy Pom-Pom
    ctx.save();
    ctx.translate(lerp(0, 1.8, t), -11);

    // Beanie Dome Cap
    ctx.beginPath();
    ctx.moveTo(-9.5, 1.5);
    ctx.quadraticCurveTo(-10.5, -8.5, 0, -9.5);
    ctx.quadraticCurveTo(10.5, -8.5, 9.5, 1.5);
    ctx.closePath();
    ctx.fillStyle = '#3B82F6';
    ctx.fill();
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Knit stripes on dome
    ctx.beginPath();
    ctx.moveTo(-4.5, -8.5);
    ctx.quadraticCurveTo(-6.0, -3.0, -5.5, 1.5);
    ctx.moveTo(4.5, -8.5);
    ctx.quadraticCurveTo(6.0, -3.0, 5.5, 1.5);
    ctx.strokeStyle = '#60A5FA';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Ribbed folded brim
    ctx.beginPath();
    ctx.ellipse(0, 1.8, 10.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1E40AF';
    ctx.fill();
    ctx.strokeStyle = '#172554';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Fluffy pom-pom on top
    ctx.beginPath();
    ctx.arc(0, -10.5, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  } else if (accessory === 'angel_halo') {
    // ✨ Radiant Floating Angel Halo
    ctx.save();
    ctx.translate(lerp(0, 2.0, t), -16.5);

    // Golden Halo Ring
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.0, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top glint
    ctx.beginPath();
    ctx.ellipse(1.5, -0.6, 6.0, 1.4, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Tiny sparkle star
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(7.5, -2.5, 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (accessory === 'heart_clip') {
    // 💖 Sweet Pink Heart Hair Barrette Clip
    ctx.save();
    ctx.translate(lerp(8.5, 6.5, t), -8.5);
    ctx.rotate(0.2);

    // Metallic clip pin
    ctx.beginPath();
    ctx.rect(-2.5, 1.0, 7.5, 1.4);
    ctx.fillStyle = '#94A3B8';
    ctx.fill();

    // Glossy Pink Heart
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-2.8, -3.2, -5.2, 0, 0, 4.2);
    ctx.bezierCurveTo(5.2, 0, 2.8, -3.2, 0, 0);
    ctx.fillStyle = '#EC4899';
    ctx.fill();
    ctx.strokeStyle = '#BE185D';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Glint
    ctx.beginPath();
    ctx.arc(-1.2, -0.8, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  } else if (accessory === 'party_hat') {
    // 🥳 Festive Birthday Party Cone Hat with Pom-Pom
    ctx.save();
    ctx.translate(lerp(0, 2.0, t), -11);
    ctx.rotate(-0.1);

    // Cone body
    ctx.beginPath();
    ctx.moveTo(-6.5, 2.5);
    ctx.lineTo(0, -11.5);
    ctx.lineTo(6.5, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#8B5CF6';
    ctx.fill();
    ctx.strokeStyle = '#6D28D9';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Colorful diagonal stripes
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(8, -6);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(8, -2);
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();

    // Pom-pom on tip
    ctx.beginPath();
    ctx.arc(0, -12.5, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();

    ctx.restore();
  }
}

// -------------------------------------------------------------
// 💬 CHAT SPEECH & THOUGHT BUBBLE RENDERER
// -------------------------------------------------------------
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  alpha: number,
  isThought: boolean = false
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 11px sans-serif';

  // Split text into up to 2-3 wrapped lines if longer than 24 chars
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    if (testLine.length > 24 && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  let maxW = 0;
  for (const l of lines) {
    const w = ctx.measureText(l).width;
    if (w > maxW) maxW = w;
  }

  const paddingX = 12;
  const paddingY = 6;
  const lineHeight = 14;
  const width = Math.min(156, Math.max(38, maxW + paddingX * 2));
  const height = lines.length * lineHeight + paddingY * 2;
  const bubbleX = x - width / 2;
  const bubbleY = y - height;

  // 💬 Clean, crisp speech bubble with pointer
  ctx.beginPath();
  const radius = 10;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bubbleX, bubbleY, width, height, radius);
  } else {
    ctx.rect(bubbleX, bubbleY, width, height);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fill();

  ctx.strokeStyle = 'rgba(225, 29, 72, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Little bottom pointer triangle
  ctx.beginPath();
  ctx.moveTo(x - 4, bubbleY + height);
  ctx.lineTo(x, bubbleY + height + 4);
  ctx.lineTo(x + 4, bubbleY + height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fill();

  // Draw lines of text
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1E1E24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = bubbleY + paddingY + lineHeight / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, x, startY + idx * lineHeight);
  });
  ctx.restore();
}
