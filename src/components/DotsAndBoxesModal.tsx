import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Grid,
  ArrowLeft,
  RotateCcw,
  Bell,
  Sparkles,
  Trophy,
  Heart,
  Clock,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile, Message, InGameChatMessage } from '../types';
import { PartnerMainChatBubble } from './PartnerMainChatBubble';
import { InGameChatDrawer } from './InGameChatDrawer';

export interface DotsAndBoxesProps {
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

// 4x4 dots = 3x3 boxes (9 boxes total)
const DOT_ROWS = 4;
const DOT_COLS = 4;
const BOX_ROWS = 3;
const BOX_COLS = 3;
const TOTAL_BOXES = BOX_ROWS * BOX_COLS; // 9

type LineOwner = UserRole | null;
type BoxOwner = UserRole | null;

interface GameState {
  // horizontalLines: 4 rows x 3 cols
  hLines: LineOwner[][];
  // verticalLines: 3 rows x 4 cols
  vLines: LineOwner[][];
  // boxes: 3 rows x 3 cols
  boxes: BoxOwner[][];
  turn: UserRole;
  winner: UserRole | 'draw' | null;
  scores: { owner: 0; partner: 0 };
}

const createInitialState = (): GameState => ({
  hLines: Array.from({ length: DOT_ROWS }, () => Array(BOX_COLS).fill(null)),
  vLines: Array.from({ length: BOX_ROWS }, () => Array(DOT_COLS).fill(null)),
  boxes: Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS).fill(null)),
  turn: 'owner', // Rahul starts first or alternating
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
  onClose,
  onSendNudge,
  onSendMainChatMessage,
}: DotsAndBoxesProps) {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [lastBonusTurn, setLastBonusTurn] = useState<boolean>(false);
  const [partnerInGame, setPartnerInGame] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [inGameMessages, setInGameMessages] = useState<InGameChatMessage[]>([]);

  const channelRef = useRef<any>(null);

  // Rahul is owner (Blue 💙), Nusrat is partner (Pink 💖)
  const isOwnerMe = role === 'owner';
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
          if (data.game_data) {
            setGameState(data.game_data);
          } else if (data.board && data.board.hLines) {
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
      const otherPresent = presences.some(
        (p) => p && p.role && p.role !== role
      );
      setPartnerInGame(otherPresent);
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
            payload: { gameState },
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
        setLastBonusTurn(payload.bonusTurn || false);

        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(payload.newGameState.winner ? [100, 50, 200] : payload.bonusTurn ? [50, 30, 50] : 30);
          } catch (_) {}
        }
      })
      .on('broadcast', { event: 'game_reset' }, ({ payload }) => {
        if (!isSubscribed) return;
        setGameState(payload?.newGameState || createInitialState());
        setLastBonusTurn(false);
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

  // Click handler to draw a Horizontal Line
  const handleDrawHLine = (r: number, c: number) => {
    if (gameState.winner || gameState.turn !== role) return;
    if (gameState.hLines[r][c] !== null) return; // already drawn

    makeMove({ type: 'h', r, c });
  };

  // Click handler to draw a Vertical Line
  const handleDrawVLine = (r: number, c: number) => {
    if (gameState.winner || gameState.turn !== role) return;
    if (gameState.vLines[r][c] !== null) return; // already drawn

    makeMove({ type: 'v', r, c });
  };

  // Core Dots & Boxes Engine
  const makeMove = async (line: { type: 'h' | 'v'; r: number; c: number }) => {
    // 1. Clone state
    const newHLines = gameState.hLines.map((row) => [...row]);
    const newVLines = gameState.vLines.map((row) => [...row]);
    const newBoxes = gameState.boxes.map((row) => [...row]);
    const newScores = { ...gameState.scores };

    // 2. Mark the line with current player's role
    if (line.type === 'h') {
      newHLines[line.r][line.c] = role;
    } else {
      newVLines[line.r][line.c] = role;
    }

    // 3. Check for newly completed boxes
    let completedAnyBox = false;

    for (let br = 0; br < BOX_ROWS; br++) {
      for (let bc = 0; bc < BOX_COLS; bc++) {
        // Only check uncompleted boxes
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

    // 4. Determine next turn:
    // If a box was completed, player gets a BONUS TURN!
    // Otherwise, turn switches to other player.
    let nextTurn = gameState.turn;
    if (!completedAnyBox) {
      nextTurn = role === 'owner' ? 'partner' : 'owner';
    }

    // 5. Check if all 9 boxes are claimed
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

    // Haptic feedback
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(newWinner ? [100, 50, 200] : completedAnyBox ? [60, 40, 60] : 30);
      } catch (_) {}
    }

    // Broadcast immediately (zero latency)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_move',
      payload: {
        newGameState: nextGameState,
        bonusTurn: completedAnyBox && !newWinner,
      },
    });

    // Save state to Supabase in background
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
        `💖 ${myName} wants to play Dots & Hearts with you! Tap to claim your love boxes 💕`
      );
    }
  };

  const isMyTurn = gameState.turn === role && !gameState.winner;

  // Visual Colors: Rahul = Sky Blue 💙, Nusrat = Rose Pink 💖
  const rahulColor = {
    bg: 'bg-sky-500',
    border: 'border-sky-400',
    text: 'text-sky-500',
    badge: '💙',
    fill: 'rgba(14, 165, 233, 0.25)',
  };

  const nusratColor = {
    bg: 'bg-pink-500',
    border: 'border-pink-400',
    text: 'text-pink-500',
    badge: '💖',
    fill: 'rgba(236, 72, 153, 0.25)',
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300">
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

      {/* Center Content: Scoreboard & Dots & Boxes Arena */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 pt-14 pb-2 max-w-lg mx-auto w-full overflow-y-auto">
        {/* Versus Scoreboard */}
        <div className="w-full grid grid-cols-3 items-center gap-2 mb-3 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-2.5 shadow-sm">
          {/* Player 1 (Rahul / Owner - Blue 💙) */}
          <div
            className={`flex flex-col items-center p-2 rounded-2xl transition-all ${
              gameState.turn === 'owner' && !gameState.winner
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
              {gameState.scores.owner} / 9
            </span>
          </div>

          {/* Versus Center Info */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text)]/40">
              Dots & Hearts
            </span>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--theme-text)]/60">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>9 Boxes</span>
            </div>
          </div>

          {/* Player 2 (Nusrat / Partner - Pink 💖) */}
          <div
            className={`flex flex-col items-center p-2 rounded-2xl transition-all ${
              gameState.turn === 'partner' && !gameState.winner
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
              {gameState.scores.partner} / 9
            </span>
          </div>
        </div>

        {/* Turn & Bonus Announcement Status Pill */}
        <div className="mb-3 text-center">
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
              className="px-3.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md shadow-amber-500/25"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Box Captured! Bonus Turn! 🔥</span>
            </motion.div>
          ) : (
            <div
              className={`px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all ${
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
                  : `${partnerName}'s Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        {/* Dots and Boxes Game Canvas (4x4 Dots = 3x3 Boxes) */}
        <div className="w-full max-w-[340px] aspect-square bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] rounded-[2.5rem] p-4 shadow-xl flex items-center justify-center relative overflow-hidden">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Dynamic Grid Layout */}
          <div className="w-full h-full relative flex flex-col justify-between p-2">
            {/* 3 Rows of Boxes */}
            {Array.from({ length: BOX_ROWS }).map((_, r) => (
              <React.Fragment key={`row-wrap-${r}`}>
                {/* 1. Horizontal Lines Row (above box row r) */}
                <div className="flex items-center justify-between relative z-20 h-4">
                  {Array.from({ length: BOX_COLS }).map((_, c) => {
                    const lineOwner = gameState.hLines[r][c];
                    const isDrawn = lineOwner !== null;
                    return (
                      <React.Fragment key={`h-segment-${r}-${c}`}>
                        {/* Dot (r, c) */}
                        <div className="w-3.5 h-3.5 rounded-full bg-[var(--theme-text)]/70 shadow-sm shrink-0 ring-2 ring-[var(--theme-surface)]" />

                        {/* Horizontal Line between Dot (r, c) and Dot (r, c+1) */}
                        <div
                          onClick={() => handleDrawHLine(r, c)}
                          className={`flex-1 h-6 flex items-center justify-center cursor-pointer px-0.5 group`}
                        >
                          <div
                            className={`w-full h-1.5 rounded-full transition-all duration-200 ${
                              isDrawn
                                ? lineOwner === 'owner'
                                  ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] h-2'
                                  : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] h-2'
                                : isMyTurn
                                ? 'bg-[var(--theme-border)] hover:bg-[var(--theme-accent)]/60 group-hover:h-2'
                                : 'bg-[var(--theme-border)]/50'
                            }`}
                          />
                        </div>

                        {/* If last column in row, render the ending dot */}
                        {c === BOX_COLS - 1 && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[var(--theme-text)]/70 shadow-sm shrink-0 ring-2 ring-[var(--theme-surface)]" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 2. Vertical Lines & Box Interiors Row r */}
                <div className="flex-1 flex items-center justify-between relative z-10 my-0.5">
                  {Array.from({ length: BOX_COLS }).map((_, c) => {
                    const leftVLine = gameState.vLines[r][c];
                    const boxOwner = gameState.boxes[r][c];
                    return (
                      <React.Fragment key={`box-segment-${r}-${c}`}>
                        {/* Vertical Line on Left of Box (r, c) */}
                        <div
                          onClick={() => handleDrawVLine(r, c)}
                          className="w-6 h-full flex items-center justify-center cursor-pointer py-0.5 group shrink-0"
                        >
                          <div
                            className={`h-full w-1.5 rounded-full transition-all duration-200 ${
                              leftVLine !== null
                                ? leftVLine === 'owner'
                                  ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] w-2'
                                  : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] w-2'
                                : isMyTurn
                                ? 'bg-[var(--theme-border)] hover:bg-[var(--theme-accent)]/60 group-hover:w-2'
                                : 'bg-[var(--theme-border)]/50'
                            }`}
                          />
                        </div>

                        {/* Box Interior (r, c) */}
                        <div className="flex-1 h-full mx-0.5 rounded-2xl flex items-center justify-center relative overflow-hidden transition-all duration-300">
                          {boxOwner && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                type: 'spring',
                                damping: 12,
                                stiffness: 240,
                              }}
                              className={`w-full h-full rounded-2xl flex flex-col items-center justify-center p-1 border ${
                                boxOwner === 'owner'
                                  ? 'bg-sky-500/20 border-sky-400 text-sky-500 shadow-sm'
                                  : 'bg-pink-500/20 border-pink-400 text-pink-500 shadow-sm'
                              }`}
                            >
                              <span className="text-xl sm:text-2xl drop-shadow select-none">
                                {boxOwner === 'owner' ? '💙' : '💖'}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-wider leading-none mt-0.5">
                                {boxOwner === 'owner' ? 'Rahul' : 'Nusrat'}
                              </span>
                            </motion.div>
                          )}
                        </div>

                        {/* If last box in row, render the right vertical boundary line */}
                        {c === BOX_COLS - 1 && (
                          <div
                            onClick={() => handleDrawVLine(r, c + 1)}
                            className="w-6 h-full flex items-center justify-center cursor-pointer py-0.5 group shrink-0"
                          >
                            <div
                              className={`h-full w-1.5 rounded-full transition-all duration-200 ${
                                gameState.vLines[r][c + 1] !== null
                                  ? gameState.vLines[r][c + 1] === 'owner'
                                    ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] w-2'
                                    : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] w-2'
                                  : isMyTurn
                                  ? 'bg-[var(--theme-border)] hover:bg-[var(--theme-accent)]/60 group-hover:w-2'
                                  : 'bg-[var(--theme-border)]/50'
                              }`}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}

            {/* Bottom-most Horizontal Line Row (under the 3rd box row) */}
            <div className="flex items-center justify-between relative z-20 h-4">
              {Array.from({ length: BOX_COLS }).map((_, c) => {
                const lineOwner = gameState.hLines[BOX_ROWS][c];
                const isDrawn = lineOwner !== null;
                return (
                  <React.Fragment key={`bottom-h-segment-${c}`}>
                    {/* Dot */}
                    <div className="w-3.5 h-3.5 rounded-full bg-[var(--theme-text)]/70 shadow-sm shrink-0 ring-2 ring-[var(--theme-surface)]" />

                    {/* Horizontal Line */}
                    <div
                      onClick={() => handleDrawHLine(BOX_ROWS, c)}
                      className="flex-1 h-6 flex items-center justify-center cursor-pointer px-0.5 group"
                    >
                      <div
                        className={`w-full h-1.5 rounded-full transition-all duration-200 ${
                          isDrawn
                            ? lineOwner === 'owner'
                              ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] h-2'
                              : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] h-2'
                            : isMyTurn
                            ? 'bg-[var(--theme-border)] hover:bg-[var(--theme-accent)]/60 group-hover:h-2'
                            : 'bg-[var(--theme-border)]/50'
                        }`}
                      />
                    </div>

                    {c === BOX_COLS - 1 && (
                      <div className="w-3.5 h-3.5 rounded-full bg-[var(--theme-text)]/70 shadow-sm shrink-0 ring-2 ring-[var(--theme-surface)]" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rematch Button */}
        {gameState.winner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 w-full max-w-[340px]"
          >
            <button
              onClick={handleReset}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-pink-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again (Rematch)</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Bottom In-Game Banter Drawer */}
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
