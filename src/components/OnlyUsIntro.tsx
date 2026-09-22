import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getThemeDualTone, ThemeDualTone } from '../lib/themes';

interface OnlyUsIntroProps {
  onFinish?: () => void;
  ready?: boolean;
  minDuration?: number;
  themeName?: string | null;
}

// Pure individual letter vector paths for "OnlyUs" with clean contours (zero font overlaps or variable-font construction loops across all devices)
const ONLYUS_LETTERS = [
  {
    id: 'O',
    d: 'M259.98 112.09Q259.98 123.21 256.68 132.31Q253.38 141.40 247.18 147.87Q240.98 154.34 232.05 157.84Q223.12 161.35 211.87 161.35Q199.94 161.35 191.01 157.68Q182.08 154 176.09 147.43Q170.09 140.86 167.09 131.83Q164.09 122.80 164.09 112.09Q164.09 100.97 167.23 92.01Q170.36 83.05 176.46 76.75Q182.56 70.45 191.48 67.05Q200.41 63.64 212 63.64Q223.59 63.64 232.52 67.08Q241.45 70.52 247.55 76.85Q253.64 83.18 256.81 92.11Q259.98 101.04 259.98 112.09ZM239.70 112.09Q239.70 104.61 237.91 98.58Q236.13 92.55 232.62 88.24Q229.12 83.92 223.96 81.60Q218.81 79.28 212 79.28Q205.06 79.28 199.84 81.60Q194.62 83.92 191.11 88.24Q187.61 92.55 185.86 98.58Q184.11 104.61 184.11 112.09Q184.11 119.50 185.89 125.67Q187.68 131.83 191.18 136.28Q194.68 140.73 199.87 143.22Q205.06 145.71 211.87 145.71Q219.14 145.71 224.40 143.19Q229.66 140.66 233.06 136.18Q236.46 131.70 238.08 125.53Q239.70 119.37 239.70 112.09Z',
  },
  {
    id: 'n',
    d: 'M341.51 160L322.64 160L322.64 119.10Q322.64 114.85 321.97 111.32Q321.30 107.78 319.75 105.25Q318.20 102.72 315.70 101.31Q313.21 99.89 309.64 99.89Q306.20 99.89 303.41 101.41Q300.61 102.93 298.59 105.72Q296.57 108.52 295.46 112.39Q294.34 116.27 294.34 120.92L294.34 160L275.41 160L275.41 103.40Q275.41 101.04 275.38 98.55Q275.34 96.05 275.24 93.80Q275.14 91.54 275.07 89.75Q275 87.97 274.87 87.09L292.93 87.09Q293.06 87.90 293.20 89.69Q293.33 91.47 293.47 93.63Q293.60 95.78 293.70 97.94Q293.80 100.10 293.80 101.58L294.07 101.58Q297.92 93.22 303.71 89.45Q309.50 85.68 317.52 85.68Q324.13 85.68 328.68 87.83Q333.22 89.99 336.09 93.76Q338.95 97.54 340.23 102.66Q341.51 107.78 341.51 113.71Z',
  },
  {
    id: 'l',
    d: 'M359.71 60L359.71 160L378.64 160L378.64 60Z',
  },
  {
    id: 'y',
    d: 'M409.50 87.09L427.76 143.76L444.61 87.09L464.42 87.09L435.58 163.84Q430.12 177.12 424.26 182.64Q417.86 188.64 407.48 188.64Q400.67 188.64 395.55 187.76L395.55 174.29Q399.12 174.82 401.99 174.82Q404.85 174.82 407.01 174.22Q409.16 173.61 410.92 172.20Q414.35 169.37 417.12 162.49L418.33 159.26L389.49 87.09Z',
  },
  {
    id: 'U',
    d: 'M513.88 161.35Q504.98 161.35 497.57 159.23Q490.16 157.10 484.80 152.62Q479.44 148.14 476.45 141.13Q473.45 134.13 473.45 124.42L473.45 65.06L493.33 65.06L493.33 122.87Q493.33 128.87 494.81 133.22Q496.29 137.56 499.05 140.36Q501.82 143.15 505.72 144.47Q509.63 145.78 514.42 145.78Q519.27 145.78 523.34 144.40Q527.42 143.02 530.35 140.12Q533.28 137.22 534.90 132.78Q536.52 128.33 536.52 122.20L536.52 65.06L556.40 65.06L556.40 123.41Q556.40 133.18 553.23 140.32Q550.06 147.47 544.40 152.15Q538.74 156.83 530.96 159.09Q523.18 161.35 513.88 161.35Z',
  },
  {
    id: 's',
    d: 'M635.91 138.71Q635.91 143.96 633.72 148.14Q631.53 152.32 627.35 155.25Q623.17 158.18 617.11 159.76Q611.04 161.35 603.29 161.35Q596.35 161.35 590.76 160.34Q585.17 159.33 580.96 157Q576.75 154.68 573.92 150.97Q571.08 147.26 569.67 141.81L586.31 139.31Q587.12 142.35 588.54 144.23Q589.95 146.12 592.04 147.13Q594.13 148.14 596.93 148.48Q599.72 148.81 603.29 148.81Q606.53 148.81 609.32 148.44Q612.12 148.07 614.18 147.16Q616.23 146.25 617.38 144.60Q618.52 142.95 618.52 140.46Q618.52 137.63 616.87 135.98Q615.22 134.33 612.36 133.28Q609.49 132.24 605.62 131.46Q601.74 130.69 597.36 129.68Q592.78 128.67 588.33 127.25Q583.89 125.84 580.38 123.41Q576.88 120.99 574.72 117.25Q572.57 113.51 572.57 107.78Q572.57 102.59 574.59 98.51Q576.61 94.44 580.52 91.57Q584.43 88.71 590.19 87.19Q595.95 85.68 603.43 85.68Q609.36 85.68 614.48 86.79Q619.60 87.90 623.64 90.29Q627.69 92.68 630.42 96.39Q633.14 100.10 634.22 105.35L617.44 107.10Q616.97 104.48 615.76 102.76Q614.55 101.04 612.76 100.03Q610.98 99.02 608.62 98.65Q606.26 98.28 603.43 98.28Q596.69 98.28 593.32 100Q589.95 101.71 589.95 105.76Q589.95 108.25 591.33 109.73Q592.71 111.21 595.24 112.19Q597.77 113.17 601.24 113.88Q604.71 114.58 608.82 115.59Q613.87 116.67 618.76 118.12Q623.64 119.57 627.45 122.10Q631.26 124.62 633.58 128.60Q635.91 132.58 635.91 138.71Z',
  },
];

