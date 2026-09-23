import React from 'react';
import { motion } from 'motion/react';
import { 
  MessageCircleHeart, 
  Instagram, 
  MessageSquareCode, 
  Settings, 
  LogOut, 
  User, 
  Heart,
  ChevronRight,
  Flame,
  Lock,
  ArrowRight,
  FolderHeart,
  Sparkles,
  Image as ImageIcon,
  Film,
  Mic,
  Link2
} from 'lucide-react';
import { UserProfile, Message } from '../types';
import { is3DTheme } from '../lib/themes';
import { QuantumAuraBackground } from './QuantumAuraBackground';
import { ShaderBorderBeam } from './ShaderBorderBeam';
import { RomanticCardAmbiance } from './RomanticCardAmbiance';
import { hydrateMessageMedia } from '../lib/dateUtils';
import { GlowEffect } from './ui/glow-effect';

interface MultiHubDashboardProps {
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  isOwner: boolean;
  isPartner: boolean;
  isSocketConnected: boolean;
  socketOnlineUsers: string[];
  formatLastSeen: (timestamp: any, uid?: string) => string;
  totalMessages: number;
  messages?: Message[];
  onSelectTab: (tab: 'chat' | 'instagram' | 'whatsapp') => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenPartnerInfo?: () => void;
  onOpenMedia?: () => void;
  onLogout: () => void;
}

