import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  Clock,
  Zap,
  Minus,
  LogOut,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile, Message, InGameChatMessage } from '../types';
import { is3DTheme } from '../lib/themes';
import { QuantumAuraBackground } from './QuantumAuraBackground';
import { PartnerMainChatBubble } from './PartnerMainChatBubble';
import { InGameChatDrawer } from './InGameChatDrawer';

export interface DotsAndBoxesProps {
  sessionId: string;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  latestPartnerMessage?: Message | null;
  isPartnerOnline?: boolean;
  isPartnerInGameRoom?: boolean;
  isGameMinimized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onLeave?: () => void;
  onSendNudge?: (type: string) => void;
  onSendMainChatMessage?: (text: string) => Promise<void> | void;
}

// 16 Boxes (4x4 boxes = 5x5 dots)
const DOT_ROWS = 5;
const DOT_COLS = 5;
const BOX_ROWS = 4;
const BOX_COLS = 4;
const TOTAL_BOXES = BOX_ROWS * BOX_COLS; // 16

type LineOwner = UserRole | null;
type BoxOwner = UserRole | null;

interface GameState {
  // horizontalLines: 5 rows x 4 cols
  hLines: LineOwner[][];
  // verticalLines: 4 rows x 5 cols
  vLines: LineOwner[][];
  // boxes: 4 rows x 4 cols
  boxes: BoxOwner[][];
  turn: UserRole;
  winner: UserRole | 'draw' | null;
  scores: { owner: number; partner: number };
}

const createInitialState = (): GameState => ({
  hLines: Array.from({ length: DOT_ROWS }, () => Array(BOX_COLS).fill(null)),
  vLines: Array.from({ length: BOX_ROWS }, () => Array(DOT_COLS).fill(null)),
  boxes: Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS).fill(null)),
  turn: 'owner',
  winner: null,
  scores: { owner: 0, partner: 0 },
});

