import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ThreeDThemeBackground } from './ThreeDThemeBackground';
import { getThemeDualTone } from '../lib/themes';
import { UserProfile } from '../types';
import { Heart } from 'lucide-react';

interface ShaderWelcomeBackProps {
  userProfile?: UserProfile | null;
  partnerProfile?: UserProfile | null;
  isOwner?: boolean;
  isPartner?: boolean;
  themeName?: string | null;
  isAuthenticating?: boolean;
  onFinish?: () => void;
  duration?: number;
}

export const ShaderWelcomeBack: React.FC<ShaderWelcomeBackProps> = ({
  userProfile,
  partnerProfile,
  isOwner = false,
  isPartner = false,
  themeName,
  isAuthenticating = false,
  onFinish,
  duration = 2000,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Determine active theme (falling back to cached or romantic/sakura blossom)
  const [activeTheme] = useState<string>(() => {
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
          if (parsed?.theme) return parsed.theme;
        }
      } catch {}
    }
    return '3d-romantic';
  });

  const dualTone = getThemeDualTone(activeTheme);
  const isDark = dualTone.isDark;

  const triggerFinish = useCallback(() => {
    if (isAuthenticating) return; // Do NOT dismiss while authentication is resolving!
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 450);
  }, [isAuthenticating]);

  // Once authenticated (or if not authenticating), run auto-finish timer
  useEffect(() => {
    if (isAuthenticating) return;

    const timer = setTimeout(() => {
      triggerFinish();
    }, duration);

    return () => clearTimeout(timer);
  }, [isAuthenticating, duration, triggerFinish]);

  // Determine names and greetings
  const currentUserName = isPartner
    ? (userProfile?.display_name || 'Nusrat')
    : (userProfile?.display_name || 'Rahul');

  const partnerName = isPartner
    ? (partnerProfile?.display_name || 'Rahul')
    : (partnerProfile?.display_name || 'Nusrat');

  const currentUserPhoto = userProfile?.photo_url || (isPartner
    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
    : 'https://lh3.googleusercontent.com/a/ACg8ocK_glO-zvZsP06dotj-OZalDvjF6evoVbACaQkPth8cSU6nuos=s96-c');

  const partnerPhoto = partnerProfile?.photo_url || (isPartner
    ? 'https://lh3.googleusercontent.com/a/ACg8ocK_glO-zvZsP06dotj-OZalDvjF6evoVbACaQkPth8cSU6nuos=s96-c'
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256');

  return (
    <div
      id="onlyus-welcome-back-screen"
      onClick={() => {
        if (!isAuthenticating) triggerFinish();
      }}
      className={`fixed inset-0 z-[99999] flex items-center justify-center cursor-pointer select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isDark ? 'wb-dark' : 'wb-light'
      } ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: dualTone.bg,
        colorScheme: isDark ? 'dark' : 'light',
        ['--wb-main' as any]: dualTone.color2,
        ['--wb-main2' as any]: dualTone.color1,
        ['--wb-drop-shadow' as any]: dualTone.glow,
        ['--wb-bg' as any]: dualTone.bg,
        ['--wb-bg-glow-1' as any]: dualTone.glow1,
        ['--wb-bg-glow-2' as any]: dualTone.glow2,
      }}
    >
      <style>{`
        #onlyus-welcome-back-screen {
          transition: opacity .55s ease;
        }

        #onlyus-welcome-back-screen.wb-dark {
          --wb-card-bg: rgba(16, 12, 24, 0.58);
          --wb-card-border: rgba(255, 255, 255, 0.1);
          --wb-pill-bg: rgba(18, 14, 24, 0.52);
          --wb-pill-border: rgba(255, 255, 255, 0.12);
          --wb-pill-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.4);
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, var(--wb-bg-glow-1), transparent 68%),
            radial-gradient(ellipse 75% 55% at 85% 110%, var(--wb-bg-glow-2), transparent 68%),
            var(--wb-bg);
        }

        #onlyus-welcome-back-screen.wb-light {
          --wb-card-bg: rgba(255, 255, 255, 0.78);
          --wb-card-border: rgba(255, 255, 255, 0.85);
          --wb-pill-bg: rgba(255, 255, 255, 0.85);
          --wb-pill-border: var(--wb-bg-glow-1);
          --wb-pill-shadow: 0 4px 16px -2px var(--wb-drop-shadow), inset 0 1px 1px rgba(255, 255, 255, 0.95);
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, var(--wb-bg-glow-1), transparent 68%),
            radial-gradient(ellipse 75% 55% at 85% 110%, var(--wb-bg-glow-2), transparent 68%),
            var(--wb-bg);
        }

        .wb-card {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: var(--wb-card-bg);
          border: 1px solid var(--wb-card-border);
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.4), 0 0 35px -8px var(--wb-drop-shadow);
          animation: wbAppear .7s cubic-bezier(.22,1,.36,1) both;
        }

        .wb-sheen-title {
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 700;
          letter-spacing: .16em;
          text-align: center;
          white-space: nowrap;
          text-transform: uppercase;
        }

        .wb-dark .wb-sheen-title {
          color: rgba(255, 255, 255, 0.92);
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.8) 0%,
            rgba(255, 255, 255, 0.8) 35%,
            var(--wb-main2) 48%,
            #ffffff 52%,
            var(--wb-main) 56%,
            rgba(255, 255, 255, 0.8) 68%,
            rgba(255, 255, 255, 0.8) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wbSubtleSheen 5s ease-in-out infinite;
        }

        .wb-light .wb-sheen-title {
          color: #2e1c28;
          background: linear-gradient(
            110deg,
            rgba(46, 28, 40, 0.88) 0%,
            rgba(46, 28, 40, 0.88) 34%,
            var(--wb-main) 48%,
            var(--wb-main2) 52%,
            var(--wb-main) 56%,
            rgba(46, 28, 40, 0.88) 68%,
            rgba(46, 28, 40, 0.88) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
          animation: wbSubtleSheen 5s ease-in-out infinite;
        }

        .wb-sheen-name {
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 800;
          letter-spacing: .12em;
          text-align: center;
          text-transform: uppercase;
        }

        .wb-dark .wb-sheen-name {
          background: linear-gradient(135deg, var(--wb-main2), var(--wb-main));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px var(--wb-drop-shadow));
        }

        .wb-light .wb-sheen-name {
          background: linear-gradient(135deg, var(--wb-main), var(--wb-main2));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
        }

        .wb-made-bottom {
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
          animation: wbFadeUp .8s cubic-bezier(.22,1,.36,1) .4s forwards;
        }

        .wb-made-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 16px;
          border-radius: 9999px;
          background: var(--wb-pill-bg);
          border: 1px solid var(--wb-pill-border);
          box-shadow: var(--wb-pill-shadow);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .wb-made-text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(10px, 2.3vw, 12px);
          font-weight: 600;
          letter-spacing: .16em;
          text-align: center;
          white-space: nowrap;
        }

        .wb-dark .wb-made-text {
          color: rgba(255, 255, 255, 0.84);
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.72) 0%,
            rgba(255, 255, 255, 0.72) 38%,
            var(--wb-main2) 50%,
            #ffffff 54%,
            var(--wb-main) 58%,
            rgba(255, 255, 255, 0.72) 70%,
            rgba(255, 255, 255, 0.72) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wbSubtleSheen 5.5s ease-in-out infinite;
        }

        .wb-light .wb-made-text {
          color: #2e1c28;
          background: linear-gradient(
            110deg,
            rgba(46, 28, 40, 0.88) 0%,
            rgba(46, 28, 40, 0.88) 36%,
            var(--wb-main) 48%,
            var(--wb-main2) 52%,
            var(--wb-main) 56%,
            rgba(46, 28, 40, 0.88) 68%,
            rgba(46, 28, 40, 0.88) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
          animation: wbSubtleSheen 5.5s ease-in-out infinite;
        }

        .wb-heart {
          display: inline-block;
          margin: 0 .22em;
          vertical-align: baseline;
          color: var(--wb-main2, #ef3e73);
          -webkit-text-fill-color: var(--wb-main2, #ef3e73);
          filter: drop-shadow(0 0 6px var(--wb-drop-shadow));
          animation: wbHeartbeat 1.8s ease-in-out infinite;
        }

        @keyframes wbSubtleSheen {
          0%, 25% { background-position: 100% 0%; }
          75%, 100% { background-position: -100% 0%; }
        }

        @keyframes wbHeartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.18); }
          28% { transform: scale(1); }
          42% { transform: scale(1.14); }
          70% { transform: scale(1); }
        }

        @keyframes wbAppear {
          from { opacity: 0; transform: scale(.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes wbFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 1. Real Hardware-Accelerated 3D WebGL Shader Engine */}
      <ThreeDThemeBackground 
        theme={activeTheme} 
        className="absolute inset-0 pointer-events-none z-0 overflow-hidden" 
      />

      {/* 2. Central Sanctuary Glass Card */}
      <div 
        className={`wb-card relative z-20 max-w-sm w-full mx-5 px-7 py-8 rounded-[2rem] flex flex-col items-center text-center transition-all duration-500 transform ${
          isFadingOut ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Connected Couple Bridge */}
        <div className="flex items-center justify-center mb-6 relative">
          {/* User Avatar */}
          <div className="relative group">
            <div 
              className="w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300"
              style={{
                background: `linear-gradient(135deg, ${dualTone.color1}, ${dualTone.color2})`,
                boxShadow: `0 0 16px ${dualTone.glow}`,
              }}
            >
              <img 
                src={currentUserPhoto} 
                alt={currentUserName}
                className="w-full h-full object-cover rounded-full bg-neutral-900"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border text-white shadow-sm"
              style={{
                backgroundColor: dualTone.color1,
                borderColor: 'rgba(255, 255, 255, 0.25)',
              }}
            >
              {currentUserName}
            </div>
          </div>

          {/* Symmetrical Heart Connector */}
          <div className="mx-4 relative flex items-center justify-center">
            <div 
              className="absolute w-8 h-[2px] -left-2 top-1/2 -translate-y-1/2"
              style={{
                background: `linear-gradient(to right, ${dualTone.color1}, ${dualTone.color2})`,
                opacity: 0.6,
              }}
            />
            <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center bg-black/20 dark:bg-white/10 backdrop-blur-md border border-white/20 shadow-md">
              <Heart 
                className="w-5 h-5 animate-pulse" 
                style={{ 
                  color: dualTone.color1, 
                  fill: dualTone.color1,
                  filter: `drop-shadow(0 0 8px ${dualTone.glow})`,
                }} 
              />
            </div>
            <div 
              className="absolute w-8 h-[2px] -right-2 top-1/2 -translate-y-1/2"
              style={{
                background: `linear-gradient(to right, ${dualTone.color1}, ${dualTone.color2})`,
                opacity: 0.6,
              }}
            />
          </div>

          {/* Partner Avatar */}
          <div className="relative group">
            <div 
              className="w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300"
              style={{
                background: `linear-gradient(135deg, ${dualTone.color2}, ${dualTone.color1})`,
                boxShadow: `0 0 16px ${dualTone.glow}`,
              }}
            >
              <img 
                src={partnerPhoto} 
                alt={partnerName}
                className="w-full h-full object-cover rounded-full bg-neutral-900"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border text-white shadow-sm"
              style={{
                backgroundColor: dualTone.color2,
                borderColor: 'rgba(255, 255, 255, 0.25)',
              }}
            >
              {partnerName}
            </div>
          </div>
        </div>

        {/* Website-Intro Styled Typography */}
        <div className="space-y-1.5 mb-2">
          <div className="wb-sheen-title text-sm tracking-[0.2em] opacity-90">
            {isAuthenticating ? 'ENTERING SANCTUARY' : 'WELCOME BACK'}
          </div>

          <div className="wb-sheen-name text-2xl tracking-[0.14em]">
            {currentUserName} <span className="wb-heart">❤️</span>
          </div>

          <p 
            className="text-xs font-medium tracking-wide max-w-[240px] mx-auto pt-1 leading-relaxed opacity-75"
            style={{
              color: isDark ? 'rgba(240, 235, 245, 0.75)' : 'rgba(55, 40, 60, 0.75)',
            }}
          >
            {isAuthenticating 
              ? 'Opening your private sanctuary...' 
              : `Connected with ${partnerName}`}
          </p>
        </div>
      </div>

      {/* 3. Bottom Pill styled exactly like Website Intro */}
      <div className="wb-made-bottom">
        <span className="wb-made-pill">
          <span className="wb-made-text">
            OUR PRIVATE SANCTUARY <span className="wb-heart">❤️</span> FOR US
          </span>
        </span>
      </div>
    </div>
  );
};

export default ShaderWelcomeBack;