export const MultiHubDashboard: React.FC<MultiHubDashboardProps> = ({
  userProfile,
  partnerProfile,
  isOwner,
  formatLastSeen,
  totalMessages,
  messages = [],
  onSelectTab,
  onOpenSettings,
  onOpenProfile,
  onOpenPartnerInfo,
  onOpenMedia,
  onLogout,
}) => {
  // Normal names (strictly account display names or standard 'Rahul' & 'Nusrat', excluding nicknames)
  const partnerNormalName = partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul');
  const myNormalName = userProfile?.display_name || (isOwner ? 'Rahul' : 'Nusrat');
  const partnerName = userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerNormalName;
  const myName = myNormalName;
  
  const lastSeenStatus = formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid);
  const isPartnerOnline = lastSeenStatus === 'Online';
  const isInGame = lastSeenStatus === 'In Game Room 🎮';

  // Real-time media stats calculation for Media & Memories
  const mediaStats = React.useMemo(() => {
    let photos = 0;
    let videos = 0;
    let audios = 0;
    let links = 0;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    messages.forEach((msg) => {
      if (msg.deleted) return;
      if (isOwner && msg.hidden_for_owner) return;
      if (!isOwner && msg.hidden_for_partner) return;

      const media = msg.media || hydrateMessageMedia(msg);
      if (media?.mediaList && media.mediaList.length > 0) {
        media.mediaList.forEach((item) => {
          if (item.type === 'video') videos++;
          else if (item.type === 'audio') audios++;
          else photos++;
        });
      } else if (media) {
        if (media.type === 'video') videos++;
        else if (media.type === 'audio') audios++;
        else photos++;
      }

      const rawAtt = (msg as any).attachment_url;
      if (typeof rawAtt === 'string' && rawAtt.trim()) {
        const isAudio = /^data:audio\//.test(rawAtt) || /\.(mp3|wav|ogg|m4a|aac|weba|webm)(?:\?|$)/i.test(rawAtt);
        const isVideo = !isAudio && (/^data:video\//.test(rawAtt) || /\.(mp4|mov|webm)(?:\?|$)/i.test(rawAtt));
        if (isAudio) audios++;
        else if (isVideo) videos++;
      }

      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) links += matches.length;
      }
    });

    return { photos, videos, audios, links, total: photos + videos + audios + links };
  }, [messages, isOwner]);

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
    <div className="theme-hub min-h-[100dvh] flex flex-col justify-between relative overflow-hidden select-none bg-[var(--theme-bg)] text-[var(--theme-text)]">
      {(is3DTheme(userProfile?.theme) || (typeof document !== 'undefined' && is3DTheme(document.documentElement.dataset.chatTheme))) && (
        <QuantumAuraBackground theme={userProfile?.theme || (typeof document !== 'undefined' ? document.documentElement.dataset.chatTheme : undefined)} />
      )}
      
      {/* Subtle ambient glows using theme colors */}
      <div 
        className="absolute -top-36 -left-36 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--theme-accent)' }} 
      />
      <div 
        className="absolute top-1/2 -right-36 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: 'var(--theme-accent)' }} 
      />

      {/* Top Header Bar */}
      <header className="relative z-10 px-5 pt-[max(1rem,calc(0.75rem+env(safe-area-inset-top,0px)))] pb-3 flex items-center justify-between max-w-md mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center border border-[var(--theme-accent)]/25 shadow-2xs">
            <Heart className="w-4 h-4 fill-current animate-pulse" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black tracking-tight text-[var(--theme-text)]">
                OnlyUs
              </h1>
            </div>
            <p className="text-[11px] text-[var(--theme-text)]/60 font-medium truncate max-w-[140px] sm:max-w-[180px]">
              {isOwner ? 'Nusrat & Rahul' : 'Rahul & Nusrat'}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {isOwner && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-[var(--theme-text)]/70 hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface)]/80 active:scale-90 transition-all cursor-pointer"
              title="Settings & Passcodes"
            >
              <Settings className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-full text-[var(--theme-text)]/70 hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface)]/80 active:scale-90 transition-all cursor-pointer"
            title="My Profile"
          >
            <User className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-full text-red-500/80 hover:text-red-500 hover:bg-red-500/10 active:scale-90 transition-all cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* Main Hub Body */}
      <main className="relative z-10 px-5 py-2 max-w-md mx-auto w-full flex-1 flex flex-col justify-center gap-4">
        
        {/* Partner Sanctuary Card - Wrapped in swirling theme-adaptive ShaderBorderBeam */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.985 }}
          className="group cursor-pointer"
        >
          <ShaderBorderBeam
            borderRadius="rounded-2xl"
            innerRadius="rounded-[calc(1rem-1.5px)]"
            borderWidth={1.8}
            duration={5}
            beamLength={120}
            glow={true}
            glowIntensity={0.45}
            beamColors={[
              'transparent',
              'var(--theme-accent)',
              'rgba(255, 255, 255, 0.95)',
              'var(--theme-accent)',
              'transparent',
            ]}
            onClick={onOpenPartnerInfo || onOpenProfile}
            className="p-3.5 bg-[var(--theme-surface)]/90 backdrop-blur-md flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0 w-12 h-12 aspect-square">
                <div className="w-12 h-12 aspect-square rounded-full overflow-hidden border-2 border-[var(--theme-accent)]/40 ring-2 ring-[var(--theme-accent)]/15 shadow-2xs bg-[var(--theme-surface)]">
                  {partnerProfile?.photo_url ? (
                    <img 
                      src={partnerProfile.photo_url} 
                      alt={partnerName} 
                      className="w-full h-full object-cover rounded-full aspect-square block"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center font-bold text-base">
                      {partnerName[0] || (isOwner ? 'N' : 'R')}
                    </div>
                  )}
                </div>
                
                {/* Online indicator */}
                {isPartnerOnline ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--theme-surface)] rounded-full animate-pulse z-10 shadow-xs" />
                ) : isInGame ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 border-2 border-[var(--theme-surface)] rounded-full animate-pulse z-10 shadow-xs" />
                ) : null}
              </div>

              <div className="min-w-0">
                <h2 className="font-bold text-sm sm:text-base text-[var(--theme-text)] truncate leading-tight">
                  {partnerName}
                </h2>
                
                <div className="mt-0.5 flex items-center gap-1.5">
                  {isPartnerOnline ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online now
                    </span>
                  ) : isInGame ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      In Game Room 🎮
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--theme-text)]/60 font-medium">
                      {lastSeenStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages count pill */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0 text-xs font-bold shadow-2xs">
              <Flame className="w-3.5 h-3.5 fill-current text-orange-500 animate-pulse" />
              <span>{totalMessages.toLocaleString()}</span>
            </div>
          </ShaderBorderBeam>
        </motion.div>

        {/* Primary Destination: OnlyUs Chat with Romantic Floating Hearts & Stardust Ambiance */}
        <motion.div
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleTabClick('chat')}
          className="group cursor-pointer relative rounded-3xl p-5 text-white shadow-xl overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 92%, #FF80AB 8%) 0%, color-mix(in srgb, var(--theme-accent) 80%, black 20%) 100%)',
            boxShadow: '0 12px 32px -4px color-mix(in srgb, var(--theme-accent) 45%, transparent), 0 0 20px -2px rgba(255, 182, 193, 0.28)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Romantic Floating Hearts & Twinkling Stardust Ambiance (Nusrat's Favorite Ambiance) */}
          <RomanticCardAmbiance heartCount={12} starCount={18} />

          {/* Gentle romantic ambient light overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/15 pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_14px_rgba(0,0,0,0.15)] shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircleHeart className="w-6 h-6 stroke-[2.2] text-rose-100 drop-shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow-xs">
                    OnlyUs Chat
                  </h3>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider text-white border border-white/30 shadow-2xs">
                    <Heart className="w-2.5 h-2.5 fill-current text-rose-300 animate-pulse" />
                    <span>Our Place</span>
                  </span>
                </div>
                <p className="text-xs text-white/90 font-medium mt-0.5 drop-shadow-xs">
                  Messages, voice notes, live calls & games
                </p>
              </div>
            </div>

            {/* Action Arrow Button with Soft Romantic Glow */}
            <div className="w-9 h-9 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white group-hover:text-[var(--theme-accent)] group-hover:translate-x-0.5 transition-all shadow-md shrink-0 border border-white/30">
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
        </motion.div>

        {/* Media Option: Placed directly under OnlyUs Chat with 21st.dev Glow Effect */}
        <div className="relative group/glow-media">
          {/* Ambient Glow Effect radiating around the media option card */}
          <GlowEffect
            theme={userProfile?.theme}
            mode="colorShift"
            blur="medium"
            duration={5}
            scale={1.03}
            className="rounded-3xl opacity-55 group-hover/glow-media:opacity-95 group-hover/glow-media:scale-105 transition-all duration-300"
          />

          <motion.div
            whileHover={{ scale: 1.012 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              if (onOpenMedia) onOpenMedia();
            }}
            className="relative z-10 group cursor-pointer p-4 rounded-3xl bg-[var(--theme-surface)]/95 backdrop-blur-md border border-[var(--theme-border)]/75 hover:border-[var(--theme-accent)]/50 shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[var(--theme-accent)] to-rose-400 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <FolderHeart className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-[var(--theme-text)] leading-tight">
                    Media
                  </h3>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] text-[10px] font-bold border border-[var(--theme-accent)]/20 shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 fill-current" />
                    <span>{mediaStats.total}</span>
                  </span>
                </div>
                <p className="text-[11px] text-[var(--theme-text)]/60 font-medium truncate mt-0.5">
                  Photos, videos, audios & shared links
                </p>
                {/* Quick count chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] text-[var(--theme-text)]/70 font-semibold">
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/60 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-[var(--theme-accent)]" />
                    <span>{mediaStats.photos}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/60 flex items-center gap-1">
                    <Film className="w-3 h-3 text-purple-500" />
                    <span>{mediaStats.videos}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/60 flex items-center gap-1">
                    <Mic className="w-3 h-3 text-emerald-500" />
                    <span>{mediaStats.audios}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--theme-bg)]/80 border border-[var(--theme-border)]/60 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    <span>{mediaStats.links}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--theme-text)]/40 group-hover:text-[var(--theme-accent)] group-hover:translate-x-0.5 transition-all shrink-0">
              <ChevronRight className="w-5 h-5 stroke-[2.2]" />
            </div>
          </motion.div>
        </div>

        {/* Companion Apps Section - Clean, Elegant & Clutter-Free */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text)]/50">
              Companion Apps
            </span>
            <div className="h-px flex-1 bg-[var(--theme-border)]/40" />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Instagram */}
            <motion.div
              whileHover={{ scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => handleTabClick('instagram')}
              className="group cursor-pointer p-3.5 rounded-2xl bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)]/70 hover:border-pink-500/40 shadow-2xs transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-xs shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--theme-text)] leading-snug">
                    Instagram
                  </h4>
                  <p className="text-[11px] text-[var(--theme-text)]/60 font-medium">
                    Reels & Direct Messages
                  </p>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--theme-text)]/40 group-hover:text-pink-500 group-hover:translate-x-0.5 transition-all">
                <ChevronRight className="w-4 h-4 stroke-[2.2]" />
              </div>
            </motion.div>

            {/* WhatsApp Web */}
            <motion.div
              whileHover={{ scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => handleTabClick('whatsapp')}
              className="group cursor-pointer p-3.5 rounded-2xl bg-[var(--theme-surface)]/85 backdrop-blur-md border border-[var(--theme-border)]/70 hover:border-emerald-500/40 shadow-2xs transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#25D366] to-[#128C7E] flex items-center justify-center text-white shadow-xs shrink-0">
                  <MessageSquareCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--theme-text)] leading-snug">
                    WhatsApp Web
                  </h4>
                  <p className="text-[11px] text-[var(--theme-text)]/60 font-medium">
                    Linked session & messaging
                  </p>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--theme-text)]/40 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all">
                <ChevronRight className="w-4 h-4 stroke-[2.2]" />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full flex items-center justify-center px-5 pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))] pt-2 text-center text-[10px] text-[var(--theme-text)]/50 font-medium tracking-wide">
        <span>OnlyUs • Made with love</span>
        <span className="inline-block mx-1 text-red-500 animate-pulse">❤️</span>
        <span>for Rahul & Nusrat</span>
      </footer>
    </div>
  );
};