export function OnlyUsIntro({ onFinish, ready = true, minDuration = 2200, themeName }: OnlyUsIntroProps) {
  const letterRefs = useRef<(SVGPathElement | null)[]>([]);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const minTimeElapsedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  
  // Stabilize props in refs so effect NEVER restarts when parent re-renders or ready status changes
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Accurate active theme resolution locked on mount so the intro NEVER flickers or mutates mid-playback
  const [currentThemeKey] = useState<string>(() => {
    if (themeName) return themeName;
    if (typeof window !== 'undefined') {
      const docTheme = document.documentElement.dataset.chatTheme;
      if (docTheme) return docTheme;
      const localTheme = localStorage.getItem('onlyus_chat_theme');
      if (localTheme) return localTheme;
      try {
        const cached = localStorage.getItem('onlyus_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.theme) return parsed.theme;
        }
      } catch (e) {}
    }
    return '3d-dark';
  });
  const dualTone = getThemeDualTone(currentThemeKey);
  const isDark = dualTone.isDark;

  const triggerFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 550);
  }, []);

  // Stroke drawing animation - draws ALL letters in parallel simultaneously for the authentic unhurried vibe
  useEffect(() => {
    let animationFrameId = 0;
    let isCancelled = false;

    const startDrawing = () => {
      const paths = letterRefs.current.filter((p): p is SVGPathElement => Boolean(p));
      if (paths.length === 0 || isCancelled) return;

      const lengths = paths.map((path) => {
        try {
          return Math.ceil(path.getTotalLength());
        } catch (_) {
          return 800;
        }
      });

      paths.forEach((path, idx) => {
        const len = lengths[idx];
        path.style.strokeDasharray = `${len} ${len}`;
        path.style.strokeDashoffset = String(len);
      });

      const duration = 1800;
      const startTime = performance.now();

      function tick(now: number) {
        if (isCancelled) return;
        const elapsed = now - startTime;
        
        // Clamp p to [0, 1] for smooth, continuous completion without sudden snap
        const p = Math.min(1, Math.max(0, elapsed / duration));

        // Smooth cubic ease-in-out curve
        const eased = p < 0.5
          ? 2 * p * p
          : 1 - Math.pow(-2 * p + 2, 2) / 2;

        paths.forEach((path, idx) => {
          const len = lengths[idx];
          path.style.strokeDashoffset = String(len * (1 - eased));
        });

        // Continue holding complete state until fade out
        animationFrameId = requestAnimationFrame(tick);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    // Vector glyphs are ready synchronously on mount
    startDrawing();

    // Minimum duration before letting app transition out
    const timer = setTimeout(() => {
      minTimeElapsedRef.current = true;
      if (readyRef.current) {
        triggerFinish();
      }
    }, minDuration);

    // Absolute fail-safe max timer: dismiss intro after 2.5s regardless of network/loading state
    const maxTimer = setTimeout(() => {
      triggerFinish();
    }, Math.max(minDuration + 300, 2500));

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      clearTimeout(maxTimer);
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
        isDark ? 'ou-dark' : 'ou-light'
      } ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: dualTone.bg,
        colorScheme: isDark ? 'dark' : 'light',
        ['--ou-main' as any]: dualTone.color2,
        ['--ou-main2' as any]: dualTone.color1,
        ['--ou-drop-shadow' as any]: dualTone.glow,
        ['--ou-bg' as any]: dualTone.bg,
        ['--ou-bg-glow-1' as any]: dualTone.glow1,
        ['--ou-bg-glow-2' as any]: dualTone.glow2,
      }}
    >
      <style>{`
        #onlyus-intro-screen {
          transition: opacity .55s ease;
        }

        #onlyus-intro-screen.ou-dark {
          --ou-pill-bg: rgba(18, 14, 24, 0.48);
          --ou-pill-border: rgba(255, 255, 255, 0.08);
          --ou-pill-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.4);
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, var(--ou-bg-glow-1), transparent 68%),
            radial-gradient(ellipse 75% 55% at 85% 110%, var(--ou-bg-glow-2), transparent 68%),
            var(--ou-bg);
        }

        #onlyus-intro-screen.ou-light {
          --ou-pill-bg: rgba(255, 255, 255, 0.85);
          --ou-pill-border: var(--ou-bg-glow-1);
          --ou-pill-shadow: 0 4px 16px -2px var(--ou-drop-shadow), inset 0 1px 1px rgba(255, 255, 255, 0.95);
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, var(--ou-bg-glow-1), transparent 68%),
            radial-gradient(ellipse 75% 55% at 85% 110%, var(--ou-bg-glow-2), transparent 68%),
            var(--ou-bg);
        }

        .ou-hero {
          width: 100%;
          max-width: 860px;
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
          width: min(84vw, 620px);
          height: auto;
          overflow: visible;
          display: block;
        }

        .ou-logo-path {
          fill: none;
          stroke: url(#onlyUsIntroGradient);
          stroke-width: 3.1;
          stroke-linejoin: round;
          stroke-linecap: round;
          filter: drop-shadow(0 0 9px var(--ou-drop-shadow));
        }

        /* Centered at the middle bottom of the screen - subtle & understated */
        .ou-made-bottom {
          position: absolute;
          left: 0;
          right: 0;
          bottom: max(32px, env(safe-area-inset-bottom, 28px));
          margin: 0 auto;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          pointer-events: none;
          opacity: 0;
          animation: ouFadeUp .8s cubic-bezier(.22,1,.36,1) .6s forwards;
        }

        .ou-made-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 14px;
          border-radius: 9999px;
          background: var(--ou-pill-bg);
          border: 1px solid var(--ou-pill-border);
          box-shadow: var(--ou-pill-shadow);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .ou-made-text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(11px, 2.4vw, 13px);
          font-weight: 600;
          letter-spacing: .16em;
          text-align: center;
          white-space: nowrap;
        }

        .ou-dark .ou-made-text {
          color: rgba(255, 255, 255, 0.84);
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.72) 0%,
            rgba(255, 255, 255, 0.72) 38%,
            var(--ou-main2) 50%,
            #ffffff 54%,
            var(--ou-main) 58%,
            rgba(255, 255, 255, 0.72) 70%,
            rgba(255, 255, 255, 0.72) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ouSubtleSheen 5.5s ease-in-out infinite;
        }

        .ou-light .ou-made-text {
          color: #2e1c28;
          background: linear-gradient(
            110deg,
            rgba(46, 28, 40, 0.88) 0%,
            rgba(46, 28, 40, 0.88) 36%,
            var(--ou-main) 48%,
            var(--ou-main2) 52%,
            var(--ou-main) 56%,
            rgba(46, 28, 40, 0.88) 68%,
            rgba(46, 28, 40, 0.88) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
          animation: ouSubtleSheen 5.5s ease-in-out infinite;
        }

        .ou-made-text .ou-heart {
          display: inline-block;
          margin: 0 .22em;
          vertical-align: baseline;
          color: var(--ou-main, #ef3e73);
          -webkit-text-fill-color: var(--ou-main, #ef3e73);
          filter: drop-shadow(0 0 5px var(--ou-drop-shadow));
          animation: ouHeartbeat 1.8s ease-in-out infinite;
        }

        @keyframes ouSubtleSheen {
          0%, 25% { background-position: 100% 0%; }
          75%, 100% { background-position: -100% 0%; }
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
            transform: translateY(-2.5vh);
          }
          .ou-svg {
            width: min(86vw, 440px);
          }
          .ou-logo-path {
            stroke-width: 2.9;
          }
          .ou-made-bottom {
            bottom: max(24px, env(safe-area-inset-bottom, 20px));
          }
          .ou-made-text {
            font-size: 11px;
            letter-spacing: .12em;
          }
        }

        @media (max-width: 390px) {
          .ou-svg {
            width: min(88vw, 360px);
          }
          .ou-logo-path {
            stroke-width: 2.6;
          }
          .ou-made-bottom {
            bottom: max(20px, env(safe-area-inset-bottom, 16px));
          }
          .ou-made-text {
            font-size: 10.5px;
            letter-spacing: .09em;
          }
        }

        @media (orientation: landscape) and (max-height: 500px) {
          .ou-hero {
            transform: none;
          }
          .ou-svg {
            width: min(58vw, 420px);
          }
          .ou-logo-path {
            stroke-width: 2.6;
          }
          .ou-made-bottom {
            bottom: 12px;
          }
          .ou-made-text {
            font-size: 9.5px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ou-logo-wrap, .ou-made-bottom {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .ou-made-text, .ou-made-text .ou-heart {
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
              viewBox="0 0 800 240"
              role="img"
              aria-label="OnlyUs"
            >
              <defs>
                <linearGradient id="onlyUsIntroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={dualTone.color1} style={{ stopColor: dualTone.color1 }} />
                  <stop offset="100%" stopColor={dualTone.color2} style={{ stopColor: dualTone.color2 }} />
                </linearGradient>
              </defs>

              {ONLYUS_LETTERS.map((item, idx) => (
                <path
                  key={item.id}
                  ref={(el) => {
                    letterRefs.current[idx] = el;
                  }}
                  id={`logoLetter_${item.id}`}
                  className="ou-logo-path"
                  d={item.d}
                />
              ))}
            </svg>
          </div>
        </section>

        {/* Centered at the middle bottom of the screen */}
        <div className="ou-made-bottom">
          <span className="ou-made-pill">
            <span className="ou-made-text">
              MADE WITH <span className="ou-heart">❤️</span> FOR US
            </span>
          </span>
        </div>
      </main>
    </div>
  );
}

export default OnlyUsIntro;
