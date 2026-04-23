import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings2, Target, Download, Heart, ShieldCheck, Gamepad } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, UserProfile } from '../types';

// Asset Mocks/Refs - In a real setup, these would be proper imports or paths
const boardImg = "/src/assets/ludo/ludo_board.webp";
const redToken = "/src/assets/ludo/token_red.webp";
const blueToken = "/src/assets/ludo/token_blue.webp";
const greenToken = "/src/assets/ludo/token_green.webp";
const yellowToken = "/src/assets/ludo/token_yellow.webp";
const diceBase = "/src/assets/ludo/dice.webp";
const DICE_FACES = {
  1: "/src/assets/ludo/1.webp",
  2: "/src/assets/ludo/2.webp",
  3: "/src/assets/ludo/3.webp",
  4: "/src/assets/ludo/4.webp",
  5: "/src/assets/ludo/5.webp",
  6: "/src/assets/ludo/6.webp"
};

// Simple onSnapshot mock if relative import is not used
const onSnapshot = (ref: any, cb: any) => { 
  const channel = supabase.channel(`game_${ref.id}`);
  supabase.from(ref.coll).select('*').eq('id', ref.id).single().then(({data}) => {
    if (data) cb({ exists: () => true, data: () => data });
    else cb({ exists: () => false, data: () => null });
  });
  channel.on('postgres_changes', { event: '*', schema: 'public', table: ref.coll, filter: `id=eq.${ref.id}` }, (payload) => {
     cb({ exists: () => true, data: () => payload.new });
  }).subscribe();
  return () => { supabase.removeChannel(channel); };
};

export function TicTacToe({ sessionId, role, userProfile, partnerProfile, onClose }: { sessionId: string, role: UserRole, userProfile: UserProfile | null, partnerProfile: UserProfile | null, onClose: () => void }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<UserRole>('owner');
  const [winner, setWinner] = useState<UserRole | 'draw' | null>(null);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  useEffect(() => {
    const unsub = onSnapshot({ coll: 'games', id: sessionId }, (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        setBoard(data.board);
        setTurn(data.turn);
        setWinner(data.winner);
        setStatus(data.status);
      } else {
        const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
        supabase.from('games').insert([{
          id: sessionId,
          board: Array(9).fill(null),
          turn: randomTurn,
          status: 'playing',
          winner: null,
          players: { [role]: userProfile?.uid }
        }]).then();
      }
    });
    return unsub;
  }, [sessionId]);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
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
    } catch (err) { console.error(err); }
  };

  const resetGame = async () => {
    const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
    await supabase.from('games').update({
      board: Array(9).fill(null),
      turn: randomTurn,
      status: 'playing',
      winner: null
    }).eq('id', sessionId);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/80 backdrop-blur-xl" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-[0_32px_64px_-16px_rgba(255,143,163,0.2)] border border-[#FF8FA3]/20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#FF8FA3] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF8FA3]/20"><Gamepad2 className="w-5 h-5" /></div>
             <div className="text-left">
               <h3 className="text-sm font-black text-[#1a1a1a] uppercase tracking-wider">Tic Tac Toe</h3>
               <p className="text-[10px] text-[#6E6E6E] opacity-60 font-medium tracking-widest uppercase">Match with {role === 'owner' ? 'Nusrat' : 'Rahul'}</p>
             </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-400 Transition-all"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-center mb-8">
          {winner ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="py-2 px-6 bg-[#FF8FA3]/10 text-[#FF8FA3] rounded-2xl inline-block">
              <span className="text-lg font-black uppercase tracking-tighter"> {winner === 'draw' ? "It's a Draw! 🤝" : winner === role ? "You Won! 🎉" : `${role === 'owner' ? 'Nusrat' : 'Rahul'} Won! 💖`} </span>
            </motion.div>
          ) : (
            <div className={`py-2 px-6 rounded-2xl inline-block transition-colors ${turn === role ? 'bg-[#FF8FA3] text-white shadow-lg shadow-[#FF8FA3]/20' : 'bg-gray-50 text-gray-400'}`}>
              <span className="text-xs font-black uppercase tracking-[0.2em]">{turn === role ? "Your Turn ✨" : `${role === 'owner' ? "Nusrat's" : "Rahul's"} Turn ⏳`}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {board.map((cell, i) => (
            <button key={i} onClick={() => handleMove(i)} className={`aspect-square rounded-3xl text-3xl font-black flex items-center justify-center transition-all ${cell ? (cell === 'X' ? 'bg-[#FF8FA3] text-white' : 'bg-[#FFD6C9] text-[#FF8FA3]') : 'bg-gray-50 hover:bg-[#FF8FA3]/5 active:scale-95'}`}>
              {cell && <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>{cell}</motion.span>}
            </button>
          ))}
        </div>
        {winner && <button onClick={resetGame} className="w-full py-4 bg-[#FF8FA3] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#FF8FA3]/30 hover:bg-[#FF8FA3]/90 transition-all active:scale-95">Play Again</button>}
      </motion.div>
    </div>
  );
}

