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
    <div className="theme-hub min-h-screen flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background soft ambient glows */}
      <div className="theme-hub-glow absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none" />
      <div className="theme-hub-glow absolute top-1/2 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none" />
      <div className="theme-hub-glow absolute -bottom-32 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-5 pt-6 pb-4 flex items-center justify-between max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF8FA3] to-[#FF4D6D] flex items-center justify-center text-white shadow-md shadow-[#FF8FA3]/30">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-[#FF4D6D] to-[#C9184A] bg-clip-text text-transparent">
                OnlyUs Hub
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#FF8FA3]/15 text-[#C9184A] border border-[#FF8FA3]/20">
                Private
              </span>
            </div>
            <p className="text-xs text-[#590D22]/60 font-medium">
              {myName} & {partnerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={onOpenSettings}
              className="p-2.5 rounded-xl bg-white/80 backdrop-blur-md text-[#590D22] border border-[#FFCCD5]/80 shadow-sm hover:bg-white active:scale-95 transition-all"
              title="Settings & Passcodes"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onOpenProfile}
            className="p-2.5 rounded-xl bg-white/80 backdrop-blur-md text-[#590D22] border border-[#FFCCD5]/80 shadow-sm hover:bg-white active:scale-95 transition-all"
            title="My Profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-white/80 backdrop-blur-md text-red-500 border border-red-100 shadow-sm hover:bg-red-50 active:scale-95 transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 px-5 py-2 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">
        {/* Couple Presence Pill */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[#FFCCD5] shadow-[0_8px_30px_rgb(255,143,163,0.12)] flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              {partnerProfile?.photo_url ? (
                <img 
                  src={partnerProfile.photo_url} 
                  alt={partnerName} 
                  className="w-11 h-11 rounded-full object-cover border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[var(--theme-accent)]/15 border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center font-bold text-sm shadow-sm">
                  {partnerName[0] || 'N'}
                </div>
              )}
              {isPartnerOnline && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--theme-surface)] rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#1a1a1a]">{partnerName}</span>
                {isPartnerOnline ? (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    Online Now
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500 font-medium">
                    {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#590D22]/60 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FF4D6D]" />
                Encrypted Couple Sanctuary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FFF0F3] border border-[#FFCCD5]/80">
            <Flame className="w-3.5 h-3.5 text-[#FF4D6D]" />
            <span className="text-xs font-bold text-[#590D22]">{totalMessages} msgs</span>
          </div>
        </motion.div>

        {/* 3 Core Destination Cards */}
        <div className="space-y-3.5">
          {/* Card 1: OnlyUs Private Chat */}
          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('chat')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-gradient-to-r from-[#FF758F] via-[#FF4D6D] to-[#C9184A] text-white shadow-[0_12px_32px_rgba(201,24,74,0.28)] overflow-hidden transition-all"
          >
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/10 -skew-x-12 translate-x-10 pointer-events-none group-hover:translate-x-6 transition-transform duration-500" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                  <MessageCircleHeart className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight">OnlyUs Chat</h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white">
                      Primary
                    </span>
                  </div>
                  <p className="text-xs text-white/80 font-medium mt-0.5">
                    Messages, voice notes, live calls & games
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#C9184A] transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          {/* Card 2: Instagram */}
          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('instagram')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-white/95 backdrop-blur-md border border-[#FFCCD5] text-[#1a1a1a] shadow-[0_8px_24px_rgba(255,143,163,0.12)] hover:border-[#FF758F] transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#D300C5] flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                  <Instagram className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight">Instagram</h2>
                    <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[10px] font-bold border border-pink-100">
                      Reels & DMs
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6E6E] font-medium mt-0.5">
                    Persistent personal session on this device
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#FFF0F3] flex items-center justify-center text-[#FF4D6D] group-hover:bg-gradient-to-tr group-hover:from-[#FF0069] group-hover:to-[#D300C5] group-hover:text-white transition-all">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          {/* Card 3: WhatsApp */}
          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handleTabClick('whatsapp')}
            className="group relative cursor-pointer p-4 rounded-3xl bg-white/95 backdrop-blur-md border border-[#FFCCD5] text-[#1a1a1a] shadow-[0_8px_24px_rgba(255,143,163,0.12)] hover:border-emerald-300 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#25D366] to-[#128C7E] flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                  <MessageSquareCode className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight">WhatsApp Web</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                      Linked Session
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6E6E] font-medium mt-0.5">
                    Phone number pairing & linked webview
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-gradient-to-tr group-hover:from-[#25D366] group-hover:to-[#128C7E] group-hover:text-white transition-all">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Security & Persistence Notice */}
        <div className="mt-5 p-3 rounded-2xl bg-white/60 backdrop-blur-sm border border-[#FFCCD5]/60 flex items-center gap-2.5 text-[#590D22]/80 text-xs">
          <Lock className="w-4 h-4 text-[#FF4D6D] shrink-0" />
          <p className="leading-snug text-[11px]">
            <strong>Independent Isolation:</strong> Logging out of OnlyUs never affects or logs you out of your personal Instagram or WhatsApp sessions.
          </p>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 px-5 py-4 text-center text-xs text-[#590D22]/50 font-medium">
        OnlyUs v3.0 • Built exclusively for Rahul & Nusrat
      </footer>
    </div>
  );
};
