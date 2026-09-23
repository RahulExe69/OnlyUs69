import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ThreeDThemeBackground } from './ThreeDThemeBackground';
import { getThemeDualTone } from '../lib/themes';
import { UserProfile } from '../types';
import { Heart, Sparkles } from 'lucide-react';

interface ShaderWelcomeBackProps {
  userProfile?: UserProfile | null;
  partnerProfile?: UserProfile | null;
  isOwner?: boolean;
  isPartner?: boolean;
  themeName?: string | null;
  onFinish?: () => void;
  duration?: number;
}

export const ShaderWelcomeBack: React.FC<ShaderWelcomeBackProps> = ({
  userProfile,
  partnerProfile,
  isOwner = false,
  isPartner = false,
  themeName,
  onFinish,
  duration = 2400,
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
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 450);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFinish();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, triggerFinish]);

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
      onClick={triggerFinish}
      className={`fixed inset-0 z-[99999] flex items-center justify-center cursor-pointer select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: dualTone.bg,
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      {/* 1. Real Hardware-Accelerated 3D WebGL Shader Engine */}
      <ThreeDThemeBackground 
        theme={activeTheme} 
        className="absolute inset-0 pointer-events-none z-0 overflow-hidden" 
      />

      {/* 2. Theme-Responsive Dual-Tone Radial Atmospheric Glow */}
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-700"
        style={{
          background: isDark
            ? `radial-gradient(ellipse 90% 70% at 50% 40%, ${dualTone.glow1} 0%, transparent 70%), radial-gradient(ellipse 80% 60% at 50% 85%, ${dualTone.glow2} 0%, transparent 65%)`
            : `radial-gradient(ellipse 90% 70% at 50% 40%, ${dualTone.glow1} 0%, transparent 70%), radial-gradient(ellipse 80% 60% at 50% 85%, ${dualTone.glow2} 0%, transparent 65%)`,
          backgroundColor: isDark ? 'rgba(8, 6, 14, 0.42)' : 'rgba(255, 255, 255, 0.32)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* 3. Romantic Glassmorphic Sanctuary Welcome Card */}
      <div 
        className={`relative z-20 max-w-sm w-full mx-5 px-6 py-8 rounded-[2rem] border shadow-2xl flex flex-col items-center text-center transition-all duration-500 transform ${
          isFadingOut ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{
          background: isDark 
            ? 'rgba(18, 14, 28, 0.65)' 
            : 'rgba(255, 255, 255, 0.78)',
          borderColor: isDark 
            ? 'rgba(255, 255, 255, 0.12)' 
            : 'rgba(255, 255, 255, 0.85)',
          boxShadow: isDark
            ? `0 24px 60px -12px rgba(0, 0, 0, 0.65), 0 0 40px -10px ${dualTone.glow}`
            : `0 24px 60px -12px ${dualTone.glow}, 0 0 30px -5px rgba(255, 255, 255, 0.9)`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Symmetrical Dual-Avatar Heart Bridge */}
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

          {/* Animated Connecting Heart */}
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

        {/* Dynamic Welcome Heading */}
        <div className="space-y-2 mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border backdrop-blur-md mb-1"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              color: isDark ? '#E5E7EB' : '#374151',
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: dualTone.color1 }} />
            <span>Our Private Sanctuary</span>
          </div>

          <h2 
            className="text-2xl font-bold tracking-tight"
            style={{
              background: `linear-gradient(135deg, ${dualTone.color1} 0%, ${dualTone.color2} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: isDark ? `0 0 30px ${dualTone.glow}` : 'none',
            }}
          >
            Welcome back, {currentUserName}
          </h2>

          <p 
            className="text-xs font-medium tracking-wide max-w-[240px] mx-auto leading-relaxed"
            style={{
              color: isDark ? 'rgba(240, 235, 245, 0.72)' : 'rgba(55, 40, 60, 0.75)',
            }}
          >
            Your shared space with {partnerName} is ready and waiting for you.
          </p>
        </div>

        {/* Subtle Tap-to-Enter Pill */}
        <div 
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium tracking-wider border backdrop-blur-md shadow-sm transition-all duration-300"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.06)',
            color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
          }}
        >
          <span>Entering sanctuary...</span>
          <span className="text-[9px] opacity-60">tap to skip</span>
        </div>
      </div>
    </div>
  );
};

export default ShaderWelcomeBack;