export function Ludo({ sessionId, role, userProfile, partnerProfile, onClose }: { sessionId: string, role: UserRole, userProfile: UserProfile | null, partnerProfile: UserProfile | null, onClose: () => void }) {
  const [debugConfig, setDebugConfig] = useState({
    boardTop: 0.15, boardBottom: -0.35, boardLeft: 1.2, boardRight: -1.4, baseOffset1: 1.775, baseOffset2: 3.725, tokenSizeBase: 10.5, tokenSizeGrid: 150, showDebug: false, enableDrag: false, snapToGrid: true, compact: true, selectedTarget: 'board' as 'board' | 'pockets'
  });
  const [gameState, setGameState] = useState<any>(null);
  const [isRolling, setIsRolling] = useState(false);
  const myColor = role === 'owner' ? 'blue' : 'red';
  const partnerColor = role === 'owner' ? 'red' : 'blue';

  useEffect(() => {
    const unsub = onSnapshot({ coll: 'games', id: sessionId }, (snap: any) => {
      if (snap.exists()) setGameState(snap.data());
      else {
        supabase.from('games').insert([{
          id: sessionId, pieces: { red: [-1,-1,-1,-1], blue: [-1,-1,-1,-1], green: [-1,-1,-1,-1], yellow: [-1,-1,-1,-1] },
          turn: Math.random() < 0.5 ? 'owner' : 'partner', dice: null, status: 'rolling', winner: null, lastDiceRoll: null
        }]).then();
      }
    });
    return unsub;
  }, [sessionId]);

  const commonPath = [
    [6,1], [6,2], [6,3], [6,4], [6,5], [5,6], [4,6], [3,6], [2,6], [1,6], [0,6], [0,7], [0,8], [1,8], [2,8], [3,8], [4,8], [5,8], 
    [6,9], [6,10], [6,11], [6,12], [6,13], [6,14], [7,14], [8,14], [8,13], [8,12], [8,11], [8,10], [8,9], [9,8], [10,8], [11,8], [12,8], [13,8], [14,8], 
    [14,7], [14,6], [13,6], [12,6], [11,6], [10,6], [9,6], [8,5], [8,4], [8,3], [8,2], [8,1], [8,0], [7,0], [6,0]
  ];

  const getPosCoords = (color: 'red' | 'blue' | 'green' | 'yellow', pos: number) => {
    if (pos === -1) return null;
    const offsets = { red: 0, green: 13, yellow: 26, blue: 39 };
    const homeStretches = { red: [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]], blue: [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]], green: [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]], yellow: [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]] };
    if (pos < 51) { return commonPath[(pos + offsets[color]) % 52]; }
    return homeStretches[color][pos - 51];
  };

  const rollDice = async () => {
    if (gameState?.turn !== role || gameState.status !== 'rolling' || isRolling) return;
    setIsRolling(true);
    setTimeout(async () => {
      const roll = Math.floor(Math.random() * 6) + 1;
      const canMoveAny = gameState.pieces[myColor].some((p: number) => (p === -1 ? roll === 6 : p + roll <= 56));
      await supabase.from('games').update({
        dice: canMoveAny ? roll : null, lastDiceRoll: roll, status: canMoveAny ? 'moving' : 'rolling',
        turn: canMoveAny ? gameState.turn : (gameState.turn === 'owner' ? 'partner' : 'owner')
      }).eq('id', sessionId);
      setIsRolling(false);
    }, 800);
  };

  const movePiece = async (pieceIdx: number) => {
    if (!gameState || gameState.turn !== role || gameState.status !== 'moving') return;
    const roll = gameState.dice!; const pieces = [...gameState.pieces[myColor]]; let pos = pieces[pieceIdx];
    if (pos === -1 && roll !== 6) return; if (pos !== -1 && pos + roll > 56) return;
    pos = pos === -1 ? 0 : pos + roll; pieces[pieceIdx] = pos;
    const updatedAllPieces = { ...gameState.pieces, [myColor]: pieces };
    if (pos < 51) {
      const myCoords = getPosCoords(myColor, pos);
      (['red', 'blue', 'green', 'yellow'] as const).forEach(color => {
        if (color === myColor) return;
        updatedAllPieces[color] = updatedAllPieces[color].map((op: number) => {
          if (op === -1 || op >= 51) return op;
          const otherCoords = getPosCoords(color, op);
          if (otherCoords?.[0] === myCoords?.[0] && otherCoords?.[1] === myCoords?.[1]) {
            const safeSpots = [[6,2], [2,8], [8,12], [12,6], [6,13], [1,6], [8,1], [13,8]];
            return safeSpots.some(s => s[0] === myCoords?.[0] && s[1] === myCoords?.[1]) ? op : -1;
          }
          return op;
        });
      });
    }
    const isWinner = pieces.every(p => p === 56);
    const nextTurn = (roll === 6 || isWinner) ? gameState.turn : (gameState.turn === 'owner' ? 'partner' : 'owner');
    await supabase.from('games').update({
      pieces: updatedAllPieces, status: 'rolling', dice: null, turn: nextTurn, winner: isWinner ? (role === 'owner' ? 'owner' : 'partner') : null
    }).eq('id', sessionId);
  };

  if (!gameState) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="relative w-full h-full bg-[#FFF9F9] flex flex-col z-10">
        <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-[#FF8FA3]/10 shadow-sm relative z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg transform -rotate-3 border border-white/50"><Gamepad2 className="w-6 h-6 text-white" /></div>
            <div>
              <h3 className="text-sm font-black text-[#1a1a1a] uppercase tracking-tight">Ludo Classic</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF8FA3]">{gameState.turn === role ? "Your Turn! 🎲" : "Partner's Turn ⏳"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full border border-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 relative flex items-center justify-center p-3 lg:p-6 overflow-hidden">
          <div className="relative w-full max-w-[min(90vw,calc(100vh-320px))] aspect-square bg-white shadow-2xl rounded-2xl overflow-hidden border-4 border-white">
            <img src={boardImg} alt="Board" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute" style={{ top: '0.15%', bottom: '-0.35%', left: '1.2%', right: '-1.4%' }}>
              <div className="relative w-full h-full grid grid-cols-15 grid-rows-15">
                {Array.from({ length: 225 }).map((_, i) => {
                  const r = Math.floor(i / 15), c = i % 15;
                  const allAt: any[] = [];
                  (['red', 'blue', 'green', 'yellow'] as const).forEach(clr => {
                    gameState.pieces[clr].forEach((p: number, idx: number) => {
                      const coords = getPosCoords(clr, p);
                      if (coords?.[0] === r && coords?.[1] === c) allAt.push({ clr, idx });
                    });
                  });
                  return (
                    <div key={i} className="relative w-full h-full">
                      {allAt.map((p, idx) => (
                        <motion.img key={`${p.clr}-${p.idx}`} src={p.clr==='red'?redToken:p.clr==='blue'?blueToken:p.clr==='green'?greenToken:yellowToken} 
                          onClick={() => p.clr === myColor && movePiece(p.idx)}
                          className={`absolute inset-0 w-[150%] h-[150%] object-contain z-10 -translate-x-1/4 -translate-y-1/4 ${gameState.status==='moving'&&p.clr===myColor&&gameState.turn===role?'animate-bounce':''}`} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-6 bg-white border-t border-[#FF8FA3]/10 flex flex-col items-center gap-6 shadow-sm z-20">
          <div className="flex items-center justify-around w-full max-w-md">
            <LudoDice name="You" active={gameState.turn === role} diceVal={gameState.turn === role ? gameState.dice : null} isRolling={isRolling && gameState.turn === role} onRoll={rollDice} />
            <LudoDice name="Partner" active={gameState.turn !== role} diceVal={gameState.turn !== role ? gameState.dice : null} isRolling={isRolling && gameState.turn !== role} onRoll={rollDice} />
          </div>
        </div>
        <AnimatePresence>
          {gameState.winner && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-[#FF8FA3]/95 backdrop-blur-lg z-[130] flex flex-col items-center justify-center text-white p-8">
              <Heart className="w-16 h-16 text-white fill-white animate-pulse mb-6" />
              <h2 className="text-4xl font-black mb-2">WINNER! 👑</h2>
              <button onClick={onClose} className="mt-10 px-8 py-4 bg-white text-[#FF8FA3] rounded-2xl font-black uppercase">Close</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function LudoDice({ name, active, diceVal, isRolling, onRoll }: { name: string, active: boolean, diceVal: number | null, isRolling: boolean, onRoll: () => void }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${active ? 'scale-105' : 'opacity-30'}`}>
      <span className="text-[10px] font-black uppercase">{name}</span>
      <button onClick={onRoll} disabled={!active || isRolling || diceVal!==null} className={`w-16 h-16 relative ${isRolling?'animate-bounce':''}`}>
        <img src={diceBase} className="absolute inset-0 w-full h-full object-contain" />
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          {diceVal && <img src={DICE_FACES[diceVal as keyof typeof DICE_FACES]} className="w-[80%] h-[80%]" />}
        </div>
      </button>
    </div>
  );
}
