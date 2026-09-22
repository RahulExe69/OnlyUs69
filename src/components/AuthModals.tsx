import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, KeyRound, Lock, Delete, X, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { THEMES, DEFAULT_THEME, ThemeName, isValidTheme, getThemeDualTone, getThemeCategory, applyTheme } from '../lib/themes';

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

  // Dynamic theme detection based on active/cached theme
  const [themeKey] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const stored = (localStorage.getItem('onlyus_chat_theme') || localStorage.getItem('onlyus_partner_theme')) as ThemeName;
      if (stored && isValidTheme(stored)) return stored;
      const docTheme = document.documentElement.dataset.chatTheme as ThemeName;
      if (docTheme && isValidTheme(docTheme)) return docTheme;
    }
    return DEFAULT_THEME;
  });

  // Apply theme on mount so CSS variables match chosen theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      applyTheme(themeKey);
    }
  }, [themeKey]);

  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const dualTone = getThemeDualTone(themeKey);
  const isDark = getThemeCategory(themeKey) === 'dark' || dualTone.isDark;

  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch (_) {}
  }, []);

  const handleVerify = useCallback(async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || isVerifying) return;
    setLocalError(null);
    setIsVerifying(true);
    
    // Safety timeout to prevent indefinite spinning under any circumstances
    const safetyTimer = setTimeout(() => {
      setIsVerifying(false);
      setLocalError("Verification timed out. Please try again.");
    }, 5000);

    try {
      const ok = await onPasscodeLogin(codeToVerify);
      clearTimeout(safetyTimer);
      if (!ok) {
        setLocalError("Incorrect passcode. Please enter the active 6-digit PIN.");
        setPasscode('');
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      setLocalError(err.message || "Verification failed");
      setPasscode('');
    } finally {
      clearTimeout(safetyTimer);
      setIsVerifying(false);
    }
  }, [isVerifying, onPasscodeLogin]);

  const handleKeyPress = useCallback((digit: string) => {
    triggerHaptic();
    if (localError) setLocalError(null);
    setPasscode((prev) => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) {
        // Auto-verify on 6th digit without needing manual enter
        setTimeout(() => handleVerify(next), 40);
      }
      return next;
    });
  }, [handleVerify, localError, triggerHaptic]);

  const handleDelete = useCallback(() => {
    triggerHaptic();
    if (localError) setLocalError(null);
    setPasscode((prev) => prev.slice(0, -1));
  }, [localError, triggerHaptic]);

  const handleClear = useCallback(() => {
    triggerHaptic();
    if (localError) setLocalError(null);
    setPasscode('');
  }, [localError, triggerHaptic]);

  // Physical desktop keyboard support
  useEffect(() => {
    if (loginMode !== 'passcode') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' && passcode.length === 6) {
        e.preventDefault();
        handleVerify(passcode);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginMode, passcode, handleKeyPress, handleDelete, handleClear, handleVerify]);

  const displayError = localError || error;

  return (
    <div 
      className="chat-theme h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] w-full flex items-center justify-center p-3 sm:p-4 relative overflow-hidden select-none"
      style={{ 
        height: 'var(--app-height, 100dvh)',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: theme.font || 'inherit'
      }}
    >
      {/* Soft Ambient Theme Glows */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-30 overflow-hidden transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${dualTone.color1}, transparent 60%), radial-gradient(circle at 80% 80%, ${dualTone.color2}, transparent 55%)`
        }}
      />

      {/* Main Login Card - Compact, Lovely, Perfectly Symmetric */}
      <div 
        className="relative z-10 w-full max-w-[290px] sm:max-w-[315px] rounded-[1.75rem] p-4 sm:p-5 transition-all duration-300 flex flex-col justify-between shadow-2xl"
        style={{
          backgroundColor: isDark ? 'rgba(20, 20, 30, 0.92)' : 'rgba(255, 255, 255, 0.94)',
          borderColor: theme.border || (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
          borderWidth: '1px',
          boxShadow: `0 18px 45px -10px ${dualTone.glow || 'rgba(0,0,0,0.25)'}`
        }}
      >
        {/* Lovely Compact Header */}
        <div className="flex flex-col items-center justify-center text-center mb-3">
          <div 
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-1.5 transition-transform duration-200"
            style={{
              background: `linear-gradient(135deg, ${dualTone.color1}, ${dualTone.color2})`,
              boxShadow: `0 6px 18px -3px ${dualTone.glow}`
            }}
          >
            <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <h2 
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ color: theme.text }}
            >
              OnlyUs
            </h2>
            <Sparkles className="w-3.5 h-3.5 opacity-60" style={{ color: theme.accent }} />
          </div>
        </div>

        {/* Tab Switcher - Compact, Lovely Rounded Pill */}
        <div 
          className="flex p-0.5 rounded-full mb-3 border transition-colors"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: theme.border || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')
          }}
        >
          <button
            type="button"
            onClick={() => { setLoginMode('passcode'); setLocalError(null); }}
            className="flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
            style={loginMode === 'passcode' ? {
              backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : '#ffffff',
              color: theme.accent,
              boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.08)'
            } : {
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
            }}
          >
            <KeyRound className="w-3 h-3" />
            <span>Passcode</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('google'); setLocalError(null); }}
            className="flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
            style={loginMode === 'google' ? {
              backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : '#ffffff',
              color: theme.accent,
              boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.08)'
            } : {
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
            }}
          >
            <Lock className="w-3 h-3" />
            <span>Google</span>
          </button>
        </div>

        {/* Error Notification */}
        <AnimatePresence>
          {displayError && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="p-2 bg-red-500/10 text-red-400 text-[11px] font-medium rounded-xl flex items-center justify-between border border-red-500/20 overflow-hidden"
            >
              <span className="truncate pr-2">{displayError}</span>
              <X className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setLocalError(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed Height Viewport Container - Exactly ~240px for both tabs */}
        <div className="h-[240px] w-full flex flex-col justify-between">
          {loginMode === 'passcode' ? (
            <div className="h-full flex flex-col justify-between">
              {/* Lovely PIN Dots */}
              <div className="flex items-center justify-center gap-2.5 py-0.5">
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const isFilled = index < passcode.length;
                  return (
                    <div
                      key={index}
                      className="w-3 h-3 rounded-full border transition-all duration-150 flex items-center justify-center"
                      style={isFilled ? {
                        backgroundColor: theme.accent,
                        borderColor: theme.accent,
                        boxShadow: `0 0 8px ${dualTone.glow || theme.accent}`,
                        transform: 'scale(1.15)'
                      } : {
                        borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                        backgroundColor: 'transparent'
                      }}
                    />
                  );
                })}
              </div>

              {/* Compact, Lovely Inbuilt Numberpad */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleKeyPress(digit)}
                    className="h-10 sm:h-10.5 rounded-xl text-base sm:text-lg font-semibold transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:scale-90 border touch-manipulation disabled:opacity-40"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      color: theme.text
                    }}
                  >
                    {digit}
                  </button>
                ))}

                {/* Bottom Row: Clear, 0, Backspace */}
                <button
                  type="button"
                  disabled={isVerifying || passcode.length === 0}
                  onClick={handleClear}
                  className="h-10 sm:h-10.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:scale-90 border touch-manipulation disabled:opacity-30"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleKeyPress('0')}
                  className="h-10 sm:h-10.5 rounded-xl text-base sm:text-lg font-semibold transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:scale-90 border touch-manipulation disabled:opacity-40"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    color: theme.text
                  }}
                >
                  0
                </button>

                <button
                  type="button"
                  disabled={isVerifying || passcode.length === 0}
                  onClick={handleDelete}
                  className="h-10 sm:h-10.5 rounded-xl transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:scale-90 border touch-manipulation disabled:opacity-30"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'
                  }}
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              {/* Status / Helper note */}
              <div className="h-5 flex items-center justify-center text-center">
                {isVerifying ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: theme.accent }}>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-medium opacity-40">
                    Enter 6-digit code
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-between py-2">
              {/* Lovely Security Shield Badge */}
              <div className="flex flex-col items-center justify-center pt-2">
                <div 
                  className="w-13 h-13 rounded-2xl flex items-center justify-center mb-2.5 transition-transform"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: theme.border || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    borderWidth: '1px'
                  }}
                >
                  <ShieldCheck className="w-6 h-6" style={{ color: theme.accent }} />
                </div>
                <div className="text-[11px] font-medium opacity-70">
                  Quick Single Sign-On
                </div>
              </div>

              {/* Compact Google Sign In Button */}
              <button 
                type="button"
                onClick={onLogin}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl transition-all duration-100 font-semibold text-xs tracking-wide cursor-pointer active:scale-98 shadow-sm border touch-manipulation"
                style={{
                  backgroundColor: isDark ? '#ffffff' : '#1a1a1a',
                  color: isDark ? '#1a1a1a' : '#ffffff',
                  borderColor: isDark ? '#ffffff' : '#1a1a1a',
                  boxShadow: `0 6px 16px -4px ${dualTone.glow || 'rgba(0,0,0,0.2)'}`
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Status Indicator */}
              <div className="h-5 flex items-center justify-center gap-1.5 opacity-45">
                <CheckCircle2 className="w-3 h-3" style={{ color: theme.accent }} />
                <span className="text-[10px] font-medium tracking-wide">
                  End-to-End Encrypted
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnauthorizedView({ error, onLogout }: { error: string, onLogout: () => void }) {
  const [themeKey] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const stored = (localStorage.getItem('onlyus_chat_theme') || localStorage.getItem('onlyus_partner_theme')) as ThemeName;
      if (stored && isValidTheme(stored)) return stored;
    }
    return DEFAULT_THEME;
  });

  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const isDark = getThemeCategory(themeKey) === 'dark';

  return (
    <div 
      className="chat-theme h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] w-full flex items-center justify-center p-4 select-none"
      style={{ 
        height: 'var(--app-height, 100dvh)',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: theme.font || 'inherit'
      }}
    >
      <div 
        className="text-center max-w-xs p-6 rounded-3xl border"
        style={{
          backgroundColor: isDark ? 'rgba(20, 20, 30, 0.90)' : 'rgba(255, 255, 255, 0.92)',
          borderColor: theme.border || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
        }}
      >
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            color: theme.accent
          }}
        >
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Restricted Area</h2>
        <p className="text-xs mb-4 opacity-70 leading-relaxed">{error}</p>
        <button 
          onClick={onLogout}
          className="font-bold uppercase tracking-wider text-[11px] hover:underline cursor-pointer"
          style={{ color: theme.accent }}
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
