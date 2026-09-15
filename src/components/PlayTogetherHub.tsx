import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  ArrowLeft,
  Sparkles,
  Play,
  Heart,
  Zap,
  Users,
  Swords,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { is3DTheme } from '../lib/themes';
import { QuantumAuraBackground } from './QuantumAuraBackground';
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

interface GameItem {
  id: 'dotsandboxes' | 'connecthearts' | 'tictactoe';
  title: string;
  badge: string;
  category: string;
  description: string;
  image: string;
  accentColor: string;
  players: string;
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
  const myName =
    userProfile?.display_name || (role === 'owner' ? 'Rahul' : 'Nusrat');
  const partnerPhoto = partnerProfile?.photo_url;
  const myPhoto = userProfile?.photo_url;

  const games: GameItem[] = [
    {
      id: 'dotsandboxes',
      title: 'Dots & Hearts',
      badge: '💕 Strategy',
      category: '4x4 Grid · Turn-based',
      description: 'Connect dots to complete boxes. Every completed square claims a heart and earns you a bonus turn!',
      image: dotsAndHeartsImg,
      accentColor: 'from-pink-500 to-rose-500',
      players: '2 Players',
    },
    {
      id: 'connecthearts',
      title: 'Connect Hearts',
      badge: '💖 4-in-a-Row',
      category: '7x6 Rack · Tactical',
      description: 'Drop romantic discs down the columns. Align 4 hearts horizontally, vertically, or diagonally to win!',
      image: connectHeartsImg,
      accentColor: 'from-purple-500 to-pink-500',
      players: '2 Players',
    },
    {
      id: 'tictactoe',
      title: 'Tic Tac Toe',
      badge: '⚡ Fast Duel',
      category: '3x3 Board · Classic',
      description: 'The timeless duel of strategy and speed. Make swift moves, banter live, and trigger instant rematches.',
      image: ticTacToeImg,
      accentColor: 'from-sky-500 to-indigo-500',
      players: '2 Players',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-hidden select-none"
      >
        {/* Active Theme Background Decoration & 3D Aura Engine */}
        <div className="theme-chat-decoration absolute inset-0 z-0 pointer-events-none" />
        {(is3DTheme(userProfile?.theme) ||
          (typeof document !== 'undefined' &&
            is3DTheme(document.documentElement.dataset.chatTheme))) && (
          <QuantumAuraBackground
            theme={
              userProfile?.theme ||
              (typeof document !== 'undefined'
                ? document.documentElement.dataset.chatTheme
                : undefined)
            }
          />
        )}

        {/* Clean Header Bar */}
        <header className="relative z-20 h-14 px-3 sm:px-5 flex items-center justify-between flex-shrink-0 bg-[var(--theme-surface)]/80 backdrop-blur-md border-b border-[var(--theme-border)] shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--theme-accent)]/15 active:scale-95 transition-all text-[var(--theme-text)] cursor-pointer"
              title="Back to Chat"
              aria-label="Back to Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 flex items-center justify-center text-[var(--theme-accent)]">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-[var(--theme-text)] leading-tight">
                  Play Together
                </h1>
                <p className="text-[10px] text-[var(--theme-text)]/60 font-medium">
                  Real-time couple games
                </p>
              </div>
            </div>
          </div>

          {/* Partner Status Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] text-xs shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isPartnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
              }`}
            />
            <span className="font-medium text-[11px] text-[var(--theme-text)]/80 truncate max-w-[120px]">
              {isPartnerOnline ? `${partnerName} Online` : partnerName}
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-3.5 sm:px-6 py-5 max-w-xl mx-auto w-full space-y-4">
          {/* Couple Lounge Card */}
          <div className="p-4 rounded-2xl bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)] shadow-sm flex items-center justify-between">
            {/* Player 1 (You) */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                {myPhoto ? (
                  <img
                    src={myPhoto}
                    alt={myName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--theme-accent)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] flex items-center justify-center font-bold text-sm ring-2 ring-[var(--theme-accent)]">
                    {myName[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[var(--theme-surface)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--theme-text)] truncate">
                  {myName}
                </p>
                <span className="text-[10px] text-[var(--theme-text)]/50 font-medium">
                  {role === 'owner' ? 'Host' : 'Partner'}
                </span>
              </div>
            </div>

            {/* Duel Heart Badge */}
            <div className="flex flex-col items-center px-3">
              <div className="w-8 h-8 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-500">
                <Heart className="w-4 h-4 fill-pink-500/30" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--theme-text)]/50 mt-0.5">
                VS
              </span>
            </div>

            {/* Player 2 (Partner) */}
            <div className="flex items-center gap-2.5 min-w-0 flex-row-reverse text-right">
              <div className="relative">
                {partnerPhoto ? (
                  <img
                    src={partnerPhoto}
                    alt={partnerName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-400"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center font-bold text-sm ring-2 ring-pink-400">
                    {partnerName[0]?.toUpperCase() || 'P'}
                  </div>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--theme-surface)] ${
                    isPartnerOnline ? 'bg-emerald-500' : 'bg-neutral-400'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--theme-text)] truncate">
                  {partnerName}
                </p>
                <span className="text-[10px] text-[var(--theme-text)]/50 font-medium">
                  {isPartnerOnline ? 'Ready to play' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[var(--theme-text)]/70">
                Available Games
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
              3 Modes
            </span>
          </div>

          {/* Game Cards List */}
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => onLaunchGame(game.id)}
                className="group relative rounded-2xl bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)] hover:border-[var(--theme-accent)] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5"
              >
                {/* Game Thumbnail */}
                <div className="relative w-full sm:w-28 h-32 sm:h-28 rounded-xl overflow-hidden bg-black/10 flex-shrink-0">
                  <img
                    src={game.image}
                    alt={game.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white">
                    {game.badge}
                  </div>
                </div>

                {/* Game Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-[var(--theme-text)] truncate">
                        {game.title}
                      </h3>
                      <span className="text-[10px] text-[var(--theme-text)]/50 font-medium shrink-0">
                        {game.category}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--theme-text)]/70 leading-relaxed mt-1 line-clamp-2 sm:line-clamp-2">
                      {game.description}
                    </p>
                  </div>

                  <div className="mt-3 sm:mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-[var(--theme-text)]/50 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {game.players} · Realtime
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLaunchGame(game.id);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-accent)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm group-hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Clean Realtime Guarantee Info */}
          <div className="pt-2 pb-6 text-center">
            <p className="text-[11px] text-[var(--theme-text)]/50 flex items-center justify-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Live zero-latency synchronization with in-game reactions & audio notes.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
