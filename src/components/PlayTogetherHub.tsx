import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  ArrowLeft,
  Sparkles,
  Heart,
  Grid3X3,
  CircleDot,
  Layers,
  Flame,
  Zap,
  Swords,
  Trophy,
  Play,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface PlayTogetherHubProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchGame: (gameType: 'tictactoe' | 'connecthearts' | 'dotsandboxes') => void;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  isPartnerOnline: boolean;
}

export const PlayTogetherHub: React.FC<PlayTogetherHubProps> = ({
  isOpen,
  onClose,
  onLaunchGame,
  role,
  userProfile,
  partnerProfile,
  isPartnerOnline,
}) => {
  if (!isOpen) return null;

  const partnerName =
    partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');
  const myPhoto = userProfile?.photo_url;
  const partnerPhoto = partnerProfile?.photo_url;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[160] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-y-auto custom-scrollbar select-none"
      >
        {/* Floating Back Button - No Top Bar */}
        <button
          onClick={onClose}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-full bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer"
          title="Back to Chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Lounge Content Container */}
        <div className="flex-1 max-w-xl w-full mx-auto px-4 pt-16 pb-12 sm:px-6 space-y-7">
          {/* 1. Play Together Lounge Hero Banner - Completely Distinct from Game Cards */}
          <div className="relative pt-2 pb-1 text-center">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-24 bg-gradient-to-r from-sky-500/15 via-pink-500/15 to-violet-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-sky-500/10 via-pink-500/10 to-violet-500/10 border border-[var(--theme-border)] mb-3 shadow-xs">
              <Gamepad2 className="w-4 h-4 text-pink-500 animate-bounce" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[var(--theme-text)]/80">
                OnlyUs Arcade Arena
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--theme-text)]">
              Play Together 💕
            </h1>
            <p className="text-xs sm:text-sm text-[var(--theme-text)]/65 font-medium mt-1">
              Zero-latency 1-on-1 couple games & live banter
            </p>

            {/* Couple Rivalry Status Pill */}
            <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span className="text-xs font-bold text-sky-500">Rahul 💙</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-[var(--theme-text)]/40 uppercase tracking-widest">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span>VS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <span className="text-xs font-bold text-pink-500">Nusrat 💖</span>
              </div>
              <div className="h-3 w-px bg-[var(--theme-border)] mx-1" />
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--theme-text)]/70">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPartnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-400'
                  }`}
                />
                <span>{isPartnerOnline ? `${partnerName} Online` : partnerName}</span>
              </div>
            </div>
          </div>

          {/* 2. Visual Game Showcase Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-[var(--theme-text)]/70">
                  Select Game
                </h2>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-500 uppercase tracking-wider">
                3 Games Available
              </span>
            </div>

            {/* GAME 1: Dots & Hearts (NEW!) */}
            <div className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-pink-400/80 p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-pink-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/20 transition-all" />

              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                {/* Visual Game Art Showcase (Mini 3x3 Dots & Hearts Arena Simulation) */}
                <div className="w-full sm:w-40 h-28 sm:h-36 rounded-2xl bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-pink-500/15 border border-[var(--theme-border)] p-2.5 flex flex-col justify-between shrink-0 relative overflow-hidden shadow-inner group-hover:scale-[1.02] transition-transform">
                  <div className="absolute top-1 right-2 text-[9px] font-black uppercase tracking-wider text-pink-500/70">
                    4x4 Dots
                  </div>

                  {/* Simulated Mini Grid with Blue & Pink Lines + Heart Boxes */}
                  <div className="w-full h-full flex flex-col justify-between p-1">
                    {/* Row 1 */}
                    <div className="flex items-center justify-between">
                      <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm" />
                      <div className="flex-1 h-1 bg-sky-500 mx-0.5 rounded-full shadow-[0_0_6px_rgba(14,165,233,0.8)]" />
                      <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm" />
                      <div className="flex-1 h-1 bg-pink-500 mx-0.5 rounded-full shadow-[0_0_6px_rgba(236,72,153,0.8)]" />
                      <div className="w-2 h-2 rounded-full bg-pink-500 shadow-sm" />
                    </div>

                    {/* Row 1 Interiors */}
                    <div className="flex items-center justify-between my-0.5 h-6">
                      <div className="w-1 h-full bg-sky-500 rounded-full" />
                      <div className="flex-1 h-full mx-1 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs">
                        💙
                      </div>
                      <div className="w-1 h-full bg-pink-500 rounded-full" />
                      <div className="flex-1 h-full mx-1 rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-xs">
                        💖
                      </div>
                      <div className="w-1 h-full bg-pink-500 rounded-full" />
                    </div>

                    {/* Row 2 */}
                    <div className="flex items-center justify-between">
                      <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm" />
                      <div className="flex-1 h-1 bg-sky-500 mx-0.5 rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-purple-400 shadow-sm" />
                      <div className="flex-1 h-1 bg-pink-500 mx-0.5 rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-pink-500 shadow-sm" />
                    </div>
                  </div>
                </div>

                {/* Details & Action */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[var(--theme-text)] tracking-tight">
                      Dots & Hearts 💕
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-wider">
                      New 🟢
                    </span>
                  </div>

                  <p className="text-xs text-[var(--theme-text)]/70 mt-1 font-medium leading-relaxed">
                    Connect lines between dots to complete 3x3 boxes. Claim a box to score & get a bonus turn!
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul 💙 Blue
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat 💖 Pink
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[var(--theme-border)] text-[var(--theme-text)]/70">
                      ⚡ Chain Combos
                    </span>
                  </div>

                  {/* Challenge Button */}
                  <div className="mt-4 pt-3 border-t border-[var(--theme-border)]/50 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold text-[var(--theme-text)]/60 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>9 Love Boxes</span>
                    </div>

                    <button
                      onClick={() => onLaunchGame('dotsandboxes')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-pink-500/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* GAME 2: Connect Hearts (Connect 4) */}
            <div className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-pink-400/80 p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-pink-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/20 transition-all" />

              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                {/* Visual Game Art Showcase (Mini 7x6 Connect Rack Preview) */}
                <div className="w-full sm:w-40 h-28 sm:h-36 rounded-2xl bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-sky-500/10 border border-[var(--theme-border)] p-2.5 flex flex-col justify-between shrink-0 relative overflow-hidden shadow-inner group-hover:scale-[1.02] transition-transform">
                  <div className="absolute top-1 right-2 text-[9px] font-black uppercase tracking-wider text-pink-500/70">
                    7x6 Rack
                  </div>

                  {/* Simulated Mini Connect 4 Grid */}
                  <div className="w-full h-full grid grid-cols-7 grid-rows-6 gap-1 p-1 bg-black/10 rounded-xl">
                    {Array.from({ length: 42 }).map((_, idx) => {
                      const isWinningBlue = [36, 37, 38, 39].includes(idx);
                      const isPink = [35, 30, 31, 23].includes(idx);
                      return (
                        <div
                          key={`c4-cell-${idx}`}
                          className={`rounded-full flex items-center justify-center text-[7px] ${
                            isWinningBlue
                              ? 'bg-sky-500 shadow-[0_0_4px_rgba(14,165,233,0.8)] animate-pulse'
                              : isPink
                              ? 'bg-pink-500 shadow-[0_0_4px_rgba(236,72,153,0.8)]'
                              : 'bg-[var(--theme-surface)]/40 border border-white/10'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Details & Action */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[var(--theme-text)] tracking-tight">
                      Connect Hearts 💖
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-500 uppercase tracking-wider">
                      Popular 🔥
                    </span>
                  </div>

                  <p className="text-xs text-[var(--theme-text)]/70 mt-1 font-medium leading-relaxed">
                    Drop your discs down the rack to connect 4 hearts in a row horizontally, vertically, or diagonally!
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul 💙 Blue
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat 💖 Pink
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[var(--theme-border)] text-[var(--theme-text)]/70">
                      ⚡ Gravity Drop
                    </span>
                  </div>

                  {/* Challenge Button */}
                  <div className="mt-4 pt-3 border-t border-[var(--theme-border)]/50 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold text-[var(--theme-text)]/60 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-pink-500" />
                      <span>7x6 Grid • Live Banter</span>
                    </div>

                    <button
                      onClick={() => onLaunchGame('connecthearts')}
                      className="px-5 py-2.5 rounded-xl bg-pink-500 text-white font-black text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-pink-500/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* GAME 3: Tic Tac Toe */}
            <div className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-pink-400/80 p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                {/* Visual Game Art Showcase (Mini 3x3 Neon Grid Preview) */}
                <div className="w-full sm:w-40 h-28 sm:h-36 rounded-2xl bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-sky-500/15 border border-[var(--theme-border)] p-2.5 flex flex-col justify-between shrink-0 relative overflow-hidden shadow-inner group-hover:scale-[1.02] transition-transform">
                  <div className="absolute top-1 right-2 text-[9px] font-black uppercase tracking-wider text-purple-400">
                    3x3 Grid
                  </div>

                  {/* Simulated 3x3 Mini Grid */}
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1 p-1 bg-black/10 rounded-xl">
                    <div className="rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs font-black text-sky-400">
                      ✕
                    </div>
                    <div className="rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-xs font-black text-pink-400">
                      ◯
                    </div>
                    <div className="rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs font-black text-sky-400">
                      ✕
                    </div>
                    <div className="rounded-lg bg-[var(--theme-surface)]/40 border border-white/5" />
                    <div className="rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs font-black text-sky-400">
                      ✕
                    </div>
                    <div className="rounded-lg bg-[var(--theme-surface)]/40 border border-white/5" />
                    <div className="rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-xs font-black text-pink-400">
                      ◯
                    </div>
                    <div className="rounded-lg bg-[var(--theme-surface)]/40 border border-white/5" />
                    <div className="rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xs font-black text-sky-400">
                      ✕
                    </div>
                  </div>
                </div>

                {/* Details & Action */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[var(--theme-text)] tracking-tight">
                      Tic Tac Toe ⚡
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500 uppercase tracking-wider">
                      Fast ⚡
                    </span>
                  </div>

                  <p className="text-xs text-[var(--theme-text)]/70 mt-1 font-medium leading-relaxed">
                    The classic quick showdown. 3 marks in a row wins. Quick matches with instant revenge rematches!
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul 💙 ✕
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat 💖 ◯
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[var(--theme-border)] text-[var(--theme-text)]/70">
                      ⚡ 1-Min Duel
                    </span>
                  </div>

                  {/* Challenge Button */}
                  <div className="mt-4 pt-3 border-t border-[var(--theme-border)]/50 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold text-[var(--theme-text)]/60 flex items-center gap-1.5">
                      <Grid3X3 className="w-3.5 h-3.5 text-violet-500" />
                      <span>3x3 Classic Grid</span>
                    </div>

                    <button
                      onClick={() => onLaunchGame('tictactoe')}
                      className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-black text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-violet-500/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
