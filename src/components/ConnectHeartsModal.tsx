import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  ArrowLeft,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  Heart,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile, Message, InGameChatMessage } from '../types';
import { PartnerMainChatBubble } from './PartnerMainChatBubble';
import { InGameChatDrawer } from './InGameChatDrawer';

export interface ConnectHeartsProps {
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

const ROWS = 6;
const COLS = 7;

type CellValue = UserRole | null;
type BoardState = CellValue[][];

const createEmptyBoard = (): BoardState => {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
};

export default function ConnectHearts({
  sessionId,
  role,
  userProfile,
  partnerProfile,
  latestPartnerMessage = null,
  isPartnerOnline = false,
  onClose,
  onSendNudge,
  onSendMainChatMessage,
}: ConnectHeartsProps) {
  const [board, setBoard] = useState<BoardState>(createEmptyBoard);
  const [turn, setTurn] = useState<UserRole>('owner');
  const [winner, setWinner] = useState<UserRole | 'draw' | null>(null);
  const [winningCells, setWinningCells] = useState<[number, number][] | null>(null);
  const [scores, setScores] = useState({ owner: 0, partner: 0, draws: 0 });
  const [partnerInGame, setPartnerInGame] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [inGameMessages, setInGameMessages] = useState<InGameChatMessage[]>([]);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const channelRef = useRef<any>(null);
  const myName =
    userProfile?.display_name || (role === 'owner' ? 'Rahul' : 'Nusrat');
  const partnerName =
    partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');
  const myPhoto = userProfile?.photo_url;
  const partnerPhoto = partnerProfile?.photo_url;

  // Check Winning 4-in-a-row
  const evaluateWinner = (grid: BoardState) => {
    // 1. Horizontal Check
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const p = grid[r][c];
        if (
          p &&
          p === grid[r][c + 1] &&
          p === grid[r][c + 2] &&
          p === grid[r][c + 3]
        ) {
          return {
            winner: p,
            cells: [
              [r, c],
              [r, c + 1],
              [r, c + 2],
              [r, c + 3],
            ] as [number, number][],
          };
        }
      }
    }

