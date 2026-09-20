import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';
import { StealthNotepadView } from './components/StealthNotepadView';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AppConfig, UserRole, UserProfile, Message, MediaAttachment, PetSettings } from './types';
import { LogOut, Send, Settings as SettingsIcon, MessageSquare, ShieldCheck, Heart, User as UserIcon, Plus, X, Trash2, Smile, MoreVertical, Copy, RotateCcw, Reply, CornerUpLeft, Pencil, Camera, Image as ImageIcon, Check, CheckCheck, Clock3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, UserPlus, Gamepad2, Music, Headphones, Wifi, WifiOff, ListChecks, Wind, Laugh, Star, KeyRound, Lock, Sparkles, RefreshCw, LayoutGrid, Instagram, MessageSquareCode, ArrowLeft, UserCheck, Repeat, Film, Link2, Video, FileVideo, Ban, Play, Mic, BookOpen, EyeOff, Phone, Cat } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { MultiHubDashboard } from './components/MultiHubDashboard';
import { ExternalHubView } from './components/ExternalHubView';
import { WhatsAppMediaBubble } from './components/WhatsAppMediaBubble';
import { FullscreenMediaViewer } from './components/FullscreenMediaViewer';
import { MediaSendPreviewModal, SelectedMediaFile } from './components/MediaSendPreviewModal';
import { saveLocalMedia, getLocalMedia, initMediaSyncListener } from './lib/mediaStore';
import { uploadToCloudinary, syncCloudinaryFromAppConfig, deleteFromCloudinary, extractAllCloudinaryIds } from './lib/cloudinary';
import { processImageLossless, blobToDataUrl } from './lib/imageProcessor';
import { useOverlayBack, hasOpenOverlays, popOverlay } from './lib/overlayManager';
import { cacheMessages, loadCachedMessages, safeSetItem, safeGetItem, safeRemoveItem } from './lib/safeStorage';
import { THEMES, ThemeName, applyTheme, is3DTheme, isValidTheme } from './lib/themes';
import { QuantumAuraBackground } from './components/QuantumAuraBackground';
import { getMillis, parseDate, hydrateMessageMedia } from './lib/dateUtils';
import { initializeE2EE, isE2EEReady, encryptChatMessage, resetE2EECache, onE2EEStatusChange, exportSharedSecretBase64 } from './lib/e2ee';
import { FullImageViewer } from './components/FullImageViewer';
import { NudgeOverlay } from './components/NudgeOverlay';
import { BottomSheet, AttachmentOption, GameCard, CelebrateIcon } from './components/BottomSheet';
import { ChatInputBar, ChatInputBarHandle } from './components/ChatInputBar';
import { MessageItem } from './components/MessageItem';
import { InstagramReelInfo } from './lib/instagram';
import { InstagramReelModal } from './components/InstagramReelModal';
import { ShareReelModal } from './components/ShareReelModal';
import { LoginView, UnauthorizedView, QuotaBanner } from './components/AuthModals';
import { DeleteChoicesModal } from './components/DeleteChoicesModal';
import { GameOverlayManager } from './components/GameOverlayManager';
import { useMessageSync } from './hooks/useMessageSync';
import { useWebRTCCall } from './hooks/useWebRTCCall';
import { CallModal } from './components/CallModal';
import { initLocalNotifications, OnlyUsNativeNotification, syncFcmTokenToSupabase, triggerPushNotification } from './lib/notifications';
import { OnlyUsIntro } from './components/OnlyUsIntro';
import { ChatPetCompanion } from './components/ChatPetCompanion';
import { PetSettingsModal } from './components/PetSettingsModal';

// Dynamic lazy imports for heavy secondary modal dialogs
const ProfileModal = lazy(() => import('./components/ProfileModal').then(m => ({ default: m.ProfileModal })));
const PartnerInfoModal = lazy(() => import('./components/PartnerInfoModal').then(m => ({ default: m.PartnerInfoModal })));
const E2EEVerificationModal = lazy(() => import('./components/E2EEVerificationModal').then(m => ({ default: m.E2EEVerificationModal })));
const ThemeCustomizeSheet = lazy(() => import('./components/ThemeCustomizePage').then(m => ({ default: m.ThemeCustomizeSheet })));
const MediaGalleryModal = lazy(() => import('./components/MediaGalleryModal').then(m => ({ default: m.MediaGalleryModal })));

const OWNER_EMAIL = "bodruddoja4@gmail.com";

