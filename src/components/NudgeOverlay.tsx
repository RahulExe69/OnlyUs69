import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, X, Send } from 'lucide-react';

export interface NudgeData {
  type: string;
  sender: string;
  isFromPartner?: boolean;
}

export interface NudgeOverlayProps {
  nudge: NudgeData;
  onDismiss?: () => void;
  onSendBack?: (type: string) => void;
}

interface FeelingConfig {
  label: string;
  emoji: string;
  actionText: string;
  selfActionText: string;
  accentColor: string;
  glowRgba: string;
  cornerGlowRgba: string;
  sparkles: string[];
}

const FEELING_CONFIGS: Record<string, FeelingConfig> = {
  kiss: {
    label: 'Sweet Kiss',
    emoji: '💋',
    actionText: 'blew you a sweet kiss',
    selfActionText: 'Sent a sweet kiss',
    accentColor: '#f43f5e',
    glowRgba: 'rgba(244, 63, 94, 0.42)',
    cornerGlowRgba: 'rgba(244, 63, 94, 0.28)',
    sparkles: ['💋', '✨', '🌸', '💕', '✨', '💋', '💖'],
  },
  blowkiss: {
    label: 'Flying Kiss',
    emoji: '😘',
    actionText: 'blew you a flying kiss',
    selfActionText: 'Sent a flying kiss',
    accentColor: '#ec4899',
    glowRgba: 'rgba(236, 72, 153, 0.42)',
    cornerGlowRgba: 'rgba(236, 72, 153, 0.28)',
    sparkles: ['😘', '💋', '✨', '💖', '✨', '🌸', '💕'],
  },
  love: {
    label: 'Love You',
    emoji: '💖',
    actionText: 'loves you with all their heart',
    selfActionText: 'Sent love and adoration',
    accentColor: '#ff4f8b',
    glowRgba: 'rgba(255, 79, 139, 0.42)',
    cornerGlowRgba: 'rgba(255, 79, 139, 0.28)',
    sparkles: ['💖', '💕', '✨', '🌸', '💗', '✨', '💖'],
  },
  hug: {
    label: 'Warm Hug',
    emoji: '🤗',
    actionText: 'sent you a warm, tight hug',
    selfActionText: 'Sent a warm hug',
    accentColor: '#f59e0b',
    glowRgba: 'rgba(245, 158, 11, 0.38)',
    cornerGlowRgba: 'rgba(245, 158, 11, 0.24)',
    sparkles: ['🤗', '✨', '💛', '🫂', '✨', '🌟', '🤗'],
  },
  cuddle: {
    label: 'Warm Cuddle',
    emoji: '🫂',
    actionText: 'wants to cuddle up with you',
    selfActionText: 'Sent cozy cuddles',
    accentColor: '#a855f7',
    glowRgba: 'rgba(168, 85, 247, 0.40)',
    cornerGlowRgba: 'rgba(168, 85, 247, 0.25)',
    sparkles: ['🫂', '💜', '✨', '🧸', '✨', '🌸', '🫂'],
  },
  miss: {
    label: 'Miss You',
    emoji: '🥺',
    actionText: 'misses you so very much',
    selfActionText: 'Thinking of you and missing you',
    accentColor: '#6366f1',
    glowRgba: 'rgba(99, 102, 241, 0.40)',
    cornerGlowRgba: 'rgba(99, 102, 241, 0.25)',
    sparkles: ['🥺', '💧', '✨', '💙', '🌙', '✨', '🥺'],
  },
  tickle: {
    label: 'Tickle Attack!',
    emoji: '😂',
    actionText: 'is tickling you playfully!',
    selfActionText: 'Sent a playful tickle',
    accentColor: '#eab308',
    glowRgba: 'rgba(234, 179, 8, 0.38)',
    cornerGlowRgba: 'rgba(234, 179, 8, 0.24)',
    sparkles: ['😂', '✨', '💫', '💛', '🤭', '✨', '😂'],
  },
  adore: {
    label: 'Adore You',
    emoji: '😍',
    actionText: 'adores you endlessly',
    selfActionText: 'Sent endless adoration',
    accentColor: '#ef4444',
    glowRgba: 'rgba(239, 68, 68, 0.42)',
    cornerGlowRgba: 'rgba(239, 68, 68, 0.28)',
    sparkles: ['😍', '❤️', '✨', '🌹', '✨', '💖', '😍'],
  },
};

