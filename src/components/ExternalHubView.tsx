import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  RotateCw, 
  ExternalLink, 
  Instagram, 
  MessageSquareCode, 
  HelpCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone,
  X,
  Copy,
  Check
} from 'lucide-react';

interface ExternalHubViewProps {
  type: 'instagram' | 'whatsapp';
  onBackToHub: () => void;
}

export const ExternalHubView: React.FC<ExternalHubViewProps> = ({
  type,
  onBackToHub,
}) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [showPairingGuide, setShowPairingGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isInsta = type === 'instagram';
  const targetUrl = isInsta ? 'https://www.instagram.com' : 'https://web.whatsapp.com';
  const title = isInsta ? 'Instagram' : 'WhatsApp Web';

  const handleReload = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.AndroidBridge?.openTab) {
      try {
        window.AndroidBridge.openTab('dashboard');
        return;
      } catch (err) {
        console.warn('AndroidBridge call error:', err);
      }
    }
    onBackToHub();
  };

  return (
    <div className="theme-external-hub h-screen w-full flex flex-col overflow-hidden relative select-none">
      {/* Top Floating Control Bar */}
      <header className="h-14 px-4 bg-[#1e1e1e]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs transition-all"
            title="Return to OnlyUs Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>OnlyUs Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
              isInsta 
                ? 'bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#D300C5]' 
                : 'bg-gradient-to-tr from-[#25D366] to-[#128C7E]'
            }`}>
              {isInsta ? <Instagram className="w-4 h-4" /> : <MessageSquareCode className="w-4 h-4" />}
            </div>
            <span className="font-bold text-sm text-white/90 hidden sm:inline-block">
              {title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isInsta && (
            <button
              onClick={() => setShowPairingGuide(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Pairing Guide</span>
            </button>
          )}

          <button
            onClick={handleReload}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 transition-all"
            title="Reload Page"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenExternal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FF4D6D] hover:bg-[#FF758F] active:scale-95 text-white text-xs font-semibold shadow-sm transition-all"
            title="Open in Full Browser Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Launch</span>
          </button>
        </div>
      </header>

      {/* Main Container Area */}
      <div className="flex-1 relative bg-neutral-900 flex flex-col items-center justify-center p-4">
        {/* Interactive In-App Companion / APK Bridge Shell */}
        <div className="w-full max-w-2xl bg-neutral-800/90 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md text-center">
          <div className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center text-white shadow-lg mb-4 ${
            isInsta 
              ? 'bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#D300C5]' 
              : 'bg-gradient-to-tr from-[#25D366] to-[#128C7E]'
          }`}>
            {isInsta ? <Instagram className="w-8 h-8" /> : <MessageSquareCode className="w-8 h-8" />}
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{title} Companion</h2>
          <p className="text-xs text-white/70 max-w-md mx-auto mb-6">
            {isInsta 
              ? 'Enjoy private Reels, Stories, and Direct DMs. Your session remains persistent and safe on your device.'
              : 'Sync your personal chats with 8-digit phone number pairing codes. Multi-device encryption enabled.'
            }
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-6 text-left">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Device Persistent</p>
                <p className="text-[11px] text-white/60">Sessions stay saved even if you log out of OnlyUs.</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-[#FF4D6D] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Mobile Optimized</p>
                <p className="text-[11px] text-white/60">Ready for both Web and Android APK bridge.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleOpenExternal}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF758F] to-[#FF4D6D] text-white font-bold text-sm shadow-lg shadow-pink-500/25 active:scale-95 flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open {title}</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs active:scale-95 flex items-center justify-center gap-2 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Pairing Guide Modal */}
      <AnimatePresence>
        {showPairingGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1e1e1e] border border-white/10 rounded-3xl p-6 text-white relative shadow-2xl"
            >
              <button
                onClick={() => setShowPairingGuide(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <MessageSquareCode className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold mb-2">How to Link with Phone Number (Mobile)</h3>
              <div className="space-y-3 text-xs text-white/80 mb-6">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <p>Open <strong>web.whatsapp.com</strong> in desktop mode on your phone.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <p>Tap <strong>"Link with phone number"</strong> under the QR code area.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <p>Enter your phone number to receive an 8-character pairing code (e.g. ABCD-1234).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                  <p>Open WhatsApp on your mobile &gt; <strong>Linked Devices &gt; Link a Device &gt; Link with phone number</strong> and enter the code!</p>
                </div>
              </div>

              <button
                onClick={() => setShowPairingGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 active:scale-95 transition-all"
              >
                Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
