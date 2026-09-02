import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2,
  ArrowLeft,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  Heart,
  X as XIcon,
  Circle,
  Clock,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile, Message, InGameChatMessage } from '../types';
import { PartnerMainChatBubble } from './PartnerMainChatBubble';
import { InGameChatDrawer } from './InGameChatDrawer';

export interface TicTacToeProps {
  sessionId: string;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  latestPartnerMessage?: Message | null;
  isPartnerOnline?: boolean;
  onClose: () => void;
  onSendNudge?: (type: string) => void;
  onSendMainChatMessage?: (text: string) => Promise<void> | void;
}

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // cols
  [0, 4, 8],
  [2, 4, 6], // diags
];

export default function TicTacToe({
  sessionId,
  role,
  userProfile,
  partnerProfile,
  latestPartnerMessage = null,
  isPartnerOnline = false,
  onClose,
  onSendNudge,
  onSendMainChatMessage,
}: TicTacToeProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<UserRole>('owner');
  const [winner, setWinner] = useState<UserRole | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ owner: 0, partner: 0, draws: 0 });
  const [partnerInGame, setPartnerInGame] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [inGameMessages, setInGameMessages] = useState<InGameChatMessage[]>([]);

  const channelRef = useRef<any>(null);
  const myName =
    userProfile?.display_name || (role === 'owner' ? 'Rahul' : 'Nusrat');
  const partnerName =
    partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');
  const myPhoto = userProfile?.photo_url;
  const partnerPhoto = partnerProfile?.photo_url;

  // Check winning logic
  const evaluateWinner = (squares: (string | null)[]) => {
    for (let i = 0; i < WINNING_COMBOS.length; i++) {
      const [a, b, c] = WINNING_COMBOS[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return {
          winner: (squares[a] === 'X' ? 'owner' : 'partner') as UserRole,
          line: [a, b, c],
        };
      }
    }
    if (squares.every((s) => s !== null)) {
      return { winner: 'draw' as const, line: null };
    }
    return null;
  };

  // Setup Realtime Channel (Presence + Broadcast + DB fallback)
  useEffect(() => {
    let isSubscribed = true;

    // 1. Initial State Fetch from DB
    const fetchGameFromDB = async () => {
      try {
        const { data } = await supabase
          .from('games')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (data && isSubscribed) {
          if (data.board) setBoard(data.board);
          if (data.turn) setTurn(data.turn);
          if (data.winner) setWinner(data.winner);
          if (data.scores) setScores(data.scores);
          if (data.board) {
            const evalResult = evaluateWinner(data.board);
            if (evalResult?.line) setWinningLine(evalResult.line);
          }
        } else if (!data && isSubscribed) {
          // Initialize game record
          const initialData = {
            id: sessionId,
            board: Array(9).fill(null),
            turn: 'owner',
            status: 'playing',
            winner: null,
            scores: { owner: 0, partner: 0, draws: 0 },
            players: { [role]: userProfile?.uid || role },
          };
          supabase.from('games').insert([initialData]).then(() => {}, () => {});
        }
      } catch (err) {
        console.warn('Game DB fetch notice:', err);
      }
    };

    fetchGameFromDB();

    // 2. Realtime Channel with Presence & Broadcast
    const channelName = `game_arena:${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userProfile?.uid || role },
        broadcast: { self: false, ack: true },
      },
    });
    channelRef.current = channel;

    // Presence handlers
    const updatePresence = () => {
      if (!isSubscribed) return;
      const state = channel.presenceState();
      const presences = Object.values(state).flat() as any[];
      const otherPlayerPresent = presences.some(
        (p) => p && p.role && p.role !== role
      );
      setPartnerInGame(otherPlayerPresent);
    };

    channel
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        updatePresence();
        // If partner just joined, send them current state so they sync immediately
        const hasPartner = newPresences.some((p: any) => p.role !== role);
        if (hasPartner) {
          channel.send({
            type: 'broadcast',
            event: 'game_sync',
            payload: { board, turn, winner, scores, winningLine },
          });
        }
      })
      .on('presence', { event: 'leave' }, updatePresence)
      .on('broadcast', { event: 'game_sync' }, ({ payload }) => {
        if (!isSubscribed || !payload) return;
        if (payload.board) setBoard(payload.board);
        if (payload.turn) setTurn(payload.turn);
        if (payload.winner !== undefined) setWinner(payload.winner);
        if (payload.scores) setScores(payload.scores);
        if (payload.winningLine !== undefined) setWinningLine(payload.winningLine);
      })
      .on('broadcast', { event: 'game_move' }, ({ payload }) => {
        if (!isSubscribed || !payload) return;
        const { newBoard, nextTurn, winnerResult, line, updatedScores } = payload;
        setBoard(newBoard);
        setTurn(nextTurn);
        setWinner(winnerResult);
        setWinningLine(line);
        if (updatedScores) setScores(updatedScores);

        // Haptic feedback on partner move
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(winnerResult ? [100, 50, 200] : 40);
          } catch (_) {}
        }
      })
      .on('broadcast', { event: 'game_reset' }, ({ payload }) => {
        if (!isSubscribed) return;
        setBoard(Array(9).fill(null));
        setWinner(null);
        setWinningLine(null);
        if (payload?.turn) setTurn(payload.turn);
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

  // Handle Player Move
  const handleMove = async (index: number) => {
    if (board[index] || winner || turn !== role) return;

    // Haptic
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(25);
      } catch (_) {}
    }

    const mySymbol = role === 'owner' ? 'X' : 'O';
    const newBoard = [...board];
    newBoard[index] = mySymbol;

    const evalResult = evaluateWinner(newBoard);
    const newWinner = evalResult?.winner || null;
    const newLine = evalResult?.line || null;
    const nextTurn = newWinner ? turn : role === 'owner' ? 'partner' : 'owner';

    // Update Scores
    let updatedScores = { ...scores };
    if (newWinner === 'owner') {
      updatedScores.owner += 1;
    } else if (newWinner === 'partner') {
      updatedScores.partner += 1;
    } else if (newWinner === 'draw') {
      updatedScores.draws += 1;
    }

    setBoard(newBoard);
    setTurn(nextTurn);
    setWinner(newWinner);
    setWinningLine(newLine);
    if (newWinner) setScores(updatedScores);

    // 1. Broadcast immediately to partner (0ms latency)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_move',
      payload: {
        newBoard,
        nextTurn,
        winnerResult: newWinner,
        line: newLine,
        updatedScores,
      },
    });

    // 2. Persist to Supabase in background
    try {
      await supabase
        .from('games')
        .upsert({
          id: sessionId,
          board: newBoard,
          turn: nextTurn,
          winner: newWinner,
          status: newWinner ? 'finished' : 'playing',
          scores: updatedScores,
        });
    } catch (err) {
      console.warn('Game save warning:', err);
    }
  };

  // Reset Game for Rematch
  const handleReset = async () => {
    const nextTurn = role === 'owner' ? 'partner' : 'owner';
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setTurn(nextTurn);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_reset',
      payload: { turn: nextTurn },
    });

    try {
      await supabase
        .from('games')
        .upsert({
          id: sessionId,
          board: Array(9).fill(null),
          turn: nextTurn,
          winner: null,
          status: 'playing',
        });
    } catch (err) {
      console.warn('Game reset save warning:', err);
    }
  };

  // Send In-Game Temporary Chat or Banter
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

  // Nudge Partner to Join Game
  const handleNudgePartner = () => {
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 3000);

    // Call high-level nudge if provided
    onSendNudge?.('sparkle');

    // Broadcast in game channel
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_nudge',
      payload: { from: myName },
    });

    // Also send an invitation nudge to the regular chat so partner sees it
    if (onSendMainChatMessage) {
      onSendMainChatMessage(
        `🎮 ${myName} is waiting for you in Tic Tac Toe! Tap to play together 💕`
      );
    }
  };

  const isMyTurn = turn === role && !winner;

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300">
      {/* 1. Floating Main Chat Speech Bubble (if partner messages in regular chat) */}
      <PartnerMainChatBubble
        latestPartnerMessage={latestPartnerMessage}
        partnerProfile={partnerProfile}
        role={role}
        onSendMainChatMessage={async (text) => {
          if (onSendMainChatMessage) await onSendMainChatMessage(text);
        }}
      />

      {/* Floating Back Button - No Top Bar */}
      <button
        onClick={onClose}
        className="fixed top-4 left-4 z-40 p-2.5 rounded-full bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer"
        title="Back to Chat"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Floating Nudge Button (if partner not yet in game) */}
      {!partnerInGame && (
        <button
          onClick={handleNudgePartner}
          className={`fixed top-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-md ${
            nudgeSent
              ? 'bg-emerald-500 text-white'
              : 'bg-pink-500 text-white hover:opacity-90 animate-pulse'
          }`}
          title={`Nudge ${partnerName} to join`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="text-[11px]">{nudgeSent ? 'Nudged! 💖' : `Nudge ${partnerName}`}</span>
        </button>
      )}

      {/* Center Content (Scoreboard & Interactive Game Canvas) */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-14 pb-2 max-w-lg mx-auto w-full overflow-y-auto">
        {/* Player Versus Scoreboard */}
        <div className="w-full grid grid-cols-3 items-center gap-2 mb-4 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-3 shadow-sm">
          {/* Player 1 (Rahul / Owner - Blue 💙) */}
          <div
            className={`flex flex-col items-center p-2 rounded-2xl transition-all ${
              turn === 'owner' && !winner
                ? 'bg-sky-500/15 ring-2 ring-sky-400 shadow-md'
                : 'opacity-80'
            }`}
          >
            <div className="relative">
              {role === 'owner' ? (
                myPhoto ? (
                  <img
                    src={myPhoto}
                    alt="You"
                    className="w-10 h-10 rounded-full object-cover border-2 border-sky-400"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm">
                    R
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Rahul"
                  className="w-10 h-10 rounded-full object-cover border-2 border-sky-400"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm">
                  R
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                X
              </span>
            </div>
            <span className="text-xs font-bold mt-1 text-[var(--theme-text)]">
              {role === 'owner' ? 'You' : 'Rahul'}
            </span>
            <span className="text-lg font-black text-sky-500 leading-none">
              {scores.owner}
            </span>
          </div>

          {/* Versus Center Info */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--theme-text)]/40">
              VS
            </span>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--theme-text)]/60">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>Draws: {scores.draws}</span>
            </div>
          </div>

          {/* Player 2 (Nusrat / Partner - Pink 💖) */}
          <div
            className={`flex flex-col items-center p-2 rounded-2xl transition-all ${
              turn === 'partner' && !winner
                ? 'bg-pink-500/15 ring-2 ring-pink-400 shadow-md'
                : 'opacity-80'
            }`}
          >
            <div className="relative">
              {role === 'partner' ? (
                myPhoto ? (
                  <img
                    src={myPhoto}
                    alt="You"
                    className="w-10 h-10 rounded-full object-cover border-2 border-pink-400"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-sm">
                    N
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Nusrat"
                  className="w-10 h-10 rounded-full object-cover border-2 border-pink-400"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-sm">
                  N
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                O
              </span>
            </div>
            <span className="text-xs font-bold mt-1 text-[var(--theme-text)]">
              {role === 'partner' ? 'You' : 'Nusrat'}
            </span>
            <span className="text-lg font-black text-pink-500 leading-none">
              {scores.partner}
            </span>
          </div>
        </div>

        {/* Turn / Winner Status Pill */}
        <div className="mb-4 text-center">
          {winner ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-sky-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 inline-flex"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {winner === 'draw'
                  ? "It's a Draw! 🤝"
                  : winner === role
                  ? 'You Won! 🎉🏆'
                  : `${partnerName} Won! 💕`}
              </span>
            </motion.div>
          ) : (
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5 transition-all ${
                isMyTurn
                  ? role === 'owner'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 animate-pulse'
                    : 'bg-pink-500 text-white shadow-md shadow-pink-500/25 animate-pulse'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text)]/70 border border-[var(--theme-border)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isMyTurn ? 'Your Turn ✨ Tap a tile' : `${partnerName}'s Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        {/* 3x3 Grid Board */}
        <div className="w-full max-w-[320px] aspect-square grid grid-cols-3 gap-2.5 p-3 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[2.5rem] shadow-xl">
          {board.map((cell, idx) => {
            const isWinningTile = winningLine?.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => handleMove(idx)}
                disabled={!!cell || !!winner || !isMyTurn}
                className={`relative aspect-square rounded-2xl text-4xl font-black flex items-center justify-center transition-all ${
                  isWinningTile
                    ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/40 scale-105 z-10 animate-pulse'
                    : cell
                    ? 'bg-[var(--theme-input-bg)] border border-[var(--theme-border)] cursor-default'
                    : isMyTurn
                    ? 'bg-[var(--theme-bg)] border-2 border-dashed border-[var(--theme-border)] hover:border-[var(--theme-accent)] active:scale-95 cursor-pointer'
                    : 'bg-[var(--theme-bg)]/50 border border-[var(--theme-border)]/40 cursor-not-allowed'
                }`}
              >
                {cell && (
                  <motion.span
                    initial={{ scale: 0, rotate: -25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className={
                      isWinningTile
                        ? 'text-white drop-shadow-md'
                        : cell === 'X'
                        ? 'text-sky-500'
                        : 'text-pink-500'
                    }
                  >
                    {cell === 'X' ? (
                      <XIcon className="w-9 h-9 stroke-[3]" />
                    ) : (
                      <Circle className="w-8 h-8 stroke-[3]" />
                    )}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        {/* Play Again / Rematch Button */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 w-full max-w-[320px]"
          >
            <button
              onClick={handleReset}
              className="w-full py-3.5 bg-[var(--theme-accent)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[var(--theme-accent)]/30 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again (Rematch)</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* 5. Bottom Temporary Game Chat & Quick Banter Strip */}
      <div className="w-full shrink-0 border-t border-[var(--theme-border)]/50 bg-[var(--theme-surface)]/60 backdrop-blur-md pt-2 pb-3 px-2">
        <InGameChatDrawer
          messages={inGameMessages}
          onSendMessage={handleSendInGameMessage}
          role={role}
          userProfile={userProfile}
          partnerProfile={partnerProfile}
        />
      </div>
    </div>
  );
}
