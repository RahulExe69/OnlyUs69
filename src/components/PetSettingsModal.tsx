import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Volume2,
  VolumeX,
  Edit2,
  Sparkles,
  Heart,
} from 'lucide-react';
import { PetSettings, PetBreed, PetAccessory } from '../types';
import { drawCuteKitten } from './ChatPetCompanion';

interface PetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PetSettings;
  onSaveSettings: (settings: PetSettings) => void;
  partnerName?: string;
  isOwner?: boolean;
}

// -------------------------------------------------------------
// 🎵 PROCEDURAL RETRO/CHIBI SFX SYNTHESIZER
// -------------------------------------------------------------
function playPetSFX(type: 'meow' | 'purr' | 'equip', soundEnabled: boolean = true) {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'meow') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(860, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.28);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'purr') {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, now);
      mod.type = 'sine';
      mod.frequency.setValueAtTime(28, now);
      modGain.gain.setValueAtTime(48, now);
      mod.connect(modGain);
      modGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      mod.start(now);
      osc.start(now);
      mod.stop(now + 0.5);
      osc.stop(now + 0.5);
    } else if (type === 'equip') {
      const freqs = [1046.5, 1318.5, 1568.0];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        gain.gain.setValueAtTime(0.1, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.18);
      });
    }
  } catch (_) {}
}

// -------------------------------------------------------------
// 🐱 PREVIEW CANVASES
// -------------------------------------------------------------
const MiniMochiCanvas: React.FC<{
  breed: PetBreed;
  accessory: PetAccessory;
  scale?: number;
  width?: number;
  height?: number;
}> = ({ breed, accessory, scale = 1.15, width = 84, height = 66 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2 + 13);
    ctx.scale(scale, scale);

    drawCuteKitten(
      ctx,
      'idle',
      breed,
      accessory,
      0,
      0.5,
      0,
      false,
      0,
      0,
      0,
      { dx: 0, dy: 0 }
    );
    ctx.restore();
  }, [breed, accessory, scale, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="pointer-events-none mx-auto block"
    />
  );
};

const HeroMochiCanvas: React.FC<{
  breed: PetBreed;
  accessory: PetAccessory;
  onPet: () => void;
}> = ({ breed, accessory, onPet }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const tailRef = useRef(0);
  const blinkRef = useRef(70);
  const isBlinkingRef = useRef(false);
  const earTwitchRef = useRef(0);
  const breatheRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 180;
    const height = 145;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const render = () => {
      tailRef.current += 0.05;
      breatheRef.current += 0.035;
      blinkRef.current--;
      if (blinkRef.current <= 0) {
        isBlinkingRef.current = true;
        if (blinkRef.current <= -6) {
          isBlinkingRef.current = false;
          blinkRef.current = 75 + Math.floor(Math.random() * 85);
        }
      }

      if (Math.random() < 0.015 && earTwitchRef.current <= 0) {
        earTwitchRef.current = 18;
      }
      if (earTwitchRef.current > 0) earTwitchRef.current--;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2 + 24);
      ctx.scale(1.9, 1.9);

      drawCuteKitten(
        ctx,
        'idle',
        breed,
        accessory,
        0,
        tailRef.current,
        0,
        isBlinkingRef.current,
        earTwitchRef.current,
        0,
        0,
        { dx: 0, dy: 0 },
        breatheRef.current
      );
      ctx.restore();

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [breed, accessory]);

  return (
    <div onClick={onPet} className="cursor-pointer group flex flex-col items-center">
      <canvas
        ref={canvasRef}
        style={{ width: '180px', height: '145px' }}
        className="block transition-transform duration-200 group-hover:scale-105 active:scale-95"
      />
    </div>
  );
};

// -------------------------------------------------------------
// 🌸 SKINS & ITEMS CATALOG
// -------------------------------------------------------------
interface SkinItem {
  id: PetBreed;
  name: string;
}

const SKINS: SkinItem[] = [
  { id: 'mochi', name: 'Snowy White' },
  { id: 'calico', name: 'Sweet Calico' },
  { id: 'caramel', name: 'Honey Tabby' },
  { id: 'luna', name: 'Midnight Luna' },
  { id: 'siamese', name: 'Seal Siamese' },
  { id: 'tuxedo', name: 'Dapper Tuxedo' },
  { id: 'silver', name: 'Misty Silver' },
  { id: 'cinnamon', name: 'Cinnamon Spice' },
  { id: 'berry', name: 'Berry Blush' },
];

interface WardrobeItem {
  id: PetAccessory;
  name: string;
}