export const closeMobileKeyboard = () => {
  if (typeof window !== 'undefined') {
    (window as any).__isChatInputFocused = false;
    (window as any).__keepChatInputActive = false;
  }
  if (typeof document !== 'undefined') {
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as any).isContentEditable)) {
      activeEl.blur();
    }
    const chatInput = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
    chatInput?.blur();
  }
};

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('onlyus_cached_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const partnerProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => { partnerProfileRef.current = partnerProfile; }, [partnerProfile]);
  const [isOwner, setIsOwner] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  // Detect if running inside Nusrat's Notes APK (package: com.onlyus.notes or userAgent flavor)
  const [isNotesFlavor, setIsNotesFlavor] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return navigator.userAgent.includes('OnlyUsFlavor/Notes') || window.location.search.includes('edition=nusrat');
  });

  // Stealth Disguise Vault State (Notepad vs OnlyUs)
  const [isStealthUnlocked, setIsStealthUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    // 1. If unlocked during this active app session
    if (sessionStorage.getItem('onlyus_vault_unlocked') === 'true') {
      return true;
    }
    // 2. Only locked initially if running inside Nusrat's Notes APK flavor
    if (navigator.userAgent.includes('OnlyUsFlavor/Notes') || window.location.search.includes('edition=nusrat')) {
      return false;
    }
    const pref = localStorage.getItem('onlyus_stealth_mode');
    if (pref === 'true') return false;
    if (window.location.search.includes('stealth')) {
      return false;
    }
    return true;
  });

  // Website Opening Intro Screen
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // If running in locked stealth mode (Nusrat's Notes APK), do not show OnlyUs intro while locked
    if (navigator.userAgent.includes('OnlyUsFlavor/Notes') || window.location.search.includes('edition=nusrat')) {
      return false;
    }
    if (localStorage.getItem('onlyus_stealth_mode') === 'true' && sessionStorage.getItem('onlyus_vault_unlocked') !== 'true') {
      return false;
    }
    return true;
  });

  const handleFinishIntro = useCallback(() => {
    setShowIntro(false);
  }, []);

  // Verify package identity asynchronously: if com.onlyus.notes, lock immediately and mark as notes flavor
  useEffect(() => {
    CapApp.getInfo().then(info => {
      const isNotes = info.id.includes('notes');
      if (isNotes) {
        setIsNotesFlavor(true);
        localStorage.setItem('onlyus_stealth_mode', 'true');
        if (sessionStorage.getItem('onlyus_vault_unlocked') !== 'true') {
          setIsStealthUnlocked(false);
        }
      } else {
        // Explicitly Rahul's APK or standard flavor: clear stealth preference
        localStorage.removeItem('onlyus_stealth_mode');
        setIsStealthUnlocked(true);
      }
    }).catch(() => {});
  }, []);

  const lockVault = useCallback(() => {
    sessionStorage.removeItem('onlyus_vault_unlocked');
    setIsStealthUnlocked(false);
  }, []);

  const handleUnlockVault = useCallback(() => {
    sessionStorage.setItem('onlyus_vault_unlocked', 'true');
    setIsStealthUnlocked(true);
  }, []);

  // Panic shake listener when vault is unlocked: shake to exit & lock
  useEffect(() => {
    if (!isStealthUnlocked) return;
    let lastX = 0, lastY = 0, lastZ = 0, lastTime = 0;
    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity;
      if (!current) return;
      const currentTime = Date.now();
      if ((currentTime - lastTime) > 100) {
        const diffTime = currentTime - lastTime;
        lastTime = currentTime;
        const x = current.x || 0, y = current.y || 0, z = current.z || 0;
        const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;
        if (speed > 2200) {
          setIsStealthUnlocked(false);
          try { CapApp.exitApp(); } catch {}
        }
        lastX = x; lastY = y; lastZ = z;
      }
    };
    window.addEventListener('devicemotion', handleMotion, { passive: true });
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isStealthUnlocked]);

  // Screen lock, home button, & minimize auto-lock listener
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        const pref = localStorage.getItem('onlyus_stealth_mode');
        if (pref === 'true' || navigator.userAgent.includes('OnlyUsFlavor/Notes')) {
          sessionStorage.removeItem('onlyus_vault_unlocked');
          setIsStealthUnlocked(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let appStateSub: any = null;
    let appUrlSub: any = null;

    (async () => {
      try {
        appStateSub = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            const pref = localStorage.getItem('onlyus_stealth_mode');
            if (pref === 'true' || navigator.userAgent.includes('OnlyUsFlavor/Notes')) {
              sessionStorage.removeItem('onlyus_vault_unlocked');
              setIsStealthUnlocked(false);
            }
          }
        });
      } catch {}

      // Android Deep Link Handler for Google OAuth Callback in APK
      try {
        appUrlSub = await CapApp.addListener('appUrlOpen', async ({ url }) => {
          try {
            await Browser.close();
          } catch {}

          if (url.includes('access_token=') || url.includes('refresh_token=')) {
            const hashPart = url.includes('#') 
              ? url.substring(url.indexOf('#') + 1) 
              : (url.includes('?') ? url.substring(url.indexOf('?') + 1) : '');
            const params = new URLSearchParams(hashPart);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              const { data, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!sessionErr && data?.session?.user) {
                setUser(data.session.user);
              }
            }
          }
        });
      } catch {}
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      try {
        if (appStateSub && typeof appStateSub.remove === 'function') {
          appStateSub.remove();
        }
      } catch {}
      try {
        if (appUrlSub && typeof appUrlSub.remove === 'function') {
          appUrlSub.remove();
        }
      } catch {}
    };
  }, []);
  const { messages, setMessages, messagesLoading, refetchCatchUp } = useMessageSync({
    user,
    userProfile,
    partnerProfile,
    isOwner,
  });

  const {
    activeCall,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    facingMode,
    callDuration,
    callErrorMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  } = useWebRTCCall({
    currentRole: userProfile?.role || null,
    partnerRole: isOwner ? 'partner' : 'owner',
    partnerName: partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul'),
    partnerPhoto: partnerProfile?.photo_url,
    isStealthUnlocked,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [galleryMediaViewer, setGalleryMediaViewer] = useState<MediaAttachment | null>(null);
  const [galleryMediaList, setGalleryMediaList] = useState<MediaAttachment[] | undefined>(undefined);
  const [galleryMediaIndex, setGalleryMediaIndex] = useState<number>(0);

  const handleOpenGalleryMedia = useCallback((media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => {
    setGalleryMediaViewer(media);
    setGalleryMediaList(fullList || (media.mediaList) || [media]);
    setGalleryMediaIndex(initialIndex || 0);
  }, []);
  const [petSettings, setPetSettings] = useState<PetSettings>(() => {
    if (typeof window === 'undefined') {
      return { enabled: true, name: 'Mochi', breed: 'mochi', accessory: 'bow', soundEnabled: true };
    }
    try {
      const stored = localStorage.getItem('onlyus_pet_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.enabled === 'boolean') {
          return {
            enabled: parsed.enabled,
            name: parsed.name || 'Mochi',
            breed: parsed.breed || 'mochi',
            accessory: parsed.accessory || 'bow',
            soundEnabled: parsed.soundEnabled ?? true,
          };
        }
      }
    } catch (_) {}
    return { enabled: true, name: 'Mochi', breed: 'mochi', accessory: 'bow', soundEnabled: true };
  });

  const petConfigDebounceTimerRef = useRef<any>(null);
  const handleUpdatePetSettings = useCallback(async (updated: PetSettings) => {
    setPetSettings(updated);
    try {
      localStorage.setItem('onlyus_pet_settings', JSON.stringify(updated));
    } catch (_) {}

    // 1. Instant broadcast to partner for zero-latency live sync
    if (mainChannelRef.current) {
      try {
        mainChannelRef.current.send({
          type: 'broadcast',
          event: 'pet_settings_changed',
          payload: { settings: updated },
        });
      } catch (err) {
        console.warn("Notice: pet settings broadcast", err);
      }
    }

    // 2. Persist to Supabase app_config so both partners share Mochi's name, look & AI brain permanently
    if (petConfigDebounceTimerRef.current) {
      clearTimeout(petConfigDebounceTimerRef.current);
    }
    petConfigDebounceTimerRef.current = setTimeout(async () => {
      try {
        await supabase.from('app_config').update({ pet_config: updated }).eq('id', 'main');
      } catch (err) {
        console.warn("Notice: pet settings app_config update", err);
      }
    }, 1200);
  }, []);
  const [showE2EEModal, setShowE2EEModal] = useState(false);
  const [isE2EEActive, setIsE2EEActive] = useState(isE2EEReady());

  // Sync E2EE active state & sync derived shared secret to Android native layer for background notification decryption
  useEffect(() => {
    const unsub = onE2EEStatusChange(async (status) => {
      setIsE2EEActive(status.isReady);
      if (status.isReady && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        try {
          const secretBase64 = await exportSharedSecretBase64();
          if (secretBase64) {
            await OnlyUsNativeNotification.cacheSharedSecret({ sharedKeyBase64: secretBase64 });
          }
        } catch (e) {
          console.warn('Failed to sync E2EE shared secret to native layer:', e);
        }
      }
    });

    // Check if already ready immediately
    if (isE2EEReady() && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      exportSharedSecretBase64().then(secretBase64 => {
        if (secretBase64) {
          OnlyUsNativeNotification.cacheSharedSecret({ sharedKeyBase64: secretBase64 }).catch(() => {});
        }
      }).catch(() => {});
    }

    return () => unsub();
  }, []);
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Close 3-dot menu on click release outside (pointerup)
  useEffect(() => {
    if (!showMenu) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    // Trigger on click release (pointerup)
    document.addEventListener('pointerup', handleOutsideClick, true);
    return () => {
      document.removeEventListener('pointerup', handleOutsideClick, true);
    };
  }, [showMenu]);

  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const themeUpdateRequestRef = useRef(0);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showDeleteChoices, setShowDeleteChoices] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [showNudgeMenu, setShowNudgeMenu] = useState(false);
  const [activeGame, setActiveGame] = useState<{ id: string, type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' } | null>(null);
  const [isGameMinimized, setIsGameMinimized] = useState(false);
  const [isPartnerInGameRoom, setIsPartnerInGameRoom] = useState(false);
  const [minimizedCountdown, setMinimizedCountdown] = useState(60);
  const minimizedTimerRef = useRef<any>(null);

  const activeGameRef = useRef(activeGame);
  activeGameRef.current = activeGame;
  const isGameMinimizedRef = useRef(isGameMinimized);
  isGameMinimizedRef.current = isGameMinimized;
  const isPartnerInGameRoomRef = useRef(isPartnerInGameRoom);
  isPartnerInGameRoomRef.current = isPartnerInGameRoom;

  const handleMinimizeGame = useCallback(() => {
    if (!activeGameRef.current) return;
    setIsGameMinimized(true);
    setMinimizedCountdown(60);

    if (minimizedTimerRef.current) {
      clearInterval(minimizedTimerRef.current);
    }

    minimizedTimerRef.current = setInterval(() => {
      setMinimizedCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(minimizedTimerRef.current);
          minimizedTimerRef.current = null;
          handleTerminateGame(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResumeGame = useCallback(() => {
    if (minimizedTimerRef.current) {
      clearInterval(minimizedTimerRef.current);
      minimizedTimerRef.current = null;
    }
    setIsGameMinimized(false);
  }, []);

  const handleTerminateGame = useCallback(async (notifyPartner: boolean = true) => {
    if (minimizedTimerRef.current) {
      clearInterval(minimizedTimerRef.current);
      minimizedTimerRef.current = null;
    }
    const currentGame = activeGameRef.current;
    setActiveGame(null);
    setIsGameMinimized(false);
    setIsPartnerInGameRoom(false);

    if (currentGame?.id) {
      if (notifyPartner && mainChannelRef.current) {
        try {
          mainChannelRef.current.send({
            type: 'broadcast',
            event: 'game_closed',
            payload: { sessionId: currentGame.id },
          });
        } catch (_) {}
      }

      try {
        await supabase.from('games').update({ status: 'closed' }).eq('id', currentGame.id);
        await supabase.from('messages').update({
          gameInvite: {
            sessionId: currentGame.id,
            gameType: currentGame.type,
            status: 'closed',
          },
        }).filter('gameInvite->>sessionId', 'eq', currentGame.id);
      } catch (err) {
        console.warn('Terminate game note:', err);
      }
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (minimizedTimerRef.current) {
        clearInterval(minimizedTimerRef.current);
      }
    };
  }, []);

  // Native Mobile Keyboard Viewport Sync (Hardware-smooth keyboard resize without lag/jitter)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number;
    const updateViewportHeight = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${height}px`);
      });
    };

    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
    } else {
      window.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
      } else {
        window.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

  const [socketTypingUsers, setSocketTypingUsers] = useState<string[]>([]);
  const [socketOnlineUsers, setSocketOnlineUsers] = useState<string[]>([]);
  const [socketOnlineRoles, setSocketOnlineRoles] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isTabActive, setIsTabActive] = useState(true);
  const [activeNudge, setActiveNudge] = useState<{ type: string; sender: string; isFromPartner?: boolean } | null>(null);
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismissNudge = useCallback(() => {
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
    setActiveNudge(null);
  }, []);
  const getInitialTab = (): 'dashboard' | 'chat' | 'instagram' | 'whatsapp' => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'chat' || tabParam === 'dashboard' || tabParam === 'instagram' || tabParam === 'whatsapp') {
          return tabParam;
        }
      } catch (e) {}
    }
    return 'dashboard';
  };

  const [activeHubTab, setActiveHubTab] = useState<'dashboard' | 'chat' | 'instagram' | 'whatsapp'>(getInitialTab);
  const mainChannelRef = useRef<any>(null);

  // Mobile / Browser Hardware Back Button Overlay Closers
  useOverlayBack(activeHubTab !== 'dashboard', () => setActiveHubTab('dashboard'), 'hub-active-tab');
  useOverlayBack(showProfileModal, () => setShowProfileModal(false), 'profile-modal');
  useOverlayBack(showPartnerInfo, () => setShowPartnerInfo(false), 'partner-info-modal');
  useOverlayBack(showPetModal, () => setShowPetModal(false), 'pet-settings-modal');
  useOverlayBack(showMediaModal, () => setShowMediaModal(false), 'media-gallery-modal');
  useOverlayBack(!!galleryMediaViewer, () => {
    setGalleryMediaViewer(null);
    setGalleryMediaList(undefined);
  }, 'gallery-media-viewer');
  useOverlayBack(showE2EEModal, () => setShowE2EEModal(false), 'e2ee-modal');
  useOverlayBack(!!showFullImage, () => setShowFullImage(null), 'full-image-viewer');
  useOverlayBack(showCustomizeModal, () => setShowCustomizeModal(false), 'customize-theme');
  useOverlayBack(showClearChatConfirm, () => setShowClearChatConfirm(false), 'clear-chat-confirm');
  useOverlayBack(showDeleteChoices, () => setShowDeleteChoices(false), 'delete-choices');
  // If active game is open and not minimized, back button minimizes it!
  useOverlayBack(!!activeGame && !isGameMinimized, () => handleMinimizeGame(), 'active-game');
  useOverlayBack(!!activeNudge, handleDismissNudge, 'active-nudge');
  useOverlayBack(showGamesMenu, () => setShowGamesMenu(false), 'games-menu');
  useOverlayBack(selectedMessages.length > 0, () => setSelectedMessages([]), 'selected-messages');
  useOverlayBack(isSidebarOpen, () => setIsSidebarOpen(false), 'sidebar-drawer');

  // Periodic 10s tick to keep relative "Last seen" and online indicators accurate in realtime
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => setTimeTick(t => t + 1), 10000);
    return () => clearInterval(tickInterval);
  }, []);

  // Sync E2EE operational status
  useEffect(() => {
    const unsub = onE2EEStatusChange((status) => {
      setIsE2EEActive(status.isReady);
    });
    return unsub;
  }, []);

  // Automatically close keyboard when navigating away from chat screen or opening full-page modals
  useEffect(() => {
    if (
      activeHubTab !== 'chat' ||
      showProfileModal ||
      showCustomizeModal ||
      showGamesMenu ||
      showPartnerInfo ||
      showMediaModal ||
      showClearChatConfirm ||
      showDeleteChoices ||
      activeGame ||
      showFullImage
    ) {
      closeMobileKeyboard();
    }
  }, [
    activeHubTab,
    showProfileModal,
    showCustomizeModal,
    showGamesMenu,
    showPartnerInfo,
    showMediaModal,
    showClearChatConfirm,
    showDeleteChoices,
    activeGame,
    showFullImage,
  ]);

  const handleHubTabChange = (tab: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => {
    if (tab !== 'chat') {
      closeMobileKeyboard();
    }
    if (tab === 'dashboard' && typeof document !== 'undefined' && document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
    const hasAndroidBridge = typeof window !== 'undefined' && typeof window.AndroidBridge?.openTab === 'function';

    if (hasAndroidBridge) {
      try {
        window.AndroidBridge!.openTab!(tab);
      } catch (err) {
        console.warn('AndroidBridge call error:', err);
      }
    }

    // Always update React internal state for dashboard and chat
    if (tab === 'chat' || tab === 'dashboard') {
      setActiveHubTab(tab);
      return;
    }

    // External tabs in regular browser fallback
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

  // Two-way bridge hooks so Android APK can seamlessly interact with the web app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.setHubTab = (tab: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => {
        if (tab !== 'chat') {
          closeMobileKeyboard();
        }
        setActiveHubTab(tab);
      };
      window.getCurrentHubTab = () => {
        return activeHubTab;
      };
      window.handleAndroidBack = () => {
        if (showMenu) {
          setShowMenu(false);
          return true;
        }
        if (showAttachmentMenu) {
          setShowAttachmentMenu(false);
          return true;
        }
        if (showNudgeMenu) {
          setShowNudgeMenu(false);
          return true;
        }
        if (hasOpenOverlays()) {
          const popped = popOverlay();
          if (popped) return true;
        }
        if (activeHubTab !== 'dashboard') {
          setActiveHubTab('dashboard');
          return true; // handled, don't exit app
        }
        return false; // on dashboard with no overlays, allow Android to minimize/exit
      };

      window.registerPushToken = async (token: string) => {
        if (!token) return false;
        try {
          const role = isOwner ? 'owner' : (isPartner ? 'partner' : (user?.email === OWNER_EMAIL ? 'owner' : 'partner'));
          await supabase.from('device_tokens').upsert([
            {
              user_id: user?.id || role,
              email: user?.email || (role === 'owner' ? OWNER_EMAIL : 'nusrat@onlyus.app'),
              role: role,
              token: token,
              updated_at: new Date().toISOString()
            }
          ], { onConflict: 'token' });
          return true;
        } catch (err) {
          console.warn('Failed to register device token:', err);
          return false;
        }
      };

      window.sendNativeDirectReply = async (text: string) => {
        if (!text || !text.trim()) return false;
        try {
          const role = isOwner ? 'owner' : (userProfile?.role || 'owner');
          let newMsg: any = {
            sender_role: role,
            created_at: new Date().toISOString(),
            reactions: {},
            reply_to: null,
            attachment_url: null
          };

          if (isE2EEReady()) {
            const enc = await encryptChatMessage({ text: text.trim(), reply_to: null, attachment_url: null });
            newMsg.ciphertext = enc.ciphertext;
            newMsg.iv = enc.iv;
            newMsg.is_encrypted = true;
            newMsg.text = '';
          } else {
            newMsg.text = text.trim();
          }

          const { error } = await supabase.from('messages').insert([newMsg]);
          return !error;
        } catch (err) {
          console.warn('Failed to send native direct reply:', err);
          return false;
        }
      };
    }
  }, [activeHubTab, isOwner, isPartner, user]);

  const sendGameInvite = async (type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' = 'tictactoe') => {
    if (!userProfile) return;
    const sessionId = Math.random().toString(36).substring(7);
    const senderName = userProfile.role === 'owner' ? 'Rahul' : 'Nusrat';
    const gameTitle = type === 'connecthearts' 
      ? 'Connect Hearts 💖' 
      : type === 'dotsandboxes' 
      ? 'Dots & Hearts 💕' 
      : 'Tic Tac Toe 🎮';
    
    try {
      await supabase.from('messages').insert([{ 
        sender_role: userProfile.role,
        text: `🎮 ${senderName} invited you to play ${gameTitle}`,
        created_at: new Date().toISOString(), 
        reactions: {},
        gameInvite: {
          gameType: type,
          sessionId: sessionId,
          status: 'pending'
        }
       }]);
      setShowGamesMenu(false);
      setActiveGame({ id: sessionId, type });
    } catch (err) {
      console.error("Error sending game invite:", err);
    }
  };

  const sendMainChatMessageFromGame = async (text: string) => {
    if (!userProfile) return;
    try {
      let insertRow: any = {
        sender_role: userProfile.role,
        created_at: new Date().toISOString(),
        reactions: {},
        reply_to: null,
        attachment_url: null,
      };

      if (isE2EEReady()) {
        const enc = await encryptChatMessage({ text, reply_to: null, attachment_url: null });
        insertRow.ciphertext = enc.ciphertext;
        insertRow.iv = enc.iv;
        insertRow.is_encrypted = true;
        insertRow.text = '';
      } else {
        insertRow.text = text;
      }

      await supabase.from('messages').insert([insertRow]);
    } catch (err) {
      console.error("Error sending message from game:", err);
    }
  };

  const latestPartnerMessage = useMemo(() => {
    if (!userProfile) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_role !== userProfile.role) {
        return messages[i];
      }
    }
    return null;
  }, [messages, userProfile?.role]);

  // Lifecycle 1: Auth State Monitor (Supports Google OAuth for Rahul & 6-Digit Passcode Session for Nusrat)
  useEffect(() => {
    // Helper to keep URL bar clean (strip long OAuth hash fragments like #access_token=...)
    const cleanUrlHash = () => {
      if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=') || window.location.hash.includes('token_type='))) {
        window.history.replaceState(null, '', '/chat');
      }
    };

    // Check for cached partner passcode session in localStorage first
    const partnerSessionStr = localStorage.getItem('onlyus_partner_session');
    if (partnerSessionStr) {
      try {
        const partnerUser = JSON.parse(partnerSessionStr);
        if (partnerUser && (partnerUser.isPartnerPasscode || partnerUser.id === '625ede11-c534-4475-be39-63554fdbb7a7' || partnerUser.id === 'partner_nusrat_main')) {
          const standardPartner = {
            id: '625ede11-c534-4475-be39-63554fdbb7a7',
            email: 'bodruddoja2@gmail.com',
            isPartnerPasscode: true,
            user_metadata: { full_name: 'Nusrat' }
          };
          setUser(standardPartner);
          setUserProfile({
            id: standardPartner.id,
            uid: standardPartner.id,
            email: standardPartner.email,
            role: 'partner',
            display_name: 'Nusrat',
            photo_url: '',
            theme: ((typeof window !== 'undefined' ? (localStorage.getItem('onlyus_chat_theme') || localStorage.getItem('onlyus_partner_theme')) : null) as ThemeName) || '3d-cyber',
            last_seen: new Date().toISOString(),
            last_read_at: new Date().toISOString()
          });
          setIsPartner(true);
          setIsOwner(false);
          setLoading(false);
          if (window.location.pathname !== '/chat') {
            window.history.replaceState(null, '', '/chat');
          }
        }
      } catch (e) {
        localStorage.removeItem('onlyus_partner_session');
        localStorage.removeItem('onlyus_partner_passcode');
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        cleanUrlHash();
      } else {
        const cached = localStorage.getItem('onlyus_partner_session');
        if (!cached) {
          setUser(null);
          setLoading(false);
          setUserProfile(null);
          setPartnerProfile(null);
          setAppConfig(null);
          setIsOwner(false);
          setIsPartner(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        cleanUrlHash();
      } else {
        const cached = localStorage.getItem('onlyus_partner_session');
        if (!cached) {
          setUser(null);
          setLoading(false);
          setUserProfile(null);
          setPartnerProfile(null);
          setAppConfig(null);
          setIsOwner(false);
          setIsPartner(false);
        }
      }
    });

    // Run cleanUrlHash after brief timeout to ensure browser address bar is sanitized
    const timer = setTimeout(cleanUrlHash, 200);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Permissions: Request notifications on initial login for Direct edition (Rahul)
  useEffect(() => {
    if (!user) return;
    const isNotes = typeof navigator !== 'undefined' && navigator.userAgent.includes('OnlyUsFlavor/Notes');
    // Nusrat's stealth edition intentionally avoids notification popups to protect stealth
    if (isNotes) return;

    // Initialize WhatsApp-style local notifications and inline reply callback
    initLocalNotifications(async (replyText: string) => {
      // On native Android, DirectReplyReceiver handles direct insertion into Supabase.
      // Prevent duplicate insert if running inside Capacitor native container:
      if (Capacitor.isNativePlatform()) return;

      try {
        const role: UserRole = isOwner ? 'owner' : (userProfile?.role || 'owner');
        let newMsg: any = {
          sender_role: role,
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: null,
          attachment_url: null
        };

        if (isE2EEReady()) {
          const enc = await encryptChatMessage({ text: replyText.trim(), reply_to: null, attachment_url: null });
          newMsg.ciphertext = enc.ciphertext;
          newMsg.iv = enc.iv;
          newMsg.is_encrypted = true;
          newMsg.text = '';
        } else {
          newMsg.text = replyText.trim();
        }

        await supabase.from('messages').insert([newMsg]);
      } catch (err) {
        console.error('Failed to send reply from notification action:', err);
      }
    });

    // Register high-priority FCM token for background/closed app push delivery
    const role: UserRole = isOwner ? 'owner' : (userProfile?.role || 'owner');
    syncFcmTokenToSupabase(user.id, role);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [user, userProfile?.role, isOwner]);

  // Helper: Verify if partner's cached passcode is still valid against current app_config
  const verifyPasscodeSession = useCallback((config: AppConfig) => {
    const isPartnerSession = localStorage.getItem('onlyus_partner_session');
    const storedPasscode = localStorage.getItem('onlyus_partner_passcode');
    const serverPasscode = (config.partner_passcode || '123456').trim();

    if (isPartnerSession && storedPasscode) {
      if (storedPasscode.trim() !== serverPasscode) {
        console.warn("Passcode changed. Logging partner out immediately.");
        localStorage.removeItem('onlyus_partner_session');
        localStorage.removeItem('onlyus_partner_passcode');
        setUser(null);
        setUserProfile(null);
        setPartnerProfile(null);
        setIsPartner(false);
        setIsOwner(false);
        setSocketOnlineUsers([]);
        setError("The login passcode was updated. Please enter the new 6-digit PIN to reconnect.");
        return false;
      }
    }
    return true;
  }, []);

  // Lifecycle 1b: Core Config Sync (Gated by Auth)
  useEffect(() => {
    if (!user) return;
    
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.from('app_config').select('*').eq('id', 'main').single();
        if (data) {
          setAppConfig(data as AppConfig);
          verifyPasscodeSession(data as AppConfig);
          if (data.cloudinary_config) {
            syncCloudinaryFromAppConfig(data.cloudinary_config);
          }
          if (data.pet_config) {
            setPetSettings((prev) => {
              const merged = { ...prev, ...data.pet_config };
              try { localStorage.setItem('onlyus_pet_settings', JSON.stringify(merged)); } catch (_) {}
              return merged;
            });
          }
        } else if (user?.email === OWNER_EMAIL && (!error || error.code === 'PGRST116')) {
          await supabase.from('app_config').insert([{ id: 'main', owner_email: OWNER_EMAIL, partner_allowed_emails: [], partner_passcode: '123456' }]);
          setAppConfig({ owner_email: OWNER_EMAIL, partner_allowed_emails: [], partner_passcode: '123456' } as AppConfig);
        }
      } catch (err) {
        console.warn("Notice: fetchConfig network retry", err);
      }
    };
    fetchConfig();

    const configSub = supabase.channel('app_config_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config', filter: "id=eq.main" }, (payload: any) => {
        if (payload.new) {
          const newCfg = payload.new as AppConfig;
          setAppConfig(newCfg);
          verifyPasscodeSession(newCfg);
          if (newCfg.cloudinary_config) {
            syncCloudinaryFromAppConfig(newCfg.cloudinary_config);
          }
          if (newCfg.pet_config) {
            setPetSettings((prev) => {
              const merged = { ...prev, ...newCfg.pet_config };
              try { localStorage.setItem('onlyus_pet_settings', JSON.stringify(merged)); } catch (_) {}
              return merged;
            });
          }
        }
      }).subscribe();

    // Background fallback check (every 60 seconds) to ensure logout if config changes
    const pollInterval = setInterval(fetchConfig, 60000);

    return () => { 
      supabase.removeChannel(configSub); 
      clearInterval(pollInterval);
    };
  }, [user?.id, verifyPasscodeSession]);

  // Lifecycle 2: Role & Profile Sync
  useEffect(() => {
    if (!user) return;

    const email = user.email || "";
    let role: UserRole = 'partner';
    if (email === OWNER_EMAIL || email === appConfig?.owner_email || user.id === '770c6ecc-e7ed-46ce-b37e-14caae961bb7') {
      role = 'owner';
      setIsOwner(true);
      setIsPartner(false);
    } else {
      role = 'partner';
      setIsPartner(true);
      setIsOwner(false);
    }

    // Instant update on session start
    supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(undefined, () => {});

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          const defaultHandle = data.username || (data.email ? data.email.split('@')[0] : (data.role === 'owner' ? 'rahul' : 'nusrat'));
          const profile = { ...data, uid: user.id, username: defaultHandle } as UserProfile;

          const cachedTheme = (typeof window !== 'undefined' ? localStorage.getItem('onlyus_chat_theme') : null) as ThemeName | null;
          // Determine the active theme:
          // The user's explicit local device selection (cachedTheme) takes top priority.
          // If no local theme is set, fall back to the remote database profile theme, or '3d-dark'.
          const resolvedTheme: ThemeName = (cachedTheme && isValidTheme(cachedTheme))
            ? cachedTheme
            : ((profile.theme && isValidTheme(profile.theme as ThemeName)) ? (profile.theme as ThemeName) : '3d-dark');

          // Keep remote database and local storage in complete sync
          if (profile.theme !== resolvedTheme) {
            profile.theme = resolvedTheme;
            const targetId = user.id || profile.id || profile.uid;
            if (targetId) {
              supabase.from('users').update({ theme: resolvedTheme }).eq('id', targetId).then(undefined, () => {});
            }
          }

          setUserProfile(profile);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('onlyus_cached_profile', JSON.stringify(profile));
              localStorage.setItem('onlyus_chat_theme', resolvedTheme);
              if (profile.role === 'partner' || isPartner) {
                localStorage.setItem('onlyus_partner_theme', resolvedTheme);
              }
            } catch(e) {}
          }

          if (typeof document !== 'undefined' && document.documentElement.dataset.chatTheme !== resolvedTheme) {
            applyTheme(resolvedTheme);
          }
        } else if (!error || error.code === 'PGRST116') {
          const cachedTheme = (localStorage.getItem('onlyus_chat_theme') as ThemeName) || 'romantic';
          const defaultHandle = (email || "").split('@')[0] || (role === 'owner' ? 'rahul' : 'nusrat');
          const newProfile = {
            id: user.id,
            email: (email || "").trim().toLowerCase(),
            role,
            display_name: user?.user_metadata?.full_name || (role === 'owner' ? 'Rahul' : 'Nusrat'),
            username: defaultHandle,
            photo_url: user?.user_metadata?.avatar_url || "",
            last_seen: new Date().toISOString(),
            last_read_at: new Date().toISOString(),
            theme: cachedTheme
          };
          await supabase.from('users').upsert([newProfile]);
          setUserProfile({ ...newProfile, uid: user.id } as any);
          applyTheme(cachedTheme);
        }
      } catch (err) {
        console.warn("Notice: fetchProfile network retry", err);
      } finally {
        setLoading(false);
        // Initialize End-to-End Encryption Keys locally
        const passcode = role === 'partner' ? (localStorage.getItem('onlyus_partner_passcode') || undefined) : undefined;
        initializeE2EE(user.id, role, passcode).catch(e => console.warn('E2EE init warning:', e));
      }
    };
    fetchProfile();

    const fetchPartner = async () => {
      try {
        // Sort by last_seen descending to always pick partner's most recently active profile
        const targetRole = role === 'owner' ? 'partner' : 'owner';
        const { data } = await supabase.from('users')
          .select('*')
          .eq('role', targetRole)
          .order('last_seen', { ascending: false });

        if (data && data.length > 0) {
          // Prioritize row that has a non-empty photo_url if multiple user records exist
          const withPhoto = data.find((p: any) => p.photo_url && p.photo_url.trim() !== '') || data[0];
          const partnerHandle = withPhoto.username || (withPhoto.email ? withPhoto.email.split('@')[0] : (withPhoto.role === 'owner' ? 'rahul' : 'nusrat'));
          const resolvedPartner = { ...withPhoto, uid: withPhoto.id, username: partnerHandle } as UserProfile;
          setPartnerProfile(resolvedPartner);

          if (resolvedPartner.photo_url && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            OnlyUsNativeNotification.cachePartnerAvatar({ avatarUrl: resolvedPartner.photo_url }).catch(() => {});
          }

          // If partner has public key, derive E2EE shared secret
          if (resolvedPartner.public_key && user?.id) {
            const passcode = role === 'partner' ? (localStorage.getItem('onlyus_partner_passcode') || undefined) : undefined;
            initializeE2EE(user.id, role, passcode).catch(e => console.warn('E2EE partner key derivation warning:', e));
          }
        } else if (role === 'owner') {
          // Fallback for partner profile if not loaded
          setPartnerProfile({
            id: '625ede11-c534-4475-be39-63554fdbb7a7',
            uid: '625ede11-c534-4475-be39-63554fdbb7a7',
            email: 'bodruddoja2@gmail.com',
            username: 'bodruddoja2',
            role: 'partner',
            display_name: 'Nusrat',
            photo_url: '',
            theme: 'romantic',
            last_seen: new Date().toISOString(),
            last_read_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn("Notice: fetchPartner network retry", err);
      }
    };
    fetchPartner();

    // Periodic DB last_seen heartbeat every 15s ONLY while tab is active and visible
    const heartbeatInterval = setInterval(() => {
      if (user?.id && !document.hidden && document.visibilityState === 'visible') {
        supabase.from('users').update({ 
          last_seen: new Date().toISOString() 
        }).eq('id', user.id).then(undefined, () => {});
      }
    }, 15000);

    const profileSub = supabase.channel('user_profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
        if (payload.new && payload.new.id === user.id) setUserProfile({ ...payload.new, uid: user.id } as UserProfile);
        else fetchPartner();
      }).subscribe();

    // Presence heartbeat & Broadcast via Supabase (static channel name for stability)
    const presenceChannel = supabase.channel('presence:onlyus_chat', {
      config: {
        presence: {
          key: user.id,
        },
        broadcast: {
          self: false,
          ack: true,
        },
      },
    });
    mainChannelRef.current = presenceChannel;

    const updatePresenceState = () => {
      const state = presenceChannel.presenceState();
      const presences = Object.values(state).flat() as any[];
      
      // Active when is_active is not explicitly false
      const activePresences = presences.filter(p => p && p.is_active !== false);

      const onlineIds = activePresences
        .map(p => p.user_id)
        .filter(Boolean);

      const onlineRoles = activePresences
        .map(p => p.role)
        .filter(Boolean);

      setSocketOnlineUsers([...new Set(onlineIds)]);
      setSocketOnlineRoles([...new Set(onlineRoles)]);

      // Check partner's in-game status
      const myId = user?.id || '';
      const myRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
      const partnerRole = myRole === 'owner' ? 'partner' : 'owner';
      const partnerPres = presences.find(p => p && (p.role === partnerRole || (p.user_id && p.user_id !== myId)));
      const isPartnerInGame = !!(
        partnerPres &&
        partnerPres.in_game === true &&
        partnerPres.location === 'game' &&
        (!activeGameRef.current || partnerPres.game_id === activeGameRef.current.id)
      );
      setIsPartnerInGameRoom(prev => (prev !== isPartnerInGame ? isPartnerInGame : prev));

      // If this user is minimized in chat, and partner presence reports they are NOT in the game room (e.g. partner also in chat, left, or offline):
      // Then both players are outside the game arena, so automatically terminate the game session for both!
      if (activeGameRef.current && isGameMinimizedRef.current) {
        if (!partnerPres || partnerPres.in_game === false || partnerPres.location === 'chat') {
          handleTerminateGame(true);
        }
      }

      // Safety: If they are not active/online, they are definitely not typing
      setSocketTypingUsers(prev => prev.filter(id => onlineIds.includes(id)));
    };

    presenceChannel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .on('broadcast', { event: 'game_closed' }, ({ payload }) => {
        if (activeGameRef.current && (!payload?.sessionId || payload.sessionId === activeGameRef.current.id)) {
          handleTerminateGame(false);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, isTyping } = payload;
        setSocketTypingUsers(prev => {
          if (isTyping) {
            if (prev.includes(userId)) return prev;
            return [...prev, userId];
          }
          return prev.filter(id => id !== userId);
        });
      })
      .on('broadcast', { event: 'nudge' }, ({ payload }) => {
        if (!payload) return;
        const { senderId, senderRole, senderName, type } = payload;
        const myId = user?.id || '';
        const myRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
        const myName = myRole === 'owner' ? 'Rahul' : 'Nusrat';
        
        // Match if it's sent from the other partner (not self)
        const isFromPartner = (senderId && senderId !== myId) || 
                              (senderRole && senderRole !== myRole) || 
                              (senderName && senderName !== myName);

        if (isFromPartner) {
          const partnerDisplayName = userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || 
                                     partnerProfile?.display_name || 
                                     senderName || 
                                     (myRole === 'owner' ? 'Nusrat' : 'Rahul');

          if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
          setActiveNudge({ type: type || 'hug', sender: partnerDisplayName, isFromPartner: true });
          // Auto-clear feeling overlay after 3.8s
          nudgeTimerRef.current = setTimeout(() => {
            setActiveNudge(null);
            nudgeTimerRef.current = null;
          }, 3800);
          // Romantic heartbeat double vibration pulse (lub-dub... lub-dub)
          if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            try { window.navigator.vibrate([60, 80, 60, 160, 60, 80, 60]); } catch (_) {}
          }
        }
      })
      .on('broadcast', { event: 'pet_settings_changed' }, ({ payload }) => {
        if (payload?.settings) {
          setPetSettings((prev) => {
            const merged = { ...prev, ...payload.settings };
            try { localStorage.setItem('onlyus_pet_settings', JSON.stringify(merged)); } catch (_) {}
            return merged;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const currentVisible = !document.hidden && document.visibilityState === 'visible';
          const myRole = userProfile?.role || role;
          await presenceChannel.track({ 
            user_id: user.id, 
            online_at: new Date().toISOString(),
            is_active: currentVisible,
            role: myRole,
            in_game: !!activeGameRef.current && !isGameMinimizedRef.current,
            game_id: (activeGameRef.current && !isGameMinimizedRef.current) ? activeGameRef.current.id : null,
            location: (activeGameRef.current && !isGameMinimizedRef.current) ? 'game' : 'chat',
          });
          setIsSocketConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsSocketConnected(false);
        }
      });

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(profileSub);
      supabase.removeChannel(presenceChannel);
      mainChannelRef.current = null;
      setIsSocketConnected(false);
    };
  }, [user?.id]);

  // Sync tab activity and in-game presence without resubscribing
  useEffect(() => {
    if (mainChannelRef.current && isSocketConnected && user) {
      mainChannelRef.current.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
        is_active: isTabActive,
        role: userProfile?.role || (isOwner ? 'owner' : 'partner'),
        in_game: !!activeGame && !isGameMinimized,
        game_id: (activeGame && !isGameMinimized) ? activeGame.id : null,
        location: (activeGame && !isGameMinimized) ? 'game' : 'chat',
      });
    }
  }, [isTabActive, isSocketConnected, user?.id, userProfile?.role, isOwner, activeGame?.id, isGameMinimized]);

  // Auto-terminate active game if message invite status is closed
  useEffect(() => {
    if (activeGame?.id) {
      const isClosed = messages.some(
        (m) => m.gameInvite?.sessionId === activeGame.id && m.gameInvite?.status === 'closed'
      );
      if (isClosed) {
        handleTerminateGame(false);
      }
    }
  }, [messages, activeGame?.id, handleTerminateGame]);

  // Watch games table for remote termination
  useEffect(() => {
    if (!activeGame?.id) return;
    const gameChannel = supabase
      .channel(`game_status:${activeGame.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${activeGame.id}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.status === 'closed') {
            handleTerminateGame(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [activeGame?.id, handleTerminateGame]);

  const lastBroadcastTypingStateRef = useRef<boolean>(false);
  const lastBroadcastTypingTimeRef = useRef<number>(0);

  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!mainChannelRef.current || !user || !isTabActive) return;
    
    const now = Date.now();
    // If state didn't change and we broadcasted recently (<2s), throttle it
    if (lastBroadcastTypingStateRef.current === isTyping && (now - lastBroadcastTypingTimeRef.current) < 2000) {
      return;
    }

    lastBroadcastTypingStateRef.current = isTyping;
    lastBroadcastTypingTimeRef.current = now;

    mainChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, isTyping }
    });
  }, [user, isTabActive]);

  const sendNudge = async (type: string = 'hug') => {
    const currentRole: UserRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
    const senderName = currentRole === 'owner' ? 'Rahul' : 'Nusrat';
    const senderId = user?.id || (isOwner ? '770c6ecc-e7ed-46ce-b37e-14caae961bb7' : '625ede11-c534-4475-be39-63554fdbb7a7');
    const nudgeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Instant local visual celebration
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    setActiveNudge({ type, sender: 'You', isFromPartner: false });
    nudgeTimerRef.current = setTimeout(() => {
      setActiveNudge(null);
      nudgeTimerRef.current = null;
    }, 3800);

    // Haptic feedback
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate([60, 80, 60]); } catch (_) {}
    }

    // 2. Real-time broadcast to partner
    if (mainChannelRef.current) {
      try {
        await mainChannelRef.current.send({
          type: 'broadcast',
          event: 'nudge',
          payload: { 
            nudgeId,
            senderId, 
            senderRole: currentRole,
            senderName,
            type,
            sentAt: Date.now()
          }
        });
      } catch (err) {
        console.warn("Nudge broadcast notice:", err);
      }
    }
  };

  // Track Tab Visibility & Minimize events (WhatsApp-style hide on backgrounding)
  useEffect(() => {
    const handleHide = () => {
      setIsTabActive(false);
      if (userProfile?.uid) {
        supabase.from('users').update({ 
          last_seen: new Date().toISOString() 
        }).eq('id', userProfile.uid).then();
      }
      if (mainChannelRef.current && user) {
        mainChannelRef.current.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
          is_active: false,
          role: userProfile?.role || (isOwner ? 'owner' : 'partner')
        });
      }
    };

    const handleShow = () => {
      setIsTabActive(true);
      if (userProfile?.uid) {
        supabase.from('users').update({ 
          last_seen: new Date().toISOString() 
        }).eq('id', userProfile.uid).then();
      }
      if (mainChannelRef.current && user) {
        mainChannelRef.current.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
          is_active: true,
          role: userProfile?.role || (isOwner ? 'owner' : 'partner')
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        handleHide();
      } else {
        handleShow();
      }
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('beforeunload', handleHide);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('beforeunload', handleHide);
    };
  }, [userProfile?.uid, user?.id, isOwner]);

  // Unique Room ID for the couple
  const chatRoomId = appConfig ? `room_${appConfig.owner_email.replace(/[@.]/g, '_')}` : 'main-chat';

  const handleLogin = async () => {
    setError(null);
    try {
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();

      if (isNative) {
        const { data, error } = await supabase.auth.signInWithOAuth({ 
          provider: 'google', 
          options: { 
            redirectTo: 'com.onlyus.app://auth/callback',
            skipBrowserRedirect: true 
          } 
        });
        if (error) throw error;
        if (data?.url) {
          await Browser.open({ url: data.url, windowName: '_self' });
        }
      } else {
        await supabase.auth.signInWithOAuth({ 
          provider: 'google', 
          options: { redirectTo: `${window.location.origin}/chat` } 
        });
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Your current domain (${window.location.hostname}) is not authorized in Supabase. Please add this domain to Supabase Auth URL configuration.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Silent
      } else {
        setError(`Login error: ${err.message || err.toString()}`);
      }
    }
  };

  const handlePasscodeLogin = async (code: string): Promise<boolean> => {
    setError(null);
    try {
      const trimmed = code.trim();
      const { data, error: cfgErr } = await supabase.from('app_config').select('*').eq('id', 'main').single();
      if (cfgErr && cfgErr.code !== 'PGRST116') {
        console.warn("Config query notice:", cfgErr);
      }
      const validPasscode = (data?.partner_passcode || appConfig?.partner_passcode || '123456').trim();
      
      if (trimmed === validPasscode) {
        const partnerUser = {
          id: '625ede11-c534-4475-be39-63554fdbb7a7',
          email: 'bodruddoja2@gmail.com',
          isPartnerPasscode: true,
          user_metadata: { full_name: 'Nusrat' }
        };
        localStorage.setItem('onlyus_partner_session', JSON.stringify(partnerUser));
        localStorage.setItem('onlyus_partner_passcode', trimmed);
        setUser(partnerUser);
        initializeE2EE(partnerUser.id, 'partner', trimmed).catch(e => console.warn('E2EE init on partner login:', e));
        setUserProfile({
          id: partnerUser.id,
          uid: partnerUser.id,
          email: partnerUser.email,
          role: 'partner',
          display_name: 'Nusrat',
          photo_url: '',
          theme: ((typeof window !== 'undefined' ? (localStorage.getItem('onlyus_chat_theme') || localStorage.getItem('onlyus_partner_theme')) : null) as ThemeName) || '3d-cyber',
          last_seen: new Date().toISOString(),
          last_read_at: new Date().toISOString()
        });
        setIsPartner(true);
        setIsOwner(false);
        setLoading(false);
        if (window.location.pathname !== '/chat') {
          window.history.replaceState(null, '', '/chat');
        }
        return true;
      } else {
        setError("Invalid 6-digit passcode. Please enter the active 6-digit PIN.");
        return false;
      }
    } catch (err: any) {
      console.error("Passcode verification error:", err);
      setError(`Passcode verification failed: ${err.message || 'Please check your connection'}`);
      return false;
    }
  };

  // Apply theme when userProfile changes (skip redundant apply to prevent flicker)
  useEffect(() => {
    if (userProfile?.theme) {
      if (typeof document !== 'undefined' && document.documentElement.dataset.chatTheme !== userProfile.theme) {
        applyTheme(userProfile.theme as ThemeName);
      }
    }
  }, [userProfile?.theme]);

  const updateSettings = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    const targetId = userProfile.uid || userProfile.id || user?.id;
    const previousProfile = userProfile;
    const updatedProfile = { ...userProfile, ...updates };
    setUserProfile(updatedProfile);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('onlyus_cached_profile', JSON.stringify(updatedProfile));
        if (updates.theme && isValidTheme(updates.theme as ThemeName)) {
          localStorage.setItem('onlyus_chat_theme', updates.theme);
          if (userProfile.role === 'partner' || isPartner) {
            localStorage.setItem('onlyus_partner_theme', updates.theme);
          }
        }
      } catch (e) {}
    }

    if (!targetId) return;
    try {
      const { error: settingsError } = await supabase.from('users').update(updates).eq('id', targetId);
      if (settingsError) throw settingsError;
    } catch (err) {
      console.error("Error updating settings:", err);
      if (!updates.theme) {
        setUserProfile(previousProfile);
      }
    }
  };

  const clearChat = async () => {
    try {
      // For this app, clear chat will delete all messages for this conversation
      await supabase.from('messages').delete().neq('id', 'placeholder');
      setShowClearChatConfirm(false);
      setShowMenu(false);
      // Messages state will update via realtime subscription
    } catch (err) {
      console.error("Error clearing chat:", err);
    }
  };

  const selectTheme = async (theme: ThemeName) => {
    if (!userProfile || isThemeSaving) return;
    const requestId = ++themeUpdateRequestRef.current;
    
    // 1. Immediately apply to DOM and persist locally across all storage keys
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('onlyus_chat_theme', theme);
        if (userProfile.role === 'partner' || isPartner) {
          localStorage.setItem('onlyus_partner_theme', theme);
        }
        const cached = localStorage.getItem('onlyus_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.theme = theme;
          localStorage.setItem('onlyus_cached_profile', JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // 2. Persist to database profile
    setIsThemeSaving(true);
    await updateSettings({ theme });
    if (requestId === themeUpdateRequestRef.current) setIsThemeSaving(false);
  };

  const handleLogout = async () => {
    // 1. Instant cleanup of local state to prevent "permission-denied" UI updates
    setLoading(true);
    setAppConfig(null);
    setUserProfile(null);
    setPartnerProfile(null);
    resetE2EECache();
    
    // 2. Clear Local Cache and Passcode Session
    localStorage.removeItem('onlyus_partner_session');
    localStorage.removeItem('onlyus_partner_passcode');
    localStorage.removeItem('cached_msgs');
    localStorage.removeItem('hidden_msgs');
    localStorage.removeItem('cached_users');
    setUser(null);
    setIsPartner(false);
    setIsOwner(false);
    setSocketOnlineUsers([]);
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }

    try {
      // 3. Perform actual signout
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => setSelectedMessages([]);

  const toggleSelectMessage = (msg: Message) => {
    setSelectedMessages(prev => {
      const exists = prev.find(m => m.id === msg.id);
      if (exists) {
        return prev.filter(m => m.id !== msg.id);
      }
      return [...prev, msg];
    });
  };

  const copySelected = () => {
    const text = selectedMessages.map(m => m.text).join('\n');
    navigator.clipboard.writeText(text);
    clearSelection();
  };

  const startReplyFromSelection = () => {
    if (selectedMessages.length === 1) {
      setReplyingTo(selectedMessages[0]);
      setEditingMessage(null);
      clearSelection();
      const el = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
      el?.focus({ preventScroll: true });
    }
  };

  const startEditFromSelection = () => {
    if (selectedMessages.length === 1 && selectedMessages[0].sender_role === userProfile?.role) {
      setEditingMessage(selectedMessages[0]);
      setReplyingTo(null);
      clearSelection();
      const el = document.getElementById('chat-message-input') as HTMLTextAreaElement | null;
      el?.focus({ preventScroll: true });
    }
  };

  const selectAllMessages = () => {
    const visible = messages.filter(m => {
      if (userProfile?.role === 'owner') return !m.hidden_for_owner;
      return !m.hidden_for_partner;
    });
    setSelectedMessages([...visible]);
  };

  const deleteSelected = async (everyone: boolean) => {
    if (selectedMessages.length === 0) return;
    
    const messagesToProcess = [...selectedMessages];
    
    // 1. Close modal and clear selection immediately for UI smoothness
    setShowDeleteChoices(false);
    clearSelection();
    
    try {
      if (everyone) {
        // Delete for Everyone (Update Database with placeholder and purge media from Cloudinary)
        const messagesToUpdate = messagesToProcess
          .filter(m => m.sender_role === userProfile?.role && !m.deleted)
          .map(m => m.id)
          .filter(id => !id.startsWith('temp-'));

        // Collect all Cloudinary media public_ids across the deleted messages
        const publicIdsToPurge: string[] = [];
        messagesToProcess.forEach(m => {
          const ids = extractAllCloudinaryIds(m);
          ids.forEach(id => publicIdsToPurge.push(id));
        });

        if (publicIdsToPurge.length > 0) {
          deleteFromCloudinary(publicIdsToPurge).catch(cldErr => {
            console.warn('Notice: Background Cloudinary media deletion error:', cldErr);
          });
        }
        
        // Optimistic UI update
        setMessages(prev => {
          const updated = prev.map(m => 
            messagesToProcess.some(sm => sm.id === m.id)
              ? { 
                  ...m, 
                  deleted: true, 
                  deletedBy: userProfile?.role, 
                  text: "", 
                  attachment_url: null,
                  media: undefined,
                  mediaList: undefined,
                  gameInvite: null,
                  reactions: {} 
                }
              : m
          );
          cacheMessages(updated);
          return updated;
        });

        if (messagesToUpdate.length > 0) {
          const chunkSize = 50;
          const chunks: string[][] = [];
          for (let i = 0; i < messagesToUpdate.length; i += chunkSize) {
            chunks.push(messagesToUpdate.slice(i, i + chunkSize));
          }

          await Promise.all(
            chunks.map(async (chunk) => {
              const { error: updateError } = await supabase.from('messages').update({
                text: "",
                attachment_url: null,
                gameInvite: null,
                deleted: true,
                deletedBy: userProfile?.role,
                reactions: {}
              }).in('id', chunk);
              
              if (updateError) throw updateError;
            })
          );
        }
      } else {
        // Delete for Me (If partner already deleted from their side, permanently delete from Database and Cloudinary)
        const currentRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
        const visibilityField = currentRole === 'owner' ? 'hidden_for_owner' : 'hidden_for_partner';
        const partnerVisibilityField = currentRole === 'owner' ? 'hidden_for_partner' : 'hidden_for_owner';
        
        const idsToDeleteCompletely: string[] = [];
        const idsToHideOnly: string[] = [];

        messagesToProcess.forEach(m => {
          if (!m.id || m.id.startsWith('temp-')) return;
          // If partner has already deleted/hidden it, both sides have now deleted it -> purge row from DB!
          if (Boolean((m as any)[partnerVisibilityField])) {
            idsToDeleteCompletely.push(m.id);
          } else {
            idsToHideOnly.push(m.id);
          }
        });

        // If messages are permanently purged because both sides deleted, purge Cloudinary media
        if (idsToDeleteCompletely.length > 0) {
          const publicIdsToPurge: string[] = [];
          messagesToProcess
            .filter(m => idsToDeleteCompletely.includes(m.id))
            .forEach(m => {
              const ids = extractAllCloudinaryIds(m);
              ids.forEach(id => publicIdsToPurge.push(id));
            });

          if (publicIdsToPurge.length > 0) {
            deleteFromCloudinary(publicIdsToPurge).catch(cldErr => {
              console.warn('Notice: Background Cloudinary media deletion error:', cldErr);
            });
          }
        }

        // Optimistic UI update: hide locally immediately
        setMessages(prev => {
          const updated = prev
            .filter(m => !idsToDeleteCompletely.includes(m.id))
            .map(m => 
              messagesToProcess.some(sm => sm.id === m.id) 
                ? { ...m, [visibilityField]: true } 
                : m
            );
          cacheMessages(updated);
          return updated;
        });

        // 1. Permanently delete messages that both users deleted
        if (idsToDeleteCompletely.length > 0) {
          const chunkSize = 50;
          for (let i = 0; i < idsToDeleteCompletely.length; i += chunkSize) {
            const chunk = idsToDeleteCompletely.slice(i, i + chunkSize);
            await supabase.from('messages').delete().in('id', chunk);
          }
        }

        // 2. Hide messages where only current user deleted
        if (idsToHideOnly.length > 0) {
          const chunkSize = 50;
          const chunks: string[][] = [];
          for (let i = 0; i < idsToHideOnly.length; i += chunkSize) {
            chunks.push(idsToHideOnly.slice(i, i + chunkSize));
          }

          await Promise.all(
            chunks.map(async (chunk) => {
              const { error: updateError } = await supabase.from('messages')
                .update({ [visibilityField]: true })
                .in('id', chunk);
              
              if (updateError) throw updateError;
            })
          );
        }
      }
    } catch (err: any) {
      console.error("Deletion error:", err);
      setError(`Deletion failed: ${err.message || 'Unknown error'}`);
    }
  };

  const formatLastSeen = (timestamp: any, uid?: string) => {
    // 1. Instant Realtime Presence check (by ID or partner role)
    const currentRole = userProfile?.role || (isOwner ? 'owner' : 'partner');
    const partnerRole = currentRole === 'owner' ? 'partner' : 'owner';
    const targetId = uid || partnerProfile?.uid || partnerProfile?.id;
    
    // Check if realtime presence channel has them listed as active
    const isSocketOnline = Boolean(
      (targetId && socketOnlineUsers.includes(targetId)) ||
      socketOnlineRoles.includes(partnerRole)
    );

    if (isSocketOnline) {
      if (isPartnerInGameRoom) {
        return "In Game Room 🎮";
      }
      return "Online";
    }

    if (!timestamp) return "Offline";
    
    // Handle ISO string, timestamp numbers, or objects
    const lastMillis = getMillis(timestamp);
    if (lastMillis <= 0) return "Offline";

    const last = new Date(lastMillis);
    const now = new Date();
    const isToday = last.toDateString() === now.toDateString();
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - lastMillis) / 1000));

    // 2. Active Heartbeat Window:
    // If the database last_seen timestamp was updated within the last 30 seconds,
    // the user is actively connected and heartbeat is pulsing.
    if (diffSeconds <= 30) {
      return "Online";
    }

    // 3. Human-readable WhatsApp / Instagram-grade formatting
    if (isToday) {
      if (diffSeconds < 60) {
        return "Last seen just now";
      }
      if (diffSeconds < 120) {
        return "Last seen 1 minute ago";
      }
      if (diffSeconds < 3600) {
        const mins = Math.floor(diffSeconds / 60);
        return `Last seen ${mins} minutes ago`;
      }
      return `Last seen today at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (last.toDateString() === yesterday.toDateString()) {
      return `Last seen yesterday at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return `Last seen on ${last.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (!isStealthUnlocked) {
    return <StealthNotepadView onUnlock={handleUnlockVault} />;
  }

  if (showIntro || loading) {
    const activeIntroTheme = (userProfile?.theme as ThemeName) || (typeof window !== 'undefined' ? ((localStorage.getItem('onlyus_chat_theme') as ThemeName) || (document.documentElement.dataset.chatTheme as ThemeName)) : '3d-dark') || '3d-dark';
    return (
      <OnlyUsIntro
        ready={!loading}
        onFinish={handleFinishIntro}
        themeName={activeIntroTheme}
      />
    );
  }

  if (!user) {
    return <LoginView error={error} onLogin={handleLogin} onPasscodeLogin={handlePasscodeLogin} />;
  }

  if (error && !userProfile) {
    return <UnauthorizedView error={error} onLogout={handleLogout} />;
  }

  return (
    <div 
      className="chat-theme flex h-[100dvh] max-h-[100dvh] bg-[var(--theme-bg)] text-[var(--theme-text)] font-sans overflow-hidden relative transition-colors duration-300"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      {activeHubTab === 'dashboard' ? (
        <MultiHubDashboard
          userProfile={userProfile}
          partnerProfile={partnerProfile}
          isOwner={isOwner}
          isPartner={isPartner}
          isSocketConnected={isSocketConnected}
          socketOnlineUsers={socketOnlineUsers}
          formatLastSeen={formatLastSeen}
          totalMessages={messages.length}
          messages={messages}
          onSelectTab={(tab) => handleHubTabChange(tab)}
          onOpenSettings={() => setShowProfileModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenPartnerInfo={() => setShowPartnerInfo(true)}
          onOpenMedia={() => setShowMediaModal(true)}
          onLogout={handleLogout}
        />
      ) : activeHubTab === 'instagram' || activeHubTab === 'whatsapp' ? (
        <ExternalHubView
          type={activeHubTab}
          onBackToHub={() => handleHubTabChange('dashboard')}
        />
      ) : (
        <main className="flex-1 flex flex-col bg-[var(--theme-bg)] overflow-hidden z-30 transition-colors duration-300 w-full relative">
          {!activeGame && (
            <div className="h-[calc(4.75rem+env(safe-area-inset-top,0px))] lg:h-24 flex-shrink-0 relative w-full z-50 bg-[var(--theme-bg)] shadow-sm border-b border-[var(--theme-border)] transition-colors duration-300">
              <AnimatePresence>
              {selectedMessages.length > 0 ? (
                <motion.header 
                  key="selection-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="absolute top-[env(safe-area-inset-top,0px)] left-0 right-0 bottom-0 px-5 lg:px-8 flex items-center justify-between bg-[var(--theme-accent)] text-[var(--theme-bubble-owner-text)] z-30 transition-colors duration-300 transform-gpu will-change-[opacity]"
                >
                  <div className="flex items-center gap-6 lg:gap-8">
                    <button onPointerDown={(e) => e.preventDefault()} onClick={clearSelection} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors active:scale-95">
                      <X className="w-5 h-5 lg:w-6 lg:h-6" />
                    </button>
                    <span className="text-lg lg:text-xl font-bold tracking-tight">{selectedMessages.length}</span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-4">
                    {selectedMessages.length === 1 && (
                      <>
                        <button onPointerDown={(e) => e.preventDefault()} onClick={startReplyFromSelection} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Reply">
                          <Reply className="w-5 h-5" />
                        </button>
                        {selectedMessages[0].sender_role === userProfile?.role && !selectedMessages[0].deleted && (
                          <button onPointerDown={(e) => e.preventDefault()} onClick={startEditFromSelection} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Edit">
                            <Pencil className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                    {selectedMessages.length < messages.length && (
                      <button onPointerDown={(e) => e.preventDefault()} onClick={selectAllMessages} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Select All">
                        <ListChecks className="w-5 h-5" />
                      </button>
                    )}
                    <button onPointerDown={(e) => e.preventDefault()} onClick={() => setShowDeleteChoices(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    {selectedMessages.every(m => !m.deleted) && (
                      <button onPointerDown={(e) => e.preventDefault()} onClick={copySelected} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Copy">
                        <Copy className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.header>
              ) : (
                <motion.header 
                  key="normal-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="absolute top-[env(safe-area-inset-top,0px)] left-0 right-0 bottom-0 px-3 sm:px-4 lg:px-6 flex items-center justify-between bg-[var(--theme-header-bg)] text-[var(--theme-text)] backdrop-blur-md z-20 transition-colors duration-300 transform-gpu will-change-[opacity]"
                >
                  <div className="flex items-center flex-1 min-w-0 pr-2 h-full">
                    {/* Back to Multi-Hub button - Clean, no background container */}
                    <button
                      onClick={() => {
                        if (typeof document !== 'undefined' && document.activeElement && 'blur' in document.activeElement) {
                          (document.activeElement as HTMLElement).blur();
                        }
                        handleHubTabChange('dashboard');
                      }}
                      className="p-1.5 -ml-1 mr-1 text-[var(--theme-text)] hover:opacity-75 active:scale-90 transition-transform flex items-center justify-center shrink-0 cursor-pointer"
                      title="Back to OnlyUs Hub"
                    >
                      <ArrowLeft className="w-6 h-6 lg:hidden stroke-[2.2]" />
                      <LayoutGrid className="w-5 h-5 hidden lg:block" />
                    </button>

                    {/* Profile Header Item */}
                    <div 
                      className="flex items-center gap-2.5 cursor-pointer group flex-1 min-w-0" 
                      onClick={() => setShowPartnerInfo(true)}
                    >
                      {/* Avatar strictly circular, never distorted */}
                      <div 
                        className="relative shrink-0 w-10 h-10 lg:w-11 lg:h-11 aspect-square select-none" 
                        onClick={(e) => { e.stopPropagation(); if(partnerProfile?.photo_url) setShowFullImage(partnerProfile.photo_url); }}
                      >
                        <div className="w-10 h-10 lg:w-11 lg:h-11 shrink-0 aspect-square rounded-full overflow-hidden border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 shadow-sm bg-[var(--theme-surface)]">
                          {partnerProfile?.photo_url ? (
                            <img 
                              src={partnerProfile.photo_url} 
                              alt="Partner" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-full aspect-square block"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-[var(--theme-accent)]/15 flex items-center justify-center text-[var(--theme-accent)] font-bold text-lg">
                              {partnerProfile?.display_name?.[0] || (isOwner ? 'N' : 'R')}
                            </div>
                          )}
                        </div>
                        {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'In Game Room 🎮' ? (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 border-2 border-[var(--theme-surface)] rounded-full animate-pulse z-10"></div>
                        ) : formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online' ? (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#4ade80] border-2 border-[var(--theme-surface)] rounded-full z-10"></div>
                        ) : null}
                      </div>
                      
                      {/* Name & Status */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h2 className="text-[15px] lg:text-[16px] font-bold text-[var(--theme-text)] truncate leading-tight">
                            {userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul')}
                          </h2>
                        </div>
                        <p className={`text-[10px] lg:text-[11px] font-bold leading-none mt-0.5 ${
                          formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'In Game Room 🎮'
                            ? 'text-purple-500'
                            : formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online'
                            ? 'text-green-500'
                            : 'text-[#6E6E6E]/60'
                        }`}>
                          {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 lg:gap-1.5 shrink-0">
                    {/* Voice Call Button */}
                    <button
                      onClick={() => startCall('voice')}
                      className="p-2 lg:p-2.5 rounded-full text-[var(--theme-text)]/70 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all"
                      title="Start Voice Call"
                    >
                      <Phone className="w-5 h-5" />
                    </button>

                    {/* Video Call Button */}
                    <button
                      onClick={() => startCall('video')}
                      className="p-2 lg:p-2.5 rounded-full text-[var(--theme-text)]/70 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 active:scale-95 transition-all"
                      title="Start Video Call"
                    >
                      <Video className="w-5 h-5" />
                    </button>

                    <div className="relative">
                      <button 
                        ref={menuBtnRef}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => setShowMenu(!showMenu)}
                        className={`p-2 rounded-full transition-all ${showMenu ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]' : 'text-[var(--theme-text)]/60 hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10'}`}
                      >
                        <MoreVertical className="w-5 h-5 lg:w-6 lg:h-6" />
                      </button>
                      
                      <AnimatePresence>
                        {showMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onPointerDown={(e) => e.preventDefault()} onClick={() => setShowMenu(false)} />
                            <motion.div 
                              ref={menuRef}
                              onPointerDown={(e) => e.preventDefault()}
                              initial={{ opacity: 0, scale: 0.92, y: -6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: -6 }}
                              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                              style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
                              className="absolute right-0 mt-2 w-52 bg-[var(--theme-surface)] text-[var(--theme-text)] rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] border border-[var(--theme-border)] z-50 overflow-hidden py-1"
                            >
                              <button 
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => { setShowProfileModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 flex items-center gap-3 transition-colors"
                              >
                                <UserIcon className="w-4 h-4 text-[var(--theme-accent)]" />
                                My Profile
                              </button>
                              <button 
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => { setShowMediaModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 flex items-center gap-3 transition-colors"
                              >
                                <ImageIcon className="w-4 h-4 text-[var(--theme-accent)]" />
                                Media & Memories
                              </button>
                              {isNotesFlavor && (
                                <button 
                                  onPointerDown={(e) => e.preventDefault()}
                                  onClick={() => { lockVault(); setShowMenu(false); }}
                                  className="w-full px-4 py-3 text-left text-sm font-medium text-amber-600 hover:bg-amber-500/10 flex items-center gap-3 transition-colors"
                                >
                                  <BookOpen className="w-4 h-4 text-amber-600" />
                                  Lock to Notes
                                </button>
                              )}
                              <button 
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => { setShowCustomizeModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 flex items-center gap-3 transition-colors"
                              >
                                <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
                                Customize
                              </button>
                              <button 
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => { setShowGamesMenu(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 flex items-center gap-3 transition-colors"
                              >
                                <Gamepad2 className="w-4 h-4 text-[var(--theme-accent)]" />
                                Play Together
                              </button>
                              <button 
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => { setShowPetModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/10 flex items-center gap-3 transition-colors"
                              >
                                <Cat className="w-4 h-4 text-[var(--theme-accent)]" />
                                <span>Pet</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.header>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            <div className="theme-chat-decoration absolute inset-0 z-0 pointer-events-none" />
            {(is3DTheme(userProfile?.theme) || (typeof document !== 'undefined' && is3DTheme(document.documentElement.dataset.chatTheme))) && (
              <QuantumAuraBackground 
                theme={userProfile?.theme || (typeof document !== 'undefined' ? document.documentElement.dataset.chatTheme : undefined)} 
                paused={Boolean(!!showFullImage || (!!activeGame && !isGameMinimized))}
              />
            )}
            <div className="relative z-10 h-full flex flex-col">
              <ChatView 
                role={userProfile?.role || 'partner'} 
                messages={messages}
                setMessages={setMessages}
                messagesLoading={messagesLoading}
                selectedMessages={selectedMessages}
                onToggleSelect={toggleSelectMessage}
                onClearSelection={clearSelection}
                replyingTo={replyingTo}
                onSetReplyingTo={setReplyingTo}
                editingMessage={editingMessage}
                onSetEditingMessage={setEditingMessage}
                selectedMessagesCount={selectedMessages.length}
                userProfile={userProfile}
                partnerProfile={partnerProfile}
                onViewImage={(url) => setShowFullImage(url)}
                isOverlayOpen={showProfileModal || showPartnerInfo || showPetModal || !!showFullImage || showDeleteChoices || showAttachmentMenu || showGamesMenu || (!!activeGame && !isGameMinimized)}
                showAttachmentMenu={showAttachmentMenu}
                onSetShowAttachmentMenu={setShowAttachmentMenu}
                showGamesMenu={showGamesMenu}
                onSetShowGamesMenu={setShowGamesMenu}
                petSettings={petSettings}
                onUpdatePetSettings={handleUpdatePetSettings}
                activeGame={activeGame}
                onSetActiveGame={(game) => {
                  if (minimizedTimerRef.current) {
                    clearInterval(minimizedTimerRef.current);
                    minimizedTimerRef.current = null;
                  }
                  setIsGameMinimized(false);
                  setActiveGame(game);
                }}
                onSendGameInvite={sendGameInvite}
                socketTypingUsers={socketTypingUsers}
                isPartnerOnline={formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online'}
                chatRoomId={chatRoomId}
                quotaExceeded={quotaExceeded}
                setQuotaExceeded={setQuotaExceeded}
                isTabActive={isTabActive}
                onBroadcastTyping={broadcastTyping}
                onSendNudge={sendNudge}
                showNudgeMenu={showNudgeMenu}
                onSetShowNudgeMenu={setShowNudgeMenu}
                activeNudge={activeNudge}
                onDismissNudge={() => setActiveNudge(null)}
              />
            </div>
          </div>
        </main>
      )}

      <Suspense fallback={null}>
        <AnimatePresence>
          {showProfileModal && userProfile && (
            <ProfileModal 
              profile={userProfile} 
              onClose={() => setShowProfileModal(false)}
              config={appConfig}
              isOwner={isOwner}
              onLogout={handleLogout}
              onProfileUpdated={(newMe) => setUserProfile(newMe)}
              onLockVault={isNotesFlavor ? lockVault : undefined}
              isNotesFlavor={isNotesFlavor}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPartnerInfo && partnerProfile && (
            <PartnerInfoModal 
              partner={partnerProfile}
              myProfile={userProfile}
              onClose={() => setShowPartnerInfo(false)}
              onViewImage={(url) => setShowFullImage(url)}
              onPartnerUpdated={(newPartner) => setPartnerProfile(newPartner)}
              onMyProfileUpdated={(newMe) => setUserProfile(newMe)}
              messages={messages}
              isPartnerOnline={formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online'}
              currentTheme={(userProfile?.theme as ThemeName) || (typeof window !== 'undefined' ? (localStorage.getItem('onlyus_chat_theme') as ThemeName) : null) || '3d-dark'}
              onThemeSelect={selectTheme}
              isThemeSaving={isThemeSaving}
              petSettings={petSettings}
              onOpenPetSettings={() => setShowPetModal(true)}
              onOpenMediaGallery={() => {
                setShowPartnerInfo(false);
                setShowMediaModal(true);
              }}
            />
          )}
        </AnimatePresence>

        <PetSettingsModal
          isOpen={showPetModal}
          onClose={() => setShowPetModal(false)}
          settings={petSettings}
          onSaveSettings={handleUpdatePetSettings}
          partnerName={partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul')}
          isOwner={isOwner}
        />

        <AnimatePresence>
          {showE2EEModal && (
            <E2EEVerificationModal
              myProfile={userProfile}
              partnerProfile={partnerProfile}
              onClose={() => setShowE2EEModal(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFullImage && (
            <FullImageViewer url={showFullImage} onClose={() => setShowFullImage(null)} />
          )}
        </AnimatePresence>

        <ThemeCustomizeSheet
          isOpen={showCustomizeModal}
          onClose={() => setShowCustomizeModal(false)}
          currentTheme={(userProfile?.theme as ThemeName) || (typeof window !== 'undefined' ? (localStorage.getItem('onlyus_chat_theme') as ThemeName) : null) || '3d-dark'}
          onThemeSelect={selectTheme}
          isThemeSaving={isThemeSaving}
          partnerProfile={partnerProfile}
          userProfile={userProfile}
        />

        <AnimatePresence>
          {showMediaModal && (
            <MediaGalleryModal
              isOpen={showMediaModal}
              onClose={() => setShowMediaModal(false)}
              messages={messages}
              myProfile={userProfile}
              partnerProfile={partnerProfile}
              onViewMedia={handleOpenGalleryMedia}
              onUpdateMessages={(updatedMsgs: Message[]) => {
                setMessages(prev => {
                  const map = new Map(updatedMsgs.map(u => [u.id, u]));
                  const next = prev.map(m => {
                    const found = map.get(m.id);
                    return found ? { ...m, ...found } : m;
                  });
                  cacheMessages(next);
                  return next;
                });
              }}
            />
          )}
        </AnimatePresence>

        <FullscreenMediaViewer 
          media={galleryMediaViewer}
          mediaList={galleryMediaList}
          initialIndex={galleryMediaIndex}
          onClose={() => {
            setGalleryMediaViewer(null);
            setGalleryMediaList(undefined);
          }}
        />
      </Suspense>
      <DeleteChoicesModal
        isOpen={showDeleteChoices}
        onClose={() => setShowDeleteChoices(false)}
        selectedMessages={selectedMessages}
        userProfile={userProfile}
        onDeleteSelected={deleteSelected}
      />

      <GameOverlayManager
        activeGame={activeGame}
        isGameMinimized={isGameMinimized}
        isPartnerInGameRoom={isPartnerInGameRoom}
        minimizedCountdown={minimizedCountdown}
        showGamesMenu={showGamesMenu}
        onCloseGamesMenu={() => setShowGamesMenu(false)}
        onLaunchGame={(type) => {
          if (minimizedTimerRef.current) {
            clearInterval(minimizedTimerRef.current);
            minimizedTimerRef.current = null;
          }
          setIsGameMinimized(false);
          sendGameInvite(type);
        }}
        onResumeGame={handleResumeGame}
        onMinimizeGame={handleMinimizeGame}
        onTerminateGame={handleTerminateGame}
        role={userProfile?.role || 'partner'}
        userProfile={userProfile}
        partnerProfile={partnerProfile}
        isPartnerOnline={formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online'}
        latestPartnerMessage={latestPartnerMessage}
        onSendNudge={sendNudge}
        onSendMainChatMessage={sendMainChatMessageFromGame}
      />

      {/* Real-time Voice & Video Call Modal */}
      <CallModal
        activeCall={activeCall}
        partnerProfile={partnerProfile}
        localStream={localStream}
        remoteStream={remoteStream}
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        facingMode={facingMode}
        callDuration={callDuration}
        callErrorMessage={callErrorMessage}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onFlipCamera={flipCamera}
      />

      {/* Real-time Feeling / Nudge Overlay with Edge-Lighting Shader & Romantic Capsule */}
      <AnimatePresence>
        {activeNudge && (
          <NudgeOverlay
            nudge={activeNudge}
            onDismiss={handleDismissNudge}
            onSendBack={(type) => sendNudge(type)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const ChatView = React.memo(function ChatView({ 
  role, 
  messages,
  setMessages,
  messagesLoading,
  selectedMessages, 
  onToggleSelect, 
  onClearSelection, 
  replyingTo, 
  onSetReplyingTo, 
  editingMessage, 
  onSetEditingMessage, 
  selectedMessagesCount, 
  userProfile, 
  partnerProfile, 
  onViewImage, 
  isOverlayOpen,
  showAttachmentMenu,
  onSetShowAttachmentMenu,
  showGamesMenu,
  onSetShowGamesMenu,
  activeGame,
  onSetActiveGame,
  onSendGameInvite,
  socketTypingUsers,
  isPartnerOnline,
  chatRoomId,
  quotaExceeded,
  setQuotaExceeded,
  isTabActive,
  onBroadcastTyping,
  onSendNudge,
  showNudgeMenu,
  onSetShowNudgeMenu,
  activeNudge,
  onDismissNudge,
  petSettings,
  onUpdatePetSettings
}: { 
  role: UserRole, 
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  messagesLoading: boolean,
  selectedMessages: Message[], 
  onToggleSelect: (msg: Message) => void, 
  onClearSelection: () => void,
  replyingTo: Message | null, 
  onSetReplyingTo: (msg: Message | null) => void,
  editingMessage: Message | null,
  onSetEditingMessage: (msg: Message | null) => void,
  selectedMessagesCount: number,
  userProfile: UserProfile | null,
  partnerProfile: UserProfile | null,
  onViewImage: (url: string) => void,
  isOverlayOpen?: boolean,
  showAttachmentMenu: boolean,
  onSetShowAttachmentMenu: (val: boolean) => void,
  showGamesMenu: boolean,
  onSetShowGamesMenu: (val: boolean) => void,
  activeGame: { id: string, type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' } | null,
  onSetActiveGame: (game: { id: string, type: 'tictactoe' | 'connecthearts' | 'dotsandboxes' } | null) => void,
  onSendGameInvite: (type?: 'tictactoe' | 'connecthearts' | 'dotsandboxes') => Promise<void>,
  socketTypingUsers: string[],
  isPartnerOnline: boolean,
  chatRoomId: string,
  quotaExceeded: boolean,
  setQuotaExceeded: (val: boolean) => void,
  isTabActive: boolean,
  onBroadcastTyping: (isTyping: boolean) => void,
  onSendNudge: (type: string) => void,
  showNudgeMenu: boolean,
  onSetShowNudgeMenu: (val: boolean) => void,
  activeNudge?: { type: string, sender: string } | null,
  onDismissNudge?: () => void,
  petSettings?: PetSettings,
  onUpdatePetSettings?: (settings: PetSettings) => void
}) {
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<SelectedMediaFile[]>([]);
  const [activeMediaViewer, setActiveMediaViewer] = useState<MediaAttachment | null>(null);
  const [activeMediaList, setActiveMediaList] = useState<MediaAttachment[] | undefined>(undefined);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<ChatInputBarHandle>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [triggerVoiceRecord, setTriggerVoiceRecord] = useState(false);
  const [activeReel, setActiveReel] = useState<InstagramReelInfo | null>(null);
  const [showShareReelModal, setShowShareReelModal] = useState(false);

  // Mobile / Browser Hardware Back Button Overlay Closers inside ChatArea
  useOverlayBack(!!activeMediaViewer, () => {
    setActiveMediaViewer(null);
    setActiveMediaList(undefined);
  }, 'chat-media-viewer');
  useOverlayBack(showMediaPreviewModal, () => {
    setShowMediaPreviewModal(false);
    setSelectedMediaFiles([]);
  }, 'chat-media-preview-modal');
  useOverlayBack(showEmojiPicker, () => setShowEmojiPicker(false), 'chat-emoji-picker');

  const popularEmojis = ['❤️', '😂', '🥺', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨', '🤍', '😍', '😘', '🫂', '🌹', '🌸', '🤤', '🤭', '🔥', '💯', '👍', '💫', '🌙', '💌'];

  const adjustTextareaHeight = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 144; // ~6-7 rows
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(44, newHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  const handleSelectMedia = (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const validFiles: SelectedMediaFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (isVideo || isImage) {
        validFiles.push({
          file,
          previewUrl: URL.createObjectURL(file),
          type: isVideo ? 'video' : 'image'
        });
      }
    }

    if (validFiles.length === 0) {
      alert('Please select valid image or video files.');
      return;
    }

    setSelectedMediaFiles(validFiles);
    setShowMediaPreviewModal(true);
    onSetShowAttachmentMenu(false);
    
    // Clear input so selecting the same file again triggers change
    e.target.value = '';
  };

  const handleSelectAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onSetShowAttachmentMenu(false);

    // Read audio duration using an Audio object
    const objectUrl = URL.createObjectURL(file);
    const audioTest = new Audio();
    audioTest.preload = 'metadata';
    audioTest.src = objectUrl;

    const onLoaded = () => {
      const duration = isFinite(audioTest.duration) && audioTest.duration > 0 ? audioTest.duration : 0;
      handleSendVoiceNote(file, duration, file.name);
      URL.revokeObjectURL(objectUrl);
    };

    audioTest.onloadedmetadata = onLoaded;
    audioTest.onerror = () => {
      handleSendVoiceNote(file, 0, file.name);
      URL.revokeObjectURL(objectUrl);
    };
  };

  const handleSendMediaMessage = async (caption: string, filesToSend: SelectedMediaFile[]) => {
    if (!filesToSend || filesToSend.length === 0) return;

    // 1. Immediately close modal & clean up inputs for instant WhatsApp-like feel
    setShowMediaPreviewModal(false);
    setSelectedMediaFiles([]);
    setIsSendingMedia(false);
    const replyContext = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      sender_role: replyingTo.sender_role
    } : null;
    onSetReplyingTo(null);

    // 2. Generate immediate local attachments using native crystal-clear preview URLs
    const tempId = `temp-media-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const initialAttachments: MediaAttachment[] = filesToSend.map((item, idx) => {
      const mediaId = `media_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 7)}`;
      return {
        id: mediaId,
        type: item.type,
        url: item.previewUrl || URL.createObjectURL(item.file),
        fileName: item.file.name,
        fileSize: item.file.size,
        mimeType: item.file.type,
      };
    });

    const initialPrimary: MediaAttachment = {
      ...initialAttachments[0],
      caption: caption || undefined,
      mediaList: initialAttachments.length > 1 ? initialAttachments : undefined
    };

    // 3. Immediately inject optimistic message into the chat state (0ms delay)
    const optimisticMessage: any = {
      id: tempId,
      sender_role: role,
      text: caption || '',
      media: initialPrimary,
      mediaList: initialAttachments.length > 1 ? initialAttachments : undefined,
      timestamp: Date.now(),
      reactions: {},
      deliveryStatus: 'sending',
      replyTo: replyContext
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(false), 30);

    // 4. Background processing: Lossless visual compression, EXIF metadata stripping, local persistence & cloud upload
    (async () => {
      try {
        const processedAttachments: MediaAttachment[] = [];

        for (let i = 0; i < filesToSend.length; i++) {
          const item = filesToSend[i];
          const mediaId = initialAttachments[i].id;
          const isVideo = item.type === 'video';
          let finalBlob: Blob = item.file;
          let previewThumbUrl: string | undefined = undefined;
          let base64DataUrl = '';

          if (!isVideo) {
            try {
              // High fidelity lossless visual compression & metadata stripping (max 2560px, 0.92 quality)
              const result = await processImageLossless(item.file);
              finalBlob = result.blob;
              previewThumbUrl = result.previewDataUrl;
              base64DataUrl = await blobToDataUrl(finalBlob);
            } catch (procErr) {
              console.warn('Image processing fallback to raw file:', procErr);
              finalBlob = item.file;
              base64DataUrl = await blobToDataUrl(finalBlob);
            }
          } else {
            base64DataUrl = await blobToDataUrl(finalBlob);
          }

          // Save full-res media in local device-first IndexedDB
          await saveLocalMedia(mediaId, finalBlob);

          let cloudUrl = '';
          let cldThumb: string | undefined = undefined;
          let cldPublicId: string | undefined = undefined;

          // 1. Primary: Upload directly to permanent Cloudinary Cloud (25 GB free tier, multi-account pool)
          try {
            const cldRes = await uploadToCloudinary(finalBlob, isVideo ? 'video' : 'image', `${mediaId}.${isVideo ? 'mp4' : 'jpg'}`);
            if (cldRes?.secureUrl) {
              cloudUrl = cldRes.secureUrl;
              cldThumb = cldRes.thumbnailUrl;
              cldPublicId = cldRes.publicId;
            }
          } catch (cldErr) {
            console.warn('Cloudinary upload attempt failed, falling back to Supabase:', cldErr);
          }

          // 2. Secondary Fallback: Supabase Storage bridge if Cloudinary unconfigured or failed
          if (!cloudUrl) {
            const extension = isVideo ? 'mp4' : 'jpg';
            const storagePath = `${mediaId}.${extension}`;
            try {
              const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(storagePath, finalBlob, { contentType: finalBlob.type, upsert: true });

              if (!uploadError) {
                const { data: publicUrlData } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
                if (publicUrlData?.publicUrl) {
                  cloudUrl = publicUrlData.publicUrl;
                }
              }
            } catch (storageErr) {
              console.warn('Supabase storage upload error:', storageErr);
            }
          }

          // If cloudUrl is available use it, otherwise use direct high-quality base64DataUrl
          const finalUrl = (cloudUrl && cloudUrl.startsWith('http')) ? cloudUrl : base64DataUrl;

          processedAttachments.push({
            id: mediaId,
            type: isVideo ? 'video' : 'image',
            url: finalUrl,
            thumbnailUrl: cldThumb || previewThumbUrl || (finalUrl.length < 50000 ? finalUrl : undefined),
            fileName: item.file.name,
            fileSize: finalBlob.size,
            mimeType: finalBlob.type,
            public_id: cldPublicId
          });
        }

        const finalPrimaryAttachment: MediaAttachment = {
          ...processedAttachments[0],
          caption: caption || undefined,
          mediaList: processedAttachments.length > 1 ? processedAttachments : undefined
        };

        // Serialize compact structured media into attachment_url for Supabase database
        const attachmentPayload = JSON.stringify(finalPrimaryAttachment);

        let insertPayload: any = {
          sender_role: role,
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: replyContext ? replyContext.id : null,
        };

        const ready = isE2EEReady();
        if (ready) {
          const encrypted = await encryptChatMessage({
            text: caption || '',
            reply_to: replyContext ? replyContext.id : null,
            attachment_url: attachmentPayload
          });
          insertPayload.ciphertext = encrypted.ciphertext;
          insertPayload.iv = encrypted.iv;
          insertPayload.is_encrypted = true;
          insertPayload.text = '';
          insertPayload.attachment_url = null;
        } else {
          insertPayload.text = caption || '';
          insertPayload.attachment_url = attachmentPayload;
        }

        const { data: savedMessage, error } = await supabase.from('messages').insert([insertPayload]).select().single();

        if (error) throw error;

        // Dispatches WhatsApp-style push notification for media
        let mediaText = '📎 Media attachment';
        if (finalPrimaryAttachment?.type === 'audio') mediaText = caption ? `🎤 Voice note: ${caption}` : '🎤 Voice note';
        else if (finalPrimaryAttachment?.type === 'image') mediaText = caption ? `📷 Photo: ${caption}` : '📷 Photo';
        else if (finalPrimaryAttachment?.type === 'video') mediaText = caption ? `🎥 Video: ${caption}` : '🎥 Video';
        else if (caption) mediaText = caption;

        triggerPushNotification({
          senderRole: role,
          senderName: role === 'owner' ? 'Rahul' : (userProfile?.display_name || 'Nusrat'),
          text: mediaText,
          avatarUrl: userProfile?.photo_url || undefined,
          messageId: savedMessage?.id,
          ciphertext: insertPayload.ciphertext,
          iv: insertPayload.iv,
          is_encrypted: insertPayload.is_encrypted,
        });

        const hydratedMedia = hydrateMessageMedia(savedMessage);
        setMessages(prev => {
          const isAlreadyInList = prev.some(m => m.id === savedMessage.id);
          if (isAlreadyInList) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(message => message.id === tempId ? {
            ...message,
            ...savedMessage,
            media: hydratedMedia || finalPrimaryAttachment,
            mediaList: hydratedMedia?.mediaList || processedAttachments,
            timestamp: savedMessage.created_at || message.timestamp,
            deliveryStatus: 'sent'
          } : message);
        });

      } catch (err) {
        console.error('Background media send error:', err);
        setMessages(prev => prev.map(message => message.id === tempId ? { ...message, deliveryStatus: 'failed' } : message));
      }
    })();
  };

  const [partnerLastReadAt, setPartnerLastReadAt] = useState<number>(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCountBelow, setUnreadCountBelow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef(messages.length);

  const checkIfNearBottom = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Considered near bottom if within 120px of bottom
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distanceFromBottom < 120;
    setIsNearBottom(near);
    if (near) {
      setUnreadCountBelow(0);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setUnreadCountBelow(0);
      setIsNearBottom(true);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      checkIfNearBottom();
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      const isMyMessage = lastMsg.sender_role === role;
      
      // If user is near bottom or user just sent a message, auto-scroll down smoothly
      if (isNearBottom || isMyMessage) {
        setTimeout(() => scrollToBottom(true), 60);
      } else {
        // User is scrolled up reading past history -> show WhatsApp / Instagram style new messages pill
        setUnreadCountBelow(prev => prev + (messages.length - prevMessagesCountRef.current));
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages.length, isNearBottom, role]);

  useEffect(() => {
    if (isTabActive && messages.length > 0 && userProfile) {
      const interval = setInterval(() => {
        if (isTabActive && userProfile) {
          supabase.from('users').update({ last_read_at: new Date().toISOString() }).eq('id', userProfile.uid).then(undefined, () => {});
        }
      }, 60000); 
      return () => clearInterval(interval);
    }
  }, [isTabActive, messages.length, userProfile?.uid]);

  const handleSendMessage = async (text: string) => {
    const tempId = `temp-${Date.now()}`;
    const activeReply = replyingTo;
    onSetReplyingTo(null);
    const msgData: any = {
      id: tempId,
      sender_role: role,
      text: text,
      timestamp: Date.now(),
      reactions: {},
      deliveryStatus: 'sending',
      replyTo: activeReply ? {
        id: activeReply.id,
        text: activeReply.text,
        sender_role: activeReply.sender_role
      } : null
    };

    setMessages(prev => [...prev, msgData]);
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });

    try {
      let insertRow: any = {
        sender_role: role,
        created_at: new Date().toISOString(),
        reactions: {},
        reply_to: activeReply ? activeReply.id : null,
      };

      const ready = isE2EEReady();
      if (ready) {
        const encrypted = await encryptChatMessage({
          text: text,
          reply_to: activeReply ? activeReply.id : null,
          attachment_url: null,
        });
        insertRow.ciphertext = encrypted.ciphertext;
        insertRow.iv = encrypted.iv;
        insertRow.is_encrypted = true;
        insertRow.text = '';
        insertRow.attachment_url = null;
      } else {
        insertRow.text = text;
        insertRow.attachment_url = null;
      }

      const { data: savedMessage, error } = await supabase.from('messages').insert([insertRow]).select().single();
      
      if (error) throw error;

      // Dispatches high-priority WhatsApp-style push notification to partner's device
      triggerPushNotification({
        senderRole: role,
        senderName: role === 'owner' ? 'Rahul' : (userProfile?.display_name || 'Nusrat'),
        text: text,
        avatarUrl: userProfile?.photo_url || undefined,
        messageId: savedMessage?.id,
        ciphertext: insertRow.ciphertext,
        iv: insertRow.iv,
        is_encrypted: insertRow.is_encrypted,
      });

      setMessages(prev => {
        const isExisting = prev.some(m => m.id === savedMessage.id);
        if (isExisting) {
          return prev.filter(m => m.id !== tempId);
        }
        return prev.map(message => message.id === tempId ? {
          ...message,
          ...savedMessage,
          text: text, // preserve sender's plaintext text in memory
          timestamp: savedMessage.created_at || message.timestamp,
          deliveryStatus: 'sent'
        } : message);
      });
    } catch (err: any) {
      console.error("Supabase insert error:", err);
      setMessages(prev => prev.map(message => message.id === tempId ? { ...message, deliveryStatus: 'failed' } : message));
    }
  };

  const handleSendVoiceNote = async (audioBlob: Blob, durationSeconds: number, customTitle?: string) => {
    const tempId = `temp-audio-${Date.now()}`;
    const mediaId = `media_${Date.now()}_audio`;
    const activeReply = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      sender_role: replyingTo.sender_role,
      mediaType: replyingTo.media?.type
    } : null;
    onSetReplyingTo(null);

    const localUrl = URL.createObjectURL(audioBlob);
    const fileName = customTitle || `Voice Note (${Math.round(durationSeconds)}s)`;
    const audioAttachment: MediaAttachment = {
      id: mediaId,
      type: 'audio',
      url: localUrl,
      fileName: fileName,
      duration: Math.round(durationSeconds),
      fileSize: audioBlob.size,
      mimeType: audioBlob.type || 'audio/webm',
    };

    saveLocalMedia(mediaId, audioBlob).catch(() => {});

    const optimisticMessage: any = {
      id: tempId,
      sender_role: role,
      text: '',
      timestamp: Date.now(),
      reactions: {},
      deliveryStatus: 'sending',
      media: audioAttachment,
      replyTo: activeReply
    };

    setMessages(prev => [...prev, optimisticMessage]);
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });

    (async () => {
      try {
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const extMatch = customTitle?.match(/\.([0-9a-z]+)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : (audioBlob.type?.includes('mp3') ? 'mp3' : 'webm');
        const storagePath = `${mediaId}.${ext}`;
        let cloudUrl = '';

        // 1. Primary: Upload voice note directly to Cloudinary permanent cloud
        let audioPublicId: string | undefined = undefined;
        try {
          const cldRes = await uploadToCloudinary(audioBlob, 'audio', `${mediaId}.${ext}`);
          if (cldRes?.secureUrl) {
            cloudUrl = cldRes.secureUrl;
            audioPublicId = cldRes.publicId;
          }
        } catch (cldErr) {
          console.warn('Cloudinary audio upload failed, falling back to Supabase:', cldErr);
        }

        // 2. Secondary Fallback: Supabase Storage
        if (!cloudUrl) {
          try {
            const { error: uploadError } = await supabase.storage
              .from('chat-media')
              .upload(storagePath, audioBlob, { contentType: audioBlob.type || 'audio/webm', upsert: true });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
              if (publicUrlData?.publicUrl) {
                cloudUrl = publicUrlData.publicUrl;
              }
            }
          } catch (storageErr) {
            console.warn('Supabase audio upload warning:', storageErr);
          }
        }

        const finalUrl = (cloudUrl && cloudUrl.startsWith('http')) ? cloudUrl : base64DataUrl;
        const finalAudioAttachment: MediaAttachment = {
          ...audioAttachment,
          url: finalUrl,
          public_id: audioPublicId,
        };

        const audioPayload = JSON.stringify(finalAudioAttachment);
        let insertPayload: any = {
          sender_role: role,
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: activeReply ? activeReply.id : null,
        };

        const ready = isE2EEReady();
        if (ready) {
          const encrypted = await encryptChatMessage({
            text: '',
            reply_to: activeReply ? activeReply.id : null,
            attachment_url: audioPayload,
          });
          insertPayload.ciphertext = encrypted.ciphertext;
          insertPayload.iv = encrypted.iv;
          insertPayload.is_encrypted = true;
          insertPayload.text = '';
          insertPayload.attachment_url = null;
        } else {
          insertPayload.text = '';
          insertPayload.attachment_url = audioPayload;
        }

        const { data: savedMessage, error } = await supabase.from('messages').insert([insertPayload]).select().single();

        if (error) throw error;

        const hydratedMedia = hydrateMessageMedia(savedMessage);
        setMessages(prev => {
          const isAlreadyInList = prev.some(m => m.id === savedMessage.id);
          if (isAlreadyInList) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(message => message.id === tempId ? {
            ...message,
            ...savedMessage,
            media: hydratedMedia || finalAudioAttachment,
            timestamp: savedMessage.created_at || message.timestamp,
            deliveryStatus: 'sent'
          } : message);
        });
      } catch (err) {
        console.error('Audio upload error:', err);
        setMessages(prev => prev.map(message => message.id === tempId ? { ...message, deliveryStatus: 'failed' } : message));
      }
    })();
  };

  const handleEditMessage = async (msgId: string, newText: string) => {
    try {
      const msg = messages.find(m => m.id === msgId);
      if (isE2EEReady()) {
        const enc = await encryptChatMessage({
          text: newText,
          replyTo: msg?.replyTo || null,
          media: msg?.media || null,
        });
        await supabase.from('messages').update({
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          is_encrypted: true,
          text: '',
          isEdited: true
        }).eq('id', msgId);
      } else {
        await supabase.from('messages').update({
          text: newText,
          isEdited: true
        }).eq('id', msgId);
      }
      onSetEditingMessage(null);
    } catch (err) {
      console.error("Edit error:", err);
    }
  };

  const sendGameInvite = onSendGameInvite;

  const latestPartnerMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.sender_role !== role && !messages[i]?.deleted) {
        return messages[i];
      }
    }
    return null;
  }, [messages, role]);

  const [messageLimit, setMessageLimit] = useState(50);

  const handleLoadEarlier = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setMessageLimit(prev => prev + 50);
      return;
    }
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;
    setMessageLimit(prev => prev + 50);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const heightDiff = scrollRef.current.scrollHeight - prevScrollHeight;
        scrollRef.current.scrollTop = prevScrollTop + heightDiff;
      }
    });
  }, []);

  const visibleMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter(m => {
      if (!m || !m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      if (role === 'owner') return !m.hidden_for_owner;
      return !m.hidden_for_partner;
    });
  }, [messages, role]);

  const displayedMessages = useMemo(() => {
    return visibleMessages.slice(-messageLimit);
  }, [visibleMessages, messageLimit]);

  const hasMoreMessages = visibleMessages.length > messageLimit;

  // Memoized lookup map for instant O(1) reply message resolution
  const messagesMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (let i = 0; i < visibleMessages.length; i++) {
      const m = visibleMessages[i];
      map.set(m.id, m);
    }
    return map;
  }, [visibleMessages]);

  // Memoized Set of selected message IDs for instant O(1) lookup
  const selectedMessageIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < selectedMessages.length; i++) {
      set.add(selectedMessages[i].id);
    }
    return set;
  }, [selectedMessages]);

  const partnerLastReadMillis = useMemo(() => {
    let lastRead = partnerProfile?.last_read_at ? getMillis(partnerProfile.last_read_at) : partnerLastReadAt;

    // Symmetrical blue tick guarantee: If partner sent a message or replied, they have definitely read all messages prior to that!
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i];
      if (m.sender_role !== role) {
        const mTs = getMillis(m.timestamp);
        if (mTs > lastRead) {
          lastRead = mTs;
        }
        break;
      }
    }
    return lastRead;
  }, [partnerProfile?.last_read_at, partnerLastReadAt, visibleMessages, role]);

  // Single-pass reverse computation for interaction points and seen indicator
  const { interactionId, showIndicatorSeenText } = useMemo(() => {
    let lastSentByMe: Message | null = null;
    let lastMsgByPartner: Message | null = null;
    let seenFrontierId: string | undefined = undefined;

    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i];
      if (m.sender_role === role) {
        if (!lastSentByMe) {
          lastSentByMe = m;
        }
        if (!seenFrontierId) {
          const msgTs = getMillis(m.timestamp);
          if (msgTs > 0 && msgTs <= partnerLastReadMillis) {
            seenFrontierId = m.id;
          }
        }
      } else {
        if (!lastMsgByPartner) {
          lastMsgByPartner = m;
        }
      }
      if (lastSentByMe && lastMsgByPartner && seenFrontierId) break;
    }

    const meLastMillis = lastSentByMe ? getMillis(lastSentByMe.timestamp) : 0;
    const partnerLastMillis = lastMsgByPartner ? getMillis(lastMsgByPartner.timestamp) : 0;

    let targetId: string | null | undefined = null;
    let showSeen = false;

    if (partnerLastMillis >= partnerLastReadMillis && partnerLastMillis > 0) {
      targetId = lastMsgByPartner?.id;
      showSeen = false;
    } else if (meLastMillis > 0 && partnerLastReadMillis >= meLastMillis) {
      targetId = lastSentByMe?.id;
      showSeen = true;
    } else if (partnerLastReadMillis > 0) {
      targetId = seenFrontierId;
      showSeen = false;
    }

    return {
      interactionId: targetId || null,
      showIndicatorSeenText: showSeen
    };
  }, [visibleMessages, role, partnerLastReadMillis]);

  useEffect(() => {
    setTimeout(() => scrollToBottom(false), 50);
  }, [displayedMessages.length]);

  const toggleReaction = useCallback(async (msgId: string, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const reactions = { ...(msg.reactions || {}) };
    
    if (reactions[role] === emoji) {
      delete reactions[role];
    } else {
      reactions[role] = emoji;
    }

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));

    try {
      await supabase.from('messages').update({ reactions }).eq('id', msgId);
      onClearSelection();
    } catch (err) {
      console.error("Reaction error:", err);
    }
  }, [messages, role, onClearSelection, setMessages]);

  const selectedMessagesCountRef = useRef(selectedMessages.length);
  selectedMessagesCountRef.current = selectedMessages.length;
  const isSelectionActiveRef = useRef(selectedMessages.length > 0);
  isSelectionActiveRef.current = selectedMessages.length > 0;

  const handleFocusInput = useCallback(() => {
    chatInputRef.current?.focusInput();
  }, []);

  const handleViewImage = useCallback((url: string) => {
    if (selectedMessagesCountRef.current > 0) return;
    onViewImage(url);
  }, [onViewImage]);

  const handleViewMedia = useCallback((media: MediaAttachment, fullList?: MediaAttachment[], initialIndex?: number) => {
    if (selectedMessagesCountRef.current > 0) return;
    setActiveMediaViewer(media);
    setActiveMediaList(fullList || (media.mediaList) || [media]);
    setActiveMediaIndex(initialIndex || 0);
  }, []);

  const handleJoinGame = useCallback((game: any) => {
    onSetActiveGame(game);
  }, [onSetActiveGame]);

  // Update last_read_at when new messages from partner arrive OR when user returns to tab
  useEffect(() => {
    if (!userProfile || !messages.length || !isTabActive || isOverlayOpen) return;
    
    // Check if the latest message is unseen (older than their lastReadAt)
    // or if the latest message is simply not from them
    const updateReadStatus = () => {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender_role !== role) {
        supabase.from('users').update({ last_read_at: new Date().toISOString() }).eq('id', userProfile.uid).then();
      }
    };

    updateReadStatus();
  }, [messages.length, userProfile?.uid, role, isTabActive, isOverlayOpen]);

  const partnerName = partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul');

  return (
    <div id="chat-view-container" className="flex flex-col h-full relative overflow-hidden">
      <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
        <div 
          ref={scrollRef}
          id="message-container" 
          style={{ touchAction: 'pan-y' }}
          className="flex-1 overflow-y-auto pb-3 custom-scrollbar scroll-smooth px-2.5 sm:px-3 lg:px-6 relative"
        >
          {petSettings && (
            <ChatPetCompanion 
              settings={petSettings} 
              onUpdateSettings={onUpdatePetSettings}
              lastMessageId={messages[messages.length - 1]?.id} 
              lastMessageText={messages[messages.length - 1]?.text}
              lastMessageSender={messages[messages.length - 1]?.sender_role === 'owner' ? 'Rahul' : partnerName}
              isTyping={socketTypingUsers.length > 0} 
              partnerName={partnerName}
              currentUserRole={role}
            />
          )}
          {quotaExceeded && <QuotaBanner />}
          <div className="flex justify-center mb-10 pt-6">
            <span className="text-[9px] font-bold text-[var(--theme-accent)] uppercase tracking-[0.4em] bg-[var(--theme-surface)]/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-[var(--theme-border)]">Our Story Begins Here</span>
          </div>
          
          {hasMoreMessages && (
            <div className="flex justify-center mb-4">
              <button 
                onClick={handleLoadEarlier}
                className="text-xs font-semibold px-4 py-2 bg-[var(--theme-surface)]/90 hover:bg-[var(--theme-surface)] text-[var(--theme-accent)] rounded-full shadow-sm border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Load earlier messages ({visibleMessages.length - messageLimit} more)
              </button>
            </div>
          )}

          {messagesLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-6 h-6 border-2 border-[var(--theme-border)] border-t-[var(--theme-accent)] rounded-full animate-spin"></div>
            </div>
          ) : displayedMessages.length === 0 ? (
            <div className="text-center py-20 opacity-20 select-none grayscale">
              <Heart className="w-16 h-16 mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs italic">A clean slate for our story</p>
            </div>
          ) : (
            displayedMessages.map((msg, index) => {
              const prevMsg = index > 0 ? displayedMessages[index - 1] : null;
              const nextMsg = index < displayedMessages.length - 1 ? displayedMessages[index + 1] : null;

              const prevTime = prevMsg ? getMillis(prevMsg.timestamp || prevMsg.created_at) : 0;
              const currTime = getMillis(msg.timestamp || msg.created_at);
              const timeDiffPrev = prevMsg && prevTime > 0 && currTime > 0 ? Math.abs(currTime - prevTime) : 0;
              const isFirstInGroup = !prevMsg || prevMsg.sender_role !== msg.sender_role || timeDiffPrev > 15 * 60 * 1000;

              const nextTime = nextMsg ? getMillis(nextMsg.timestamp || nextMsg.created_at) : 0;
              const timeDiffNext = nextMsg && nextTime > 0 && currTime > 0 ? Math.abs(nextTime - currTime) : 0;
              const isLastInGroup = !nextMsg || nextMsg.sender_role !== msg.sender_role || timeDiffNext > 15 * 60 * 1000;

              // Partner avatar is only shown on the first message of an incoming run until sender changes
              const showAvatar = isFirstInGroup && msg.sender_role !== role;

              return (
                <MessageItem 
                  key={msg.id} 
                  msg={msg} 
                  role={role} 
                  showAvatar={showAvatar}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  allMessages={displayedMessages}
                  replyToMessage={msg.replyTo?.id ? messagesMap.get(msg.replyTo.id) : undefined}
                  onReact={toggleReaction} 
                  isSelected={selectedMessageIds.has(msg.id)}
                  onToggleSelect={onToggleSelect}
                  selectionActive={selectedMessages.length > 0}
                  isSelectionActiveRef={isSelectionActiveRef}
                  onReply={onSetReplyingTo}
                  onFocusInput={handleFocusInput}
                  userProfile={userProfile}
                  partnerProfile={partnerProfile}
                  onViewImage={handleViewImage}
                  onViewMedia={handleViewMedia}
                  isInteractionPoint={msg.id === interactionId}
                  showSeenText={msg.id === interactionId && showIndicatorSeenText}
                  partnerLastReadAt={partnerLastReadMillis}
                  isPartnerOnline={isPartnerOnline}
                  onJoinGame={handleJoinGame}
                  onTriggerNudge={onSendNudge}
                  onOpenReel={setActiveReel}
                />
              );
            })
          )}
          {/* Permanent anchor for companion pet and scroll boundary */}
          <div id="chat-messages-bottom-anchor" className="h-6 w-full pointer-events-none opacity-0 select-none" />
        </div>

        {/* Scroll to bottom & New messages indicator pill */}
        <AnimatePresence>
          {(!isNearBottom || unreadCountBelow > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-4 right-4 z-30 pointer-events-auto"
            >
              <button
                onClick={() => scrollToBottom(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--theme-accent)] text-white shadow-lg shadow-[var(--theme-accent)]/30 hover:scale-105 active:scale-95 transition-all text-xs font-bold cursor-pointer border border-white/20"
                aria-label="Scroll to newest messages"
              >
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                {unreadCountBelow > 0 ? (
                  <span>{unreadCountBelow} new {unreadCountBelow === 1 ? 'message' : 'messages'}</span>
                ) : (
                  <span>Latest</span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {socketTypingUsers.includes(partnerProfile?.uid || '') && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="px-6 lg:px-10 py-1 flex items-center gap-2.5 text-[var(--theme-accent)]"
          >
            <div className="flex gap-2 items-center bg-[var(--theme-surface)]/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-[var(--theme-border)] scale-95 origin-left">
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-2 h-2 bg-[var(--theme-accent)] rounded-full" />
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 h-2 bg-[var(--theme-accent)] rounded-full" />
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 h-2 bg-[var(--theme-accent)] rounded-full" />
            </div>
            <span className="text-[11px] font-bold italic tracking-wide opacity-80 animate-pulse text-[var(--theme-accent)]">
              {role === 'owner' ? (userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || 'Nusrat') : 'Rahul'} is writing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatInputBar 
        ref={chatInputRef}
        inputRef={messageInputRef}
        role={role}
        userProfile={userProfile}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onClearReply={() => onSetReplyingTo(null)}
        onClearEditing={() => onSetEditingMessage(null)}
        onSendMessage={handleSendMessage}
        onSendVoiceNote={handleSendVoiceNote}
        onEditMessage={handleEditMessage}
        onOpenAttachmentMenu={() => onSetShowAttachmentMenu(true)}
        onOpenNudgeMenu={() => onSetShowNudgeMenu(true)}
        onBroadcastTyping={onBroadcastTyping}
        externalTriggerVoiceRecord={triggerVoiceRecord}
        onClearExternalVoiceRecordTrigger={() => setTriggerVoiceRecord(false)}
      />

      {/* Hidden file inputs for Camera, Gallery, and Audio */}
      <input 
        type="file" 
        ref={cameraInputRef} 
        accept="image/*,video/*" 
        capture="environment" 
        className="hidden" 
        onChange={(e) => handleSelectMedia(e, true)} 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        multiple
        accept="image/*,video/*" 
        className="hidden" 
        onChange={(e) => handleSelectMedia(e, false)} 
      />
      <input 
        type="file" 
        ref={audioInputRef} 
        accept="audio/*" 
        className="hidden" 
        onChange={handleSelectAudio} 
      />

      <BottomSheet 
        isOpen={showAttachmentMenu} 
        onClose={() => onSetShowAttachmentMenu(false)}
        title="Share with Love"
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-4 p-4 lg:p-6">
          <AttachmentOption 
            icon={<Camera className="w-5 h-5 sm:w-6 sm:h-6" />} 
            label="Camera" 
            color="bg-[var(--theme-accent)] text-white" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              cameraInputRef.current?.click();
            }} 
          />
          <AttachmentOption 
            icon={<ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />} 
            label="Photos" 
            color="bg-[var(--theme-bubble-partner)] text-[var(--theme-bubble-partner-text)]" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              fileInputRef.current?.click();
            }} 
          />
          <AttachmentOption 
            icon={<Instagram className="w-5 h-5 sm:w-6 sm:h-6" />} 
            label="Reel" 
            color="bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              setShowShareReelModal(true);
            }} 
          />
          <AttachmentOption 
            icon={<Headphones className="w-5 h-5 sm:w-6 sm:h-6" />} 
            label="Audio" 
            color="bg-orange-500 text-white" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              audioInputRef.current?.click();
            }} 
          />
        </div>
      </BottomSheet>

      {/* Media Send Preview Modal (WhatsApp Style) */}
      <MediaSendPreviewModal 
        isOpen={showMediaPreviewModal}
        onClose={() => {
          setShowMediaPreviewModal(false);
          setSelectedMediaFiles([]);
        }}
        files={selectedMediaFiles}
        recipientName={role === 'owner' ? 'Nusrat' : 'Rahul'}
        onSend={handleSendMediaMessage}
        isSending={isSendingMedia}
      />

      {/* WhatsApp-style Fullscreen Media Viewer */}
      <FullscreenMediaViewer 
        media={activeMediaViewer}
        mediaList={activeMediaList}
        initialIndex={activeMediaIndex}
        onClose={() => {
          setActiveMediaViewer(null);
          setActiveMediaList(undefined);
        }}
      />

      <BottomSheet
        isOpen={showNudgeMenu}
        onClose={() => onSetShowNudgeMenu(false)}
        title="Send a Feeling ✨"
      >
        <div className="grid grid-cols-4 gap-3 p-4 lg:p-6 pb-8">
          {[
            { id: 'hug', label: 'Hug', emoji: '🤗' },
            { id: 'kiss', label: 'Kiss', emoji: '💋' },
            { id: 'love', label: 'Love', emoji: '💖' },
            { id: 'miss', label: 'Miss You', emoji: '🥺' },
            { id: 'cuddle', label: 'Cuddle', emoji: '🫂' },
            { id: 'tickle', label: 'Tickle', emoji: '😂' },
            { id: 'adore', label: 'Adore', emoji: '😍' },
            { id: 'blowkiss', label: 'Blow Kiss', emoji: '😘' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              style={{ touchAction: 'manipulation' }}
              onClick={() => {
                onSendNudge(f.id);
                onSetShowNudgeMenu(false);
              }}
              className="flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-150 hover:scale-105 active:scale-95 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-transform duration-150 group-hover:rotate-6 bg-[var(--theme-bg)] border border-[var(--theme-border)] group-hover:border-[var(--theme-accent)]/40">
                <span className="select-none leading-none">{f.emoji}</span>
              </div>
              <span className="text-[12px] font-bold text-[var(--theme-text)] opacity-85 group-hover:opacity-100 tracking-tight text-center whitespace-nowrap">
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Instagram Reel In-App Fullscreen Player */}
      <InstagramReelModal 
        reel={activeReel} 
        onClose={() => setActiveReel(null)} 
      />

      {/* Quick Share Reel Modal */}
      <ShareReelModal 
        isOpen={showShareReelModal}
        onClose={() => setShowShareReelModal(false)}
        onSend={handleSendMessage}
        recipientName={partnerProfile?.display_name || (role === 'owner' ? 'Nusrat' : 'Rahul')}
      />
    </div>
  );
});
