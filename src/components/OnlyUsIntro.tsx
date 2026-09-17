import React, { useEffect, useRef, useState, useCallback } from 'react';

interface OnlyUsIntroProps {
  onFinish?: () => void;
  ready?: boolean;
  minDuration?: number;
}

export function OnlyUsIntro({ onFinish, ready = true, minDuration = 3200 }: OnlyUsIntroProps) {
  const textRef = useRef<SVGTextElement | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const minTimeElapsedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  
  // Stablize props in refs so effect NEVER restarts when parent re-renders or ready status changes
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const triggerFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 550);
  }, []);

  // Stroke drawing animation - runs strictly ONCE on mount without restarting
  useEffect(() => {
    let animationFrameId = 0;
    let isCancelled = false;

    const startDrawing = () => {
      const text = textRef.current;
      if (!text || isCancelled) return;

      let length = 0;
      try {
        length = Math.ceil(text.getComputedTextLength() * 1.18);
      } catch (_) {
        length = 900;
      }
      length = Math.max(length, 700);

      text.style.strokeDasharray = `${length} ${length}`;
      text.style.strokeDashoffset = String(length);

      const duration = 3000;
      const startTime = performance.now();

      function tick(now: number) {
        if (isCancelled) return;
        const elapsed = now - startTime;
        
        // Clamp p to [0, 1] so it smoothly finishes drawing and never snaps back to 0
        const p = Math.min(1, Math.max(0, elapsed / duration));

        // Smooth cubic easing
        const eased = p < 0.5
          ? 2 * p * p
          : 1 - Math.pow(-2 * p + 2, 2) / 2;

        if (text) {
          text.style.strokeDashoffset = String(length * (1 - eased));
        }

        // Keep loop running so completion is held smoothly until fade out
        animationFrameId = requestAnimationFrame(tick);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(startDrawing).catch(startDrawing);
    } else {
      startDrawing();
    }

    // Min duration timer before allowing automatic transition
    const timer = setTimeout(() => {
      minTimeElapsedRef.current = true;
      if (readyRef.current) {
        triggerFinish();
      }
    }, minDuration);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [minDuration, triggerFinish]); // Stable dependencies: effect never tears down or restarts

  // Listen for ready status change without restarting the drawing effect
  useEffect(() => {
    if (ready && minTimeElapsedRef.current) {
      triggerFinish();
    }
  }, [ready, triggerFinish]);

  return (
    <div
      id="onlyus-intro-screen"
      onClick={triggerFinish}
      className={`fixed inset-0 z-[99999] flex items-center justify-center cursor-pointer select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'var(--ou-bg, #0b090e)',
        colorScheme: 'light dark',
      }}
    >
      <style>{`
        #onlyus-intro-screen {
          --ou-bg: #0b090e;
          --ou-bg-glow-1: rgba(240, 147, 251, .11);
          --ou-bg-glow-2: rgba(245, 87, 108, .08);
          --ou-main: #ff4f8b;
          --ou-main2: #c66cff;
          --ou-muted: rgba(255,255,255,.62);
          --ou-line: rgba(255,255,255,.38);
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, var(--ou-bg-glow-1), transparent 68%),
            radial-gradient(ellipse 75% 55% at 85% 110%, var(--ou-bg-glow-2), transparent 68%),
            var(--ou-bg);
          transition: background-color .35s ease, opacity .55s ease;
        }

        @media (prefers-color-scheme: light) {
          #onlyus-intro-screen {
            --ou-bg: #f8f7fb;
            --ou-bg-glow-1: rgba(196, 84, 255, .12);
            --ou-bg-glow-2: rgba(255, 73, 125, .10);
            --ou-main: #c51f69;
            --ou-main2: #7037c8;
            --ou-muted: rgba(25,20,30,.62);
            --ou-line: rgba(30,25,35,.32);
          }
        }

        .ou-hero {
          width: 100%;
          max-width: 1180px;
          padding: 20px;
          text-align: center;
          transform: translateY(-2vh);
        }

        .ou-logo-wrap {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: ouAppear .9s cubic-bezier(.22,1,.36,1) both;
        }

        .ou-svg {
          width: min(94vw, 1080px);
          height: auto;
          overflow: visible;
          display: block;
        }

        .ou-logo-text {
          fill: none;
          stroke: url(#onlyUsIntroGradient);
          stroke-width: 3.2;
          stroke-linejoin: round;
          stroke-linecap: round;
          font-size: 166px;
          font-weight: 700;
          font-family: Arial, Helvetica, sans-serif;
          letter-spacing: .015em;
          filter: drop-shadow(0 0 10px rgba(255, 79, 139, 0.28));
        }

        /* Centered at the very bottom of the screen */
        .ou-made-bottom {
          position: absolute;
          left: 50%;
          bottom: max(32px, env(safe-area-inset-bottom, 28px));
          transform: translateX(-50%);
          margin: 0;
          color: var(--ou-muted);
          font-size: clamp(12px, 2.6vw, 16px);
          font-weight: 500;
          letter-spacing: .15em;
          text-align: center;
          white-space: nowrap;
          opacity: 0;
          animation: ouFadeUp .8s cubic-bezier(.22,1,.36,1) .6s forwards;
          font-family: Arial, Helvetica, sans-serif;
          z-index: 20;
          pointer-events: none;
        }

        .ou-made-bottom .ou-heart {
          display: inline-block;
          color: #ef3e73;
          margin: 0 .12em;
          animation: ouHeartbeat 1.8s ease-in-out infinite;
        }

        @keyframes ouAppear {
          from { opacity: 0; transform: scale(.96); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes ouFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes ouHeartbeat {
          0%, 100% { transform: scale(1); }
          12% { transform: scale(1.15); }
          24% { transform: scale(1); }
        }

        @media (max-width: 600px) {
          .ou-hero {
            padding: 12px;
            transform: translateY(-3vh);
          }
          .ou-svg {
            width: 96vw;
          }
          .ou-logo-text {
            font-size: 150px;
            stroke-width: 3;
          }
          .ou-made-bottom {
            bottom: max(24px, env(safe-area-inset-bottom, 20px));
            letter-spacing: .1em;
          }
        }

        @media (max-width: 390px) {
          .ou-logo-text {
            font-size: 136px;
            stroke-width: 2.8;
          }
          .ou-made-bottom {
            font-size: 11px;
            bottom: max(20px, env(safe-area-inset-bottom, 16px));
          }
        }

        @media (orientation: landscape) and (max-height: 500px) {
          .ou-hero {
            transform: none;
          }
          .ou-svg {
            width: min(72vw, 700px);
          }
          .ou-logo-text {
            font-size: 120px;
          }
          .ou-made-bottom {
            bottom: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ou-logo-wrap, .ou-made-bottom {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .ou-made-bottom .ou-heart {
            animation: none;
          }
        }
      `}</style>

      <main className="w-full h-full min-h-[100dvh] flex items-center justify-center relative overflow-hidden">
        {/* Centered logo */}
        <section className="ou-hero" aria-label="OnlyUs introduction">
          <div className="ou-logo-wrap">
            <svg
              className="ou-svg"
              viewBox="0 0 860 240"
              role="img"
              aria-label="OnlyUs"
            >
              <defs>
                <linearGradient id="onlyUsIntroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--ou-main2, #c66cff)" />
                  <stop offset="100%" stopColor="var(--ou-main, #ff4f8b)" />
                </linearGradient>
              </defs>

              <text
                ref={textRef}
                id="logoText"
                className="ou-logo-text"
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                OnlyUs
              </text>
            </svg>
          </div>
        </section>

        {/* Pinned at the bottom of the screen */}
        <p className="ou-made-bottom">
          MADE WITH <span className="ou-heart">❤️</span> FOR US
        </p>
      </main>
    </div>
  );
}

export default OnlyUsIntro;
