import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, CheckCircle2, Copy, Check, X, Key, ShieldAlert } from 'lucide-react';
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

    // Re-verify and compute latest safety number on modal open
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--theme-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">End-to-End Encryption</h2>
              <p className="text-xs text-[var(--theme-text)]/60">Cryptographic Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--theme-text)]/10 text-[var(--theme-text)]/60 hover:text-[var(--theme-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Status badge */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
            isReady 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {isReady ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {isReady ? 'Private Connection Verified' : 'Negotiating Encryption Keys...'}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {isReady 
                  ? `Messages between you and ${partnerName} are end-to-end encrypted.`
                  : 'Keys are syncing with partner device.'}
              </p>
            </div>
          </div>

          {/* Safety Number Block */}
          {safetyCode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text)]/60">
                  Pairwise Safety Number
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-[var(--theme-accent)] hover:underline font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="p-3.5 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-center font-mono tracking-widest text-lg font-bold select-all text-[var(--theme-text)]">
                {safetyCode}
              </div>
              <p className="text-[11px] text-[var(--theme-text)]/60 text-center leading-relaxed">
                Both of your phones calculate this exact 12-digit code using Diffie-Hellman P-256 keys. If the numbers match, your line cannot be intercepted.
              </p>
            </div>
          )}

          {/* Key Specs Card */}
          <div className="p-4 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text)]/60">Key Agreement:</span>
              <span className="font-semibold">ECDH (NIST P-256)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text)]/60">Cipher:</span>
              <span className="font-semibold">AES-256-GCM (128-bit Tag)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text)]/60">Key Protection:</span>
              <span className="font-semibold">PBKDF2 (100,000 rounds SHA-256)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text)]/60">Hardware Accel:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">WebCrypto Subtle API</span>
            </div>
          </div>

          {/* Privacy Guarantee Explanation */}
          <div className="space-y-2 text-xs text-[var(--theme-text)]/70 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Plaintext Storage:</strong> Only encrypted ciphertext is sent to Supabase. Supabase admins and database dumps cannot read your messages.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Key className="w-4 h-4 text-[var(--theme-accent)] shrink-0 mt-0.5" />
              <span>
                <strong>Private Key Ownership:</strong> Your private key never leaves your device unencrypted.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[var(--theme-accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  );
};
