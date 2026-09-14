import React, { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { UserRole, UserProfile, Message } from '../types';
import { PlayTogetherHub } from './PlayTogetherHub';

const TicTacToe = lazy(() => import('./TicTacToeModal'));
const ConnectHearts = lazy(() => import('./ConnectHeartsModal'));
const DotsAndBoxes = lazy(() => import('./DotsAndBoxesModal'));

export interface GameOverlayManagerProps {
  activeGame: { id: string; type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' } | null;
  isGameMinimized: boolean;
  isPartnerInGameRoom?: boolean;
  minimizedCountdown: number;
  showGamesMenu: boolean;
  onCloseGamesMenu: () => void;
  onLaunchGame: (type: 'tictactoe' | 'connecthearts' | 'dotsandboxes') => void;
  onResumeGame: () => void;
  onMinimizeGame: () => void;
  onTerminateGame: () => void;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  isPartnerOnline: boolean;
  latestPartnerMessage: Message | null;
  onSendNudge: (type?: string) => Promise<void>;
  onSendMainChatMessage: (text: string) => Promise<void>;
}

export const GameOverlayManager: React.FC<GameOverlayManagerProps> = ({
  activeGame,
  isGameMinimized,
  isPartnerInGameRoom = false,
  minimizedCountdown,
  showGamesMenu,
  onCloseGamesMenu,
  onLaunchGame,
  onResumeGame,
  onMinimizeGame,
  onTerminateGame,
  role,
  userProfile,
  partnerProfile,
  isPartnerOnline,
  latestPartnerMessage,
  onSendNudge,
  onSendMainChatMessage,
}) => {
  return (
    <>
      {/* Play Together Hub (Lounge) */}
      <PlayTogetherHub 
        isOpen={showGamesMenu} 
        onClose={onCloseGamesMenu}
        onLaunchGame={onLaunchGame}
        role={role}
        userProfile={userProfile}
        partnerProfile={partnerProfile}
        isPartnerOnline={isPartnerOnline}
      />

      {/* Minimized Game Floating Banner - Only shows if one person is inside the game and this user minimized */}
      <AnimatePresence>
        {activeGame && isGameMinimized && isPartnerInGameRoom && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2.5 px-4 py-2 rounded-full bg-[var(--theme-surface)]/95 backdrop-blur-md border border-[var(--theme-accent)] shadow-2xl text-xs font-bold text-[var(--theme-text)] pointer-events-auto"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="cursor-pointer select-none" onClick={onResumeGame}>
              🎮 {activeGame.type === 'connecthearts' ? 'Connect Hearts' : activeGame.type === 'dotsandboxes' ? 'Dots & Hearts' : 'Tic Tac Toe'} ({minimizedCountdown}s)
            </span>
            <button
              onClick={onResumeGame}
              className="px-2.5 py-1 rounded-full bg-[var(--theme-accent)] text-white text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              Resume
            </button>
            <button
              onClick={onTerminateGame}
              className="p-1 rounded-full text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
              title="Leave and end game"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Arenas (Full Screen, No Chat Header) */}
      {activeGame && (
        <div className={isGameMinimized ? 'hidden' : 'contents'}>
          <Suspense fallback={null}>
            {activeGame.type === 'tictactoe' && (
              <TicTacToe 
                sessionId={activeGame.id} 
                role={role} 
                userProfile={userProfile}
                partnerProfile={partnerProfile}
                latestPartnerMessage={latestPartnerMessage}
                isPartnerOnline={isPartnerOnline}
                isPartnerInGameRoom={isPartnerInGameRoom}
                isGameMinimized={isGameMinimized}
                onClose={onMinimizeGame}
                onMinimize={onMinimizeGame}
                onLeave={onTerminateGame}
                onSendNudge={onSendNudge}
                onSendMainChatMessage={onSendMainChatMessage}
              />
            )}

            {activeGame.type === 'connecthearts' && (
              <ConnectHearts 
                sessionId={activeGame.id} 
                role={role} 
                userProfile={userProfile}
                partnerProfile={partnerProfile}
                latestPartnerMessage={latestPartnerMessage}
                isPartnerOnline={isPartnerOnline}
                isPartnerInGameRoom={isPartnerInGameRoom}
                isGameMinimized={isGameMinimized}
                onClose={onMinimizeGame}
                onMinimize={onMinimizeGame}
                onLeave={onTerminateGame}
                onSendNudge={onSendNudge}
                onSendMainChatMessage={onSendMainChatMessage}
              />
            )}

            {activeGame.type === 'dotsandboxes' && (
              <DotsAndBoxes 
                sessionId={activeGame.id} 
                role={role} 
                userProfile={userProfile}
                partnerProfile={partnerProfile}
                latestPartnerMessage={latestPartnerMessage}
                isPartnerOnline={isPartnerOnline}
                isPartnerInGameRoom={isPartnerInGameRoom}
                isGameMinimized={isGameMinimized}
                onClose={onMinimizeGame}
                onMinimize={onMinimizeGame}
                onLeave={onTerminateGame}
                onSendNudge={onSendNudge}
                onSendMainChatMessage={onSendMainChatMessage}
              />
            )}
          </Suspense>
        </div>
      )}
    </>
  );
};
