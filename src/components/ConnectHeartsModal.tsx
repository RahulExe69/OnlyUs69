import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  Clock,
  ChevronDown,
  Minus,
  LogOut,
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
  onMinimize?: () => void;
  onLeave?: () => void;
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
  onMinimize,
  onLeave,
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
  const [lastDropped, setLastDropped] = useState<{ r: number; c: number } | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const channelRef = useRef<any>(null);
  const currentGameStateRef = useRef({
    board,
    turn,
    winner,
    scores,
    winningCells,
  });

  // Keep stateRef up to date to eliminate stale closures when partners re-join
  useEffect(() => {
    currentGameStateRef.current = {
      board,
      turn,
      winner,
      scores,
      winningCells,
    };
  }, [board, turn, winner, scores, winningCells]);

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
          if (data.status === 'closed') {
            onClose();
            return;
          }
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
          // Send active state through ref to prevent wiping game on rejoin!
          channel.send({
            type: 'broadcast',
            event: 'game_sync',
            payload: currentGameStateRef.current,
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
        const { newBoard, nextTurn, winnerResult, cells, updatedScores, lastDropped: ld } = payload;
        if (ld) setLastDropped(ld);
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
        setLastDropped(null);
        if (payload?.turn) setTurn(payload.turn);
      })
      .on('broadcast', { event: 'game_closed' }, () => {
        if (!isSubscribed) return;
        onClose();
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
        window.navigator.vibrate(28);
      } catch (_) {}
    }

    // Set last dropped for smooth animated ball drop
    setLastDropped({ r: targetRow, c: col });

    const newBoard = board.map((row) => [...row]);
    newBoard[targetRow][col] = role;

    const evalResult = evaluateWinner(newBoard);
    const newWinner = evalResult?.winner || null;
    const newCells = evalResult?.cells || null;
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
        lastDropped: { r: targetRow, c: col },
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
    setLastDropped(null);
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
        payload: { leftBy: role },
      });
      await supabase.from('games').update({ status: 'closed' }).eq('id', sessionId);
      await supabase
        .from('messages')
        .update({
          gameInvite: {
            sessionId: sessionId,
            gameType: 'connecthearts',
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

  const isMyTurn = turn === role && !winner;

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between overflow-hidden select-none">
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

      {/* Center Content (Scoreboard & Interactive Connect Hearts Board) */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 pt-12 pb-4 max-w-lg mx-auto w-full overflow-y-auto">
        {/* Sleek Compact Player Status Bar (Rahul vs Nusrat) */}
        <div className="w-full max-w-[340px] mb-2 px-3 py-1.5 rounded-2xl bg-[var(--theme-surface)]/90 backdrop-blur-md border border-[var(--theme-border)] shadow-sm flex items-center justify-between">
          {/* Left: Rahul (Owner - Sky Blue) */}
          <div
            className={`flex items-center gap-2 py-0.5 px-2 rounded-xl transition-all ${
              turn === 'owner' && !winner
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
              <span className="text-[11px] leading-tight text-[var(--theme-text)]">
                {role === 'owner' ? 'You' : 'Rahul'}
              </span>
              <span className="text-xs font-black text-sky-500 leading-tight">
                {scores.owner}
              </span>
            </div>
          </div>

          {/* Center: Title / Round / Draws Badge */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text)]/40">
              VS
            </span>
            {scores.draws > 0 && (
              <span className="text-[9px] font-bold text-[var(--theme-text)]/50">
                Draws: {scores.draws}
              </span>
            )}
          </div>

          {/* Right: Nusrat (Partner - Pink) */}
          <div
            className={`flex items-center gap-2 py-0.5 px-2 rounded-xl transition-all ${
              turn === 'partner' && !winner
                ? 'bg-pink-500/15 ring-1 ring-pink-400 font-bold'
                : 'opacity-75'
            }`}
          >
            <div className="flex flex-col items-end">
              <span className="text-[11px] leading-tight text-[var(--theme-text)]">
                {role === 'partner' ? 'You' : 'Nusrat'}
              </span>
              <span className="text-xs font-black text-pink-500 leading-tight">
                {scores.partner}
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

        {/* Turn / Winner Status Pill */}
        <div className="mb-2 text-center">
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
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all ${
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
                className="h-4 flex items-center justify-center transition-all"
              >
                {isHovered && (
                  <motion.div
                    initial={{ y: -3, opacity: 0 }}
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
                    const isJustDropped = lastDropped?.r === r && lastDropped?.c === c;

                    return (
                      <div
                        key={`${r}-${c}`}
                        className="aspect-square w-full rounded-full bg-[var(--theme-bg)] border border-[var(--theme-border)]/70 flex items-center justify-center relative overflow-hidden shadow-inner"
                      >
                        {cell && (
                          isJustDropped ? (
                            /* Lag-free animated ball drop with authentic gravity physics */
                            <motion.div
                              initial={{ y: -(r + 1) * 52 - 60, opacity: 0.8 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{
                                type: 'spring',
                                damping: 15,
                                stiffness: 300,
                                mass: 0.85,
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
                          ) : (
                            /* Settled discs stay stationary with 0 lag */
                            <div
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
                            </div>
                          )
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
