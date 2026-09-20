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

  // Floating particles (hearts, zzz, sparkles)
  const particlesRef = useRef<Particle[]>([]);
  const speechBubbleRef = useRef<{ text: string; timer: number; isThought?: boolean } | null>(null);

  // Element and platform caching for zero-flicker sub-millisecond tracking
  const attachedElementRef = useRef<HTMLElement | null>(null);
  const platformsCacheRef = useRef<Platform[]>([]);
  const lastScanTimeRef = useRef<number>(0);
  const lastEscapeJumpTimeRef = useRef<number>(0);
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

          // Sequential navigation towards new message goal (one-by-one, strictly no skipping!)
          if (targetGoalIdRef.current && targetGoalIdRef.current !== curIdClean) {
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

          const roll = Math.random();

          // 1. Playful Hop strictly one-by-one between adjacent message bubbles (no skipping!)
          if (roll < 0.45 && otherBubbles.length > 0) {
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

          // 2. Walking along current message platform (~25% chance)
          if (roll < 0.70) {
            stateRef.current = 'walking';
            stateTimerRef.current = 45 + Math.floor(Math.random() * 65);
            facingRightRef.current = Math.random() > 0.5;
            return;
          }

          // 3. Face grooming (~10% chance)
          if (roll < 0.80) {
            stateRef.current = 'grooming';
            stateTimerRef.current = 75 + Math.floor(Math.random() * 40);
            groomPhaseRef.current = 0;
            return;
          }

          // 4. Cat stretch (~10% chance)
          if (roll < 0.90) {
            stateRef.current = 'stretching';
            stateTimerRef.current = 65;
            stretchPhaseRef.current = 0;
            squashRef.current = { sx: 1.25, sy: 0.78 };
            return;
          }

          // 5. Cozy bread loaf nap (~10% chance)
          stateRef.current = 'loaf';
          stateTimerRef.current = 120 + Math.floor(Math.random() * 120);
          addParticle('zzz', 1);
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
          if (facingRightRef.current) {
            ratio += speedRatio;
            if (ratio >= 0.95) {
              ratio = 0.95;
              facingRightRef.current = false;
              stateRef.current = 'peeking';
              stateTimerRef.current = 35;
            }
          } else {
            ratio -= speedRatio;
            if (ratio <= 0.05) {
              ratio = 0.05;
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
            stateTimerRef.current = 16; // Cute short pause before taking the next one-by-one hop!
          } else {
            targetGoalIdRef.current = null;
            stateTimerRef.current = 45 + Math.floor(Math.random() * 45);
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
        breathePhaseRef.current
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
  }, [settings.enabled, settings.breed, settings.accessory, getPlatformRect, scanPlatforms, startJump, checkTypingBoxCollision, addParticle]);

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
  breathePhase: number = 0
) {
  // Signature cartoon vector color palettes
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

  if (breed === 'mochi') {
    // Pure snowy milky kitten (100% match to reference photo)
    bodyColor = '#FFFFFF';
    bellyColor = '#FFF9FC';
    outlineColor = '#2A2733';
    earPink = '#FFB2C3';
    noseColor = '#FF8DA5';
    eyeColor = '#22202A';
    pawColor = '#FFFFFF';
  } else if (breed === 'calico') {
    // Calico with sweet apricot & chocolate patches
    bodyColor = '#FCFAF8';
    bellyColor = '#FFF9FC';
    spotColor1 = '#F59E0B'; // warm apricot
    spotColor2 = '#452A1E'; // chocolate espresso
    outlineColor = '#2B221E';
    earPink = '#FCA5A5';
    noseColor = '#FB7185';
    eyeColor = '#22202A';
    pawColor = '#FCFAF8';
  } else if (breed === 'caramel') {
    // Honey ginger tabby kitten
    bodyColor = '#FB923C';
    bellyColor = '#FEF3C7';
    spotColor1 = '#C2410C'; // tabby stripes
    outlineColor = '#381A08';
    earPink = '#FCA5A5';
    noseColor = '#EA580C';
    eyeColor = '#22202A';
    pawColor = '#FB923C';
  } else if (breed === 'luna') {
    // Velvet midnight black kitten
    bodyColor = '#23232B';
    bellyColor = '#2F2F3B';
    outlineColor = '#111116';
    earPink = '#6E4D5B';
    padColor = '#FFB6C1';
    noseColor = '#7A5463';
    whiskerColor = 'rgba(240, 240, 250, 0.7)';
    eyeColor = '#34D399';
    pawColor = '#FFFFFF';
  } else if (breed === 'siamese') {
    // Seal Point Siamese kitten (creamy silk with espresso points & sapphire eyes)
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
  } else if (breed === 'tuxedo') {
    // Dapper Tuxedo kitten (formal black coat, white socks & golden topaz eyes)
    bodyColor = '#1E1E24';
    bellyColor = '#FFFFFF';
    outlineColor = '#111116';
    earPink = '#F472B6';
    padColor = '#FFAEC9';
    noseColor = '#FB7185';
    whiskerColor = 'rgba(255, 255, 255, 0.85)';
    eyeColor = '#EAB308'; // golden topaz
    pawColor = '#FFFFFF';
  } else if (breed === 'silver') {
    // Silver British Shorthair (soft misty slate coat with emerald green eyes)
    bodyColor = '#94A3B8';
    bellyColor = '#E2E8F0';
    outlineColor = '#334155';
    earPink = '#F9A8D4';
    padColor = '#FDA4AF';
    noseColor = '#BE185D';
    whiskerColor = '#1E293B';
    eyeColor = '#059669'; // seafoam emerald
    pawColor = '#94A3B8';
  } else if (breed === 'cinnamon') {
    // Warm Cinnamon Tabby (rich terracotta coat with amber eyes)
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
  } else if (breed === 'berry') {
    // Sweet Strawberry Milk (pastel blush pink kitten with sparkling ruby eyes)
    bodyColor = '#FDE8EF';
    bellyColor = '#FFF5F8';
    outlineColor = '#831843';
    earPink = '#F472B6';
    padColor = '#FB7185';
    noseColor = '#E11D48';
    whiskerColor = '#9D174D';
    eyeColor = '#BE185D'; // sparkling ruby
    pawColor = '#FDE8EF';
  }

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
    // --- LEFT EYE ---
    const eyeXL = -5.6 + lookShiftX * 0.45;
    const eyeYL = eyeY + lookShiftY * 0.45;

    // Solid glossy eye
    ctx.beginPath();
    ctx.ellipse(eyeXL, eyeYL, 3.6, 3.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Big Top-Right Specular Highlight
    ctx.beginPath();
    ctx.arc(eyeXL + 1.2, eyeYL - 1.1, 1.35, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Small Bottom-Left Specular Highlight
    ctx.beginPath();
    ctx.arc(eyeXL - 1.2, eyeYL + 1.2, 0.65, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // --- RIGHT EYE ---
    const eyeXR = 5.6 + lookShiftX * 0.45;
    const eyeYR = eyeY + lookShiftY * 0.45;

    // Solid glossy eye
    ctx.beginPath();
    ctx.ellipse(eyeXR, eyeYR, 3.6, 3.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Big Top-Right Specular Highlight
    ctx.beginPath();
    ctx.arc(eyeXR + 1.2, eyeYR - 1.1, 1.35, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Small Bottom-Left Specular Highlight
    ctx.beginPath();
    ctx.arc(eyeXR - 1.2, eyeYR + 1.2, 0.65, 0, Math.PI * 2);
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

  // MOUTH: Iconic ':3' Feline Smile branching down from nose tip
  ctx.beginPath();
  // Stem connecting nose to mouth center
  ctx.moveTo(0, 3.2);
  ctx.lineTo(0, 4.2);
  // Left curved lip
  ctx.arc(-1.6, 4.4, 1.6, 0.05, Math.PI - 0.15);
  // Right curved lip
  ctx.arc(1.6, 4.4, 1.6, 0.15, Math.PI - 0.05);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.stroke();

  // DELICATE DUAL WHISKERS (Two clean lines per cheek)
  const whiskerTwitch = Math.sin(tailWave * 0.7) * 0.35;
  ctx.beginPath();
  // Left Whiskers
  ctx.moveTo(-9.5, 2.8);
  ctx.lineTo(-16.8, 2.2 + whiskerTwitch);
  ctx.moveTo(-9.5, 4.8);
  ctx.lineTo(-16.2, 6.2 + whiskerTwitch);

  // Right Whiskers
  ctx.moveTo(9.5, 2.8);
  ctx.lineTo(16.8, 2.2 - whiskerTwitch);
  ctx.moveTo(9.5, 4.8);
  ctx.lineTo(16.2, 6.2 - whiskerTwitch);

  ctx.strokeStyle = whiskerColor;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // ACCESSORIES (Rendered cleanly on head)
  drawAccessory(ctx, accessory);

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
// 🎀 ACCESSORIES RENDERER
// -------------------------------------------------------------
function drawAccessory(ctx: CanvasRenderingContext2D, accessory: PetAccessory) {
  if (accessory === 'bow') {
    // Cute Scarlet Ribbon Bow with Center Golden Pearl
    ctx.save();
    ctx.translate(0, 11);
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
    ctx.translate(0, 11);

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
    ctx.translate(-7, -8);
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
    ctx.translate(0, 10.5);

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
    // Tiny Golden Royal Crown with Ruby Studs
    ctx.save();
    ctx.translate(0, -11);
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
    // 👓 Cute Round Golden Wireframe Glasses
    ctx.save();
    ctx.translate(0, -0.4);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.2;

    // Left Lens Frame
    ctx.beginPath();
    ctx.arc(-5.6, 0, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.stroke();

    // Right Lens Frame
    ctx.beginPath();
    ctx.arc(5.6, 0, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.stroke();

    // Nose Bridge
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.6);
    ctx.quadraticCurveTo(0, -1.8, 1.2, -0.6);
    ctx.stroke();

    // Side Temples
    ctx.beginPath();
    ctx.moveTo(-10.0, 0);
    ctx.lineTo(-13.5, -1.5);
    ctx.moveTo(10.0, 0);
    ctx.lineTo(13.5, -1.5);
    ctx.stroke();

    // Glass shine gleam
    ctx.beginPath();
    ctx.moveTo(-7.5, -2.2);
    ctx.lineTo(-4.5, -3.4);
    ctx.moveTo(3.8, -2.2);
    ctx.lineTo(6.8, -3.4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.restore();
  } else if (accessory === 'sprout') {
    // 🌱 Cute Little Green Plant Sprout on Head
    ctx.save();
    ctx.translate(0, -11.5);

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
    ctx.translate(0, -11);

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
    ctx.translate(0, -16.5);

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
    ctx.translate(8.5, -8.5);
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
    ctx.translate(0, -11);
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
