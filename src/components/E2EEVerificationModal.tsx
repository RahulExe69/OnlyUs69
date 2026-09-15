import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Copy, Check, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';
import { getSafetyNumber, isE2EEReady, onE2EEStatusChange, initializeE2EE } from '../lib/e2ee';

interface E2EEVerificationModalProps {
  myProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  onClose: () => void;
}

export const E2EEVerificationModal: React.FC<E2EEVerificationModalProps> = ({
  myProfile,
  partnerProfile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [safetyCode, setSafetyCode] = useState<string | null>(getSafetyNumber());
  const [isReady, setIsReady] = useState<boolean>(isE2EEReady());

  useEffect(() => {
    const unsub = onE2EEStatusChange((status) => {
      setIsReady(status.isReady);
      setSafetyCode(status.safetyNumber);
    });

    if (myProfile?.id) {
      const passcode = myProfile.role === 'partner' ? (localStorage.getItem('onlyus_partner_passcode') || undefined) : undefined;
      initializeE2EE(myProfile.id, myProfile.role, passcode).then((status) => {
        setIsReady(status.isReady);
        setSafetyCode(status.safetyNumber);
      }).catch(console.warn);
    }

    return unsub;
  }, [myProfile?.id, myProfile?.role]);

  const handleCopy = () => {
    if (!safetyCode) return;
    navigator.clipboard?.writeText(safetyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const partnerName = partnerProfile?.display_name || (myProfile?.role === 'owner' ? 'Nusrat' : 'Rahul');

  const formattedSafetyCode = safetyCode 
    ? safetyCode.replace(/\s+/g, '').replace(/(\d{4})(?=\d)/g, '$1  ') 
    : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[120] bg-[var(--theme-surface)] text-[var(--theme-text)] flex flex-col overflow-hidden"
    >
      {/* Mobile Top Header */}
      <div className="h-[calc(3.75rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-4 flex items-center justify-between border-b border-[var(--theme-border)]/50 shrink-0 bg-[var(--theme-surface)]">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full text-[var(--theme-text)] hover:opacity-75 active:scale-90 transition-transform flex items-center justify-center cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-[var(--theme-text)]">Encryption</h1>
        <div className="w-9" />
      </div>

      {/* Main Content - Compact, Mobile-First & Clean */}
      <div className="flex-1 overflow-y-auto px-5 py-6 max-w-lg mx-auto w-full flex flex-col justify-between custom-scrollbar">
        <div className="space-y-6">
          {/* Hero Verified Shield */}
          <div className="flex flex-col items-center text-center pt-2">
            <div className="relative mb-3">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isReady 
                  ? 'bg-emerald-500/12 text-emerald-500 ring-4 ring-emerald-500/20' 
                  : 'bg-amber-500/12 text-amber-500 ring-4 ring-amber-500/20'
              }`}>
                <ShieldCheck className="w-10 h-10 stroke-[2.2]" />
              </div>
              <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-[var(--theme-surface)] flex items-center justify-center shadow-xs ${
                isReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white animate-pulse'
              }`}>
                {isReady ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Lock className="w-3 h-3" />}
              </div>
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-[var(--theme-text)]">
              End-to-End Encrypted
            </h2>
            
            <p className="text-sm text-[var(--theme-text)]/75 mt-1.5 max-w-xs leading-relaxed">
              Messages, media, and calls between you and <span className="font-bold text-[var(--theme-text)]">{partnerName}</span> are completely private.
            </p>

            <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {isReady ? 'Active & Verified' : 'Syncing Private Keys...'}
            </div>
          </div>

          {/* Verification / Safety Number Card */}
          {formattedSafetyCode && (
            <div className="bg-[var(--theme-bg)] rounded-2xl p-4 border border-[var(--theme-border)] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text)]/60">
                  Verification Code
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-[var(--theme-accent)] hover:opacity-80 active:scale-95 font-semibold px-2.5 py-1 rounded-lg bg-[var(--theme-surface)] border border-[var(--theme-border)] transition-all shadow-2xs"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="py-2.5 px-3 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)]/60 text-center font-mono text-base sm:text-lg font-bold tracking-widest text-[var(--theme-text)] select-all shadow-2xs">
                {formattedSafetyCode}
              </div>

              <p className="text-[11px] text-[var(--theme-text)]/60 text-center leading-normal">
                If the code matches on {partnerName}&apos;s device, your connection is guaranteed secure.
              </p>
            </div>
          )}

          {/* Privacy Highlights - Compact & Simple */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)]/50">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[var(--theme-text)]">Private to only both of you</p>
                <p className="text-[var(--theme-text)]/65 mt-0.5 leading-normal">
                  Not even OnlyUs, servers, or database admins can read your chats.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)]/50">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[var(--theme-text)]">Device-stored keys</p>
                <p className="text-[var(--theme-text)]/65 mt-0.5 leading-normal">
                  Your private keys never leave your phone unencrypted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Done Button */}
        <div className="pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-[var(--theme-accent)] text-white text-sm font-bold active:scale-[0.98] transition-transform shadow-md shadow-[var(--theme-accent)]/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </motion.div>
  );
};