export default function DotsAndBoxes({
  sessionId,
  role,
  userProfile,
  partnerProfile,
  latestPartnerMessage = null,
  isPartnerOnline = false,
  isPartnerInGameRoom = false,
  isGameMinimized = false,
  onClose,
  onMinimize,
  onLeave,
  onSendNudge,
  onSendMainChatMessage,
}: DotsAndBoxesProps) {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [lastBonusTurn, setLastBonusTurn] = useState<boolean>(false);
  const [partnerInGame, setPartnerInGame] = useState(isPartnerInGameRoom);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [inGameMessages, setInGameMessages] = useState<InGameChatMessage[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    setPartnerInGame(isPartnerInGameRoom);
  }, [isPartnerInGameRoom]);

  const channelRef = useRef<any>(null);
  const currentGameStateRef = useRef<GameState>(gameState);

  // Keep ref up to date to prevent wiping state on re-join
  useEffect(() => {
    currentGameStateRef.current = gameState;
  }, [gameState]);

  const myName =
    userProfile?.display_name || (role === 'owner' ? 'Rahul' : 'Nusrat');
  const partnerName =
    partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');
  const myPhoto = userProfile?.photo_url;
  const partnerPhoto = partnerProfile?.photo_url;

  // Realtime Supabase Setup
  useEffect(() => {
    let isSubscribed = true;

    const fetchGameFromDB = async () => {
      try {
        const { data } = await supabase
          .from('games')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (data && isSubscribed) {
          if (data.status === 'closed') {
            onClose();
            return;
          }
          if (data.game_data && data.game_data.boxes && data.game_data.boxes.length === BOX_ROWS) {
            setGameState(data.game_data);
          } else if (data.board && data.board.boxes && data.board.boxes.length === BOX_ROWS) {
            setGameState(data.board);
          }
        } else if (!data && isSubscribed) {
          const fresh = createInitialState();
          await supabase.from('games').insert([
            {
              id: sessionId,
              game_data: fresh,
              turn: 'owner',
              status: 'playing',
              winner: null,
              scores: { owner: 0, partner: 0 },
              players: { [role]: userProfile?.uid || role },
            },
          ]);
        }
      } catch (err) {
        console.warn('DotsAndBoxes fetch note:', err);
      }
    };

    fetchGameFromDB();

    const channelName = `game_arena:${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userProfile?.uid || role },
        broadcast: { self: false, ack: true },
      },
    });
    channelRef.current = channel;

    const updatePresence = () => {
      if (!isSubscribed) return;
      const state = channel.presenceState();
      const presences = Object.values(state).flat() as any[];
      const otherPres = presences.find(
        (p) => p && p.role && p.role !== role
      );
      // Partner is in game room ONLY if their presence actively indicates they are in the game room (not in chat)
      const otherPlayerPresent = otherPres
        ? !!(otherPres.in_game === true && otherPres.location === 'game')
        : !!isPartnerInGameRoom;
      setPartnerInGame(prev => (prev !== otherPlayerPresent ? otherPlayerPresent : prev));
    };

    channel
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        updatePresence();
        const hasPartner = newPresences.some((p: any) => p.role !== role);
        if (hasPartner) {
          // Send active state from ref to avoid resetting game on re-join
          channel.send({
            type: 'broadcast',
            event: 'game_sync',
            payload: { gameState: currentGameStateRef.current },
          });
        }
      })
      .on('presence', { event: 'leave' }, updatePresence)
      .on('broadcast', { event: 'game_sync' }, ({ payload }) => {
        if (!isSubscribed || !payload?.gameState) return;
        setGameState(payload.gameState);
      })
      .on('broadcast', { event: 'game_move' }, ({ payload }) => {
        if (!isSubscribed || !payload?.newGameState) return;
        setGameState(payload.newGameState);
        setLastBonusTurn(!!payload.bonusTurn);

        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(payload.newGameState.winner ? [100, 50, 200] : 30);
          } catch (_) {}
        }
      })
      .on('broadcast', { event: 'game_reset' }, ({ payload }) => {
        if (!isSubscribed || !payload?.newGameState) return;
        setGameState(payload.newGameState);
        setLastBonusTurn(false);
      })
      .on('broadcast', { event: 'game_closed' }, () => {
        if (!isSubscribed) return;
        if (onLeave) onLeave();
        else onClose();
      })
      .on('broadcast', { event: 'game_chat' }, ({ payload }) => {
        if (!isSubscribed || !payload) return;
        setInGameMessages((prev) => [...prev, payload]);
      })
      .on('broadcast', { event: 'game_nudge' }, () => {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate([150, 100, 150]);
          } catch (_) {}
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            role,
            name: myName,
            in_game: !isGameMinimized,
            location: isGameMinimized ? 'chat' : 'game',
            joinedAt: Date.now(),
          });
        }
      });

    return () => {
      isSubscribed = false;
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [sessionId, role, userProfile?.uid]);

  // Sync game presence when minimization state changes
  useEffect(() => {
    if (channelRef.current && role) {
      try {
        channelRef.current.track({
          role,
          name: myName,
          in_game: !isGameMinimized,
          location: isGameMinimized ? 'chat' : 'game',
          joinedAt: Date.now(),
        });
      } catch (_) {}
    }
  }, [isGameMinimized, role, myName]);

  // Draw Horizontal Line at row r (0..4), col c (0..3)
  const handleDrawHLine = async (r: number, c: number) => {
    if (gameState.winner || gameState.turn !== role) return;
    if (gameState.hLines[r][c] !== null) return;

    const newHLines = gameState.hLines.map((row) => [...row]);
    const newVLines = gameState.vLines.map((row) => [...row]);
    const newBoxes = gameState.boxes.map((row) => [...row]);
    const newScores = { ...gameState.scores };

    newHLines[r][c] = role;

    let completedAnyBox = false;

    for (let br = 0; br < BOX_ROWS; br++) {
      for (let bc = 0; bc < BOX_COLS; bc++) {
        if (newBoxes[br][bc] === null) {
          const top = newHLines[br][bc] !== null;
          const bottom = newHLines[br + 1][bc] !== null;
          const left = newVLines[br][bc] !== null;
          const right = newVLines[br][bc + 1] !== null;

          if (top && bottom && left && right) {
            newBoxes[br][bc] = role;
            newScores[role] += 1;
            completedAnyBox = true;
          }
        }
      }
    }

    let nextTurn = gameState.turn;
    if (!completedAnyBox) {
      nextTurn = role === 'owner' ? 'partner' : 'owner';
    }

    const totalClaimed = newScores.owner + newScores.partner;
    let newWinner: UserRole | 'draw' | null = null;

    if (totalClaimed === TOTAL_BOXES) {
      if (newScores.owner > newScores.partner) {
        newWinner = 'owner';
      } else if (newScores.partner > newScores.owner) {
        newWinner = 'partner';
      } else {
        newWinner = 'draw';
      }
    }

    const nextGameState: GameState = {
      hLines: newHLines,
      vLines: newVLines,
      boxes: newBoxes,
      turn: nextTurn,
      winner: newWinner,
      scores: newScores,
    };

    setGameState(nextGameState);
    setLastBonusTurn(completedAnyBox && !newWinner);

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(newWinner ? [100, 50, 200] : completedAnyBox ? [60, 40, 60] : 30);
      } catch (_) {}
    }

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_move',
      payload: {
        newGameState: nextGameState,
        bonusTurn: completedAnyBox && !newWinner,
      },
    });

    try {
      await supabase.from('games').upsert({
        id: sessionId,
        game_data: nextGameState,
        turn: nextTurn,
        winner: newWinner,
        status: newWinner ? 'finished' : 'playing',
        scores: newScores,
      });
    } catch (err) {
      console.warn('DotsAndBoxes save warning:', err);
    }
  };

  // Draw Vertical Line at row r (0..3), col c (0..4)
  const handleDrawVLine = async (r: number, c: number) => {
    if (gameState.winner || gameState.turn !== role) return;
    if (gameState.vLines[r][c] !== null) return;

    const newHLines = gameState.hLines.map((row) => [...row]);
    const newVLines = gameState.vLines.map((row) => [...row]);
    const newBoxes = gameState.boxes.map((row) => [...row]);
    const newScores = { ...gameState.scores };

    newVLines[r][c] = role;

    let completedAnyBox = false;

    for (let br = 0; br < BOX_ROWS; br++) {
      for (let bc = 0; bc < BOX_COLS; bc++) {
        if (newBoxes[br][bc] === null) {
          const top = newHLines[br][bc] !== null;
          const bottom = newHLines[br + 1][bc] !== null;
          const left = newVLines[br][bc] !== null;
          const right = newVLines[br][bc + 1] !== null;

          if (top && bottom && left && right) {
            newBoxes[br][bc] = role;
            newScores[role] += 1;
            completedAnyBox = true;
          }
        }
      }
    }

    let nextTurn = gameState.turn;
    if (!completedAnyBox) {
      nextTurn = role === 'owner' ? 'partner' : 'owner';
    }

    const totalClaimed = newScores.owner + newScores.partner;
    let newWinner: UserRole | 'draw' | null = null;

    if (totalClaimed === TOTAL_BOXES) {
      if (newScores.owner > newScores.partner) {
        newWinner = 'owner';
      } else if (newScores.partner > newScores.owner) {
        newWinner = 'partner';
      } else {
        newWinner = 'draw';
      }
    }

    const nextGameState: GameState = {
      hLines: newHLines,
      vLines: newVLines,
      boxes: newBoxes,
      turn: nextTurn,
      winner: newWinner,
      scores: newScores,
    };

    setGameState(nextGameState);
    setLastBonusTurn(completedAnyBox && !newWinner);

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(newWinner ? [100, 50, 200] : completedAnyBox ? [60, 40, 60] : 30);
      } catch (_) {}
    }

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_move',
      payload: {
        newGameState: nextGameState,
        bonusTurn: completedAnyBox && !newWinner,
      },
    });

    try {
      await supabase.from('games').upsert({
        id: sessionId,
        game_data: nextGameState,
        turn: nextTurn,
        winner: newWinner,
        status: newWinner ? 'finished' : 'playing',
        scores: newScores,
      });
    } catch (err) {
      console.warn('DotsAndBoxes save warning:', err);
    }
  };

  // Reset Game for Rematch
  const handleReset = async () => {
    const nextTurn = role === 'owner' ? 'partner' : 'owner';
    const fresh = createInitialState();
    fresh.turn = nextTurn;

    setGameState(fresh);
    setLastBonusTurn(false);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_reset',
      payload: { newGameState: fresh },
    });

    try {
      await supabase.from('games').upsert({
        id: sessionId,
        game_data: fresh,
        turn: nextTurn,
        winner: null,
        status: 'playing',
        scores: { owner: 0, partner: 0 },
      });
    } catch (err) {
      console.warn('DotsAndBoxes reset warning:', err);
    }
  };

  const handleSendInGameMessage = (text: string, isQuickReaction = false) => {
    const newMsg: InGameChatMessage = {
      id: `game-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      senderRole: role,
      senderName: myName,
      text,
      timestamp: Date.now(),
      isQuickReaction,
    };

    setInGameMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_chat',
      payload: newMsg,
    });
  };

  const handleNudgePartner = () => {
    if (nudgeSent) return;
    setNudgeSent(true);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_nudge',
      payload: { from: role },
    });

    onSendNudge?.('game_invite');
    setTimeout(() => setNudgeSent(false), 8000);
  };

  // Leave Game Handler
  const handleLeaveGame = async () => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_closed',
        payload: { leftBy: role, sessionId },
      });
      await supabase.from('games').update({ status: 'closed' }).eq('id', sessionId);
      await supabase
        .from('messages')
        .update({
          gameInvite: {
            sessionId: sessionId,
            gameType: 'dotsandboxes',
            status: 'closed',
          },
        })
        .filter('gameInvite->>sessionId', 'eq', sessionId);
    } catch (err) {
      console.warn('Leave game cleanup note:', err);
    }
    if (onLeave) onLeave();
    else onClose();
  };

  const isMyTurn = gameState.turn === role && !gameState.winner;

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between overflow-hidden select-none">
      {/* Theme Background Decoration & 3D Aura Engine */}
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

      {/* Floating Main Chat Bubble from Partner */}
      <PartnerMainChatBubble
        latestPartnerMessage={latestPartnerMessage}
        partnerProfile={partnerProfile}
        role={role}
        onSendMainChatMessage={onSendMainChatMessage || (() => {})}
      />

      {/* Top Floating Control Bar: Back/Minimize on left, Leave & Nudge on right */}
      <div className="fixed top-3 left-3 right-3 z-40 flex items-center justify-between pointer-events-none">
        {/* Left: Minimize / Back */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => (onMinimize ? onMinimize() : onClose())}
            className="p-2 rounded-full bg-[var(--theme-surface)]/90 backdrop-blur-md border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer"
            title="Minimize Game (Back to chat)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => (onMinimize ? onMinimize() : onClose())}
            className="px-2.5 py-1.5 rounded-full bg-[var(--theme-surface)]/90 backdrop-blur-md border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] active:scale-95 transition-all shadow-md flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            title="Minimize Game"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Minimize</span>
          </button>
        </div>

        {/* Right: Leave Game & Nudge */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {partnerInGame ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>In Game Room</span>
            </div>
          ) : isPartnerOnline ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-bold backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>In Chat</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-500/15 border border-neutral-500/30 text-[var(--theme-text)]/50 text-[10px] font-medium backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span>Offline</span>
            </div>
          )}

          {!partnerInGame && (
            <button
              onClick={handleNudgePartner}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-md ${
                nudgeSent
                  ? 'bg-emerald-500 text-white'
                  : 'bg-pink-500 text-white hover:opacity-90 animate-pulse'
              }`}
              title={`Nudge ${partnerName} to join`}
            >
              <Bell className="w-3 h-3" />
              <span>{nudgeSent ? 'Nudged!' : 'Nudge'}</span>
            </button>
          )}

          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="px-2.5 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 transition-all shadow-md active:scale-95 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            title="Leave Game (End match)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-[var(--theme-surface)] rounded-3xl p-5 border border-[var(--theme-border)] shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[var(--theme-text)] mb-1">
                Leave Game?
              </h3>
              <p className="text-xs text-[var(--theme-text)]/70 mb-4 leading-relaxed">
                Leaving ends the match and terminates the active session for both players.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface)] active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveGame}
                  className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 active:scale-95 transition-all shadow-md shadow-rose-500/25"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Center Content (Scoreboard & Interactive 16-Box Grid) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 pt-12 pb-4 max-w-lg mx-auto w-full overflow-y-auto">
        {/* Sleek Compact Player Status Bar (Rahul vs Nusrat) */}
        <div className="w-full max-w-[340px] mb-2 px-3 py-1.5 rounded-2xl bg-[var(--theme-surface)]/90 backdrop-blur-md border border-[var(--theme-border)] shadow-sm flex items-center justify-between">
          {/* Left: Rahul (Owner - Sky Blue) */}
          <div
            className={`flex items-center gap-2 py-0.5 px-2 rounded-xl transition-all ${
              gameState.turn === 'owner' && !gameState.winner
                ? 'bg-sky-500/15 ring-1 ring-sky-400 font-bold'
                : 'opacity-75'
            }`}
          >
            <div className="relative">
              {role === 'owner' ? (
                myPhoto ? (
                  <img
                    src={myPhoto}
                    alt="You"
                    className="w-7 h-7 rounded-full object-cover border border-sky-400"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
                    R
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Rahul"
                  className="w-7 h-7 rounded-full object-cover border border-sky-400"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
                  R
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 text-[8px] leading-none">
                💙
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[11px] leading-tight text-[var(--theme-text)]">
                  {role === 'owner' ? 'You' : 'Rahul'}
                </span>
                {role !== 'owner' && (
                  partnerInGame ? (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">In Room</span>
                  ) : isPartnerOnline ? (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400">In Chat</span>
                  ) : (
                    <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-500/15 text-[var(--theme-text)]/40">Offline</span>
                  )
                )}
              </div>
              <span className="text-xs font-black text-sky-500 leading-tight">
                {gameState.scores.owner} / {TOTAL_BOXES}
              </span>
            </div>
          </div>

          {/* Center: Title / 16 Boxes Badge */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text)]/40">
              16 Boxes
            </span>
            <span className="text-[9px] font-bold text-[var(--theme-text)]/50">
              Dots & Hearts
            </span>
          </div>

          {/* Right: Nusrat (Partner - Pink) */}
          <div
            className={`flex items-center gap-2 py-0.5 px-2 rounded-xl transition-all ${
              gameState.turn === 'partner' && !gameState.winner
                ? 'bg-pink-500/15 ring-1 ring-pink-400 font-bold'
                : 'opacity-75'
            }`}
          >
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1">
                {role !== 'partner' && (
                  partnerInGame ? (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">In Room</span>
                  ) : isPartnerOnline ? (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400">In Chat</span>
                  ) : (
                    <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-500/15 text-[var(--theme-text)]/40">Offline</span>
                  )
                )}
                <span className="text-[11px] leading-tight text-[var(--theme-text)]">
                  {role === 'partner' ? 'You' : 'Nusrat'}
                </span>
              </div>
              <span className="text-xs font-black text-pink-500 leading-tight">
                {gameState.scores.partner} / {TOTAL_BOXES}
              </span>
            </div>
            <div className="relative">
              {role === 'partner' ? (
                myPhoto ? (
                  <img
                    src={myPhoto}
                    alt="You"
                    className="w-7 h-7 rounded-full object-cover border border-pink-400"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-[10px]">
                    N
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Nusrat"
                  className="w-7 h-7 rounded-full object-cover border border-pink-400"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-[10px]">
                  N
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 text-[8px] leading-none">
                💖
              </span>
            </div>
          </div>
        </div>

        {/* Turn & Bonus Status Pill */}
        <div className="mb-2 text-center">
          {gameState.winner ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 inline-flex"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {gameState.winner === 'draw'
                  ? "It's a Draw! 🤝"
                  : gameState.winner === role
                  ? 'You Captured the Board! 🎉🏆'
                  : `${partnerName} Won! 💕`}
              </span>
            </motion.div>
          ) : lastBonusTurn && isMyTurn ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: 2, duration: 0.4 }}
              className="px-3 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md shadow-amber-500/25"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Box Captured! Bonus Turn! 🔥</span>
            </motion.div>
          ) : (
            <div
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all ${
                isMyTurn
                  ? role === 'owner'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 animate-pulse'
                    : 'bg-pink-500 text-white shadow-md shadow-pink-500/25 animate-pulse'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text)]/70 border border-[var(--theme-border)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isMyTurn
                  ? 'Your Turn ✨ Tap a line between dots'
                  : !partnerInGame && isPartnerOnline
                  ? `${partnerName}'s Turn (In Chat) • Tap Nudge!`
                  : `${partnerName}'s Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        {/* 16 Boxes (4x4 Boxes = 5x5 Dots) Coordinate Canvas: Zero Gaps! */}
        <div className="w-full max-w-[340px] aspect-square bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] rounded-[2.5rem] p-4 shadow-xl flex items-center justify-center relative overflow-hidden">
          {/* Subtle Ambient Gradients */}
          <div className="absolute top-0 left-0 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Coordinate Layout Stage */}
          <div className="w-full h-full relative">
            {/* 1. Box Interiors (4x4 = 16 Boxes) */}
            {Array.from({ length: BOX_ROWS }).map((_, r) =>
              Array.from({ length: BOX_COLS }).map((_, c) => {
                const boxOwner = gameState.boxes[r][c];
                return (
                  <div
                    key={`box-${r}-${c}`}
                    className="absolute p-1"
                    style={{
                      left: `${c * 25}%`,
                      top: `${r * 25}%`,
                      width: '25%',
                      height: '25%',
                    }}
                  >
                    <div className="w-full h-full rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300">
                      {boxOwner && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: 'spring',
                            damping: 12,
                            stiffness: 240,
                          }}
                          className={`w-full h-full rounded-xl flex flex-col items-center justify-center border shadow-sm ${
                            boxOwner === 'owner'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-500'
                              : 'bg-pink-500/20 border-pink-400 text-pink-500'
                          }`}
                        >
                          <span className="text-base sm:text-lg select-none">
                            {boxOwner === 'owner' ? '💙' : '💖'}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* 2. Horizontal Lines: 5 rows x 4 cols (connects dot center to dot center fully!) */}
            {Array.from({ length: DOT_ROWS }).map((_, r) =>
              Array.from({ length: BOX_COLS }).map((_, c) => {
                const lineOwner = gameState.hLines[r][c];
                const isDrawn = lineOwner !== null;
                return (
                  <div
                    key={`h-${r}-${c}`}
                    onClick={() => handleDrawHLine(r, c)}
                    className="absolute z-10 flex items-center justify-center cursor-pointer group -translate-y-1/2"
                    style={{
                      left: `${c * 25}%`,
                      top: `${r * 25}%`,
                      width: '25%',
                      height: '28px',
                    }}
                  >
                    <div
                      className={`w-full rounded-full transition-all duration-200 ${
                        isDrawn
                          ? lineOwner === 'owner'
                            ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] h-2'
                            : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.9)] h-2'
                          : isMyTurn
                          ? 'bg-[var(--theme-border)]/70 hover:bg-[var(--theme-accent)]/80 group-hover:h-2 h-1.5'
                          : 'bg-[var(--theme-border)]/40 h-1'
                      }`}
                    />
                  </div>
                );
              })
            )}

            {/* 3. Vertical Lines: 4 rows x 5 cols (connects dot center to dot center fully!) */}
            {Array.from({ length: BOX_ROWS }).map((_, r) =>
              Array.from({ length: DOT_COLS }).map((_, c) => {
                const lineOwner = gameState.vLines[r][c];
                const isDrawn = lineOwner !== null;
                return (
                  <div
                    key={`v-${r}-${c}`}
                    onClick={() => handleDrawVLine(r, c)}
                    className="absolute z-10 flex items-center justify-center cursor-pointer group -translate-x-1/2"
                    style={{
                      left: `${c * 25}%`,
                      top: `${r * 25}%`,
                      width: '28px',
                      height: '25%',
                    }}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isDrawn
                          ? lineOwner === 'owner'
                            ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] w-2'
                            : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.9)] w-2'
                          : isMyTurn
                          ? 'bg-[var(--theme-border)]/70 hover:bg-[var(--theme-accent)]/80 group-hover:w-2 w-1.5'
                          : 'bg-[var(--theme-border)]/40 w-1'
                      }`}
                    />
                  </div>
                );
              })
            )}

            {/* 4. Dots: 5 rows x 5 cols (Rendered at z-20 at exact dot centers) */}
            {Array.from({ length: DOT_ROWS }).map((_, r) =>
              Array.from({ length: DOT_COLS }).map((_, c) => (
                <div
                  key={`dot-${r}-${c}`}
                  className="absolute z-20 w-3.5 h-3.5 rounded-full bg-[var(--theme-text)] shadow-sm -translate-x-1/2 -translate-y-1/2 ring-2 ring-[var(--theme-surface)] pointer-events-none"
                  style={{
                    left: `${c * 25}%`,
                    top: `${r * 25}%`,
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Play Again / Rematch Button */}
        {gameState.winner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 w-full max-w-[340px]"
          >
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-[var(--theme-accent)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[var(--theme-accent)]/30 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again (Rematch)</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Floating Quick Banter & Chat Icon */}
      <InGameChatDrawer
        messages={inGameMessages}
        onSendMessage={handleSendInGameMessage}
        role={role}
        userProfile={userProfile}
        partnerProfile={partnerProfile}
      />
    </div>
  );
}
