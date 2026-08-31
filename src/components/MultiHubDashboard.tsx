import React from 'react';
import { motion } from 'motion/react';
import { 
  MessageCircleHeart, 
  Instagram, 
  MessageSquareCode, 
  Sparkles, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  User, 
  Heart,
  ChevronRight,
  ExternalLink,
  Smartphone,
  Flame,
  Gamepad2,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';

interface MultiHubDashboardProps {
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  isOwner: boolean;
  isPartner: boolean;
  isSocketConnected: boolean;
  socketOnlineUsers: string[];
  formatLastSeen: (timestamp: any, uid?: string) => string;
  totalMessages: number;
  onSelectTab: (tab: 'chat' | 'instagram' | 'whatsapp') => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const MultiHubDashboard: React.FC<MultiHubDashboardProps> = ({
  userProfile,
  partnerProfile,
  isOwner,
  isPartner,
  isSocketConnected,
  socketOnlineUsers,
  formatLastSeen,
  totalMessages,
  onSelectTab,
  onOpenSettings,
  onOpenProfile,
  onLogout,
}) => {
  const partnerName = userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul');
  const myName = userProfile?.display_name || (isOwner ? 'Rahul' : 'Nusrat');
  const isPartnerOnline = formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online';

  const handleTabClick = (tab: 'chat' | 'instagram' | 'whatsapp') => {
    const hasAndroidBridge = typeof window !== 'undefined' && typeof window.AndroidBridge?.openTab === 'function';

    // 1. Notify Android native shell if present
    if (hasAndroidBridge) {
      try {
        window.AndroidBridge!.openTab!(tab);
      } catch (err) {
        console.warn('AndroidBridge call error:', err);
      }
    }

    // 2. Chat navigation: ALWAYS switch React view to 'chat'
    if (tab === 'chat') {
      onSelectTab('chat');
      return;
    }

    // 3. External tabs in pure browser mode (fallback when not inside Android APK)
    if (!hasAndroidBridge) {
      if (tab === 'instagram') {
        window.location.href = 'https://www.instagram.com';
        return;
      }
      if (tab === 'whatsapp') {
        window.location.href = 'https://web.whatsapp.com';
        return;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1020] text-white flex flex-col justify-between relative overflow-hidden select-none">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-20 w-80 h-80 bg-[#7c3aed]/28 rounded-full blur-3xl" />
        <div className="absolute top-24 right-0 w-72 h-72 bg-[#ec4899]/22 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-96 h-72 bg-[#22d3ee]/18 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 px-5 pt-6 pb-4 flex items-center justify-between max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fb7185] via-[#f43f5e] to-[#be123c] flex items-center justify-center text-white shadow-[0_10px_26px_rgba(244,63,94,0.42)]">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight">OnlyUs Hub</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/12 border border-white/20">
                Private
              </span>
            </div>
            <p className="text-xs text-white/70 font-medium">
              {myName} & {partnerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={onOpenSettings}
              className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xl text-white border border-white/20 hover:bg-white/20 active:scale-95 transition-all"
              title="Settings & Passcodes"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onOpenProfile}
            className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xl text-white border border-white/20 hover:bg-white/20 active:scale-95 transition-all"
            title="My Profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-rose-500/15 backdrop-blur-xl text-rose-200 border border-rose-300/25 hover:bg-rose-500/25 active:scale-95 transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-5 py-2 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 rounded-3xl bg-white/8 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(15,23,42,0.45)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {partnerProfile?.photo_url ? (
                  <img
                    src={partnerProfile.photo_url}
                    alt={partnerName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-white/35 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#f472b6] to-[#8b5cf6] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {partnerName[0] || 'N'}
                  </div>
                )}
                {isPartnerOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0f1020] rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">{partnerName}</span>
                  {isPartnerOnline ? (
                    <span className="text-[11px] font-semibold text-emerald-200 bg-emerald-400/20 px-2 py-0.5 rounded-full border border-emerald-300/30">
                      Online Now
                    </span>
                  ) : (
                    <span className="text-[11px] text-white/65 font-medium">
                      {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/65 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-300" />
                  Encrypted Couple Sanctuary
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/20">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs font-bold text-white">{totalMessages} msgs</span>
            </div>
          </div>
        </motion.div>

        <div className="space-y-3.5">
          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('chat')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-gradient-to-r from-[#fb7185] via-[#f43f5e] to-[#be123c] text-white shadow-[0_16px_36px_rgba(244,63,94,0.42)] overflow-hidden transition-all"
          >
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/15 -skew-x-12 translate-x-10 pointer-events-none group-hover:translate-x-6 transition-transform duration-500" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/35 shadow-inner">
                  <MessageCircleHeart className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight">OnlyUs Chat</h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white">
                      Primary
                    </span>
                  </div>
                  <p className="text-xs text-white/85 font-medium mt-0.5">
                    Messages, voice notes, live calls & games
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#be123c] transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('instagram')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-white/8 backdrop-blur-2xl border border-white/15 text-white shadow-[0_10px_26px_rgba(15,23,42,0.35)] hover:border-fuchsia-300/45 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#D300C5] flex items-center justify-center text-white shadow-md shadow-pink-500/25">
                  <Instagram className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight">Instagram</h2>
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-300/15 text-fuchsia-100 text-[10px] font-bold border border-fuchsia-200/20">
                      Reels & DMs
                    </span>
                  </div>
                  <p className="text-xs text-white/70 font-medium mt-0.5">
                    Persistent personal session on this device
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-white/50 group-hover:text-fuchsia-100 transition-colors" />
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/85 group-hover:bg-gradient-to-tr group-hover:from-[#FF0069] group-hover:to-[#D300C5] group-hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('whatsapp')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-white/8 backdrop-blur-2xl border border-white/15 text-white shadow-[0_10px_26px_rgba(15,23,42,0.35)] hover:border-emerald-300/45 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#25D366] to-[#128C7E] flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                  <MessageSquareCode className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight">WhatsApp Web</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-300/15 text-emerald-100 text-[10px] font-bold border border-emerald-200/25">
                      Linked Session
                    </span>
                  </div>
                  <p className="text-xs text-white/70 font-medium mt-0.5">
                    Phone number pairing & linked webview
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-white/50 group-hover:text-emerald-100 transition-colors" />
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/85 group-hover:bg-gradient-to-tr group-hover:from-[#25D366] group-hover:to-[#128C7E] group-hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-5 p-3 rounded-2xl bg-white/8 backdrop-blur-2xl border border-white/15 flex items-center justify-between gap-2.5 text-white/80 text-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-cyan-300 shrink-0" />
            <p className="leading-snug text-[11px]">
              <strong>Independent Isolation:</strong> Logging out of OnlyUs never affects or logs you out of your personal Instagram or WhatsApp sessions.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/65">
            <Smartphone className="w-3.5 h-3.5" />
            <Gamepad2 className="w-3.5 h-3.5" />
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-5 py-4 text-center text-xs text-white/45 font-medium">
        OnlyUs v3.0 • Built exclusively for Rahul & Nusrat
      </footer>
    </div>
  );
};
