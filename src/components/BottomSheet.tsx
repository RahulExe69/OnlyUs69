import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-3 sm:px-4 pb-3 sm:pb-4 pointer-events-auto">
          {/* Fast hardware-accelerated dark backdrop with zero blur filter lag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 transform-gpu"
          />
          {/* Native-feeling instant bottom sheet with cubic-bezier easing */}
          <motion.div
            initial={{ y: '100%', opacity: 0.95 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-[2rem] overflow-hidden shadow-2xl pt-2 pb-6 lg:pb-8 transform-gpu will-change-transform z-10"
          >
            <div className="w-12 h-1 bg-[var(--theme-text)]/20 rounded-full mx-auto my-3" />
            <div className="px-6 pb-2">
              <h3 className="text-xs font-black text-[var(--theme-accent)] uppercase tracking-[0.25em] text-center">{title}</h3>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function AttachmentOption({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ touchAction: 'manipulation' }}
      className="flex flex-col items-center gap-1.5 group cursor-pointer w-full min-w-0"
    >
      <div
        className={`w-12 h-12 sm:w-14 sm:h-14 ${color} rounded-2xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform shrink-0`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-bold text-[var(--theme-text)] uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity truncate max-w-full text-center">
        {label}
      </span>
    </button>
  );
}

export function GameCard({
  title,
  subtitle,
  icon,
  color,
  isActive,
  onClick,
  label,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  isActive: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={isActive ? onClick : undefined}
      disabled={!isActive}
      className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] border transition-all active:scale-[0.97] text-left group
        ${
          isActive
            ? 'bg-[var(--theme-bg)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40 shadow-[0_4px_12px_color-mix(in_srgb,var(--theme-accent)_6%,transparent)] hover:shadow-[0_8px_20px_color-mix(in_srgb,var(--theme-accent)_12%,transparent)]'
            : 'bg-gray-50/50 border-gray-100 opacity-60 cursor-not-allowed filter grayscale'
        }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 flex-shrink-0 ${isActive ? color : 'bg-gray-200'} text-white rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className={`font-black uppercase tracking-tight text-[13px] ${isActive ? 'text-[var(--theme-text)]' : 'text-gray-400'}`}>
              {title}
            </h4>
            {isActive && (
              <span className="text-[7px] bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap">
                {label || 'Available 🎮'}
              </span>
            )}
          </div>
          <p
            className={`text-[10px] font-bold uppercase tracking-widest leading-none ${
              isActive ? 'text-[var(--theme-text)] opacity-50' : 'text-gray-300'
            }`}
          >
            {subtitle}
          </p>
        </div>
      </div>
      {isActive && (
        <ChevronRight className="w-5 h-5 text-[var(--theme-accent)] transition-all -translate-x-2 group-hover:translate-x-0 group-hover:drop-shadow-sm opacity-40 group-hover:opacity-100" />
      )}
    </button>
  );
}

export function CelebrateIcon({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.63 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    </div>
  );
}
