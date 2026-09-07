import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';

// Firestore mocks for migration
const db = {};
const doc = (d: any, coll: string, id: string) => ({ coll, id });
const collection = (d: any, coll: string) => coll;
const query = (...args: any[]) => args;
const orderBy = (field: string, dir: string) => field;
const limit = (l: number) => l;
const setDoc = async (ref: any, data: any) => supabase.from(ref.coll).upsert({ id: ref.id, ...data });
const updateDoc = async (ref: any, data: any) => supabase.from(ref.coll).update(data).eq('id', ref.id);
const addDoc = async (coll: string, data: any) => supabase.from(coll).insert(data);
const onSnapshot = (ref: any, cb: any, err?: any) => { 
  const channel = supabase.channel(`public_${ref.coll}_${ref.id}`);
  supabase.from(ref.coll).select('*').eq('id', ref.id).single().then(({data, error}) => {
    if (data) cb({ exists: () => true, data: () => data });
    else cb({ exists: () => false, data: () => null });
  });
  channel.on('postgres_changes', { event: '*', schema: 'public', table: ref.coll, filter: `id=eq.${ref.id}` }, (payload) => {
     cb({ exists: () => true, data: () => payload.new });
  }).subscribe();
  return () => { supabase.removeChannel(channel); };
};
const serverTimestamp = () => new Date().toISOString();
const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin }});
const auth = { currentUser: null };
// Socket mock
const socketService = {
  disconnect: () => {},
  connect: () => {},
  joinRoom: () => {},
  onConnect: () => {},
  onDisconnect: () => {},
  onRoomStatus: () => {},
  offAll: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  emitTyping: () => {},
  onNewMessage: () => {},
  onMessageUpdated: () => {},
  onMessageDeleted: () => {}
};
import { StealthNotepadView } from './components/StealthNotepadView';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AppConfig, UserRole, UserProfile, Message, MediaAttachment } from './types';
import { LogOut, Send, Settings as SettingsIcon, MessageSquare, ShieldCheck, Heart, User as UserIcon, Plus, X, Trash2, Smile, MoreVertical, Copy, RotateCcw, Reply, CornerUpLeft, Pencil, Camera, Image as ImageIcon, Check, CheckCheck, Clock3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, UserPlus, Gamepad2, Music, Wifi, WifiOff, ListChecks, Wind, Laugh, Star, KeyRound, Lock, Sparkles, RefreshCw, LayoutGrid, Instagram, MessageSquareCode, ArrowLeft, UserCheck, Repeat, Film, Link2, Video, FileVideo, Ban, Play, Mic, BookOpen, EyeOff } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { MultiHubDashboard } from './components/MultiHubDashboard';
import { ExternalHubView } from './components/ExternalHubView';
import { WhatsAppMediaBubble } from './components/WhatsAppMediaBubble';
import { FullscreenMediaViewer } from './components/FullscreenMediaViewer';
import { MediaSendPreviewModal, SelectedMediaFile } from './components/MediaSendPreviewModal';
import { saveLocalMedia, getLocalMedia, initMediaSyncListener } from './lib/mediaStore';
import { processImageLossless, blobToDataUrl } from './lib/imageProcessor';
import { useOverlayBack, hasOpenOverlays, popOverlay } from './lib/overlayManager';
import { cacheMessages, loadCachedMessages, safeSetItem, safeGetItem, safeRemoveItem } from './lib/safeStorage';
import { THEMES, ThemeName, applyTheme } from './lib/themes';
import { getMillis, parseDate, hydrateMessageMedia } from './lib/dateUtils';
import { ProfileModal } from './components/ProfileModal';
import { PartnerInfoModal } from './components/PartnerInfoModal';
import { ThemeCustomizePage, ThemeCustomizeSheet } from './components/ThemeCustomizePage';
import { FullImageViewer } from './components/FullImageViewer';
import { ImageCropperModal } from './components/ImageCropperModal';
import { NudgeOverlay } from './components/NudgeOverlay';
import { BottomSheet, AttachmentOption, GameCard, CelebrateIcon } from './components/BottomSheet';
import { ChatInputBar, ChatInputBarHandle } from './components/ChatInputBar';
import { MessageItem } from './components/MessageItem';
import { LoginView, UnauthorizedView, QuotaBanner } from './components/AuthModals';
import { DeleteChoicesModal } from './components/DeleteChoicesModal';
import { GameOverlayManager } from './components/GameOverlayManager';
import { useMessageSync } from './hooks/useMessageSync';
import { initLocalNotifications, OnlyUsNativeNotification } from './lib/notifications';
import Cropper, { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const partnerProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => { partnerProfileRef.current = partnerProfile; }, [partnerProfile]);
  const [isOwner, setIsOwner] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  // Stealth Disguise Vault State (Notepad vs OnlyUs)
  const [isStealthUnlocked, setIsStealthUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    // 1. If unlocked during this active app session
    if (sessionStorage.getItem('onlyus_vault_unlocked') === 'true') {
      return true;
    }
    // 2. If running inside Nusrat's Notes APK flavor (Native User-Agent or package check)
    if (navigator.userAgent.includes('OnlyUsFlavor/Notes')) {
      return false;
    }
    const pref = localStorage.getItem('onlyus_stealth_mode');
    if (pref === 'true') return false;
    if (window.location.search.includes('stealth') || window.location.search.includes('edition=nusrat')) {
      return false;
    }
    return true;
  });

  // Verify package identity asynchronously: if com.onlyus.notes, lock immediately
  useEffect(() => {
    CapApp.getInfo().then(info => {
      if (info.id.includes('notes')) {
        localStorage.setItem('onlyus_stealth_mode', 'true');
        if (sessionStorage.getItem('onlyus_vault_unlocked') !== 'true') {
          setIsStealthUnlocked(false);
        }
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
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);
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
  const [minimizedCountdown, setMinimizedCountdown] = useState(60);
  const minimizedTimerRef = useRef<any>(null);

  const handleMinimizeGame = useCallback(() => {
    if (!activeGame) return;
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
          // 1 minute expired -> Terminate session in DB & unmount
          if (activeGame?.id) {
            supabase.from('games').update({ status: 'closed' }).eq('id', activeGame.id).then();
            supabase.from('messages').update({
              gameInvite: {
                sessionId: activeGame.id,
                gameType: activeGame.type,
                status: 'closed',
              },
            }).filter('gameInvite->>sessionId', 'eq', activeGame.id).then();
          }
          setActiveGame(null);
          setIsGameMinimized(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [activeGame]);

  const handleResumeGame = useCallback(() => {
    if (minimizedTimerRef.current) {
      clearInterval(minimizedTimerRef.current);
      minimizedTimerRef.current = null;
    }
    setIsGameMinimized(false);
  }, []);

  const handleTerminateGame = useCallback(async () => {
    if (minimizedTimerRef.current) {
      clearInterval(minimizedTimerRef.current);
      minimizedTimerRef.current = null;
    }
    if (activeGame?.id) {
      try {
        await supabase.from('games').update({ status: 'closed' }).eq('id', activeGame.id);
        await supabase.from('messages').update({
          gameInvite: {
            sessionId: activeGame.id,
            gameType: activeGame.type,
            status: 'closed',
          },
        }).filter('gameInvite->>sessionId', 'eq', activeGame.id);
      } catch (err) {
        console.warn('Terminate game note:', err);
      }
    }
    setActiveGame(null);
    setIsGameMinimized(false);
  }, [activeGame]);

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
  const [activeNudge, setActiveNudge] = useState<{ type: string, sender: string } | null>(null);
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
  useOverlayBack(!!showFullImage, () => setShowFullImage(null), 'full-image-viewer');
  useOverlayBack(showCustomizeModal, () => setShowCustomizeModal(false), 'customize-theme');
  useOverlayBack(showClearChatConfirm, () => setShowClearChatConfirm(false), 'clear-chat-confirm');
  useOverlayBack(showDeleteChoices, () => setShowDeleteChoices(false), 'delete-choices');
  // If active game is open and not minimized, back button minimizes it!
  useOverlayBack(!!activeGame && !isGameMinimized, () => handleMinimizeGame(), 'active-game');
  useOverlayBack(!!activeNudge, () => setActiveNudge(null), 'active-nudge');
  useOverlayBack(showAttachmentMenu, () => setShowAttachmentMenu(false), 'attachment-menu');
  useOverlayBack(showGamesMenu, () => setShowGamesMenu(false), 'games-menu');
  useOverlayBack(showNudgeMenu, () => setShowNudgeMenu(false), 'nudge-menu');
  useOverlayBack(showMenu, () => setShowMenu(false), 'top-3dot-menu');
  useOverlayBack(selectedMessages.length > 0, () => setSelectedMessages([]), 'selected-messages');
  useOverlayBack(isSidebarOpen, () => setIsSidebarOpen(false), 'sidebar-drawer');

  // Periodic 10s tick to keep relative "Last seen" and online indicators accurate in realtime
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => setTimeTick(t => t + 1), 10000);
    return () => clearInterval(tickInterval);
  }, []);

  // Automatically close keyboard when navigating away from chat screen or opening full-page modals
  useEffect(() => {
    if (
      activeHubTab !== 'chat' ||
      showProfileModal ||
      showCustomizeModal ||
      showGamesMenu ||
      showPartnerInfo ||
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
          const newMsg = {
            sender_role: role,
            text: text.trim(),
            created_at: new Date().toISOString(),
            reactions: {},
            reply_to: null,
            attachment_url: null
          };
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
      await supabase.from('messages').insert([{
        sender_role: userProfile.role,
        text: text,
        created_at: new Date().toISOString(),
        reactions: {},
        reply_to: null,
        attachment_url: null,
      }]);
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
            theme: 'romantic',
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
      try {
        const role: UserRole = isOwner ? 'owner' : (userProfile?.role || 'owner');
        const newMsg = {
          sender_role: role,
          text: replyText.trim(),
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: null,
          attachment_url: null
        };
        await supabase.from('messages').insert([newMsg]);
      } catch (err) {
        console.error('Failed to send reply from notification action:', err);
      }
    });

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
          setUserProfile(profile);
          if (profile.theme) applyTheme(profile.theme as ThemeName);
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

      // Safety: If they are not active/online, they are definitely not typing
      setSocketTypingUsers(prev => prev.filter(id => onlineIds.includes(id)));
    };

    presenceChannel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
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

          setActiveNudge({ type: type || 'hug', sender: partnerDisplayName });
          // Auto-clear nudge after 4 seconds
          setTimeout(() => setActiveNudge(null), 4000);
          // WhatsApp style double vibration pulse for feeling
          if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            try { window.navigator.vibrate([150, 80, 150]); } catch (_) {}
          }
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
            role: myRole
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

  // Sync tab activity to Presence without resubscribing
  useEffect(() => {
    if (mainChannelRef.current && isSocketConnected && user) {
      mainChannelRef.current.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
        is_active: isTabActive,
        role: userProfile?.role || (isOwner ? 'owner' : 'partner')
      });
    }
  }, [isTabActive, isSocketConnected, user?.id, userProfile?.role, isOwner]);

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
    setActiveNudge({ type, sender: 'You' });
    setTimeout(() => setActiveNudge(null), 4000);

    // Haptic feedback
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate([100, 50, 100]); } catch (_) {}
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
        setUserProfile({
          id: partnerUser.id,
          uid: partnerUser.id,
          email: partnerUser.email,
          role: 'partner',
          display_name: 'Nusrat',
          photo_url: '',
          theme: 'romantic',
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

  // Apply theme when userProfile changes
  useEffect(() => {
    if (userProfile?.theme) {
      applyTheme(userProfile.theme as ThemeName);
    }
  }, [userProfile?.theme]);

  const updateSettings = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    const previousProfile = userProfile;
    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
    try {
      const { error: settingsError } = await supabase.from('users').update(updates).eq('id', userProfile.uid);
      if (settingsError) throw settingsError;
    } catch (err) {
      console.error("Error updating settings:", err);
      setUserProfile(previousProfile);
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
    if (!userProfile || userProfile.theme === theme || isThemeSaving) return;
    const requestId = ++themeUpdateRequestRef.current;
    applyTheme(theme);
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
        // Delete for Everyone (Update Database with placeholder)
        const messagesToUpdate = messagesToProcess
          .filter(m => m.sender_role === userProfile?.role && !m.deleted)
          .map(m => m.id)
          .filter(id => !id.startsWith('temp-'));
        
        // Optimistic UI update
        setMessages(prev => {
          const updated = prev.map(m => 
            messagesToProcess.some(sm => sm.id === m.id && sm.sender_role === userProfile?.role)
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
        // Delete for Me (If partner already deleted from their side, permanently delete from Database)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-sans text-sm text-[var(--theme-accent)] font-medium animate-pulse">Initializing OnlyUs...</p>
        </div>
      </div>
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
          onSelectTab={(tab) => handleHubTabChange(tab)}
          onOpenSettings={() => setShowProfileModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
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
              <AnimatePresence mode="wait">
              {selectedMessages.length > 0 ? (
                <motion.header 
                  key="selection-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-[env(safe-area-inset-top,0px)] left-0 right-0 bottom-0 px-5 lg:px-8 flex items-center justify-between bg-[var(--theme-accent)] text-[var(--theme-bubble-owner-text)] z-30 transition-colors duration-300"
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
                  className="absolute top-[env(safe-area-inset-top,0px)] left-0 right-0 bottom-0 px-4 lg:px-6 flex items-center justify-between bg-[var(--theme-header-bg)] text-[var(--theme-text)] backdrop-blur-md z-20 transition-colors duration-300"
                >
                  <div className="flex items-center flex-1 min-w-0 pr-4 h-full">
                    {/* Back to Multi-Hub button */}
                    <button
                      onClick={() => {
                        if (typeof document !== 'undefined' && document.activeElement && 'blur' in document.activeElement) {
                          (document.activeElement as HTMLElement).blur();
                        }
                        handleHubTabChange('dashboard');
                      }}
                      className="theme-accent-button p-2 -ml-1 mr-2 rounded-2xl transition-all flex items-center gap-1 active:scale-95 shrink-0 shadow-sm"
                      title="Back to OnlyUs Hub"
                    >
                      <ArrowLeft className="w-5 h-5 lg:hidden" />
                      <LayoutGrid className="w-4 h-4 hidden lg:block" />
                    </button>

                    <div className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0" onClick={() => setShowPartnerInfo(true)}>
                      <div className="relative" onClick={(e) => { e.stopPropagation(); if(partnerProfile?.photo_url) setShowFullImage(partnerProfile.photo_url); }}>
                        {partnerProfile?.photo_url ? (
                          <img 
                            src={partnerProfile.photo_url} 
                            alt="Partner" 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 lg:w-11 lg:h-11 rounded-full object-cover border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-[var(--theme-accent)]/15 flex items-center justify-center border-2 border-[var(--theme-accent)]/30 ring-2 ring-[var(--theme-accent)]/15 text-[var(--theme-accent)] font-bold text-lg">
                            {partnerProfile?.display_name?.[0] || (isOwner ? 'N' : 'R')}
                          </div>
                        )}
                        {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online' && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4ade80] border-2 border-[var(--theme-surface)] rounded-full"></div>
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <h2 className="text-[15px] lg:text-[16px] font-bold text-[var(--theme-text)] truncate leading-tight">
                          {userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul')}
                        </h2>
                        <p className={`text-[10px] lg:text-[11px] font-bold leading-none mt-0.5 ${formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online' ? 'text-green-500' : 'text-[#6E6E6E]/60'}`}>
                          {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-2 w-52 bg-[var(--theme-surface)] text-[var(--theme-text)] rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] border border-[var(--theme-border)] z-50 overflow-hidden py-1 backdrop-blur-md"
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
                                onClick={() => { lockVault(); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-amber-600 hover:bg-amber-500/10 flex items-center gap-3 transition-colors"
                              >
                                <BookOpen className="w-4 h-4 text-amber-600" />
                                Lock to Notes
                              </button>
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
                                Play Games
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
                isOverlayOpen={showProfileModal || showPartnerInfo || !!showFullImage || showDeleteChoices || showAttachmentMenu || showGamesMenu || (!!activeGame && !isGameMinimized)}
                showAttachmentMenu={showAttachmentMenu}
                onSetShowAttachmentMenu={setShowAttachmentMenu}
                showGamesMenu={showGamesMenu}
                onSetShowGamesMenu={setShowGamesMenu}
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

      <AnimatePresence>
        {showProfileModal && userProfile && (
          <ProfileModal 
            profile={userProfile} 
            onClose={() => setShowProfileModal(false)}
            config={appConfig}
            isOwner={isOwner}
            onLogout={handleLogout}
            onProfileUpdated={(newMe) => setUserProfile(newMe)}
            onLockVault={lockVault}
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
            currentTheme={(userProfile?.theme as ThemeName) || 'romantic'}
            onThemeSelect={selectTheme}
            isThemeSaving={isThemeSaving}
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
        currentTheme={(userProfile?.theme as ThemeName) || 'romantic'}
        onThemeSelect={selectTheme}
        isThemeSaving={isThemeSaving}
      />
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
  onDismissNudge
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
  onDismissNudge?: () => void
}) {
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<SelectedMediaFile[]>([]);
  const [activeMediaViewer, setActiveMediaViewer] = useState<MediaAttachment | null>(null);
  const [activeMediaList, setActiveMediaList] = useState<MediaAttachment[] | undefined>(undefined);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<ChatInputBarHandle>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [triggerVoiceRecord, setTriggerVoiceRecord] = useState(false);

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

          // Upload to temporary cloud bridge in Supabase Storage if available
          const extension = isVideo ? 'mp4' : 'jpg';
          const storagePath = `${mediaId}.${extension}`;
          let cloudUrl = '';

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

          // If cloudUrl is available use it, otherwise use direct high-quality base64DataUrl
          const finalUrl = (cloudUrl && cloudUrl.startsWith('http')) ? cloudUrl : base64DataUrl;

          processedAttachments.push({
            id: mediaId,
            type: isVideo ? 'video' : 'image',
            url: finalUrl,
            thumbnailUrl: previewThumbUrl || (finalUrl.length < 50000 ? finalUrl : undefined),
            fileName: item.file.name,
            fileSize: finalBlob.size,
            mimeType: finalBlob.type
          });
        }

        const finalPrimaryAttachment: MediaAttachment = {
          ...processedAttachments[0],
          caption: caption || undefined,
          mediaList: processedAttachments.length > 1 ? processedAttachments : undefined
        };

        // Serialize compact structured media into attachment_url for Supabase database
        const attachmentPayload = JSON.stringify(finalPrimaryAttachment);

        const { data: savedMessage, error } = await supabase.from('messages').insert([{
          sender_role: role,
          text: caption || '',
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: replyContext ? replyContext.id : null,
          attachment_url: attachmentPayload
        }]).select().single();

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
      const { data: savedMessage, error } = await supabase.from('messages').insert([{
        sender_role: role,
        text: text,
        created_at: new Date().toISOString(),
        reactions: {},
        reply_to: activeReply ? activeReply.id : null,
        attachment_url: null 
      }]).select().single();
      
      if (error) throw error;
      setMessages(prev => {
        const isExisting = prev.some(m => m.id === savedMessage.id);
        if (isExisting) {
          return prev.filter(m => m.id !== tempId);
        }
        return prev.map(message => message.id === tempId ? {
          ...message, ...savedMessage, timestamp: savedMessage.created_at || message.timestamp, deliveryStatus: 'sent'
        } : message);
      });
    } catch (err: any) {
      console.error("Supabase insert error:", err);
      setMessages(prev => prev.map(message => message.id === tempId ? { ...message, deliveryStatus: 'failed' } : message));
    }
  };

  const handleSendVoiceNote = async (audioBlob: Blob, durationSeconds: number) => {
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
    const audioAttachment: MediaAttachment = {
      id: mediaId,
      type: 'audio',
      url: localUrl,
      fileName: `Voice Note (${Math.round(durationSeconds)}s)`,
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

        const storagePath = `${mediaId}.webm`;
        let cloudUrl = '';
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

        const finalUrl = (cloudUrl && cloudUrl.startsWith('http')) ? cloudUrl : base64DataUrl;
        const finalAudioAttachment: MediaAttachment = {
          ...audioAttachment,
          url: finalUrl,
        };

        const { data: savedMessage, error } = await supabase.from('messages').insert([{
          sender_role: role,
          text: '',
          created_at: new Date().toISOString(),
          reactions: {},
          reply_to: activeReply ? activeReply.id : null,
          attachment_url: JSON.stringify(finalAudioAttachment)
        }]).select().single();

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
        console.error('Voice note send error:', err);
        setMessages(prev => prev.map(message => message.id === tempId ? { ...message, deliveryStatus: 'failed' } : message));
      }
    })();
  };

  const handleEditMessage = async (msgId: string, newText: string) => {
    try {
      await supabase.from('messages').update({
        text: newText,
        isEdited: true
      }).eq('id', msgId);
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
    return partnerProfile?.last_read_at ? getMillis(partnerProfile.last_read_at) : partnerLastReadAt;
  }, [partnerProfile?.last_read_at, partnerLastReadAt]);

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
    setTimeout(scrollToBottom, 50);
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

    try {
      await supabase.from('messages').update({ reactions }).eq('id', msgId);
      onClearSelection();
    } catch (err) {
      console.error("Reaction error:", err);
    }
  }, [messages, role, onClearSelection]);

  const selectedMessagesCountRef = useRef(selectedMessages.length);
  selectedMessagesCountRef.current = selectedMessages.length;

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

  return (
    <div className="flex flex-col h-full relative">
      <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
        <div 
          ref={scrollRef}
          id="message-container" 
          style={{ touchAction: 'pan-y' }}
          className="flex-1 overflow-y-auto space-y-4 pb-6 custom-scrollbar scroll-smooth px-3 lg:px-6 relative"
        >
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
            displayedMessages.map((msg) => (
              <MessageItem 
                key={msg.id} 
                msg={msg} 
                role={role} 
                replyToMessage={msg.replyTo?.id ? messagesMap.get(msg.replyTo.id) : undefined}
                onReact={toggleReaction} 
                isSelected={selectedMessageIds.has(msg.id)}
                onToggleSelect={onToggleSelect}
                selectionActive={selectedMessages.length > 0}
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
              />
            ))
          )}
        </div>

        <AnimatePresence>
          {activeNudge && (
            <NudgeOverlay nudge={activeNudge} onDismiss={onDismissNudge} />
          )}
        </AnimatePresence>

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
            className="px-6 lg:px-10 py-1 flex items-center gap-2.5 text-[var(--theme-accent)] bg-gradient-to-t from-[var(--theme-bg)]/80 to-transparent"
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

      {/* Hidden file inputs for Camera and Gallery */}
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

      <BottomSheet 
        isOpen={showAttachmentMenu} 
        onClose={() => onSetShowAttachmentMenu(false)}
        title="Share with Love"
      >
        <div className="grid grid-cols-4 gap-4 p-4 lg:p-6">
          <AttachmentOption 
            icon={<Camera className="w-6 h-6" />} 
            label="Camera" 
            color="bg-[var(--theme-accent)] text-white" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              cameraInputRef.current?.click();
            }} 
          />
          <AttachmentOption 
            icon={<ImageIcon className="w-6 h-6" />} 
            label="Photos & Videos" 
            color="bg-[var(--theme-bubble-partner)] text-[var(--theme-bubble-partner-text)]" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              fileInputRef.current?.click();
            }} 
          />
          <AttachmentOption 
            icon={<Video className="w-6 h-6" />} 
            label="Video" 
            color="bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              fileInputRef.current?.click();
            }} 
          />
          <AttachmentOption 
            icon={<Mic className="w-6 h-6" />} 
            label="Voice Note" 
            color="bg-[#8B5CF6]/20 text-[#8B5CF6]" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              setTriggerVoiceRecord(true);
            }} 
          />
          <AttachmentOption 
            icon={<Sparkles className="w-6 h-6" />} 
            label="Feelings" 
            color="bg-[#FF8FA3]/20 text-[#FF8FA3]" 
            onClick={() => {
              onSetShowAttachmentMenu(false);
              onSetShowNudgeMenu(true);
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
              onClick={() => {
                onSendNudge(f.id);
                onSetShowNudgeMenu(false);
              }}
              className="flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-all duration-200 group-hover:rotate-6 bg-[var(--theme-bg)] border border-[var(--theme-border)] group-hover:border-[var(--theme-accent)]/40 group-hover:shadow-[0_4px_16px_color-mix(in_srgb,var(--theme-accent)_20%,transparent)]">
                <span className="select-none leading-none">{f.emoji}</span>
              </div>
              <span className="text-[12px] font-bold text-[var(--theme-text)] opacity-85 group-hover:opacity-100 tracking-tight text-center whitespace-nowrap">
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
});