    // 2. Vertical Check
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 4; r++) {
        const p = grid[r][c];
        if (
          p &&
          p === grid[r + 1][c] &&
          p === grid[r + 2][c] &&
          p === grid[r + 3][c]
        ) {
          return {
            winner: p,
            cells: [
              [r, c],
              [r + 1, c],
              [r + 2, c],
              [r + 3, c],
            ] as [number, number][],
          };
        }
      }
    }

    // 3. Diagonal Down-Right (\)
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const p = grid[r][c];
        if (
          p &&
          p === grid[r + 1][c + 1] &&
          p === grid[r + 2][c + 2] &&
          p === grid[r + 3][c + 3]
        ) {
          return {
            winner: p,
            cells: [
              [r, c],
              [r + 1, c + 1],
              [r + 2, c + 2],
              [r + 3, c + 3],
            ] as [number, number][],
          };
        }
      }
    }

    // 4. Diagonal Up-Right (/)
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const p = grid[r][c];
        if (
          p &&
          p === grid[r - 1][c + 1] &&
          p === grid[r - 2][c + 2] &&
          p === grid[r - 3][c + 3]
        ) {
          return {
            winner: p,
            cells: [
              [r, c],
              [r - 1, c + 1],
              [r - 2, c + 2],
              [r - 3, c + 3],
            ] as [number, number][],
          };
        }
      }
    }

    // Check Draw (all top cells occupied)
    const isDraw = grid[0].every((cell) => cell !== null);
    if (isDraw) {
      return { winner: 'draw' as const, cells: null };
    }

    return null;
  };

  // Setup Realtime Channel
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
          if (data.board && Array.isArray(data.board)) {
            setBoard(data.board);
            const evalResult = evaluateWinner(data.board);
            if (evalResult?.cells) setWinningCells(evalResult.cells);
          }
          if (data.turn) setTurn(data.turn);
          if (data.winner) setWinner(data.winner);
          if (data.scores) setScores(data.scores);
        } else if (!data && isSubscribed) {
          const initialData = {
            id: sessionId,
            board: createEmptyBoard(),
            turn: 'owner',
            status: 'playing',
            winner: null,
            scores: { owner: 0, partner: 0, draws: 0 },
            players: { [role]: userProfile?.uid || role },
          };
          supabase.from('games').insert([initialData]).then(() => {}, () => {});
        }
      } catch (err) {
        console.warn('ConnectHearts fetch note:', err);
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
      const otherPlayerPresent = presences.some(
        (p) => p && p.role && p.role !== role
      );
      setPartnerInGame(otherPlayerPresent);
    };

    channel
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        updatePresence();
        const hasPartner = newPresences.some((p: any) => p.role !== role);
        if (hasPartner) {
          channel.send({
            type: 'broadcast',
            event: 'game_sync',
            payload: { board, turn, winner, scores, winningCells },
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
        if (payload.winningCells !== undefined) setWinningCells(payload.winningCells);
      })
      .on('broadcast', { event: 'game_move' }, ({ payload }) => {
        if (!isSubscribed || !payload) return;
        const { newBoard, nextTurn, winnerResult, cells, updatedScores } = payload;
        setBoard(newBoard);
        setTurn(nextTurn);
        setWinner(winnerResult);
        setWinningCells(cells);
        if (updatedScores) setScores(updatedScores);

        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(winnerResult ? [100, 50, 200] : 35);
          } catch (_) {}
        }
      })
      .on('broadcast', { event: 'game_reset' }, ({ payload }) => {
        if (!isSubscribed) return;
        setBoard(createEmptyBoard());
        setWinner(null);
        setWinningCells(null);
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

  // Drop Disc into Column
  const handleDropDisc = async (col: number) => {
    if (winner || turn !== role) return;

    // Check if column is already full
    if (board[0][col] !== null) return;

    // Find lowest available row in column
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === null) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return;

    // Haptic feedback
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(30);
      } catch (_) {}
    }

    const newBoard = board.map((row) => [...row]);
    newBoard[targetRow][col] = role;

    const evalResult = evaluateWinner(newBoard);
    const newWinner = evalResult?.winner || null;
    const newCells = evalResult?.cells || null;
    const nextTurn = newWinner ? turn : role === 'owner' ? 'partner' : 'owner';

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
    setWinningCells(newCells);
    if (newWinner) setScores(updatedScores);

    // 1. Broadcast immediately (0ms latency)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_move',
      payload: {
        newBoard,
        nextTurn,
        winnerResult: newWinner,
        cells: newCells,
        updatedScores,
      },
    });

    // 2. Persist to DB in background
    try {
      await supabase.from('games').upsert({
        id: sessionId,
        board: newBoard,
        turn: nextTurn,
        winner: newWinner,
        status: newWinner ? 'finished' : 'playing',
        scores: updatedScores,
      });
    } catch (err) {
      console.warn('ConnectHearts save warning:', err);
    }
  };

  // Reset Game for Rematch
  const handleReset = async () => {
    const nextTurn = role === 'owner' ? 'partner' : 'owner';
    const cleanBoard = createEmptyBoard();
    setBoard(cleanBoard);
    setWinner(null);
    setWinningCells(null);
    setTurn(nextTurn);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_reset',
      payload: { turn: nextTurn },
    });

    try {
      await supabase.from('games').upsert({
        id: sessionId,
        board: cleanBoard,
        turn: nextTurn,
        winner: null,
        status: 'playing',
      });
    } catch (err) {
      console.warn('ConnectHearts reset warning:', err);
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
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 3000);

    onSendNudge?.('sparkle');

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_nudge',
      payload: { from: myName },
    });

    if (onSendMainChatMessage) {
      onSendMainChatMessage(
        `💖 ${myName} wants to play Connect Hearts with you! Tap to drop hearts together 💕`
      );
    }
  };

  const isMyTurn = turn === role && !winner;

  return (
    <div className="fixed inset-0 z-[160] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300">
      {/* 1. Floating Main Chat Speech Bubble */}
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

      {/* Center Content (Scoreboard & Interactive Connect Hearts Board) */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 pt-14 pb-2 max-w-lg mx-auto w-full overflow-y-auto">
        {/* Versus Scoreboard */}
        <div className="w-full grid grid-cols-3 items-center gap-2 mb-3 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-2.5 shadow-sm">
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
                    className="w-9 h-9 rounded-full object-cover border-2 border-sky-400"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                    R
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Rahul"
                  className="w-9 h-9 rounded-full object-cover border-2 border-sky-400"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                  R
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[9px] font-black shadow-sm">
                💙
              </span>
            </div>
            <span className="text-[11px] font-bold mt-1 text-[var(--theme-text)]">
              {role === 'owner' ? 'You' : 'Rahul'}
            </span>
            <span className="text-base font-black text-sky-500 leading-none">
              {scores.owner}
            </span>
          </div>

          {/* Versus Center Info */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text)]/40">
              Connect Hearts
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
                    className="w-9 h-9 rounded-full object-cover border-2 border-pink-400"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-xs">
                    N
                  </div>
                )
              ) : partnerPhoto ? (
                <img
                  src={partnerPhoto}
                  alt="Nusrat"
                  className="w-9 h-9 rounded-full object-cover border-2 border-pink-400"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-xs">
                  N
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white flex items-center justify-center text-[9px] font-black shadow-sm">
                💖
              </span>
            </div>
            <span className="text-[11px] font-bold mt-1 text-[var(--theme-text)]">
              {role === 'partner' ? 'You' : 'Nusrat'}
            </span>
            <span className="text-base font-black text-pink-500 leading-none">
              {scores.partner}
            </span>
          </div>
        </div>

        {/* Turn / Winner Status Pill */}
        <div className="mb-3 text-center">
          {winner ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-4 py-1.5 rounded-full bg-[var(--theme-accent)] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[var(--theme-accent)]/30 flex items-center gap-2 inline-flex"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {winner === 'draw'
                  ? "It's a Draw! 🤝"
                  : winner === role
                  ? 'You Connected 4! 🎉💖'
                  : `${partnerName} Won! 💕`}
              </span>
            </motion.div>
          ) : (
            <div
              className={`px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all ${
                isMyTurn
                  ? 'bg-[var(--theme-accent)] text-white shadow-md shadow-[var(--theme-accent)]/20 animate-pulse'
                  : 'bg-[var(--theme-surface)] text-[var(--theme-text)]/70 border border-[var(--theme-border)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isMyTurn
                  ? 'Your Turn ✨ Tap any column'
                  : `${partnerName}'s Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        {/* Column Drop Indicator Arrows (Desktop / Hover) */}
        <div className="w-full max-w-[340px] grid grid-cols-7 gap-1.5 px-3 mb-1">
          {Array.from({ length: COLS }).map((_, c) => {
            const isColFull = board[0][c] !== null;
            const isHovered = hoveredCol === c && isMyTurn && !isColFull;
            return (
              <div
                key={c}
                className="h-5 flex items-center justify-center transition-all"
              >
                {isHovered && (
                  <motion.div
                    initial={{ y: -4, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-[var(--theme-accent)]"
                  >
                    <ChevronDown className="w-4 h-4 stroke-[3] animate-bounce" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Connect Hearts 7x6 Board */}
        <div className="w-full max-w-[340px] bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] rounded-[2rem] p-3 shadow-xl relative overflow-hidden">
          <div className="grid grid-cols-7 gap-1.5 relative z-10">
            {Array.from({ length: COLS }).map((_, c) => {
              const isColFull = board[0][c] !== null;
              return (
                <div
                  key={c}
                  onClick={() => handleDropDisc(c)}
                  onMouseEnter={() => setHoveredCol(c)}
                  onMouseLeave={() => setHoveredCol(null)}
                  className={`flex flex-col gap-1.5 cursor-pointer select-none rounded-xl transition-colors p-0.5 ${
                    isMyTurn && !isColFull
                      ? 'hover:bg-[var(--theme-accent)]/10 active:scale-[0.98]'
                      : ''
                  }`}
                >
                  {Array.from({ length: ROWS }).map((_, r) => {
                    const cell = board[r][c];
                    const isWinning = winningCells?.some(
                      ([wr, wc]) => wr === r && wc === c
                    );

                    return (
                      <div
                        key={`${r}-${c}`}
                        className="aspect-square w-full rounded-full bg-[var(--theme-bg)] border border-[var(--theme-border)]/70 flex items-center justify-center relative overflow-hidden shadow-inner"
                      >
                        {cell && (
                          <motion.div
                            initial={{ y: -120 - r * 15, opacity: 0.3 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              damping: 14,
                              stiffness: 280,
                            }}
                            className={`w-full h-full rounded-full flex items-center justify-center transition-all ${
                              isWinning
                                ? 'ring-4 ring-amber-400 shadow-lg scale-95 animate-pulse'
                                : ''
                            } ${
                              cell === 'owner'
                                ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md'
                                : 'bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-md'
                            }`}
                          >
                            <span className="text-xs sm:text-sm drop-shadow-sm select-none">
                              {cell === 'owner' ? '💙' : '💖'}
                            </span>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Play Again / Rematch Button */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 w-full max-w-[340px]"
          >
            <button
              onClick={handleReset}
              className="w-full py-3 bg-[var(--theme-accent)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[var(--theme-accent)]/30 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again (Rematch)</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Bottom Temporary Game Chat & Quick Banter Strip */}
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