export const NudgeOverlay: React.FC<NudgeOverlayProps> = ({ nudge, onDismiss, onSendBack }) => {
  const config = FEELING_CONFIGS[nudge.type] || FEELING_CONFIGS.hug;
  const isFromPartner = nudge.isFromPartner ?? (nudge.sender !== 'You');
  const [hasSentBack, setHasSentBack] = useState(false);

  // Heartbeat haptic pulse on mount (simulating a lover's heartbeat: lub-dub... lub-dub)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate([60, 80, 60, 160, 60, 80, 60]);
      } catch (_) {}
    }
  }, [nudge.type]);

  const handleSendBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasSentBack) return;
    setHasSentBack(true);

    if (onSendBack) {
      onSendBack(nudge.type);
    }

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate([70, 70, 100]);
      } catch (_) {}
    }

    // Dismiss gently after showing sent confirmation
    setTimeout(() => {
      onDismiss?.();
    }, 900);
  };

  // 8 staggered stardust / petal particles that float smoothly with GPU acceleration
  const particles = [
    { x: -90, y: -70, scale: 1.1, delay: 0 },
    { x: 80, y: -80, scale: 1.2, delay: 0.12 },
    { x: -110, y: 30, scale: 0.95, delay: 0.2 },
    { x: 100, y: 40, scale: 1.15, delay: 0.08 },
    { x: -40, y: -120, scale: 1.3, delay: 0.15 },
    { x: 50, y: -110, scale: 1.05, delay: 0.25 },
    { x: -60, y: 80, scale: 1.1, delay: 0.18 },
    { x: 70, y: 90, scale: 1.2, delay: 0.22 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between overflow-hidden select-none"
      onClick={onDismiss}
    >
      {/* 1. Romantic Edge-Lighting Aura Shader ("Lover's Touch Glow") */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          boxShadow: `inset 0 0 50px 8px ${config.glowRgba}`,
        }}
      >
        {/* Soft 4-corner ambient light orbs */}
        <div 
          className="absolute -top-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none"
          style={{ background: config.cornerGlowRgba }}
        />
        <div 
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none"
          style={{ background: config.cornerGlowRgba, animationDelay: '0.4s' }}
        />
        <div 
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none"
          style={{ background: config.cornerGlowRgba, animationDelay: '0.8s' }}
        />
        <div 
          className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none"
          style={{ background: config.cornerGlowRgba, animationDelay: '1.2s' }}
        />

        {/* Ambient Top & Bottom Living Light Shaders */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${config.accentColor} 50%, transparent 100%)`,
            boxShadow: `0 0 16px 2px ${config.accentColor}`,
            animation: 'nudge-top-light 2.8s ease-in-out infinite alternate',
          }}
        />
        <div 
          className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${config.accentColor} 50%, transparent 100%)`,
            boxShadow: `0 0 16px 2px ${config.accentColor}`,
            animation: 'nudge-bottom-light 2.8s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* 2. Floating Feeling Capsule (Interactive & Tender) */}
      <div className="relative pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))] px-4 w-full flex justify-center pointer-events-auto">
        <motion.div
          initial={{ y: -45, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="w-full max-w-sm rounded-2xl p-3 sm:p-3.5 shadow-2xl border flex items-center justify-between gap-3 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            boxShadow: `0 12px 36px -6px ${config.glowRgba}, 0 4px 12px rgba(0,0,0,0.15)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle luminous accent bar on left */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: config.accentColor }}
          />

          <div className="flex items-center gap-3 min-w-0 pl-1">
            {/* Animated Emoji Badge with Glow Halo */}
            <div className="relative shrink-0">
              <motion.div
                animate={{
                  scale: [1, 1.18, 1],
                  rotate: nudge.type === 'tickle' ? [-10, 10, -10] : [0, 4, -4, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: nudge.type === 'tickle' ? 0.25 : 1.6,
                  ease: 'easeInOut',
                }}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-2xl select-none shadow-xs border"
                style={{
                  backgroundColor: `${config.accentColor}18`,
                  borderColor: `${config.accentColor}40`,
                  boxShadow: `0 0 14px ${config.glowRgba}`,
                }}
              >
                {config.emoji}
              </motion.div>
            </div>

            {/* Sender & Action Title */}
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] sm:text-sm font-bold text-[var(--theme-text)] truncate leading-snug">
                  {nudge.sender}
                </span>
                <Heart 
                  className="w-3 h-3 fill-current animate-pulse shrink-0" 
                  style={{ color: config.accentColor }} 
                />
              </div>
              <p className="text-[11px] sm:text-[12px] text-[var(--theme-text)]/75 font-medium truncate leading-tight mt-0.5">
                {isFromPartner ? config.actionText : config.selfActionText}
              </p>
            </div>
          </div>

          {/* Action on Right: Quick Send Back or Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isFromPartner && onSendBack && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleSendBack}
                disabled={hasSentBack}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border"
                style={{
                  backgroundColor: hasSentBack ? 'var(--theme-surface)' : config.accentColor,
                  color: hasSentBack ? 'var(--theme-text)' : '#ffffff',
                  borderColor: hasSentBack ? 'var(--theme-border)' : `${config.accentColor}80`,
                }}
              >
                {hasSentBack ? (
                  <>
                    <Heart className="w-3 h-3 fill-current text-rose-500" />
                    <span>Sent!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Back {config.emoji}</span>
                  </>
                )}
              </motion.button>
            )}

            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--theme-text)]/45 hover:text-[var(--theme-text)] hover:bg-[var(--theme-text)]/10 transition-all cursor-pointer"
              title="Close"
              aria-label="Dismiss feeling"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* 3. Center Gentle Romantic Blossom / Emoji Burst */}
      <div className="relative flex-1 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 15 }}
          animate={{
            scale: [0, 1.25, 1],
            opacity: [0, 1, 1],
            y: [15, -10, -25],
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
        >
          {/* Central Animated Floating Feeling */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: nudge.type === 'tickle' ? [-14, 14, -14] : [-4, 4, -4],
            }}
            transition={{
              repeat: Infinity,
              duration: nudge.type === 'tickle' ? 0.2 : 1.8,
              ease: 'easeInOut',
            }}
            className="text-[72px] sm:text-[90px] drop-shadow-[0_12px_24px_rgba(0,0,0,0.22)] select-none leading-none filter"
          >
            {config.emoji}
          </motion.div>

          {/* 8 Staggered Floating Stardust Particles / Petals */}
          {particles.map((p, i) => {
            const sparkleEmoji = config.sparkles[i % config.sparkles.length] || '✨';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.95, 0],
                  scale: [0.3, p.scale, 0.4],
                  x: [0, p.x],
                  y: [0, p.y - 30],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: 'easeOut',
                }}
                className="absolute top-1/2 left-1/2 -ml-3 -mt-3 select-none pointer-events-none text-xl sm:text-2xl filter drop-shadow-md"
              >
                {sparkleEmoji}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* 4. Bottom Dismiss Cue */}
      <div className="pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] flex justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.65 }}
          transition={{ delay: 0.6 }}
          className="text-[11px] font-medium text-[var(--theme-text)]/50 tracking-wider uppercase flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-[var(--theme-accent)]" />
          <span>Tap anywhere to dismiss</span>
        </motion.div>
      </div>

      {/* Light ray keyframe styles */}
      <style>{`
        @keyframes nudge-top-light {
          0% { transform: translateX(-40%); opacity: 0.4; }
          100% { transform: translateX(40%); opacity: 1; }
        }
        @keyframes nudge-bottom-light {
          0% { transform: translateX(40%); opacity: 0.4; }
          100% { transform: translateX(-40%); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
};
