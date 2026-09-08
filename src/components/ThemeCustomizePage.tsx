import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { THEMES, ThemeName } from '../lib/themes';

export interface ThemeCustomizePageProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeName;
  onThemeSelect: (theme: ThemeName) => Promise<void> | void;
  isThemeSaving?: boolean;
}

export const ThemeCustomizePage: React.FC<ThemeCustomizePageProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeSelect,
  isThemeSaving = false,
}) => {
  const [pendingTheme, setPendingTheme] = useState<ThemeName>(currentTheme);

  useEffect(() => {
    if (isOpen) {
      setPendingTheme(currentTheme);
    }
  }, [isOpen, currentTheme]);

  const applySelectedTheme = async () => {
    if (pendingTheme === currentTheme || isThemeSaving) return;
    await onThemeSelect(pendingTheme);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="theme-customize-page fixed inset-0 z-[140] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] overflow-hidden font-sans animate-in fade-in duration-100"
        >
          {/* Header Bar */}
          <header className="h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-surface)]/90 backdrop-blur-md flex-shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 rounded-full transition-colors active:scale-95 cursor-pointer"
                aria-label="Back to chat"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-[18px] sm:text-[20px] font-bold text-[var(--theme-text)] tracking-tight">Customise Theme</h2>
                <p className="text-[11px] sm:text-[12px] text-[var(--theme-text)]/60 font-medium">Personalize colors, wallpaper & fonts</p>
              </div>
            </div>
            {pendingTheme !== currentTheme && (
              <button
                onClick={applySelectedTheme}
                disabled={isThemeSaving}
                className="px-4 py-1.5 rounded-full bg-[var(--theme-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isThemeSaving ? 'Saving...' : 'Apply'}
              </button>
            )}
          </header>

          {/* Body Content */}
          <div className="flex-1 custom-scrollbar overflow-y-auto px-4 sm:px-8 py-5 pb-28 max-w-4xl mx-auto w-full">
            {/* Info Banner */}
            <div className="mb-6 p-4 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center flex-shrink-0 font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[var(--theme-text)]">Chat Atmosphere</h3>
                <p className="text-xs text-[var(--theme-text)]/65 leading-relaxed mt-0.5">
                  Each theme changes the room's mood with custom wallpaper textures, bubble colors, ambient lighting, and typography.
                </p>
              </div>
            </div>

            {/* Grid of themes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
              {(Object.keys(THEMES) as ThemeName[]).map((themeName) => {
                const theme = THEMES[themeName];
                const isSelected = pendingTheme === themeName;
                const isApplied = currentTheme === themeName;
                return (
                  <button
                    key={themeName}
                    type="button"
                    onClick={() => setPendingTheme(themeName)}
                    disabled={isThemeSaving}
                    className={`group relative flex flex-col p-3 rounded-2xl sm:rounded-3xl border transition-all text-left overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-surface)] ring-4 ring-[var(--theme-accent)]/20 shadow-lg scale-[1.01]'
                        : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-accent)]/40 hover:shadow-md'
                    } ${isThemeSaving ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {/* Preview box */}
                    <div
                      className="relative w-full h-28 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden border border-black/5 p-2.5 flex flex-col justify-between shadow-inner transition-transform group-hover:scale-[1.01]"
                      style={{ background: theme.decoration, backgroundColor: theme.bg }}
                    >
                      {/* Mini top bar */}
                      <div 
                        className="w-full h-3 sm:h-3.5 rounded-full shadow-xs flex items-center px-1.5 justify-between"
                        style={{ background: theme.header }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
                        <div className="w-8 h-1 rounded-full opacity-30" style={{ background: theme.text }} />
                      </div>

                      {/* Mini bubbles */}
                      <div className="space-y-1.5 my-auto px-0.5">
                        <div
                          className="max-w-[78%] px-2.5 py-1 rounded-xl text-[9px] font-semibold shadow-xs"
                          style={{
                            background: theme.partner,
                            color: theme.partnerText,
                            borderRadius: '12px 12px 12px 3px'
                          }}
                        >
                          Hi there ❤️
                        </div>
                        <div
                          className="max-w-[78%] ml-auto px-2.5 py-1 rounded-xl text-[9px] font-semibold text-right shadow-xs"
                          style={{
                            background: theme.owner,
                            color: theme.ownerText,
                            borderRadius: '12px 12px 3px 12px'
                          }}
                        >
                          Love you ✨
                        </div>
                      </div>

                      {/* Selected check badge */}
                      {(isSelected || isApplied) && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Special 3D Aura Farm Badge */}
                      {themeName === '3d-aura' && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-black tracking-wider uppercase shadow-md flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>3D Live</span>
                        </div>
                      )}
                    </div>

                    {/* Theme Details */}
                    <div className="mt-3 px-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-[13px] sm:text-[15px] font-bold text-[var(--theme-text)] leading-tight truncate">
                          {theme.name}
                        </h4>
                        {themeName === '3d-aura' && !isApplied && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
                            3D
                          </span>
                        )}
                        {isApplied && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex-shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--theme-text)]/60 mt-1 line-clamp-2 leading-snug">
                        {theme.note}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-surface)]/95 backdrop-blur-md border-t border-[var(--theme-border)] p-4 z-30">
            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={applySelectedTheme}
                disabled={isThemeSaving || pendingTheme === currentTheme}
                className="w-full h-13 rounded-2xl bg-[var(--theme-accent)] text-white text-[15px] sm:text-[16px] font-bold tracking-wide shadow-xl shadow-[var(--theme-accent)]/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isThemeSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Applying Theme...</span>
                  </>
                ) : pendingTheme === currentTheme ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Theme Active</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Apply {THEMES[pendingTheme]?.name || 'Theme'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const ThemeCustomizeSheet = ThemeCustomizePage;
