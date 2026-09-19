import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PetSettings, PetBreed, PetAccessory } from '../types';

interface ChatPetCompanionProps {
  settings: PetSettings;
  onUpdateSettings?: (newSettings: PetSettings) => void;
  lastMessageId?: string;
  isTyping?: boolean;
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
const CANVAS_HEIGHT = 140;
const PET_OFFSET_X = 80;
const PET_OFFSET_Y = 100;
const GROUND_PLATFORM_ID = 'chat-messages-bottom-anchor';
const BUBBLE_EDGE_INSET = 26; // Safe margin preventing paws hanging off rounded corners

export const ChatPetCompanion: React.FC<ChatPetCompanionProps> = ({
  settings,
  lastMessageId,
  isTyping
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hitButtonRef = useRef<HTMLButtonElement | null>(null);

  // Position and Physics in #message-container content space
  const posRef = useRef<{ x: number; y: number }>({ x: 160, y: 300 });
  const facingRightRef = useRef<boolean>(true);
  const stateRef = useRef<CatState>('idle');
  const stateTimerRef = useRef<number>(0);

  // Platform Anchor (persists on message or bottom anchor, unaffected by keyboard)
  const attachedPlatformIdRef = useRef<string>(GROUND_PLATFORM_ID);
  const platformOffsetRatioRef = useRef<number>(0.5);
  const offscreenTimerRef = useRef<number>(0);

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
  const groomPhaseRef = useRef<number>(0);
  const stretchPhaseRef = useRef<number>(0);

  // Pointer & Interactive Curiosity
  const pointerPosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const eyeOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Floating particles (hearts, zzz, sparkles)
  const particlesRef = useRef<Particle[]>([]);
  const speechBubbleRef = useRef<{ text: string; timer: number } | null>(null);

  // Sound & Haptic
  const triggerHaptic = useCallback((duration: number = 25) => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(duration);
      } catch (_) {}
    }
  }, []);

  // Quick speech trigger
  const showSpeech = useCallback((text: string, durationFrames: number = 130) => {
    speechBubbleRef.current = { text, timer: durationFrames };
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

  // Helper to resolve live physical position of any platform in #message-container content space
  const getPlatformRect = useCallback((platformId: string): Platform | null => {
    const container = document.getElementById('message-container');
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    let el: HTMLElement | null = null;
    if (platformId === GROUND_PLATFORM_ID || platformId === 'chat-messages-bottom-anchor') {
      el = document.getElementById('chat-messages-bottom-anchor');
    }
    if (!el) {
      el = container.querySelector(`[data-msg-id="${platformId}"]`) as HTMLElement;
    }
    if (!el) {
      const row = document.getElementById(platformId);
      if (row) {
        el = row.querySelector('.chat-bubble-owner, .chat-bubble-partner') as HTMLElement;
      }
    }
    if (!el) {
      const bubbles = container.querySelectorAll('.chat-bubble-owner, .chat-bubble-partner');
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i] as HTMLElement;
        if (b.dataset?.msgId === platformId || b.closest('.chat-message-row')?.id === platformId) {
          el = b;
          break;
        }
      }
    }

    if (!el) {
      if (platformId === GROUND_PLATFORM_ID) {
        const groundTop = container.scrollHeight - 24;
        return {
          id: GROUND_PLATFORM_ID,
          left: 16,
          right: Math.max(100, container.clientWidth - 16),
          top: groundTop,
          bottom: groundTop + 20,
          width: Math.max(100, container.clientWidth - 32),
          height: 20,
          isBubble: false,
        };
      }
      return null;
    }

    const rect = el.getBoundingClientRect();
    const isBottomAnchor = el.id === 'chat-messages-bottom-anchor';
    const left = rect.left - containerRect.left + scrollLeft;
    const top = rect.top - containerRect.top + scrollTop;

    return {
      id: platformId,
      left,
      right: left + rect.width,
      top,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height,
      isBubble: !isBottomAnchor,
      isOwner: el.classList.contains('chat-bubble-owner'),
      element: el,
    };
  }, []);

  // Scan visible DOM platforms (Message bubbles as perches + bottom anchor)
  const scanPlatforms = useCallback((): Platform[] => {
    const container = document.getElementById('message-container');
    if (!container) return [];

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const platforms: Platform[] = [];

    // 1. Message bubbles as jumping obstacles and play platforms
    const bubbles = container.querySelectorAll('.chat-bubble-owner, .chat-bubble-partner');
    bubbles.forEach((b, idx) => {
      const el = b as HTMLElement;
      const bRect = el.getBoundingClientRect();
      const left = bRect.left - containerRect.left + scrollLeft;
      const top = bRect.top - containerRect.top + scrollTop;
      const width = bRect.width;
      const height = bRect.height;
      const isOwner = el.classList.contains('chat-bubble-owner');
      const msgId = el.dataset?.msgId || el.closest('.chat-message-row')?.id || `bubble-${idx}`;

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
          isOwner,
          element: el,
        });
      }
    });

    // 2. Chat messages bottom anchor (inside #message-container)
    const bottomAnchor = document.getElementById('chat-messages-bottom-anchor');
    if (bottomAnchor) {
      const aRect = bottomAnchor.getBoundingClientRect();
      const top = aRect.top - containerRect.top + scrollTop;
      platforms.push({
        id: GROUND_PLATFORM_ID,
        left: 16,
        right: Math.max(100, container.clientWidth - 16),
        top,
        bottom: top + 20,
        width: Math.max(100, container.clientWidth - 32),
        height: 20,
        isBubble: false,
        element: bottomAnchor,
      });
    } else {
      const groundTop = container.scrollHeight - 24;
      platforms.push({
        id: GROUND_PLATFORM_ID,
        left: 16,
        right: Math.max(100, container.clientWidth - 16),
        top: groundTop,
        bottom: groundTop + 20,
        width: Math.max(100, container.clientWidth - 32),
        height: 20,
        isBubble: false,
      });
    }

    return platforms;
  }, []);

  // Helper to plan and launch a jump with seamless Hermite/cosine arc and ZERO teleport on landing
  const startJump = useCallback((targetPlatform: Platform) => {
    // Target ratio: 0.35 to 0.65 for bubbles (centered and stable on top of flat area)
    const targetRatio = targetPlatform.isBubble ? (0.35 + Math.random() * 0.3) : (0.2 + Math.random() * 0.6);
    const inset = targetPlatform.isBubble ? BUBBLE_EDGE_INSET : 16;
    const minX = targetPlatform.left + inset;
    const maxX = targetPlatform.right - inset;
    const targetX = maxX > minX ? minX + (maxX - minX) * targetRatio : (targetPlatform.left + targetPlatform.right) / 2;
    const targetY = targetPlatform.top;

    const startX = posRef.current.x;
    const startY = posRef.current.y;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);

    facingRightRef.current = dx >= 0;

    jumpPlanRef.current = {
      startX,
      startY,
      targetX,
      targetY,
      targetPlatformId: targetPlatform.id,
      targetRatio, // STORES the target ratio to prevent any post-landing snap
      duration: Math.max(22, Math.min(36, Math.round(dist / 9))),
      arcHeight: Math.max(36, Math.min(85, Math.abs(dy) * 0.4 + 32)),
    };

    stateRef.current = 'pre_jump';
    stateTimerRef.current = 12; // Quick butt-wiggle crouch
    buttWiggleRef.current = 0;
  }, []);

  // React to new message: perk up and jump towards the newest message obstacle!
  const prevMsgRef = useRef<string | undefined>(lastMessageId);
  useEffect(() => {
    if (lastMessageId && lastMessageId !== prevMsgRef.current) {
      prevMsgRef.current = lastMessageId;
      stateRef.current = 'alert';
      stateTimerRef.current = 30;
      squashRef.current = { sx: 0.88, sy: 1.28 };
      showSpeech('New whisper! 🐾', 80);
      addParticle('✨', 2);
    }
  }, [lastMessageId, showSpeech, addParticle]);

  // React to typing: Mochi shows loving attention WITHOUT shifting or teleporting!
  // Position is preserved so keyboard opening does not displace Mochi on either phone.
  const prevTypingRef = useRef<boolean | undefined>(isTyping);
  useEffect(() => {
    if (isTyping && !prevTypingRef.current) {
      prevTypingRef.current = isTyping;
      stateRef.current = 'alert';
      stateTimerRef.current = 40;
      squashRef.current = { sx: 0.94, sy: 1.12 };
      showSpeech('Whispering with love~ 🐾', 80);
      addParticle('❤️', 2);
    } else if (!isTyping && prevTypingRef.current) {
      prevTypingRef.current = isTyping;
    }
  }, [isTyping, showSpeech, addParticle]);

  // Petting interaction on click/tap
  const handlePet = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    triggerHaptic(35);
    stateRef.current = 'purring';
    stateTimerRef.current = 100;
    squashRef.current = { sx: 1.3, sy: 0.72 };

    const randomSpeech = PURR_SPEECHES[Math.floor(Math.random() * PURR_SPEECHES.length)];
    showSpeech(randomSpeech, 120);
    addParticle('❤️', 4);
    addParticle('✨', 3);
  };

  // Main animation loop, physics simulation, zero-flicker scroll & keyboard decoupling
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

    // Initial placement: Start perched on the latest visible message bubble or bottom anchor
    const platforms = scanPlatforms();
    const visibleBubbles = platforms.filter((p) => p.isBubble);
    if (visibleBubbles.length > 0) {
      const lastB = visibleBubbles[visibleBubbles.length - 1];
      attachedPlatformIdRef.current = lastB.id;
      platformOffsetRatioRef.current = 0.5;
      const inset = lastB.isBubble ? BUBBLE_EDGE_INSET : 16;
      const minW = lastB.left + inset;
      const maxW = lastB.right - inset;
      posRef.current = {
        x: maxW > minW ? (minW + maxW) / 2 : (lastB.left + lastB.right) / 2,
        y: lastB.top,
      };
    } else {
      attachedPlatformIdRef.current = GROUND_PLATFORM_ID;
      const ground = getPlatformRect(GROUND_PLATFORM_ID);
      posRef.current = {
        x: ground ? (ground.left + ground.right) / 2 : 160,
        y: ground ? ground.top : 300,
      };
    }

    // Pointer move listener for curious gaze tracking
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const msgCont = document.getElementById('message-container');
      if (!msgCont) return;
      const rect = msgCont.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      if (clientX !== undefined && clientY !== undefined) {
        pointerPosRef.current = {
          x: clientX - rect.left + msgCont.scrollLeft,
          y: clientY - rect.top + msgCont.scrollTop,
          active: true,
        };
      }
    };

    const handlePointerLeave = () => {
      pointerPosRef.current.active = false;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);

    // Main tick loop
    const tick = () => {
      if (isDestroyed) return;

      const msgCont = document.getElementById('message-container');
      if (!msgCont) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }

      const scrollTop = msgCont.scrollTop;
      const clientHeight = msgCont.clientHeight;
      const scrollPlatforms = scanPlatforms();

      // 1. Continuous Real-time Platform Anchor Sync
      const isAirborne = stateRef.current === 'jumping';
      if (!isAirborne) {
        let livePlat = getPlatformRect(attachedPlatformIdRef.current);

        // If current platform is missing (e.g. deleted message or initial load):
        if (!livePlat) {
          const visibleBubbles = scrollPlatforms.filter(
            (p) => p.isBubble && p.top >= scrollTop + 20 && p.top <= scrollTop + clientHeight - 30
          );
          if (visibleBubbles.length > 0) {
            const nearest = visibleBubbles[visibleBubbles.length - 1];
            attachedPlatformIdRef.current = nearest.id;
            platformOffsetRatioRef.current = 0.5;
            livePlat = getPlatformRect(nearest.id);
          } else {
            attachedPlatformIdRef.current = GROUND_PLATFORM_ID;
            livePlat = getPlatformRect(GROUND_PLATFORM_ID);
          }
        }

        if (livePlat) {
          // Mochi sits directly on top of the message bubble in content space
          posRef.current.y = livePlat.top;
          const inset = livePlat.isBubble ? BUBBLE_EDGE_INSET : 16;
          const minWalk = livePlat.left + inset;
          const maxWalk = livePlat.right - inset;

          if (maxWalk <= minWalk) {
            posRef.current.x = (livePlat.left + livePlat.right) / 2;
          } else {
            const targetPx = minWalk + (maxWalk - minWalk) * platformOffsetRatioRef.current;
            posRef.current.x = Math.max(minWalk, Math.min(maxWalk, targetPx));
          }
        }

        // Off-screen recovery: If user scrolled far away and Mochi has been off-screen for > 3.5 seconds,
        // softly transition to a currently visible bubble
        const isMochiInView = posRef.current.y >= scrollTop - 80 && posRef.current.y <= scrollTop + clientHeight + 80;
        if (!isMochiInView) {
          offscreenTimerRef.current++;
          if (offscreenTimerRef.current > 210) {
            const visibleBubbles = scrollPlatforms.filter(
              (p) => p.isBubble && p.top >= scrollTop + 40 && p.top <= scrollTop + clientHeight - 50
            );
            if (visibleBubbles.length > 0) {
              const target = visibleBubbles[Math.floor(Math.random() * visibleBubbles.length)];
              startJump(target);
              showSpeech('Here I am! 🐾', 80);
              offscreenTimerRef.current = 0;
            }
          }
        } else {
          offscreenTimerRef.current = 0;
        }
      }

      // 2. Update 160x140 container position in content coordinates via GPU translate3d
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${Math.round(posRef.current.x - PET_OFFSET_X)}px, ${Math.round(posRef.current.y - PET_OFFSET_Y)}px, 0)`;
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

      // 6. Squash and stretch decay
      squashRef.current.sx += (1 - squashRef.current.sx) * 0.18;
      squashRef.current.sy += (1 - squashRef.current.sy) * 0.18;

      // 7. Curious Eye & Head Tracking
      if (pointerPosRef.current.active) {
        const dx = pointerPosRef.current.x - posRef.current.x;
        const dy = pointerPosRef.current.y - (posRef.current.y - 20);
        const dist = Math.hypot(dx, dy);

        if (dist < 400) {
          const maxLook = 2.5;
          eyeOffsetRef.current = {
            dx: (dx / dist) * maxLook * (facingRightRef.current ? 1 : -1),
            dy: Math.max(-1.5, Math.min(2.0, (dy / dist) * maxLook)),
          };
        } else {
          eyeOffsetRef.current = { dx: 0, dy: 0 };
        }
      } else {
        eyeOffsetRef.current = { dx: 0, dy: 0 };
      }

      // 8. STATE MACHINE & COMPANION INTELLIGENCE
      const state = stateRef.current;

      if (state === 'idle') {
        tailWaveRef.current += 0.04;
        walkPhaseRef.current = 0;

        if (stateTimerRef.current <= 0) {
          const roll = Math.random();

          if (roll < 0.35) {
            // Walk along current message bubble
            stateRef.current = 'walking';
            stateTimerRef.current = 45 + Math.floor(Math.random() * 65);
            facingRightRef.current = Math.random() > 0.5;
          } else if (roll < 0.62 && scrollPlatforms.length > 1) {
            // Jump: target another visible message bubble on screen
            const visibleTargets = scrollPlatforms.filter(
              (p) => p.id !== attachedPlatformIdRef.current && p.top >= scrollTop + 20 && p.top <= scrollTop + clientHeight - 40
            );
            if (visibleTargets.length > 0) {
              const targetP = visibleTargets[Math.floor(Math.random() * visibleTargets.length)];
              startJump(targetP);
            } else {
              stateTimerRef.current = 50 + Math.floor(Math.random() * 60);
            }
          } else if (roll < 0.74) {
            // Face grooming
            stateRef.current = 'grooming';
            stateTimerRef.current = 80 + Math.floor(Math.random() * 40);
            groomPhaseRef.current = 0;
          } else if (roll < 0.85) {
            // Cat stretch
            stateRef.current = 'stretching';
            stateTimerRef.current = 65;
            stretchPhaseRef.current = 0;
            squashRef.current = { sx: 1.25, sy: 0.78 };
          } else if (roll < 0.95) {
            // Cozy bread loaf nap
            stateRef.current = 'loaf';
            stateTimerRef.current = 130 + Math.floor(Math.random() * 140);
            addParticle('zzz', 1);
          } else {
            stateTimerRef.current = 50 + Math.floor(Math.random() * 70);
          }
        }
      } else if (state === 'walking') {
        tailWaveRef.current += 0.08;
        walkPhaseRef.current += 0.22;

        let livePlat = getPlatformRect(attachedPlatformIdRef.current);
        if (livePlat) {
          const inset = livePlat.isBubble ? BUBBLE_EDGE_INSET : 16;
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
            const inset = liveTarget.isBubble ? BUBBLE_EDGE_INSET : 16;
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
            // LANDING: Lock position to targetX / targetY with EXACT targetRatio to eliminate sideways teleport!
            posRef.current.x = plan.targetX;
            posRef.current.y = plan.targetY;
            attachedPlatformIdRef.current = plan.targetPlatformId;
            platformOffsetRatioRef.current = plan.targetRatio; // Zero-teleport guarantee
            jumpPlanRef.current = null;
            stateRef.current = 'landing';
            stateTimerRef.current = 10;
            squashRef.current = { sx: 1.25, sy: 0.76 };
            addParticle('✨', 1);
          }
        } else {
          stateRef.current = 'idle';
          stateTimerRef.current = 30;
        }
      } else if (state === 'landing') {
        if (stateTimerRef.current <= 0) {
          stateRef.current = 'idle';
          stateTimerRef.current = 40 + Math.floor(Math.random() * 40);
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

      ctx.scale(squashRef.current.sx, squashRef.current.sy);

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
        eyeOffsetRef.current
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
          drawSpeechBubble(ctx, PET_OFFSET_X, 36, speechBubbleRef.current.text, alpha);
        }
        if (speechBubbleRef.current.timer <= 0) {
          speechBubbleRef.current = null;
        }
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [settings.enabled, settings.breed, settings.accessory, getPlatformRect, scanPlatforms, startJump, addParticle]);

  if (!settings.enabled) return null;

  return (
    <div
      ref={containerRef}
      id="chat-pet-companion-layer"
      className="absolute top-0 left-0 pointer-events-none z-20 select-none"
      style={{
        width: `${CANVAS_WIDTH}px`,
        height: `${CANVAS_HEIGHT}px`,
        willChange: 'transform',
        transform: 'translate3d(-9999px, -9999px, 0)',
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
// 🎨 HAND-CRAFTED 2D VECTOR KITTEN RENDERER (Studio Ghibli / Chibi)
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
  eyeOffset: { dx: number; dy: number } = { dx: 0, dy: 0 }
) {
  // Palettes per Breed
  let bodyColor = '#FFFFFF';
  let bellyColor = '#FFF5F8';
  let outlineColor = '#241D20';
  let earPink = '#FFAEC9';
  let eyeColor = '#1A181B';
  let eyeHighlight = '#FFFFFF';
  let eyeGlow = '#4A3B44';
  let noseColor = '#FF94B2';
  let cheekColor = 'rgba(255, 130, 160, 0.48)';
  let padColor = '#FFAEC9';
  let spotColor1: string | null = null;
  let spotColor2: string | null = null;

  if (breed === 'mochi') {
    // Pure snowy milky kitten
    bodyColor = '#FCFCFD';
    bellyColor = '#FFF5F8';
    outlineColor = '#34292F';
    eyeColor = '#221D24';
    eyeGlow = '#4E3E4B';
  } else if (breed === 'calico') {
    // Calico with sweet apricot and dark chocolate patches
    bodyColor = '#FCFCFD';
    bellyColor = '#FFF7FA';
    spotColor1 = '#F59E0B'; // warm apricot
    spotColor2 = '#452A1E'; // chocolate
    outlineColor = '#2B1E19';
    eyeColor = '#3B2412';
    eyeGlow = '#B45309';
  } else if (breed === 'caramel') {
    // Honey tabby kitten
    bodyColor = '#FB923C';
    bellyColor = '#FEF3C7';
    spotColor1 = '#EA580C'; // stripes
    outlineColor = '#361D10';
    eyeColor = '#451A03';
    eyeGlow = '#D97706';
  } else if (breed === 'luna') {
    // Midnight velvet black kitten with emerald eyes & white mittens
    bodyColor = '#24242A';
    bellyColor = '#32323D';
    outlineColor = '#0F0F14';
    eyeColor = '#064E3B'; // deep emerald
    eyeGlow = '#10B981';  // glowing mint emerald
    eyeHighlight = '#ECFDF5';
    earPink = '#523A44';
    padColor = '#FFB6C1';
  }

  // 1. Soft Dynamic Contact Ground Shadow
  ctx.save();
  ctx.beginPath();
  const shadowScale = state === 'pre_jump' ? 1.2 : (state === 'loaf' ? 1.1 : 1.0);
  ctx.ellipse(0, 0, 16 * shadowScale, 4.2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fill();
  ctx.restore();

  // Butt wiggle offset (during pre-jump)
  const buttX = state === 'pre_jump' ? Math.sin(buttWiggle) * 3.2 : 0;
  const buttY = state === 'pre_jump' ? Math.abs(Math.cos(buttWiggle)) * 1.5 : 0;

  // 2. ANIMATED FLUFFY TAIL
  ctx.save();
  ctx.beginPath();
  const tailBaseX = -12 + buttX;
  const tailBaseY = -10 + buttY;
  ctx.moveTo(tailBaseX, tailBaseY);

  if (state === 'loaf') {
    // Curled softly around paws
    ctx.bezierCurveTo(tailBaseX - 4, tailBaseY + 6, 8, tailBaseY + 8, 12, tailBaseY + 3);
  } else if (state === 'clinging') {
    // Tail streaming back for balance
    ctx.bezierCurveTo(tailBaseX - 8, tailBaseY - 6, tailBaseX - 16, tailBaseY - 4, tailBaseX - 22, tailBaseY - 10);
  } else {
    // Wagging upright with natural S-curve
    const wave1 = Math.sin(tailWave) * 8;
    const wave2 = Math.cos(tailWave * 1.2) * 12;
    ctx.bezierCurveTo(
      tailBaseX - 8,
      tailBaseY - 12 + wave1 * 0.5,
      tailBaseX - 6 + wave1,
      tailBaseY - 22 + wave2 * 0.4,
      tailBaseX - 2 + wave1 * 1.4,
      tailBaseY - 26 + wave2 * 0.6
    );
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 5.0;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Fluffy tip highlight on tail
  if (breed === 'caramel' || breed === 'calico') {
    ctx.beginPath();
    ctx.arc(tailBaseX - 2 + Math.sin(tailWave) * 11, tailBaseY - 26 + Math.cos(tailWave * 1.2) * 7, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF5F8';
    ctx.fill();
  }
  ctx.restore();

  // 3. BACK PAWS / FEET WITH TOE BEANS
  const stepOffset1 = state === 'walking' ? Math.sin(walkPhase) * 3.2 : 0;
  const stepOffset2 = state === 'walking' ? -Math.sin(walkPhase) * 3.2 : 0;

  ctx.save();
  // Left Paw
  ctx.beginPath();
  ctx.ellipse(-8 + stepOffset1, -2, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = breed === 'luna' ? '#F8FAFC' : bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Right Paw
  ctx.beginPath();
  ctx.ellipse(8 + stepOffset2, -2, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = breed === 'luna' ? '#F8FAFC' : bodyColor;
  ctx.fill();
  ctx.stroke();

  // Little pink toe beans when lifting paws
  if (state === 'walking' && Math.abs(stepOffset1) > 1.5) {
    ctx.beginPath();
    ctx.arc(-8 + stepOffset1, -2, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = padColor;
    ctx.fill();
  }
  ctx.restore();

  // 4. CHUBBY PLUSH BODY
  ctx.save();
  ctx.beginPath();
  const bodyY = -12 + (state === 'pre_jump' ? 2 : 0);
  ctx.ellipse(0 + buttX * 0.4, bodyY, 14.5, 10.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Calico / Tabby Body Patch
  if (spotColor1) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(-4 + buttX * 0.4, bodyY - 3, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor1;
    ctx.fill();
    ctx.restore();
  }

  // Soft Tummy Fluff Patch
  ctx.beginPath();
  ctx.ellipse(1 + buttX * 0.2, bodyY + 1.2, 8.5, 6.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();
  ctx.restore();

  // 5. ROUND CHIBI HEAD WITH FLUFFY CHEEK TUFTS
  const headY = -22 + (state === 'pre_jump' ? 3 : 0);
  ctx.save();
  ctx.translate(2, headY);

  // EARS WITH INNER FLUFF WISPS
  const twitchL = (earTwitchTimer % 180 < 12) ? Math.sin(earTwitchTimer) * 0.15 : 0;
  const twitchR = (earTwitchTimer % 230 < 12) ? Math.sin(earTwitchTimer) * 0.15 : 0;

  // Left Ear
  ctx.save();
  ctx.translate(-9, -8);
  ctx.rotate(-0.16 + twitchL);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-4.5, -10.5);
  ctx.lineTo(6.5, -6);
  ctx.closePath();
  ctx.fillStyle = spotColor2 && breed === 'calico' ? spotColor2 : bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Inner ear pink
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-2.2, -7.5);
  ctx.lineTo(4.2, -4.5);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();

  // Inner ear fluffy white wisp
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(1.5, -3);
  ctx.lineTo(2, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(9, -8);
  ctx.rotate(0.16 + twitchR);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(4.5, -10.5);
  ctx.lineTo(-6.5, -6);
  ctx.closePath();
  ctx.fillStyle = spotColor1 && breed === 'calico' ? spotColor1 : bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Inner ear pink
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(2.2, -7.5);
  ctx.lineTo(-4.2, -4.5);
  ctx.closePath();
  ctx.fillStyle = earPink;
  ctx.fill();

  // Inner ear fluffy white wisp
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(-1.5, -3);
  ctx.lineTo(-2, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // HEAD BASE: Round chibi head + adorable fluffy cheek fur tufts
  ctx.beginPath();
  ctx.ellipse(0, 0, 13.5, 11.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // Left & Right Fluffy Cheek Fur Tufts
  // Left cheek tufts
  ctx.beginPath();
  ctx.moveTo(-12, -1);
  ctx.lineTo(-15.5, 2);
  ctx.lineTo(-12.5, 3.5);
  ctx.lineTo(-15, 6);
  ctx.lineTo(-11, 6.5);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Right cheek tufts
  ctx.beginPath();
  ctx.moveTo(12, -1);
  ctx.lineTo(15.5, 2);
  ctx.lineTo(12.5, 3.5);
  ctx.lineTo(15, 6);
  ctx.lineTo(11, 6.5);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();

  // Calico Head Patch
  if (spotColor2 && breed === 'calico') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-7, -4, 5.5, 6.5, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = spotColor2;
    ctx.fill();
    ctx.restore();
  }

  // CHEEK BLUSH WITH KAWAII BLUSH STRIPES (///)
  ctx.beginPath();
  ctx.ellipse(-8, 3.5, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 3.5, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = cheekColor;
  ctx.fill();

  // Anime blush tick marks
  ctx.strokeStyle = 'rgba(235, 70, 110, 0.65)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-9.5, 2.5);
  ctx.lineTo(-8.5, 4.5);
  ctx.moveTo(-7.5, 2.5);
  ctx.lineTo(-6.5, 4.5);
  ctx.moveTo(6.5, 2.5);
  ctx.lineTo(7.5, 4.5);
  ctx.moveTo(8.5, 2.5);
  ctx.lineTo(9.5, 4.5);
  ctx.stroke();

  // EYES (Big Sparkly Anime Eyes with Deep Irises & Catchlights)
  const eyeY = 0;
  const eyeDx = eyeOffset.dx;
  const eyeDy = eyeOffset.dy;

  if (isBlinking || state === 'loaf' || state === 'purring') {
    // Happy squinting lines (^ ^) with eyelashes
    ctx.beginPath();
    ctx.arc(-5.2, eyeY, 3.2, Math.PI, Math.PI * 2, false);
    ctx.arc(5.2, eyeY, 3.2, Math.PI, Math.PI * 2, false);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else {
    // Large Sparkly Chibi Anime Eyes
    // Left eye iris
    ctx.beginPath();
    ctx.ellipse(-5 + eyeDx * 0.5, eyeY + eyeDy * 0.5, 3.4, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Left lower iris luminous bounce light
    ctx.beginPath();
    ctx.ellipse(-5 + eyeDx * 0.5, eyeY + 1.8 + eyeDy * 0.5, 2.4, 1.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeGlow;
    ctx.fill();

    // Right eye iris
    ctx.beginPath();
    ctx.ellipse(5 + eyeDx * 0.5, eyeY + eyeDy * 0.5, 3.4, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // Right lower iris luminous bounce light
    ctx.beginPath();
    ctx.ellipse(5 + eyeDx * 0.5, eyeY + 1.8 + eyeDy * 0.5, 2.4, 1.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeGlow;
    ctx.fill();

    // Large primary catchlight (glossy highlight)
    ctx.beginPath();
    ctx.arc(-4.2 + eyeDx * 0.3, eyeY - 1.5 + eyeDy * 0.3, 1.4, 0, Math.PI * 2);
    ctx.arc(5.8 + eyeDx * 0.3, eyeY - 1.5 + eyeDy * 0.3, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Secondary micro-sparkle twinkle
    ctx.beginPath();
    ctx.arc(-5.8 + eyeDx * 0.3, eyeY + 1.4 + eyeDy * 0.3, 0.7, 0, Math.PI * 2);
    ctx.arc(4.2 + eyeDx * 0.3, eyeY + 1.4 + eyeDy * 0.3, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = eyeHighlight;
    ctx.fill();

    // Delicate upper feline lash flick
    ctx.beginPath();
    ctx.moveTo(-8.2 + eyeDx * 0.5, eyeY - 2.8 + eyeDy * 0.5);
    ctx.lineTo(-9.2 + eyeDx * 0.5, eyeY - 4.2 + eyeDy * 0.5);
    ctx.moveTo(8.2 + eyeDx * 0.5, eyeY - 2.8 + eyeDy * 0.5);
    ctx.lineTo(9.2 + eyeDx * 0.5, eyeY - 4.2 + eyeDy * 0.5);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  // NOSE (Cute Soft Pink Button with Specular Shine)
  ctx.beginPath();
  ctx.ellipse(0, 3, 1.6, 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = noseColor;
  ctx.fill();

  // Specular nose dot
  ctx.beginPath();
  ctx.arc(-0.4, 2.7, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // MOUTH (:3 Sweet Chibi Cat Smile)
  ctx.beginPath();
  ctx.arc(-2, 5.1, 2.1, 0.1, Math.PI - 0.2);
  ctx.arc(2, 5.1, 2.1, 0.2, Math.PI - 0.1);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // CURVED DELICATE WHISKERS
  ctx.beginPath();
  // Left whiskers
  ctx.moveTo(-8, 3.2);
  ctx.bezierCurveTo(-12, 3.0, -15, 2.2, -18, 1.8);
  ctx.moveTo(-8, 5.2);
  ctx.bezierCurveTo(-12, 5.8, -15, 6.8, -17, 7.8);
  // Right whiskers
  ctx.moveTo(8, 3.2);
  ctx.bezierCurveTo(12, 3.0, 15, 2.2, 18, 1.8);
  ctx.moveTo(8, 5.2);
  ctx.bezierCurveTo(12, 5.8, 15, 6.8, 17, 7.8);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 0.95;
  ctx.stroke();

  // ACCESSORIES
  drawAccessory(ctx, accessory);

  ctx.restore(); // end Head

  // 6. FRONT PAWS WITH PINK TOE BEAN PADS
  ctx.save();
  if (state === 'grooming') {
    // Face wash paw animation with pink beans
    const washAngle = Math.sin(groomPhase) * 0.6;
    ctx.save();
    ctx.translate(2, headY + 4);
    ctx.rotate(washAngle);
    ctx.beginPath();
    ctx.ellipse(4, -4, 4.2, 3.2, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Pink paw pad
    ctx.beginPath();
    ctx.arc(4, -4, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = padColor;
    ctx.fill();
    ctx.restore();
  } else {
    // Normal front paws
    const frontStep1 = state === 'walking' ? -Math.sin(walkPhase) * 2.8 : 0;
    const frontStep2 = state === 'walking' ? Math.sin(walkPhase) * 2.8 : 0;

    // Left Front Paw
    ctx.beginPath();
    ctx.ellipse(-4 + frontStep1, -2, 3.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = breed === 'luna' ? '#F8FAFC' : bodyColor;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // Right Front Paw
    ctx.beginPath();
    ctx.ellipse(4 + frontStep2, -2, 3.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = breed === 'luna' ? '#F8FAFC' : bodyColor;
    ctx.fill();
    ctx.stroke();
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
    // Cozy Knitted Winter Scarf with Fringe
    ctx.save();
    ctx.translate(0, 10);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#991B1B';
    ctx.stroke();

    // Scarf tail
    ctx.beginPath();
    ctx.rect(-7, 2, 4.5, 8.5);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.stroke();

    // Fringe
    ctx.beginPath();
    ctx.moveTo(-7, 10.5);
    ctx.lineTo(-2.5, 10.5);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
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
  }
}

// -------------------------------------------------------------
// 💬 CHAT SPEECH BUBBLE RENDERER
// -------------------------------------------------------------
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 11px sans-serif';

  const metrics = ctx.measureText(text);
  const paddingX = 10;
  const paddingY = 6;
  const width = metrics.width + paddingX * 2;
  const height = 22;
  const bubbleX = x - width / 2;
  const bubbleY = y - height;

  // Bubble background
  ctx.beginPath();
  const radius = 10;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bubbleX, bubbleY, width, height, radius);
  } else {
    ctx.rect(bubbleX, bubbleY, width, height);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
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
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fill();

  // Text
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1E1E24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, bubbleY + height / 2);
  ctx.restore();
}
