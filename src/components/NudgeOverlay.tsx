import React from 'react';
import { motion } from 'motion/react';

interface NudgeOverlayProps {
  nudge: { type: string; sender: string };
  onDismiss?: () => void;
}

export const NudgeOverlay: React.FC<NudgeOverlayProps> = ({ nudge, onDismiss }) => {
  const configs: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
    hug: { label: 'Virtual Hug', emoji: '🤗', color: 'text-amber-600', bg: 'bg-amber-400/20' },
    kiss: { label: 'Sweet Kiss', emoji: '💋', color: 'text-rose-600', bg: 'bg-rose-500/20' },
    love: { label: 'Love You', emoji: '💖', color: 'text-pink-600', bg: 'bg-pink-500/20' },
    miss: { label: 'Miss You', emoji: '🥺', color: 'text-blue-600', bg: 'bg-blue-500/20' },
    cuddle: { label: 'Warm Cuddle', emoji: '🫂', color: 'text-purple-600', bg: 'bg-purple-500/20' },
    tickle: { label: 'Tickle Attack!', emoji: '😂', color: 'text-yellow-600', bg: 'bg-yellow-500/20' },
    adore: { label: 'Adore You', emoji: '😍', color: 'text-red-600', bg: 'bg-red-500/20' },
    blowkiss: { label: 'Blow Kiss', emoji: '😘', color: 'text-pink-500', bg: 'bg-pink-400/20' },
  };

  const config = configs[nudge.type] || configs.hug;

  const particles = [
    { x: 100, y: -90, scale: 1.2, delay: 0 },
    { x: -110, y: -80, scale: 1.1, delay: 0.1 },
    { x: 115, y: 60, scale: 1.3, delay: 0.2 },
    { x: -95, y: 90, scale: 1.2, delay: 0.15 },
    { x: 0, y: -120, scale: 1.4, delay: 0.05 },
    { x: -15, y: 120, scale: 1.2, delay: 0.25 },
    { x: 70, y: 100, scale: 1.1, delay: 0.1 },
    { x: -80, y: -100, scale: 1.3, delay: 0.2 },
    { x: 130, y: -30, scale: 1.1, delay: 0.3 },
    { x: -120, y: 20, scale: 1.3, delay: 0.05 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className={`absolute inset-0 z-40 overflow-hidden cursor-pointer flex items-center justify-center backdrop-blur-[4px] transition-colors duration-500 rounded-none ${config.bg}`}
    >
      <div className="relative flex flex-col items-center p-4">
        <motion.div
           initial={{ scale: 0, rotate: -20 }}
           animate={{ 
             scale: [0, 1.2, 1], 
             rotate: [20, -10, 0],
             y: [0, -10, 0]
           }}
           transition={{ duration: 0.8, ease: "easeOut" }}
           className="relative flex items-center justify-center"
        >
          {nudge.type === 'tickle' ? (
             <motion.div 
              animate={{ x: [-12, 12, -12], y: [-5, 5, -5], rotate: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 0.18 }}
             >
                <div className="text-[90px] sm:text-[110px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
             </motion.div>
          ) : nudge.type === 'miss' ? (
            <motion.div 
              animate={{ opacity: [0.8, 1, 0.8], y: [0, -10, 0], scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            >
              <div className="text-[90px] sm:text-[110px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
            </motion.div>
          ) : nudge.type === 'kiss' || nudge.type === 'blowkiss' ? (
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              <div className="text-[90px] sm:text-[110px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <div className="text-[90px] sm:text-[110px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
            </motion.div>
          )}
          
          {/* Floating mini celebration items */}
          {particles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, p.scale, 0.5],
                x: p.x,
                y: p.y,
              }}
              transition={{ 
                duration: 2.2,
                repeat: Infinity,
                delay: p.delay
              }}
              className="absolute top-1/2 left-1/2 -ml-3 -mt-3 select-none pointer-events-none"
            >
              <div className="text-2xl sm:text-3xl">{config.emoji}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 bg-[var(--theme-surface)]/95 backdrop-blur-md px-6 py-3 rounded-[2rem] shadow-xl border border-[var(--theme-border)] flex flex-col items-center gap-0.5"
        >
          <span className={`text-xs sm:text-sm font-black uppercase tracking-[0.2em] ${config.color}`}>{config.label}</span>
          <span className="text-[10px] sm:text-xs font-bold text-[var(--theme-text)]/60 uppercase tracking-widest">From {nudge.sender} {config.emoji}</span>
        </motion.div>
      </div>
    </motion.div>
  );
};