const ITEMS: WardrobeItem[] = [
  { id: 'none', name: 'Natural' },
  { id: 'bow', name: 'Pink Ribbon' },
  { id: 'bell', name: 'Golden Bell' },
  { id: 'sakura', name: 'Sakura Petal' },
  { id: 'scarf', name: 'Cozy Scarf 🧣' },
  { id: 'crown', name: 'Royal Crown' },
  { id: 'glasses', name: 'Round Glasses' },
  { id: 'sprout', name: 'Plant Sprout' },
  { id: 'beanie', name: 'Cozy Beanie' },
  { id: 'angel_halo', name: 'Angel Halo' },
  { id: 'heart_clip', name: 'Heart Pin' },
  { id: 'party_hat', name: 'Party Hat' },
];

const CUDDLE_PHRASES = [
  "Purrr~ ❤️",
  "Nusrat is so sweet! ✨",
  "Meow! 🐾",
  "Rahul & Nusrat 💖",
  "Warm cuddles~ 🐱",
  "I love you! 💕"
];

// -------------------------------------------------------------
// 🐾 FULL-SCREEN CHAT COMPANION PAGE
// -------------------------------------------------------------
export const PetSettingsModal: React.FC<PetSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  partnerName,
}) => {
  const [localSettings, setLocalSettings] = useState<PetSettings>(settings);
  const [activeTab, setActiveTab] = useState<'skins' | 'items'>('skins');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(settings.name || 'Mochi');
  const [speech, setSpeech] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const speechTimeoutRef = useRef<any>(null);

  useEffect(() => {
    setLocalSettings(settings);
    setNameInput(settings.name || 'Mochi');
  }, [settings, isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Toggle active chat status
  const handleToggleActive = () => {
    const updated = { ...localSettings, enabled: !localSettings.enabled };
    setLocalSettings(updated);
    onSaveSettings(updated);
    playPetSFX(updated.enabled ? 'meow' : 'purr', localSettings.soundEnabled);
  };

  // Toggle sound
  const handleToggleSound = () => {
    const nextSound = !localSettings.soundEnabled;
    const updated = { ...localSettings, soundEnabled: nextSound };
    setLocalSettings(updated);
    onSaveSettings(updated);
    if (nextSound) playPetSFX('meow', true);
  };

  // Select skin
  const handleSelectSkin = (breed: PetBreed) => {
    const updated = { ...localSettings, breed };
    setLocalSettings(updated);
    onSaveSettings(updated);
    playPetSFX('equip', localSettings.soundEnabled);
  };

  // Select item / accessory
  const handleSelectAccessory = (accessory: PetAccessory) => {
    const updated = { ...localSettings, accessory };
    setLocalSettings(updated);
    onSaveSettings(updated);
    playPetSFX('equip', localSettings.soundEnabled);
  };

  // Save companion name
  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const updated = { ...localSettings, name: trimmed };
    setLocalSettings(updated);
    onSaveSettings(updated);
    setIsEditingName(false);
    playPetSFX('equip', localSettings.soundEnabled);
  };

  // Petting interaction
  const handlePetKitten = () => {
    playPetSFX('purr', localSettings.soundEnabled);
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate([25, 30]); } catch (_) {}
    }

    // Spawn floating heart
    const newHeart = {
      id: Date.now() + Math.random(),
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 15,
    };
    setFloatingHearts((prev) => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1100);

    // Cute speech
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    const phrase = CUDDLE_PHRASES[Math.floor(Math.random() * CUDDLE_PHRASES.length)];
    setSpeech(phrase);
    speechTimeoutRef.current = setTimeout(() => setSpeech(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed inset-0 z-50 bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-hidden select-none"
      >
        {/* 🌟 TOP NAVIGATION BAR */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3.5 border-b border-[var(--theme-border)]/60 bg-[var(--theme-bg)]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-surface)] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.4]" />
            <span>Back</span>
          </button>

          <h1 className="text-base font-bold text-[var(--theme-text)] tracking-tight">
            Chat Companion
          </h1>

          <button
            type="button"
            onClick={handleToggleSound}
            title={localSettings.soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              localSettings.soundEnabled
                ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] border-[var(--theme-accent)]/30'
                : 'bg-[var(--theme-surface)] text-[var(--theme-text)]/40 border-[var(--theme-border)]'
            }`}
          >
            {localSettings.soundEnabled ? (
              <Volume2 className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <VolumeX className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>
        </header>

        {/* 🐾 MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 max-w-lg mx-auto w-full custom-scrollbar">
          
          {/* 🐱 1. HERO PREVIEW STAGE WITH TOP FLOATING TOGGLE */}
          <div className="relative flex flex-col items-center justify-center pt-2 pb-2 rounded-3xl bg-[var(--theme-surface)]/50 border border-[var(--theme-border)]/60 shadow-xs overflow-hidden">
            
            {/* Top Floating Toggle at Top Side of Mochi */}
            <div className="w-full flex items-center justify-between px-4 pt-1.5 pb-0.5 z-20">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{localSettings.enabled ? '🐾' : '💤'}</span>
                <span className="text-xs font-semibold text-[var(--theme-text)]/75">
                  {localSettings.enabled ? 'Active' : 'Resting'}
                </span>
              </div>

              {/* Floating Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={localSettings.enabled}
                onClick={handleToggleActive}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-xs ${
                  localSettings.enabled ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-text)]/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    localSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Floating Heart Particles */}
            <AnimatePresence>
              {floatingHearts.map((heart) => (
                <motion.span
                  key={heart.id}
                  initial={{ opacity: 1, y: 0, scale: 0.7 }}
                  animate={{ opacity: 0, y: -45, scale: 1.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.0, ease: 'easeOut' }}
                  className="absolute pointer-events-none text-xl z-30"
                  style={{ left: `${heart.x}%`, top: `${heart.y}%` }}
                >
                  💖
                </motion.span>
              ))}
            </AnimatePresence>

            {/* Speech Bubble on Pet */}
            <AnimatePresence>
              {speech && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.85 }}
                  className="absolute top-8 px-3.5 py-1.5 rounded-full bg-white/95 text-slate-900 shadow-md text-xs font-bold border border-rose-200 pointer-events-none z-30 flex items-center gap-1.5"
                >
                  <span>{speech}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Vector Mochi Canvas */}
            <HeroMochiCanvas
              breed={localSettings.breed}
              accessory={localSettings.accessory}
              onPet={handlePetKitten}
            />

            {/* Companion Name (Click to Edit) */}
            <div className="mt-1 flex items-center justify-center">
              {isEditingName ? (
                <div className="flex items-center gap-1.5 bg-[var(--theme-surface)] px-3 py-1.5 rounded-xl border-2 border-[var(--theme-accent)] shadow-xs">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    maxLength={16}
                    autoFocus
                    placeholder="Name"
                    className="bg-transparent text-sm font-bold text-[var(--theme-text)] focus:outline-none w-28 text-center"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="text-xs font-bold text-[var(--theme-accent)] hover:opacity-80 px-1 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(localSettings.name || 'Mochi');
                      setIsEditingName(false);
                    }}
                    className="text-xs text-[var(--theme-text)]/50 hover:text-[var(--theme-text)] px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[var(--theme-surface)] hover:bg-[var(--theme-surface)]/80 border border-[var(--theme-border)] text-sm font-bold text-[var(--theme-text)] transition-all cursor-pointer shadow-xs"
                >
                  <span>{localSettings.name || 'Mochi'}</span>
                  <Edit2 className="w-3 h-3 text-[var(--theme-text)]/50" />
                </button>
              )}
            </div>
          </div>

          {/* 🎨 2. OPTIONS TABS: SKINS & ITEMS */}
          <div className="space-y-3">
            {/* Clean Segmented Pill Switcher */}
            <div className="flex p-1 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)]">
              <button
                type="button"
                onClick={() => setActiveTab('skins')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'skins'
                    ? 'bg-[var(--theme-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
                }`}
              >
                Skins ({SKINS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-[var(--theme-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]'
                }`}
              >
                Items ({ITEMS.length})
              </button>
            </div>

            {/* TAB A: SKINS (3-Grid Layout) */}
            {activeTab === 'skins' && (
              <div className="grid grid-cols-3 gap-2.5">
                {SKINS.map((skin) => {
                  const isSelected = localSettings.breed === skin.id;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleSelectSkin(skin.id)}
                      className={`relative p-2 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between overflow-hidden group ${
                        isSelected
                          ? 'bg-[var(--theme-accent)]/12 border-[var(--theme-accent)] shadow-xs'
                          : 'bg-[var(--theme-surface)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-xs z-10">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}

                      {/* Actual Mochi Render */}
                      <div className="py-0.5">
                        <MiniMochiCanvas
                          breed={skin.id}
                          accessory={localSettings.accessory}
                          scale={1.15}
                          width={84}
                          height={66}
                        />
                      </div>

                      {/* Skin Name */}
                      <span className="text-[11px] sm:text-xs font-bold text-[var(--theme-text)] mt-1 truncate max-w-full px-0.5 leading-tight">
                        {skin.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* TAB B: ITEMS (3-Grid Layout) */}
            {activeTab === 'items' && (
              <div className="grid grid-cols-3 gap-2.5">
                {ITEMS.map((item) => {
                  const isSelected = localSettings.accessory === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectAccessory(item.id)}
                      className={`relative p-2 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between overflow-hidden group ${
                        isSelected
                          ? 'bg-[var(--theme-accent)]/12 border-[var(--theme-accent)] shadow-xs'
                          : 'bg-[var(--theme-surface)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center shadow-xs z-10">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}

                      {/* Actual Mochi wearing this item */}
                      <div className="py-0.5">
                        <MiniMochiCanvas
                          breed={localSettings.breed}
                          accessory={item.id}
                          scale={1.15}
                          width={84}
                          height={66}
                        />
                      </div>

                      {/* Item Name */}
                      <span className="text-[11px] sm:text-xs font-bold text-[var(--theme-text)] mt-1 truncate max-w-full px-0.5 leading-tight">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
