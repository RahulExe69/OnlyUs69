import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  Sparkles, 
  CheckCheck,
  Send
} from 'lucide-react';
import { 
  THEMES, 
  ThemeName, 
  BASE_THEMES, 
  toBaseThemeKey, 
  getThemeVariantKey, 
  is3DTheme 
} from '../lib/themes';
import { ThreeDThemeBackground } from './ThreeDThemeBackground';
import { UserProfile } from '../types';

export interface ThemeCustomizePageProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeName;
  onThemeSelect: (theme: ThemeName) => Promise<void> | void;
  isThemeSaving?: boolean;
  partnerProfile?: UserProfile | null;
  userProfile?: UserProfile | null;
}

interface ThemeCardProps {
  item: { key: string; name: string };
  is3DMode: boolean;
  isSelected: boolean;
  isCardApplied: boolean;
  partnerAvatar?: string | null;
  partnerName: string;
  onSelect: (key: string) => void;
}

const ThemeCard = React.memo<ThemeCardProps>(({
  item,
  is3DMode,
  isSelected,
  isCardApplied,
  partnerAvatar,
  partnerName,
  onSelect,
}) => {
  const cardThemeKey = getThemeVariantKey(item.key, is3DMode);
  const theme = THEMES[cardThemeKey] || THEMES.romantic;

  return (
    <div
      onClick={() => onSelect(item.key)}
      className={`group relative flex flex-col rounded-xl sm:rounded-2xl border transition-all text-left overflow-hidden cursor-pointer shadow-2xs transform-gpu ${
        isSelected
          ? 'border-[var(--theme-accent)] ring-2 sm:ring-3 ring-[var(--theme-accent)]/35 shadow-md scale-[1.015]'
          : 'border-[var(--theme-border)]/80 bg-[var(--theme-surface)] hover:border-[var(--theme-accent)]/50 hover:shadow-xs'
      }`}
    >
      {/* Realistic Live Chat Preview Viewport inside each card in 3-grid */}
      <div
        className="relative w-full h-44 sm:h-52 p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden select-none"
        style={{ 
          backgroundColor: theme.bg,
          backgroundImage: !is3DMode ? theme.decoration : undefined,
          fontFamily: theme.font
        }}
      >
        {/* Live 3D Canvas running ONLY on the clicked/selected card when 3D Mode is active */}
        {is3DMode && isSelected && (
          <ThreeDThemeBackground 
            theme={cardThemeKey} 
            className="absolute inset-0 pointer-events-none z-0" 
          />
        )}

        {/* Mini Live Top Chat Header */}
        <div 
          className="relative z-10 w-full px-1.5 sm:px-2 py-1 rounded-lg border shadow-2xs flex items-center justify-between transition-all"
          style={{ 
            backgroundColor: theme.header,
            borderColor: theme.border,
            color: theme.text
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative flex-shrink-0">
              {partnerAvatar ? (
                <img 
                  src={partnerAvatar} 
                  alt={partnerName} 
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border"
                  style={{ borderColor: theme.accent }}
                />
              ) : (
                <div 
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold text-white text-[8px] sm:text-[9px]"
                  style={{ backgroundColor: theme.accent }}
                >
                  {partnerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
            </div>
            <div className="text-[9px] sm:text-[11px] font-bold truncate leading-tight">
              {partnerName}
            </div>
          </div>
        </div>

        {/* Mini Live Chat Bubbles */}
        <div className="relative z-10 my-auto space-y-1.5 px-0.5">
          {/* 1. Incoming Partner Bubble */}
          <div className="flex items-end gap-1 max-w-[92%]">
            <div
              className="p-1.5 sm:p-2 rounded-xl rounded-bl-xs text-[9px] sm:text-[10.5px] font-medium shadow-2xs border transition-all leading-tight"
              style={{
                backgroundColor: theme.partner,
                color: theme.partnerText,
                borderColor: theme.border
              }}
            >
              <p>Hey ❤️</p>
            </div>
          </div>

          {/* 2. Outgoing Owner Bubble */}
          <div className="ml-auto max-w-[92%]">
            <div
              className="p-1.5 sm:p-2 rounded-xl rounded-br-xs text-[9px] sm:text-[10.5px] font-semibold shadow-2xs transition-all leading-tight ml-auto"
              style={{
                backgroundColor: theme.owner,
                color: theme.ownerText
              }}
            >
              <p>Love this! ✨</p>
              <div className="flex items-center justify-end gap-0.5 text-[7px] sm:text-[8px] opacity-80 mt-0.5 font-mono leading-none">
                <CheckCheck className="w-2.5 h-2.5" style={{ color: theme.accent }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mini Live Bottom Chat Input Bar */}
        <div 
          className="relative z-10 w-full p-1 rounded-lg border shadow-2xs flex items-center gap-1"
          style={{
            backgroundColor: theme.input,
            borderColor: theme.border,
            color: theme.text
          }}
        >
          <div className="flex-1 text-[8px] sm:text-[9.5px] opacity-50 px-1 font-medium truncate">
            Message...
          </div>
          <div 
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center text-white shadow-2xs flex-shrink-0"
            style={{ backgroundColor: theme.accent }}
          >
            <Send className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
          </div>
        </div>

        {/* Top Badges (Active / Selected / 3D) */}
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1">
          {is3DMode && isSelected && (
            <div className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-0.5">
              <Sparkles className="w-2 h-2" />
              <span>3D</span>
            </div>
          )}

          {isCardApplied && (
            <div className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-0.5">
              <Check className="w-2 h-2 stroke-[3]" />
              <span className="hidden sm:inline">Active</span>
            </div>
          )}

          {isSelected && !isCardApplied && !is3DMode && (
            <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-xs">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          )}
        </div>
      </div>

      {/* CLEAN CARD FOOTER: Strictly provides ONLY the theme's name as requested */}
      <div className="py-2 px-1.5 sm:px-2 text-center border-t border-[var(--theme-border)]/50 bg-[var(--theme-surface)]">
        <div className="text-[11px] sm:text-[13px] font-bold text-[var(--theme-text)] truncate tracking-tight leading-tight">
          {item.name}
        </div>
      </div>
    </div>
  );
});

ThemeCard.displayName = 'ThemeCard';

export const ThemeCustomizePage: React.FC<ThemeCustomizePageProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeSelect,
  isThemeSaving = false,
  partnerProfile,
  userProfile
}) => {
  // 3D toggle state (toggle between normal and 3d)
  const [is3DMode, setIs3DMode] = useState<boolean>(() => is3DTheme(currentTheme));
  // Selected base theme key (e.g. 'romantic', 'dark', 'light', etc.)
  const [selectedBaseKey, setSelectedBaseKey] = useState<string>(() => toBaseThemeKey(currentTheme));

  useEffect(() => {
    if (isOpen) {
      setIs3DMode(is3DTheme(currentTheme));
      setSelectedBaseKey(toBaseThemeKey(currentTheme));
    }
  }, [isOpen, currentTheme]);

  const pendingTheme = getThemeVariantKey(selectedBaseKey, is3DMode);
  const isApplied = currentTheme === pendingTheme;
  const selectedThemeObj = THEMES[pendingTheme] || THEMES.romantic;

  const applySelectedTheme = async (themeToApply?: ThemeName) => {
    const target = themeToApply || pendingTheme;
    if (target === currentTheme || isThemeSaving) return;
    await onThemeSelect(target);
    onClose();
  };

  const partnerName = partnerProfile?.display_name || partnerProfile?.username || (userProfile?.role === 'owner' ? 'Nusrat' : 'Rahul');
  const partnerAvatar = partnerProfile?.photo_url;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[140] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] overflow-hidden font-sans select-none"
        >
          {/* Top Navigation Bar */}
          <header className="h-14 sm:h-16 px-3.5 sm:px-6 flex items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-surface)] flex-shrink-0 z-30">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 -ml-1 text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/15 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer flex-shrink-0"
                aria-label="Back to chat"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--theme-text)] tracking-tight leading-tight truncate">
                  Customize Theme
                </h2>
                <p className="text-[10px] sm:text-[11px] text-[var(--theme-text)]/60 font-medium leading-none mt-0.5">
                  Tap to preview • {BASE_THEMES.length} themes available
                </p>
              </div>
            </div>

            {!isApplied && (
              <button
                type="button"
                onClick={() => applySelectedTheme()}
                disabled={isThemeSaving}
                className="px-3.5 py-1.5 rounded-full bg-[var(--theme-accent)] text-white text-xs font-bold shadow-md shadow-[var(--theme-accent)]/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                {isThemeSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                <span>Apply</span>
              </button>
            )}
          </header>

          {/* Clean Sub-header with 3D Mode Toggle */}
          <div className="px-3.5 sm:px-6 py-2.5 bg-[var(--theme-surface)] flex-shrink-0 border-b border-[var(--theme-border)]/50 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[var(--theme-text)]">
                {is3DMode ? '3D Live Themes' : 'Normal Themes'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[var(--theme-text)]/60">
                {BASE_THEMES.length}
              </span>
            </div>

            {/* Interactive 3D Mode Toggle Switch */}
            <div 
              onClick={() => setIs3DMode(prev => !prev)}
              className="flex items-center gap-2 cursor-pointer select-none group"
              role="button"
              tabIndex={0}
              aria-label="Toggle 3D mode"
            >
              <div className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                is3DMode 
                  ? 'text-purple-500 dark:text-purple-400 font-extrabold' 
                  : 'text-[var(--theme-text)]/60 group-hover:text-[var(--theme-text)]'
              }`}>
                <Sparkles className={`w-3.5 h-3.5 ${is3DMode ? 'animate-pulse' : ''}`} />
                <span>3D Mode</span>
              </div>

              <div className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                is3DMode ? 'bg-purple-600' : 'bg-black/15 dark:bg-white/20'
              }`}>
                <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                  is3DMode ? 'translate-x-5' : 'translate-x-0'
                }`}>
                  {is3DMode && (
                    <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Theme Grid: EXACT 3-COLUMN GRID AS REQUESTED */}
          <div className="flex-1 custom-scrollbar overflow-y-auto px-2.5 sm:px-6 py-3.5 pb-28 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
              {BASE_THEMES.map((item) => {
                const cardThemeKey = getThemeVariantKey(item.key, is3DMode);
                const isSelected = selectedBaseKey === item.key;
                const isCardApplied = currentTheme === cardThemeKey;

                return (
                  <ThemeCard
                    key={item.key}
                    item={item}
                    is3DMode={is3DMode}
                    isSelected={isSelected}
                    isCardApplied={isCardApplied}
                    partnerAvatar={partnerAvatar}
                    partnerName={partnerName}
                    onSelect={setSelectedBaseKey}
                  />
                );
              })}
            </div>
          </div>

          {/* Fixed Floating Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-surface)] border-t border-[var(--theme-border)] p-3 sm:p-4 z-40">
            <div className="max-w-md mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => applySelectedTheme()}
                disabled={isThemeSaving || isApplied}
                className={`flex-1 h-11 sm:h-12 rounded-2xl text-[13px] sm:text-[15px] font-bold tracking-wide shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isApplied
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default'
                    : 'bg-[var(--theme-accent)] text-white shadow-[var(--theme-accent)]/25 hover:opacity-95'
                }`}
              >
                {isThemeSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Applying Theme...</span>
                  </>
                ) : isApplied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{selectedThemeObj.name} {is3DMode ? '(3D)' : ''} is Active</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Apply {selectedThemeObj.name} {is3DMode ? '(3D)' : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ThemeCustomizeSheet = ThemeCustomizePage;
