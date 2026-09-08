import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  ArrowLeft,
  Sparkles,
  Swords,
  Play,
  Grid3X3,
  Layers,
  CircleDot,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import dotsAndHeartsImg from '../assets/images/dots_and_hearts_1788838671096.jpg';
import connectHeartsImg from '../assets/images/connect_hearts_game_1788838687286.jpg';
import ticTacToeImg from '../assets/images/tic_tac_toe_1788838702128.jpg';

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-y-auto custom-scrollbar select-none"
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
        <div className="flex-1 max-w-2xl w-full mx-auto px-3.5 sm:px-6 pt-16 pb-12 space-y-6">
          {/* 1. Play Together Lounge Hero Banner */}
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

          {/* 2. Visual Game Showcase - 2-Column Grid */}
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

            {/* 2-Column Grid of Games */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* GAME 1: Dots & Hearts */}
              <div
                onClick={() => onLaunchGame('dotsandboxes')}
                className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-pink-400/80 p-3 sm:p-4 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between cursor-pointer overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/20 transition-all" />

                <div>
                  {/* Generated Cover Image */}
                  <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/5 shadow-inner">
                    <img
                      src={dotsAndHeartsImg}
                      alt="Dots & Hearts"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Floating Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-emerald-400 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>New</span>
                    </div>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/90">
                      4x4 Dots
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm sm:text-base font-black text-[var(--theme-text)] tracking-tight mt-2.5 truncate">
                    Dots & Hearts 💕
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text)]/70 font-medium leading-snug line-clamp-2 mt-0.5">
                    Connect lines between dots to complete boxes & score bonus turns!
                  </p>

                  {/* Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul 💙
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat 💖
                    </span>
                  </div>
                </div>

                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchGame('dotsandboxes');
                  }}
                  className="mt-3 w-full py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-pink-500 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-pink-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Now</span>
                </button>
              </div>

              {/* GAME 2: Connect Hearts */}
              <div
                onClick={() => onLaunchGame('connecthearts')}
                className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-pink-400/80 p-3 sm:p-4 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between cursor-pointer overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/20 transition-all" />

                <div>
                  {/* Generated Cover Image */}
                  <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/5 shadow-inner">
                    <img
                      src={connectHeartsImg}
                      alt="Connect Hearts"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Floating Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-pink-300 shadow-sm">
                      <span>🔥 Popular</span>
                    </div>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/90">
                      7x6 Rack
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm sm:text-base font-black text-[var(--theme-text)] tracking-tight mt-2.5 truncate">
                    Connect Hearts 💖
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text)]/70 font-medium leading-snug line-clamp-2 mt-0.5">
                    Drop discs down the rack to connect 4 hearts in a row!
                  </p>

                  {/* Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul 💙
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat 💖
                    </span>
                  </div>
                </div>

                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchGame('connecthearts');
                  }}
                  className="mt-3 w-full py-2 sm:py-2.5 rounded-xl bg-pink-500 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-pink-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Now</span>
                </button>
              </div>

              {/* GAME 3: Tic Tac Toe */}
              <div
                onClick={() => onLaunchGame('tictactoe')}
                className="relative rounded-3xl bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-violet-400/80 p-3 sm:p-4 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between cursor-pointer overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-violet-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-violet-500/20 transition-all" />

                <div>
                  {/* Generated Cover Image */}
                  <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/5 shadow-inner">
                    <img
                      src={ticTacToeImg}
                      alt="Tic Tac Toe"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Floating Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-violet-300 shadow-sm">
                      <span>⚡ Fast Duel</span>
                    </div>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/90">
                      3x3 Grid
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm sm:text-base font-black text-[var(--theme-text)] tracking-tight mt-2.5 truncate">
                    Tic Tac Toe ⚡
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text)]/70 font-medium leading-snug line-clamp-2 mt-0.5">
                    Classic 3-in-a-row showdown with instant revenge rematches!
                  </p>

                  {/* Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Rahul ✕
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Nusrat ◯
                    </span>
                  </div>
                </div>

                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchGame('tictactoe');
                  }}
                  className="mt-3 w-full py-2 sm:py-2.5 rounded-xl bg-violet-600 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-md shadow-violet-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Now</span>
                </button>
              </div>

              {/* CARD 4: Coming Soon Slot to balance 2x2 Grid */}
              <div className="relative rounded-3xl bg-[var(--theme-surface)]/60 border-2 border-dashed border-[var(--theme-border)] p-3 sm:p-4 flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-sky-500/10 flex flex-col items-center justify-center p-3">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] flex items-center justify-center shadow-xs">
                      <Gamepad2 className="w-5 h-5 text-pink-500 animate-pulse" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-[var(--theme-text)]/60 mt-1.5">
                      In Development 🧪
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-[var(--theme-text)]/80 tracking-tight mt-2.5 truncate">
                    More Games Soon 💕
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text)]/50 font-medium leading-snug line-clamp-2 mt-0.5">
                    More romantic 1-on-1 couple duels in the works!
                  </p>
                </div>

                <div className="mt-3 w-full py-2 sm:py-2.5 rounded-xl bg-[var(--theme-border)]/40 text-[var(--theme-text)]/60 font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Stay Tuned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

