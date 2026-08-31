import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile } from '../types';

export interface TicTacToeProps {
  sessionId: string;
  role: UserRole;
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onClose: () => void;
}

export default function TicTacToe({ sessionId, role, userProfile, partnerProfile, onClose }: TicTacToeProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<UserRole>('owner');
  const [winner, setWinner] = useState<UserRole | 'draw' | null>(null);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  useEffect(() => {
    // 1. Initial fetch
    const fetchGame = async () => {
      const { data } = await supabase.from('games').select('*').eq('id', sessionId).single();
      if (data) {
        setBoard(data.board || Array(9).fill(null));
        setTurn(data.turn || 'owner');
        setWinner(data.winner || null);
        setStatus(data.status || 'playing');
      } else {
        const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
        const initialGame = {
          id: sessionId,
          board: Array(9).fill(null),
          turn: randomTurn,
          status: 'playing',
          winner: null,
          players: { [role]: userProfile?.uid }
        };
        await supabase.from('games').insert([initialGame]);
        setTurn(randomTurn);
        setStatus('playing');
      }
    };

    fetchGame();

    // 2. Realtime Postgres Changes Subscription
    const gameChannel = supabase.channel(`game:${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games', 
        filter: `id=eq.${sessionId}` 
      }, (payload: any) => {
        if (payload.new) {
          const data = payload.new;
          setBoard(data.board || Array(9).fill(null));
          setTurn(data.turn || 'owner');
          setWinner(data.winner || null);
          setStatus(data.status || 'playing');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [sessionId, role, userProfile?.uid]);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diags
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a] === 'X' ? 'owner' : 'partner';
      }
    }
    if (squares.every(s => s !== null)) return 'draw';
    return null;
  };

  const handleMove = async (index: number) => {
    if (board[index] || winner || turn !== role || status !== 'playing') return;

    const newBoard = [...board];
    newBoard[index] = role === 'owner' ? 'X' : 'O';
    const newWinner = checkWinner(newBoard);
    const newTurn = role === 'owner' ? 'partner' : 'owner';

    try {
      await supabase.from('games').update({
        board: newBoard,
        turn: newWinner ? turn : newTurn,
        winner: newWinner,
        status: newWinner ? 'finished' : 'playing'
      }).eq('id', sessionId);
    } catch (err) {
      console.error("Game move error:", err);
    }
  };

  const resetGame = async () => {
    try {
      const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
      await supabase.from('games').update({
        board: Array(9).fill(null),
        turn: randomTurn,
        status: 'playing',
        winner: null
      }).eq('id', sessionId);
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-white/80 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-[0_32px_64px_-16px_rgba(255,143,163,0.2)] border border-[#FF8FA3]/20"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#FF8FA3] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF8FA3]/20">
               <Gamepad2 className="w-5 h-5 transition-transform group-hover:rotate-12" />
             </div>
             <div className="text-left">
               <h3 className="text-sm font-black text-[#1a1a1a] uppercase tracking-wider">Tic Tac Toe</h3>
               <p className="text-[10px] text-[#6E6E6E] opacity-60 font-medium tracking-widest uppercase">Match with {role === 'owner' ? 'Nusrat' : 'Rahul'}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-8">
          {winner ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="py-2 px-6 bg-[#FF8FA3]/10 text-[#FF8FA3] rounded-2xl inline-block">
              <span className="text-lg font-black uppercase tracking-tighter">
                {winner === 'draw' ? "It's a Draw! 🤝" : winner === role ? "You Won! 🎉" : `${role === 'owner' ? 'Nusrat' : 'Rahul'} Won! 💖`}
              </span>
            </motion.div>
          ) : (
            <div className={`py-2 px-6 rounded-2xl inline-block transition-colors ${turn === role ? 'bg-[#FF8FA3] text-white shadow-lg shadow-[#FF8FA3]/20' : 'bg-gray-50 text-gray-400'}`}>
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                {turn === role ? "Your Turn ✨" : `${role === 'owner' ? "Nusrat's" : "Rahul's"} Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleMove(i)}
              className={`aspect-square rounded-3xl text-3xl font-black flex items-center justify-center transition-all ${
                cell ? (cell === 'X' ? 'bg-[#FF8FA3] text-white' : 'bg-[#FFD6C9] text-[#FF8FA3]') : 'bg-gray-50 hover:bg-[#FF8FA3]/5 active:scale-95'
              }`}
            >
              {cell && (
                <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
                  {cell}
                </motion.span>
              )}
            </button>
          ))}
        </div>

        {winner && (
          <button 
            onClick={resetGame}
            className="w-full py-4 bg-[#FF8FA3] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#FF8FA3]/30 hover:bg-[#FF8FA3]/90 transition-all active:scale-95"
          >
            Play Again
          </button>
        )}
      </motion.div>
    </div>
  );
}
