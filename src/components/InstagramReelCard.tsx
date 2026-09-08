import React from 'react';
import { Play, ExternalLink, Instagram, Film } from 'lucide-react';
import { InstagramReelInfo } from '../lib/instagram';

interface InstagramReelCardProps {
  reel: InstagramReelInfo;
  isOwn: boolean;
  onWatch: () => void;
  selectionActive?: boolean;
}

export const InstagramReelCard: React.FC<InstagramReelCardProps> = ({
  reel,
  isOwn,
  onWatch,
  selectionActive = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (selectionActive) return;
    e.stopPropagation();
    onWatch();
  };

  const handleOpenExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(reel.cleanUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className={`my-1.5 w-full max-w-[280px] sm:max-w-[310px] rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer select-none group shadow-lg ${
        isOwn
          ? 'bg-black/40 border-white/20 text-white hover:border-white/40'
          : 'bg-[var(--theme-surface)]/95 border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)]/50'
      }`}
    >
      {/* Top Banner with Instagram Branding */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-black/40 to-black/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Instagram className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-black tracking-wide uppercase leading-tight truncate">
              Instagram Reel
            </span>
            <span className="text-[9px] opacity-60 font-mono tracking-tight truncate">
              {reel.code}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenExternal}
          title="Open in Instagram"
          className="p-1 rounded-full hover:bg-white/15 active:scale-90 transition-transform opacity-70 hover:opacity-100 shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Reel Preview Stage */}
      <div className="relative aspect-[4/3] bg-neutral-950 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Ambient glow in background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#833ab4]/25 via-[#fd1d1d]/20 to-[#fcb045]/25 opacity-75 group-hover:opacity-100 transition-opacity" />
        
        {/* Subtle grid pattern / cinema lines */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />

        {/* Center Animated Play Button */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-xl group-hover:scale-110 active:scale-95 transition-transform duration-200">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>

          <span className="text-[11px] font-bold tracking-wide text-white drop-shadow-md px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/15">
            Watch Reel
          </span>
        </div>

        {/* Bottom subtle tag */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] text-white/60 select-none">
          <span className="flex items-center gap-1 font-medium">
            <Film className="w-2.5 h-2.5" /> Tap to play in OnlyUs
          </span>
          <span className="opacity-75">No login needed</span>
        </div>
      </div>
    </div>
  );
};
