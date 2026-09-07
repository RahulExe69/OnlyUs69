import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, KeyRound, Lock, X, Sparkles, ShieldCheck } from 'lucide-react';

export function LoginView({ 
  error, 
  onLogin, 
  onPasscodeLogin 
}: { 
  error: string | null; 
  onLogin: () => void; 
  onPasscodeLogin: (code: string) => Promise<boolean>; 
}) {
  const [loginMode, setLoginMode] = useState<'passcode' | 'google'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim().length !== 6) {
      setLocalError("Please enter a valid 6-digit code.");
      return;
    }
    setLocalError(null);
    setIsVerifying(true);
    try {
      const ok = await onPasscodeLogin(passcode.trim());
      if (!ok) {
        setLocalError("Invalid 6-digit passcode. Please enter the active PIN.");
      }
    } catch (err: any) {
      setLocalError(err.message || "Failed to verify passcode.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPasscode(cleaned);
    if (localError) setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div 
      className="h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] bg-[#FFF8F6] flex items-center justify-center p-4 overflow-y-auto"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/80 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(255,143,163,0.18)] border border-[#FF8FA3]/15 backdrop-blur-xl my-auto"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF8FA3] rounded-[1.8rem] mb-4 shadow-xl shadow-[#FF8FA3]/20">
            <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-[#1a1a1a]">OnlyUs</h2>
          <p className="text-[#6E6E6E] text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Handcrafted Romantic Space</p>
        </div>

        {/* Login Mode Selector */}
        <div className="flex bg-[#FFF0F3] p-1 rounded-2xl mb-6 border border-[#FF8FA3]/10">
          <button
            type="button"
            onClick={() => { setLoginMode('passcode'); setLocalError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'passcode'
                ? 'bg-white text-[#FF8FA3] shadow-sm'
                : 'text-[#6E6E6E]/60 hover:text-[#6E6E6E]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Nusrat (PIN)</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('google'); setLocalError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'google'
                ? 'bg-white text-[#FF8FA3] shadow-sm'
                : 'text-[#6E6E6E]/60 hover:text-[#6E6E6E]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Rahul (Google)</span>
          </button>
        </div>

        {displayError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3.5 bg-red-50 text-red-500 text-[11px] font-medium leading-relaxed rounded-2xl flex items-start gap-2.5 border border-red-100/60"
          >
            <X className="w-4 h-4 mt-0.5 flex-shrink-0 cursor-pointer" onClick={() => setLocalError(null)} />
            <span>{displayError}</span>
          </motion.div>
        )}

        {loginMode === 'passcode' ? (
          <form 
            onSubmit={handlePasscodeSubmit} 
            className="space-y-5"
            autoComplete="off"
            noValidate
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
          >
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block text-center opacity-70">
                Enter 6-Digit Passcode (PIN)
              </label>
              
              {/* PIN input display boxes */}
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  name="onlyus_access_code"
                  id="onlyus_access_code"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={passcode}
                  onChange={(e) => handleDigitChange(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                  style={{ WebkitTextSecurity: 'disc' } as any}
                  className="w-full h-14 tracking-[0.6em] text-center font-mono text-2xl font-bold bg-[#FFF8F6] border border-[#FF8FA3]/20 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/30 focus:border-[#FF8FA3] transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:opacity-30"
                />
              </div>
              <p className="text-center text-[10px] text-[#6E6E6E] mt-2 opacity-50 font-medium">
                Enter the active 6-digit access code
              </p>
            </div>

            <button
              type="submit"
              disabled={isVerifying || passcode.length !== 6}
              className="w-full h-14 flex items-center justify-center gap-3 bg-[#FF8FA3] hover:bg-[#FF8FA3]/90 text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#FF8FA3]/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Enter OnlyUs</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button 
              type="button"
              onClick={onLogin}
              className="w-full h-14 flex items-center justify-center gap-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-black/10 active:scale-[0.98] cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4 invert brightness-0" alt="Google" />
              <span>Connect via Google</span>
            </button>
            <p className="text-center text-[10px] text-[#6E6E6E] opacity-50 font-medium">
              Secure authentication via Google account
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-1 h-1 rounded-full bg-[#FF8FA3]/30"></div>
          <p className="text-center text-[9px] font-bold text-[#6E6E6E] uppercase tracking-widest opacity-40">
            Private 1-to-1 Handcrafted Space
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function UnauthorizedView({ error, onLogout }: { error: string, onLogout: () => void }) {
  return (
    <div 
      className="h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] bg-[#FFF8F6] flex items-center justify-center p-4 overflow-y-auto"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      <div className="text-center max-w-xs my-auto">
        <div className="w-16 h-16 bg-[#FFD6C9] text-[#FF8FA3] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#1a1a1a]">Restricted Area</h2>
        <p className="text-[#6E6E6E] text-sm mb-6">{error}</p>
        <button 
          onClick={onLogout}
          className="text-[#FF8FA3] font-bold uppercase tracking-widest text-[10px] hover:underline cursor-pointer"
        >
          Try another account
        </button>
      </div>
    </div>
  );
}

export function QuotaBanner() {
  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 overflow-hidden"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
        Limit Reached: Operating in Real-time Mode Only (No history sync)
      </span>
    </motion.div>
  );
}
