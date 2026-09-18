import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Heart, Check, Volume2, VolumeX } from 'lucide-react';
import { PetSettings, PetBreed, PetAccessory } from '../types';

interface PetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PetSettings;
  onSaveSettings: (settings: PetSettings) => void;
}

const BREEDS: { id: PetBreed; name: string; desc: string; emoji: string; badgeColor: string }[] = [
  { id: 'mochi', name: 'Snowy Mochi', desc: 'Milky pure white with soft blush & pink ears', emoji: '🤍', badgeColor: 'bg-rose-50 border-rose-200 text-rose-700' },
  { id: 'calico', name: 'Calico Mimi', desc: 'Sweet white with honey apricot & chocolate patches', emoji: '🧡', badgeColor: 'bg-amber-50 border-amber-200 text-amber-800' },
  { id: 'caramel', name: 'Caramel Ginger', desc: 'Playful warm honey tabby with cream tummy', emoji: '🐱', badgeColor: 'bg-orange-50 border-orange-200 text-orange-800' },
  { id: 'luna', name: 'Midnight Luna', desc: 'Velvet black kitten with emerald eyes & white mittens', emoji: '🖤', badgeColor: 'bg-slate-100 border-slate-300 text-slate-800' },
];

const ACCESSORIES: { id: PetAccessory; name: string; icon: string }[] = [
  { id: 'none', name: 'Natural', icon: '✨' },
  { id: 'bow', name: 'Pink Bow', icon: '🎀' },
  { id: 'bell', name: 'Golden Bell', icon: '🔔' },
  { id: 'sakura', name: 'Sakura Petal', icon: '🌸' },
  { id: 'scarf', name: 'Cozy Scarf', icon: '🧣' },
  { id: 'crown', name: 'Royal Crown', icon: '👑' },
];

export const PetSettingsModal: React.FC<PetSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = React.useState<PetSettings>(settings);
  const [isPettingPreview, setIsPettingPreview] = React.useState<boolean>(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleToggle = () => {
    const updated = { ...localSettings, enabled: !localSettings.enabled };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleBreedChange = (breed: PetBreed) => {
    const updated = { ...localSettings, breed };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleAccessoryChange = (accessory: PetAccessory) => {
    const updated = { ...localSettings, accessory };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...localSettings, name: e.target.value };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleTestPet = () => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate([25, 40, 30]);
      } catch (_) {}
    }
    setIsPettingPreview(true);
    setTimeout(() => setIsPettingPreview(false), 900);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--theme-border)]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] flex items-center justify-center text-xl shadow-xs">
                  🐱
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[var(--theme-text)]">
                    Chat Companion
                  </h2>
                  <p className="text-xs text-[var(--theme-text)]/60">
                    Your shared animated 2D kitten
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--theme-text)]/50 hover:text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
              {/* Enable / Disable Toggle Card */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--theme-bg)]/80 border border-[var(--theme-border)] shadow-xs">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[var(--theme-text)]">Active in Chat</p>
                  <p className="text-xs text-[var(--theme-text)]/60">
                    Jumps across message bubbles and plays
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={localSettings.enabled}
                  onClick={handleToggle}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    localSettings.enabled ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-text)]/20'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      localSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Pet Preview & Test Pet Button */}
              <div className="relative p-5 rounded-3xl bg-gradient-to-b from-[var(--theme-accent)]/10 to-[var(--theme-bg)] border border-[var(--theme-border)] flex flex-col items-center justify-center text-center">
                <motion.div
                  animate={isPettingPreview ? { scale: [1, 1.25, 0.95, 1.1, 1], rotate: [0, -6, 6, -3, 0] } : {}}
                  transition={{ duration: 0.6 }}
                  className="w-20 h-20 rounded-full bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] flex items-center justify-center text-4xl shadow-md cursor-pointer relative"
                  onClick={handleTestPet}
                  title="Click to pet!"
                >
                  {localSettings.breed === 'luna' ? '🖤' : localSettings.breed === 'calico' ? '🧡' : localSettings.breed === 'caramel' ? '🐱' : '🤍'}
                  
                  {localSettings.accessory === 'bow' && (
                    <span className="absolute -top-1 -right-1 text-xl">🎀</span>
                  )}
                  {localSettings.accessory === 'bell' && (
                    <span className="absolute -bottom-1 -right-1 text-base">🔔</span>
                  )}
                  {localSettings.accessory === 'sakura' && (
                    <span className="absolute -top-1 -left-1 text-xl">🌸</span>
                  )}
                  {localSettings.accessory === 'scarf' && (
                    <span className="absolute -bottom-1 left-1 text-lg">🧣</span>
                  )}

                  <AnimatePresence>
                    {isPettingPreview && (
                      <motion.div
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: -28, scale: 1.2 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-5 text-sm font-bold text-rose-500 bg-white/95 px-2 py-0.5 rounded-full shadow-sm"
                      >
                        Purrr~ ❤️
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <p className="mt-3 text-sm font-bold text-[var(--theme-text)]">
                  {localSettings.name || 'Mochi'}
                </p>
                <p className="text-[11px] text-[var(--theme-text)]/50 mt-0.5">
                  Tap kitten to test purr & haptic
                </p>
              </div>

              {/* Kitten Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]/70">
                  Kitten Name
                </label>
                <input
                  type="text"
                  value={localSettings.name}
                  onChange={handleNameChange}
                  maxLength={16}
                  placeholder="e.g. Mochi, Mimi, Boba"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] focus:outline-hidden focus:border-[var(--theme-accent)] transition-colors"
                />
              </div>

              {/* Breed Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]/70">
                  Choose Breed & Fur Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BREEDS.map((b) => {
                    const isSelected = localSettings.breed === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBreedChange(b.id)}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                            : 'bg-[var(--theme-bg)]/60 border-[var(--theme-border)] hover:border-[var(--theme-border)]/80'
                        }`}
                      >
                        <span className="text-2xl mt-0.5">{b.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--theme-text)] truncate">
                              {b.name}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--theme-accent)] flex-shrink-0 ml-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--theme-text)]/60 mt-0.5 leading-tight">
                            {b.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accessories */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]/70">
                  Kitten Accessories
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACCESSORIES.map((acc) => {
                    const isSelected = localSettings.accessory === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleAccessoryChange(acc.id)}
                        className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--theme-accent)] text-white border-[var(--theme-accent)] shadow-xs'
                            : 'bg-[var(--theme-bg)] text-[var(--theme-text)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50'
                        }`}
                      >
                        <span>{acc.icon}</span>
                        <span>{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--theme-border)]/60 bg-[var(--theme-surface)] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-[var(--theme-accent)] text-white font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
