import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
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
import { AppConfig, UserRole, UserProfile, Message } from './types';
import { LogOut, Send, Settings as SettingsIcon, MessageSquare, ShieldCheck, Heart, User as UserIcon, Plus, X, Trash2, Smile, MoreVertical, Copy, RotateCcw, Reply, CornerUpLeft, Pencil, Camera, Image as ImageIcon, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, UserPlus, Gamepad2, Music, Wifi, WifiOff, ListChecks, Wind, Laugh, Star, KeyRound, Lock, Sparkles, RefreshCw, LayoutGrid, Instagram, MessageSquareCode, ArrowLeft, UserCheck, Repeat, Film, Link2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { MultiHubDashboard } from './components/MultiHubDashboard';
import { ExternalHubView } from './components/ExternalHubView';
const TicTacToe = lazy(() => import('./components/TicTacToeModal'));
import Cropper, { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

// Ludo Assets removed

const THEMES = {
  light: {
    bg: '#ffffff',
    text: '#1a1a1a',
    header: 'rgba(255, 255, 255, 0.8)',
    owner: '#FF8FA3',
    ownerText: '#ffffff',
    partner: '#FFD6C9',
    partnerText: '#5D5D5D',
    input: '#ffffff'
  },
  dark: {
    bg: '#0F0F0F',
    text: '#FFFFFF',
    header: 'rgba(26, 26, 26, 0.8)',
    owner: '#FF8FA3',
    ownerText: '#ffffff',
    partner: '#262626',
    partnerText: '#E0E0E0',
    input: '#1A1A1A'
  },
  romantic: {
    bg: '#FFF8F6',
    text: '#1a1a1a',
    header: 'rgba(255, 255, 255, 0.8)',
    owner: '#FF8FA3',
    ownerText: '#ffffff',
    partner: '#FFD6C9',
    partnerText: '#5D5D5D',
    input: '#ffffff'
  },
  lavender: {
    bg: '#F8F4FF',
    text: '#302A3D',
    header: 'rgba(250, 247, 255, 0.88)',
    owner: '#8F78B8',
    ownerText: '#ffffff',
    partner: '#E6DCF3',
    partnerText: '#4D4260',
    input: '#FFFDFE'
  },
  ocean: {
    bg: '#F1F8F8',
    text: '#18383B',
    header: 'rgba(245, 251, 250, 0.88)',
    owner: '#397D83',
    ownerText: '#ffffff',
    partner: '#D3E9E7',
    partnerText: '#245156',
    input: '#FBFEFD'
  },
  sunset: {
    bg: '#FFF7EF',
    text: '#493229',
    header: 'rgba(255, 250, 245, 0.9)',
    owner: '#D97868',
    ownerText: '#ffffff',
    partner: '#F5D8C4',
    partnerText: '#67483C',
    input: '#FFFCF8'
  }
};

const WALLPAPERS = [
  { id: 'none', name: 'Clean', background: '' },
  { id: 'dots', name: 'Confetti', background: 'radial-gradient(circle at center, rgba(255,255,255,.8) 0 2px, transparent 2.5px)', size: '22px 22px' },
  { id: 'hearts', name: 'Sweetheart', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.64) 0 5px, transparent 5.5px), radial-gradient(circle at 70% 65%, rgba(255,143,163,.2) 0 7px, transparent 7.5px)', size: '44px 44px' },
  { id: 'blush', name: 'Soft Bloom', background: 'radial-gradient(circle at 18% 20%, rgba(255,255,255,.72), transparent 24%), radial-gradient(circle at 78% 72%, rgba(214,120,104,.22), transparent 28%), linear-gradient(145deg, rgba(255,223,214,.74), rgba(255,247,239,.34))', size: 'cover' },
  { id: 'stars', name: 'Starlight', background: 'radial-gradient(circle at 20% 18%, rgba(255,255,255,.75) 0 1px, transparent 1.8px), radial-gradient(circle at 72% 38%, rgba(255,255,255,.5) 0 1.5px, transparent 2px), radial-gradient(circle at 42% 78%, rgba(255,143,163,.55) 0 1px, transparent 2px)', size: '48px 48px' },
  { id: 'petals', name: 'Lavender Petals', background: 'radial-gradient(ellipse at 25% 28%, rgba(143,120,184,.2) 0 7px, transparent 8px), radial-gradient(ellipse at 75% 68%, rgba(255,255,255,.7) 0 8px, transparent 9px)', size: '52px 52px' },
  { id: 'waves', name: 'Calm Waves', background: 'repeating-radial-gradient(ellipse at 0 100%, transparent 0 17px, rgba(57,125,131,.14) 18px 20px, transparent 21px 35px)', size: '70px 48px' },
  { id: 'minimal', name: 'Rose Cloud', background: 'radial-gradient(circle at 20% 25%, rgba(255,255,255,.82), transparent 26%), linear-gradient(145deg, rgba(255,205,210,.68), rgba(255,245,241,.42))', size: 'cover' },
  { id: 'night', name: 'Night Sky', background: 'radial-gradient(circle at 22% 18%, rgba(255,255,255,.8) 0 1px, transparent 1.7px), radial-gradient(circle at 70% 46%, rgba(255,255,255,.55) 0 1.2px, transparent 1.9px), linear-gradient(155deg, rgba(22,25,48,.88), rgba(64,39,65,.72))', size: '54px 54px, 68px 68px, cover' }
];

type ThemeName = keyof typeof THEMES;

const CUSTOMIZE_PRESETS: Array<{ id: string; name: string; note: string; theme: ThemeName; wallpaper: string }> = [
  { id: 'only-us', name: 'Only Us', note: 'Our signature pink', theme: 'romantic', wallpaper: 'hearts' },
  { id: 'soft-bloom', name: 'Soft Bloom', note: 'Warm and dreamy', theme: 'sunset', wallpaper: 'blush' },
  { id: 'moonlight', name: 'Moonlight', note: 'Quiet after dark', theme: 'dark', wallpaper: 'stars' },
  { id: 'lavender-haze', name: 'Lavender Haze', note: 'Soft violet petals', theme: 'lavender', wallpaper: 'petals' },
  { id: 'ocean-eyes', name: 'Ocean Eyes', note: 'Cool and calm', theme: 'ocean', wallpaper: 'waves' },
  { id: 'clean-slate', name: 'Clean Slate', note: 'Simple and bright', theme: 'light', wallpaper: 'none' }
];

const applyTheme = (themeName: ThemeName) => {
  const theme = THEMES[themeName] || THEMES.romantic;
  const root = document.documentElement;
  root.style.setProperty('--theme-bg', theme.bg);
  root.style.setProperty('--theme-text', theme.text);
  root.style.setProperty('--theme-header-bg', theme.header);
  root.style.setProperty('--theme-bubble-owner', theme.owner);
  root.style.setProperty('--theme-bubble-owner-text', theme.ownerText);
  root.style.setProperty('--theme-bubble-partner', theme.partner);
  root.style.setProperty('--theme-bubble-partner-text', theme.partnerText);
  root.style.setProperty('--theme-input-bg', theme.input);
};

const getTheme = (themeName?: string) => THEMES[themeName as ThemeName] || THEMES.romantic;

const getMillis = (ts: any) => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') return new Date(ts).getTime();
  return 0;
};

const OWNER_EMAIL = "bodruddoja4@gmail.com";

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
  const [messages, setMessages] = useState<Message[]>(() => {
    const cached = localStorage.getItem('cached_msgs');
    return cached ? JSON.parse(cached) : [];
  });
  const [messagesLoading, setMessagesLoading] = useState(messages.length === 0);
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
  const [activeGame, setActiveGame] = useState<{ id: string, type: 'tictactoe' } | null>(null);
  const [socketTypingUsers, setSocketTypingUsers] = useState<string[]>([]);
  const [socketOnlineUsers, setSocketOnlineUsers] = useState<string[]>([]);
  const [socketOnlineRoles, setSocketOnlineRoles] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTabActive, setIsTabActive] = useState(true);
  const [activeNudge, setActiveNudge] = useState<{ type: string, sender: string } | null>(null);
  const [activeHubTab, setActiveHubTab] = useState<'dashboard' | 'chat' | 'instagram' | 'whatsapp'>('dashboard');
  const mainChannelRef = useRef<any>(null);

  // Periodic 10s tick to keep relative "Last seen" and online indicators accurate in realtime
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => setTimeTick(t => t + 1), 10000);
    return () => clearInterval(tickInterval);
  }, []);

  const handleHubTabChange = (tab: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => {
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
        setActiveHubTab(tab);
      };
      window.getCurrentHubTab = () => {
        return activeHubTab;
      };
      window.handleAndroidBack = () => {
        if (activeHubTab === 'chat') {
          setActiveHubTab('dashboard');
          return true; // handled, don't exit app
        }
        return false; // on dashboard, allow Android to minimize/exit
      };
    }
  }, [activeHubTab]);

  useEffect(() => {
    if (messages.length > 0) {
      // Keep only last 100 for cache
      const toCache = messages.slice(-100);
      localStorage.setItem('cached_msgs', JSON.stringify(toCache));
    }
  }, [messages]);

  // Lifecycle 0: Real-time Messages Sync from Supabase (Immediate upon Auth)
  useEffect(() => {
    if (!user) return;
    setMessagesLoading(true);

    const fetchMessages = async () => {
      const { data, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (msgErr) {
        console.error("Error loading messages from Supabase:", msgErr);
      } else if (data) {
        // Filter out any previous test feeling messages so the chat is spotless
        const filteredData = data.filter((m: any) => 
          !m.text?.includes('Sent you a') && 
          !m.text?.includes('Tickled you') && 
          !m.text?.includes('Miss you so much')
        );

        const msgMap = new Map<string, any>();
        filteredData.forEach((m: any) => msgMap.set(m.id, m));

        const mappedData = filteredData.map((m: any) => {
          let replyToObj = null;
          if (m.reply_to) {
            const orig = msgMap.get(m.reply_to);
            if (orig) {
              replyToObj = {
                id: orig.id,
                text: orig.deleted 
                  ? (orig.deletedBy === orig.sender_role ? 'You deleted this message' : 'This message was deleted') 
                  : orig.text,
                sender_role: orig.sender_role
              };
            } else {
              replyToObj = {
                id: m.reply_to,
                text: m.reply_text || 'Original message',
                sender_role: m.reply_sender_role || (m.sender_role === 'owner' ? 'partner' : 'owner')
              };
            }
          }
          return {
            ...m,
            timestamp: m.created_at || m.timestamp || new Date().toISOString(),
            replyTo: replyToObj
          };
        });
        setMessages(mappedData as Message[]);
        localStorage.setItem('cached_msgs', JSON.stringify(mappedData));

        // Clean up database records of feeling messages in the background
        supabase.from('messages').delete().ilike('text', '%Sent you a%').then();
        supabase.from('messages').delete().ilike('text', '%Tickled you%').then();
        supabase.from('messages').delete().ilike('text', '%Miss you so much%').then();
      }
      setMessagesLoading(false);
    };

    fetchMessages();

    const unsubMsg = supabase.channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const raw = payload.new;

          // Ignore any feeling texts if inserted by mistake
          if (raw.text?.includes('Sent you a') || raw.text?.includes('Tickled you') || raw.text?.includes('Miss you so much')) {
            return;
          }

          setMessages(prev => {
            let replyToObj = null;
            if (raw.reply_to) {
              const orig = prev.find(m => m.id === raw.reply_to);
              if (orig) {
                replyToObj = {
                  id: orig.id,
                  text: orig.deleted 
                    ? (orig.deletedBy === orig.sender_role ? 'You deleted this message' : 'This message was deleted') 
                    : orig.text,
                  sender_role: orig.sender_role
                };
              } else {
                replyToObj = {
                  id: raw.reply_to,
                  text: raw.reply_text || 'Original message',
                  sender_role: raw.reply_sender_role || (raw.sender_role === 'owner' ? 'partner' : 'owner')
                };
              }
            }

            const msg = {
              ...raw,
              timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
              replyTo: replyToObj
            } as Message;

            const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.text === msg.text && m.sender_role === msg.sender_role));
            const isDuplicate = filtered.some(m => m.id === msg.id);
            if (isDuplicate) return filtered;
            return [...filtered, msg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const raw = payload.new;
          setMessages(prev => {
            let replyToObj = null;
            if (raw.reply_to) {
              const orig = prev.find(m => m.id === raw.reply_to);
              if (orig) {
                replyToObj = {
                  id: orig.id,
                  text: orig.deleted 
                    ? (orig.deletedBy === orig.sender_role ? 'You deleted this message' : 'This message was deleted') 
                    : orig.text,
                  sender_role: orig.sender_role
                };
              } else {
                replyToObj = {
                  id: raw.reply_to,
                  text: raw.reply_text || 'Original message',
                  sender_role: raw.reply_sender_role || (raw.sender_role === 'owner' ? 'partner' : 'owner')
                };
              }
            }

            const msg = {
              ...raw,
              timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
              replyTo: replyToObj
            } as Message;

            return prev.map(m => m.id === msg.id ? { ...m, ...msg } : m);
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(unsubMsg); };
  }, [user?.id]);

  const sendGameInvite = async (type: 'tictactoe' = 'tictactoe') => {
    if (!userProfile) return;
    const sessionId = Math.random().toString(36).substring(7);
    const senderName = userProfile.role === 'owner' ? 'Rahul' : 'Nusrat';
    
    try {
      await supabase.from('messages').insert([{ 
        sender_role: userProfile.role,
        text: `🎮 ${senderName} invited you to play Tic Tac Toe`,
        created_at: new Date().toISOString(), 
        reactions: {},
        gameInvite: {
          gameType: 'tictactoe',
          sessionId: sessionId,
          status: 'pending'
        }
       }]);
      setShowGamesMenu(false);
      setActiveGame({ id: sessionId, type: 'tictactoe' });
    } catch (err) {
      console.error("Error sending game invite:", err);
    }
  };

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
            wallpaper: 'none',
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

  // Helper: Verify if partner's cached passcode is still valid against current app_config
  const verifyPasscodeSession = useCallback((config: AppConfig) => {
    const isPartnerSession = localStorage.getItem('onlyus_partner_session');
    const storedPasscode = localStorage.getItem('onlyus_partner_passcode');
    const serverPasscode = (config.partner_passcode || '123456').trim();

    if (isPartnerSession && storedPasscode) {
      if (storedPasscode.trim() !== serverPasscode) {
        console.warn("Passcode changed by Rahul. Logging partner out immediately.");
        localStorage.removeItem('onlyus_partner_session');
        localStorage.removeItem('onlyus_partner_passcode');
        setUser(null);
        setUserProfile(null);
        setPartnerProfile(null);
        setIsPartner(false);
        setIsOwner(false);
        setSocketOnlineUsers([]);
        setError("Rahul updated the login passcode. Please enter the new 6-digit PIN to reconnect.");
        return false;
      }
    }
    return true;
  }, []);

  // Lifecycle 1b: Core Config Sync (Gated by Auth)
  useEffect(() => {
    if (!user) return;
    
    const fetchConfig = async () => {
      const { data } = await supabase.from('app_config').select('*').eq('id', 'main').single();
      if (data) {
        setAppConfig(data as AppConfig);
        verifyPasscodeSession(data as AppConfig);
      } else if (user?.email === OWNER_EMAIL) {
        await supabase.from('app_config').insert([{ id: 'main', owner_email: OWNER_EMAIL, partner_allowed_emails: [], partner_passcode: '123456' }]);
        setAppConfig({ owner_email: OWNER_EMAIL, partner_allowed_emails: [], partner_passcode: '123456' } as AppConfig);
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

    // Fast periodic check (every 5 seconds) to ensure instant logout if config changes
    const pollInterval = setInterval(fetchConfig, 5000);

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
    supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then();

    const fetchProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) {
        const profile = { ...data, uid: user.id } as UserProfile;
        setUserProfile(profile);
        if (profile.theme) applyTheme(profile.theme as ThemeName);
      } else {
        const newProfile = {
          id: user.id,
          email: (email || "").trim().toLowerCase(),
          role,
          display_name: user?.user_metadata?.full_name || (role === 'owner' ? 'Rahul' : 'Nusrat'),
          photo_url: user?.user_metadata?.avatar_url || "",
          last_seen: new Date().toISOString(),
          last_read_at: new Date().toISOString(),
          theme: 'romantic',
          wallpaper: 'none'
        };
        await supabase.from('users').upsert([newProfile]);
        setUserProfile({ ...newProfile, uid: user.id } as any);
        applyTheme('romantic');
      }
      setLoading(false);
    };
    fetchProfile();

    const fetchPartner = async () => {
      // Sort by last_seen descending to always pick partner's most recently active profile
      const targetRole = role === 'owner' ? 'partner' : 'owner';
      const { data } = await supabase.from('users')
        .select('*')
        .eq('role', targetRole)
        .order('last_seen', { ascending: false });

      if (data && data.length > 0) {
        setPartnerProfile({ ...data[0], uid: data[0].id } as UserProfile);
      } else if (role === 'owner') {
        // Fallback for partner profile if not loaded
        setPartnerProfile({
          id: '625ede11-c534-4475-be39-63554fdbb7a7',
          uid: '625ede11-c534-4475-be39-63554fdbb7a7',
          email: 'bodruddoja2@gmail.com',
          role: 'partner',
          display_name: 'Nusrat',
          photo_url: '',
          theme: 'romantic',
          wallpaper: 'none',
          last_seen: new Date().toISOString(),
          last_read_at: new Date().toISOString()
        });
      }
    };
    fetchPartner();

    // Periodic DB last_seen heartbeat every 15s ONLY while tab is active and visible
    const heartbeatInterval = setInterval(() => {
      if (user?.id && !document.hidden && document.visibilityState === 'visible') {
        supabase.from('users').update({ 
          last_seen: new Date().toISOString() 
        }).eq('id', user.id).then();
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
      await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { redirectTo: `${window.location.origin}/chat` } 
      });
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Your current domain (${window.location.hostname}) is not authorized in Supabase. Please add this domain to Supabase Auth URL configuration.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Silent
      } else {
        setError(`Login error: ${err.message}`);
      }
    }
  };

  const handlePasscodeLogin = async (code: string): Promise<boolean> => {
    setError(null);
    try {
      const { data, error: cfgErr } = await supabase.from('app_config').select('*').eq('id', 'main').single();
      if (cfgErr && cfgErr.code !== 'PGRST116') {
        console.warn("Config query notice:", cfgErr);
      }
      const validPasscode = (data?.partner_passcode || appConfig?.partner_passcode || '123456').trim();
      
      if (code.trim() === validPasscode) {
        const partnerUser = {
          id: '625ede11-c534-4475-be39-63554fdbb7a7',
          email: 'bodruddoja2@gmail.com',
          isPartnerPasscode: true,
          user_metadata: { full_name: 'Nusrat' }
        };
        localStorage.setItem('onlyus_partner_session', JSON.stringify(partnerUser));
        localStorage.setItem('onlyus_partner_passcode', code.trim());
        setUser(partnerUser);
        setUserProfile({
          id: partnerUser.id,
          uid: partnerUser.id,
          email: partnerUser.email,
          role: 'partner',
          display_name: 'Nusrat',
          photo_url: '',
          theme: 'romantic',
          wallpaper: 'none',
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
        setError("Invalid 6-digit passcode. Please check with Rahul for the active PIN.");
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

  const applyCustomizePreset = async (theme: ThemeName, wallpaper: string) => {
    applyTheme(theme);
    await updateSettings({ theme, wallpaper });
  };

  const getWallpaper = () => {
    if (!userProfile?.wallpaper || userProfile.wallpaper === 'none') return null;
    return WALLPAPERS.find(w => w.id === userProfile.wallpaper) || null;
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
    }
  };

  const startEditFromSelection = () => {
    if (selectedMessages.length === 1 && selectedMessages[0].sender_role === userProfile?.role) {
      setEditingMessage(selectedMessages[0]);
      setReplyingTo(null);
      clearSelection();
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
              ? { ...m, deleted: true, deletedBy: userProfile?.role, text: "", reactions: {} }
              : m
          );
          localStorage.setItem('cached_msgs', JSON.stringify(updated.slice(-100)));
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
                deleted: true,
                deletedBy: userProfile?.role,
                reactions: {}
              }).in('id', chunk);
              
              if (updateError) throw updateError;
            })
          );
        }
      } else {
        // Delete for Me (Persist in Database)
        const visibilityField = userProfile?.role === 'owner' ? 'hidden_for_owner' : 'hidden_for_partner';
        
        // Optimistic UI update: hide locally immediately
        setMessages(prev => {
          const updated = prev.map(m => 
            messagesToProcess.some(sm => sm.id === m.id) 
              ? { ...m, [visibilityField]: true } 
              : m
          );
          localStorage.setItem('cached_msgs', JSON.stringify(updated.slice(-100)));
          return updated;
        });

        const idsToUpdate = messagesToProcess
          .map(m => m.id)
          .filter(id => !id.startsWith('temp-'));

        if (idsToUpdate.length > 0) {
          // Batch in chunks of 50 in parallel for instant, bulletproof persistence
          const chunkSize = 50;
          const chunks: string[][] = [];
          for (let i = 0; i < idsToUpdate.length; i += chunkSize) {
            chunks.push(idsToUpdate.slice(i, i + chunkSize));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF8FA3] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-sans text-sm text-[#FF8FA3] font-medium animate-pulse">Initializing OnlyUs...</p>
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
    <div className="flex h-[100dvh] bg-[var(--theme-bg)] text-[var(--theme-text)] font-sans overflow-hidden relative transition-colors duration-300">
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
          <div className="h-20 lg:h-24 flex-shrink-0 relative w-full z-50 bg-[var(--theme-bg)] shadow-sm border-b border-[#FF8FA3]/10 transition-colors duration-300">
            <AnimatePresence mode="wait">
              {selectedMessages.length > 0 ? (
                <motion.header 
                  key="selection-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 px-5 lg:px-8 flex items-center justify-between bg-[#FF8FA3] text-white z-30"
                >
                  <div className="flex items-center gap-6 lg:gap-8">
                    <button onClick={clearSelection} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors active:scale-95 text-white">
                      <X className="w-5 h-5 lg:w-6 lg:h-6" />
                    </button>
                    <span className="text-lg lg:text-xl font-bold tracking-tight">{selectedMessages.length}</span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-4">
                    {selectedMessages.length === 1 && (
                      <>
                        <button onClick={startReplyFromSelection} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Reply">
                          <Reply className="w-5 h-5" />
                        </button>
                        {selectedMessages[0].sender_role === userProfile?.role && !selectedMessages[0].deleted && (
                          <button onClick={startEditFromSelection} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Edit">
                            <Pencil className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                    {selectedMessages.length < messages.length && (
                      <button onClick={selectAllMessages} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Select All">
                        <ListChecks className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={() => setShowDeleteChoices(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    {selectedMessages.every(m => !m.deleted) && (
                      <button onClick={copySelected} className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95" title="Copy">
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
                  className="absolute inset-0 px-4 lg:px-6 flex items-center justify-between bg-[var(--theme-header-bg)] text-[var(--theme-text)] backdrop-blur-md z-20 transition-colors duration-300"
                >
                  <div className="flex items-center flex-1 min-w-0 pr-4 h-full">
                    {/* Back to Multi-Hub button */}
                    <button
                      onClick={() => handleHubTabChange('dashboard')}
                      className="p-2 -ml-1 mr-2 text-[#FF4D6D] bg-[#FFF0F3] hover:bg-[#FFCCD5]/50 border border-[#FF8FA3]/25 rounded-2xl transition-all flex items-center gap-1 active:scale-95 shrink-0 shadow-sm"
                      title="Back to OnlyUs Hub"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0" onClick={() => setShowPartnerInfo(true)}>
                      <div className="relative" onClick={(e) => { e.stopPropagation(); if(partnerProfile?.photo_url) setShowFullImage(partnerProfile.photo_url); }}>
                        {partnerProfile?.photo_url ? (
                          <img 
                            src={partnerProfile.photo_url} 
                            alt="Partner" 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 lg:w-11 lg:h-11 rounded-full object-cover border border-[#FF8FA3]/20 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-[#FFD6C9]/40 flex items-center justify-center border border-[#FF8FA3]/10 text-[#FF8FA3] font-bold text-lg">
                            {partnerProfile?.display_name?.[0] || (isOwner ? 'N' : 'R')}
                          </div>
                        )}
                        {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online' && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4ade80] border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <h2 className="text-[15px] lg:text-[16px] font-bold text-[#1a1a1a] truncate leading-tight">
                          {userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul')}
                        </h2>
                        <p className={`text-[10px] lg:text-[11px] font-bold leading-none mt-0.5 ${formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid) === 'Online' ? 'text-green-500' : 'text-[#6E6E6E]/60'}`}>
                          {formatLastSeen(partnerProfile?.last_seen, partnerProfile?.uid)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div 
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-100 mr-1 cursor-help" 
                      title={`${isSocketConnected ? 'Connected' : 'Offline'} | ${socketOnlineUsers.length} in room | Partner: ${partnerProfile?.uid || 'Unknown'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      {isSocketConnected ? <Wifi className="w-3 h-3 text-green-600" /> : <WifiOff className="w-3 h-3 text-gray-400" />}
                    </div>

                    <div className="relative">
                      <button 
                        ref={menuBtnRef}
                        onClick={() => setShowMenu(!showMenu)}
                        className={`p-2 rounded-full transition-all ${showMenu ? 'bg-[#FF8FA3]/10 text-[#FF8FA3]' : 'text-[#6E6E6E]/40 hover:text-[#FF8FA3]'}`}
                      >
                        <MoreVertical className="w-5 h-5 lg:w-6 lg:h-6" />
                      </button>
                      
                      <AnimatePresence>
                        {showMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <motion.div 
                              ref={menuRef}
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] border border-black/5 z-50 overflow-hidden py-1"
                            >
                              <button 
                                onClick={() => { setShowProfileModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <UserIcon className="w-4 h-4 text-[#FF8FA3]" />
                                My Profile
                              </button>
                              <button 
                                onClick={() => { setShowCustomizeModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <Sparkles className="w-4 h-4 text-[#FF8FA3]" />
                                Customize
                              </button>
                              <button 
                                onClick={() => { setShowGamesMenu(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <Gamepad2 className="w-4 h-4 text-[#FF8FA3]" />
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

          <div className="flex-1 overflow-hidden relative">
            {getWallpaper() && (
              <div 
                className="absolute inset-0 z-0 opacity-80 pointer-events-none transition-all duration-500"
                style={{ 
                  backgroundImage: getWallpaper()?.background,
                  backgroundSize: getWallpaper()?.size || 'cover',
                  backgroundPosition: 'center'
                }}
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
                isOverlayOpen={showProfileModal || showPartnerInfo || !!showFullImage || showDeleteChoices || showAttachmentMenu || showGamesMenu || !!activeGame}
                showAttachmentMenu={showAttachmentMenu}
                onSetShowAttachmentMenu={setShowAttachmentMenu}
                showGamesMenu={showGamesMenu}
                onSetShowGamesMenu={setShowGamesMenu}
                activeGame={activeGame}
                onSetActiveGame={setActiveGame}
                onSendGameInvite={sendGameInvite}
                socketTypingUsers={socketTypingUsers}
                chatRoomId={chatRoomId}
                quotaExceeded={quotaExceeded}
                setQuotaExceeded={setQuotaExceeded}
                inputText={inputText}
                onInputTextChange={setInputText}
                isTabActive={isTabActive}
                onBroadcastTyping={broadcastTyping}
                onSendNudge={sendNudge}
                showNudgeMenu={showNudgeMenu}
                onSetShowNudgeMenu={setShowNudgeMenu}
              />
            </div>
          </div>
        </main>
      )}

      <AnimatePresence>
        {activeNudge && (
          <NudgeOverlay nudge={activeNudge} onDismiss={() => setActiveNudge(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileModal && userProfile && (
          <ProfileModal 
            profile={userProfile} 
            partnerProfile={partnerProfile}
            onClose={() => setShowProfileModal(false)}
            config={appConfig}
            isOwner={isOwner}
            onLogout={handleLogout}
            onPartnerUpdated={(newPartner) => setPartnerProfile(newPartner)}
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
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullImage && (
          <FullImageViewer url={showFullImage} onClose={() => setShowFullImage(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomizeModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#171218]/55 backdrop-blur-sm" onClick={() => setShowCustomizeModal(false)}>
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="customize-sheet w-full max-w-lg max-h-[88dvh] overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-[#FFFCFA] shadow-[0_24px_80px_rgba(28,18,24,.3)]"
            >
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#2D2028]/8">
                <div>
                  <div className="flex items-center gap-2 text-[#A95770]">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Chat look</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#251B20]">Customize</h3>
                  <p className="mt-1 text-xs text-[#75646D]">Choose a complete mood or mix your own.</p>
                </div>
                <button onClick={() => setShowCustomizeModal(false)} className="p-2.5 rounded-full bg-[#F4ECEF] text-[#6D5661] hover:bg-[#EEDFE5] transition-colors" aria-label="Close customize">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="custom-scrollbar overflow-y-auto max-h-[calc(88dvh-108px)] px-5 py-5 space-y-7">
                <section>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#2A2025]">Premade themes</h4>
                      <p className="text-[11px] text-[#8A747E]">Changes colors and wallpaper together</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {CUSTOMIZE_PRESETS.map((preset) => {
                      const presetTheme = THEMES[preset.theme];
                      const presetWallpaper = WALLPAPERS.find(item => item.id === preset.wallpaper);
                      const isActive = userProfile?.theme === preset.theme && userProfile?.wallpaper === preset.wallpaper;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => applyCustomizePreset(preset.theme, preset.wallpaper)}
                          className={`text-left rounded-[1.35rem] p-2 border-2 transition-all active:scale-[0.98] ${isActive ? 'border-[#B85F78] shadow-[0_8px_24px_rgba(184,95,120,.16)]' : 'border-transparent bg-[#F5EEF0] hover:border-[#DDBBC6]'}`}
                        >
                          <div className="relative h-24 rounded-[1rem] overflow-hidden" style={{ backgroundColor: presetTheme.bg, backgroundImage: presetWallpaper?.background, backgroundSize: presetWallpaper?.size || 'cover' }}>
                            <div className="absolute left-3 bottom-3 w-[58%] h-5 rounded-[12px_12px_12px_3px] shadow-sm" style={{ backgroundColor: presetTheme.partner }} />
                            <div className="absolute right-3 bottom-10 w-[48%] h-5 rounded-[12px_12px_3px_12px] shadow-sm" style={{ backgroundColor: presetTheme.owner }} />
                            {isActive && <span className="absolute top-2 right-2 grid place-items-center w-6 h-6 rounded-full bg-[#B85F78] text-white shadow"><Check className="w-3.5 h-3.5" /></span>}
                          </div>
                          <div className="px-1.5 pt-2 pb-1">
                            <p className="text-xs font-bold text-[#30242A]">{preset.name}</p>
                            <p className="text-[10px] text-[#8A747E]">{preset.note}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-[#2A2025]">Color style</h4>
                  <p className="mb-3 text-[11px] text-[#8A747E]">Keep your wallpaper and change the chat colors</p>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {(Object.keys(THEMES) as ThemeName[]).map((themeName) => (
                      <button key={themeName} onClick={() => updateSettings({ theme: themeName })} className="flex-shrink-0 text-center group">
                        <span className={`relative block w-14 h-14 rounded-full border-[3px] p-1 transition-transform group-active:scale-95 ${userProfile?.theme === themeName ? 'border-[#B85F78]' : 'border-transparent'}`}>
                          <span className="block w-full h-full rounded-full overflow-hidden shadow-sm" style={{ backgroundColor: THEMES[themeName].bg }}>
                            <span className="block w-full h-1/2" style={{ backgroundColor: THEMES[themeName].owner }} />
                            <span className="block ml-auto w-1/2 h-1/2" style={{ backgroundColor: THEMES[themeName].partner }} />
                          </span>
                        </span>
                        <span className="block mt-1.5 text-[10px] font-semibold capitalize text-[#6F5B65]">{themeName}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-[#2A2025]">Wallpaper</h4>
                  <p className="mb-3 text-[11px] text-[#8A747E]">Keep your colors and change the background</p>
                  <div className="grid grid-cols-4 gap-3">
                    {WALLPAPERS.map((wallpaper) => (
                      <button key={wallpaper.id} onClick={() => updateSettings({ wallpaper: wallpaper.id })} className="group text-center">
                        <span
                          className={`relative block aspect-square rounded-[1rem] border-2 overflow-hidden transition-transform group-active:scale-95 ${userProfile?.wallpaper === wallpaper.id ? 'border-[#B85F78]' : 'border-[#E9DDE1]'}`}
                          style={{ backgroundColor: getTheme(userProfile?.theme).bg, backgroundImage: wallpaper.background, backgroundSize: wallpaper.size || 'cover' }}
                        >
                          {wallpaper.id === 'none' && <span className="absolute inset-0 grid place-items-center"><X className="w-5 h-5 text-[#AA96A0]" /></span>}
                          {userProfile?.wallpaper === wallpaper.id && <span className="absolute top-1.5 right-1.5 grid place-items-center w-5 h-5 rounded-full bg-[#B85F78] text-white"><Check className="w-3 h-3" /></span>}
                        </span>
                        <span className="block mt-1.5 text-[9px] font-semibold text-[#76626C] truncate">{wallpaper.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteChoices && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteChoices(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl space-y-3"
            >
              <h3 className="text-sm font-bold text-center text-[#FF8FA3] uppercase tracking-widest mb-4">Delete Message?</h3>
              
              <button 
                onClick={() => deleteSelected(false)}
                className="w-full py-4 text-sm font-bold text-red-400 hover:bg-red-50 rounded-2xl transition-colors"
              >
                Delete for me
              </button>
              
              {selectedMessages.length === 1 && selectedMessages.every(m => m.sender_role === userProfile?.role && !m.deleted) && (
                <button 
                  onClick={() => deleteSelected(true)}
                  className="w-full py-4 text-sm font-bold text-red-400 hover:bg-red-50 rounded-2xl transition-colors"
                >
                  Delete for everyone
                </button>
              )}
              
              <button 
                onClick={() => setShowDeleteChoices(false)}
                className="w-full py-4 text-sm font-bold text-[#6E6E6E] border border-[#FF8FA3]/10 rounded-2xl transition-colors active:bg-[#FFD6C9]/10"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginView({ 
  error, 
  onLogin, 
  onPasscodeLogin 
}: { 
  error: string | null; 
  onLogin: () => void; 
  onPasscodeLogin: (code: string) => Promise<boolean>; 
}) {
  const [loginMode, setLoginMode] = useState<'passcode' | 'google'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim().length !== 6) {
      setLocalError("Please enter a valid 6-digit code.");
      return;
    }
    setLocalError(null);
    setIsVerifying(true);
    try {
      const ok = await onPasscodeLogin(passcode.trim());
      if (!ok) {
        setLocalError("Invalid 6-digit code. Please verify with Rahul.");
      }
    } catch (err: any) {
      setLocalError(err.message || "Failed to verify passcode.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPasscode(cleaned);
    if (localError) setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div className="h-[100dvh] bg-[#FFF8F6] flex items-center justify-center p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/80 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(255,143,163,0.18)] border border-[#FF8FA3]/15 backdrop-blur-xl"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF8FA3] rounded-[1.8rem] mb-4 shadow-xl shadow-[#FF8FA3]/20">
            <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-[#1a1a1a]">OnlyUs</h2>
          <p className="text-[#6E6E6E] text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Handcrafted Romantic Space</p>
        </div>

        {/* Login Mode Selector */}
        <div className="flex bg-[#FFF0F3] p-1 rounded-2xl mb-6 border border-[#FF8FA3]/10">
          <button
            type="button"
            onClick={() => { setLoginMode('passcode'); setLocalError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'passcode'
                ? 'bg-white text-[#FF8FA3] shadow-sm'
                : 'text-[#6E6E6E]/60 hover:text-[#6E6E6E]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Passcode (PIN)</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('google'); setLocalError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'google'
                ? 'bg-white text-[#FF8FA3] shadow-sm'
                : 'text-[#6E6E6E]/60 hover:text-[#6E6E6E]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Google Login</span>
          </button>
        </div>

        {displayError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3.5 bg-red-50 text-red-500 text-[11px] font-medium leading-relaxed rounded-2xl flex items-start gap-2.5 border border-red-100/60"
          >
            <X className="w-4 h-4 mt-0.5 flex-shrink-0 cursor-pointer" onClick={() => setLocalError(null)} />
            <span>{displayError}</span>
          </motion.div>
        )}

        {loginMode === 'passcode' ? (
          <form onSubmit={handlePasscodeSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block text-center opacity-70">
                Enter 6-Digit Passcode
              </label>
              
              {/* PIN input display boxes */}
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={passcode}
                  onChange={(e) => handleDigitChange(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                  className="w-full h-14 tracking-[0.6em] text-center font-mono text-2xl font-bold bg-[#FFF8F6] border border-[#FF8FA3]/20 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/30 focus:border-[#FF8FA3] transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:opacity-30"
                />
              </div>
              <p className="text-center text-[10px] text-[#6E6E6E] mt-2 opacity-50 font-medium">
                Enter the active 6-digit access code
              </p>
            </div>

            <button
              type="submit"
              disabled={isVerifying || passcode.length !== 6}
              className="w-full h-14 flex items-center justify-center gap-3 bg-[#FF8FA3] hover:bg-[#FF8FA3]/90 text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#FF8FA3]/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Enter OnlyUs</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button 
              type="button"
              onClick={onLogin}
              className="w-full h-14 flex items-center justify-center gap-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-black/10 active:scale-[0.98]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4 invert brightness-0" alt="Google" />
              <span>Connect via Google</span>
            </button>
            <p className="text-center text-[10px] text-[#6E6E6E] opacity-50 font-medium">
              Secure authentication via Google account
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-1 h-1 rounded-full bg-[#FF8FA3]/30"></div>
          <p className="text-center text-[9px] font-bold text-[#6E6E6E] uppercase tracking-widest opacity-40">
            Private 1-to-1 Handcrafted Space
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function UnauthorizedView({ error, onLogout }: { error: string, onLogout: () => void }) {
  return (
    <div className="h-[100dvh] bg-[#FFF8F6] flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-[#FFD6C9] text-[#FF8FA3] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#1a1a1a]">Restricted Area</h2>
        <p className="text-[#6E6E6E] text-sm mb-6">{error}</p>
        <button 
          onClick={onLogout}
          className="text-[#FF8FA3] font-bold uppercase tracking-widest text-[10px] hover:underline"
        >
          Try another account
        </button>
      </div>
    </div>
  );
}

function QuotaBanner() {
  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 overflow-hidden"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
        Limit Reached: Operating in Real-time Mode Only (No history sync)
      </span>
    </motion.div>
  );
}

function ChatView({ 
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
  chatRoomId,
  quotaExceeded,
  setQuotaExceeded,
  inputText,
  onInputTextChange,
  isTabActive,
  onBroadcastTyping,
  onSendNudge,
  showNudgeMenu,
  onSetShowNudgeMenu
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
  activeGame: { id: string, type: 'tictactoe' } | null,
  onSetActiveGame: (game: { id: string, type: 'tictactoe' } | null) => void,
  onSendGameInvite: (type?: 'tictactoe') => Promise<void>,
  socketTypingUsers: string[],
  chatRoomId: string,
  quotaExceeded: boolean,
  setQuotaExceeded: (val: boolean) => void,
  inputText: string,
  onInputTextChange: (val: string) => void,
  isTabActive: boolean,
  onBroadcastTyping: (isTyping: boolean) => void,
  onSendNudge: (type: string) => void,
  showNudgeMenu: boolean,
  onSetShowNudgeMenu: (val: boolean) => void
}) {
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isTabActive && messages.length > 0 && userProfile) {
      const interval = setInterval(() => {
        if (isTabActive && userProfile) {
          supabase.from('users').update({ last_read_at: new Date().toISOString() }).eq('id', userProfile.uid);
        }
      }, 60000); 
      return () => clearInterval(interval);
    }
  }, [isTabActive, messages.length, userProfile?.uid]);

  useEffect(() => {
    if (editingMessage) {
      onInputTextChange(editingMessage.text);
    } else {
      onInputTextChange("");
    }
  }, [editingMessage, onInputTextChange]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    
    if (inputText.length > 0 && !editingMessage) {
      onBroadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onBroadcastTyping(false);
      }, 3000);
    } else {
      onBroadcastTyping(false);
    }
    
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText, userProfile?.uid, editingMessage, onBroadcastTyping]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    if (editingMessage) {
      try {
        await supabase.from('messages').update({
          text: inputText,
          isEdited: true
        }).eq('id', editingMessage.id);
        onSetEditingMessage(null);
        onInputTextChange("");
      } catch (err) {
        console.error("Edit error:", err);
      }
      return;
    }

    const text = inputText;
    const tempId = `temp-${Date.now()}`;
    onInputTextChange("");

    const msgData: any = {
      id: tempId,
      sender_role: role,
      text: text,
      timestamp: Date.now(),
      reactions: {},
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender_role: replyingTo.sender_role
      } : null
    };

    setMessages(prev => [...prev, msgData]);
    setTimeout(scrollToBottom, 50);

    try {
      const { error } = await supabase.from('messages').insert([{
        sender_role: role,
        text: text,
        created_at: new Date().toISOString(),
        reactions: {},
        reply_to: replyingTo ? replyingTo.id : null,
        attachment_url: null 
      }]).select().single();
      
      if (error) throw error;
      
      onSetReplyingTo(null);
    } catch (err: any) {
      console.error("Supabase insert error:", err);
    }
  };

  const sendGameInvite = onSendGameInvite;

  const [messageLimit, setMessageLimit] = useState(50);

  const visibleMessages = messages.filter(m => {
    if (role === 'owner') return !m.hidden_for_owner;
    return !m.hidden_for_partner;
  });

  const displayedMessages = visibleMessages.slice(-messageLimit);
  const hasMoreMessages = visibleMessages.length > messageLimit;

  useEffect(() => {
    setTimeout(scrollToBottom, 50);
  }, [displayedMessages.length]);

  const toggleReaction = async (msgId: string, emoji: string) => {
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
  };
  
  // Find the ID of the exact message the partner has last read (frontier)
  const lastSentByMe = [...visibleMessages].reverse().filter(m => m.sender_role === role);
  
  const partnerLastReadMillis = partnerProfile?.last_read_at ? getMillis(partnerProfile.last_read_at) : partnerLastReadAt;
  
  const seenFrontierId = lastSentByMe.find(m => {
    const msgTs = getMillis(m.timestamp);
    return msgTs > 0 && msgTs <= partnerLastReadMillis;
  })?.id;

  const lastSentMsgId = lastSentByMe[0]?.id;

  // Refined Interaction Logic: One indicator at a time
  const lastMsgByPartner = [...visibleMessages].reverse().find(m => m.sender_role !== role);
  const meLastMillis = lastSentByMe[0] ? getMillis(lastSentByMe[0].timestamp) : 0;
  const partnerLastMillis = lastMsgByPartner ? getMillis(lastMsgByPartner.timestamp) : 0;
  const partnerReadMillis = partnerLastReadMillis;

  let interactionId = null;
  let showIndicatorSeenText = false;

  if (partnerLastMillis >= partnerReadMillis && partnerLastMillis > 0) {
    // Partner just sent a message
    interactionId = lastMsgByPartner?.id;
    showIndicatorSeenText = false;
  } else if (meLastMillis > 0 && partnerReadMillis >= meLastMillis) {
    // Partner just read my latest message
    interactionId = lastSentByMe[0]?.id;
    showIndicatorSeenText = true;
  } else if (partnerReadMillis > 0) {
    // Partner is somewhere in the past reading my messages
    interactionId = seenFrontierId;
    showIndicatorSeenText = false;
  }

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
    <div className="flex flex-col h-full">
      <div 
        ref={scrollRef}
        id="message-container" 
        className="flex-1 overflow-y-auto space-y-4 pb-6 custom-scrollbar scroll-smooth px-3 lg:px-6"
      >
        {quotaExceeded && <QuotaBanner />}
        <div className="flex justify-center mb-10 pt-6">
          <span className="text-[9px] font-bold text-[#FF8FA3]/60 uppercase tracking-[0.4em] bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-[#FF8FA3]/10">Our Story Begins Here</span>
        </div>
        
        {hasMoreMessages && (
          <div className="flex justify-center mb-4">
            <button 
              onClick={() => setMessageLimit(prev => prev + 50)}
              className="text-xs font-semibold px-4 py-2 bg-white/70 hover:bg-white text-[#FF8FA3] rounded-full shadow-sm border border-[#FF8FA3]/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Load earlier messages ({visibleMessages.length - messageLimit} more)
            </button>
          </div>
        )}

        {messagesLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-6 h-6 border-2 border-gray-100 border-t-black rounded-full animate-spin"></div>
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
              allMessages={visibleMessages}
              onReact={toggleReaction} 
              isSelected={!!selectedMessages.find(m => m.id === msg.id)}
              selectionCount={selectedMessages.length}
              onToggleSelect={onToggleSelect}
              selectionActive={selectedMessages.length > 0}
              onReply={onSetReplyingTo}
              userProfile={userProfile}
              partnerProfile={partnerProfile}
              onViewImage={onViewImage}
              isInteractionPoint={msg.id === interactionId}
              showSeenText={msg.id === interactionId && showIndicatorSeenText}
              partnerLastReadAt={partnerLastReadMillis}
              onJoinGame={(game) => onSetActiveGame(game)}
              onTriggerNudge={onSendNudge}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {socketTypingUsers.includes(partnerProfile?.uid || '') && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="px-6 lg:px-10 py-1 flex items-center gap-2.5 text-[#FF8FA3] bg-gradient-to-t from-white/40 to-transparent"
          >
            <div className="flex gap-2 items-center bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-[#FF8FA3]/10 scale-95 origin-left">
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-2 h-2 bg-[#FF8FA3] rounded-full" />
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 h-2 bg-[#FF8FA3] rounded-full" />
              <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 h-2 bg-[#FF8FA3] rounded-full" />
            </div>
            <span className="text-[11px] font-bold italic tracking-wide opacity-80 animate-pulse">
              {role === 'owner' ? (userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || 'Nusrat') : 'Rahul'} is writing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-[#FF8FA3]/5 bg-white/20 backdrop-blur-md">
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 bg-[#FFD6C9]/30 rounded-t-2xl border-l-4 border-[#FF8FA3] flex items-center justify-between mb-1 mx-2"
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] font-bold text-[#FF8FA3] uppercase tracking-wider mb-0.5">
                  Replying to {replyingTo.sender_role === 'owner' ? 'Rahul' : 'Nusrat'}
                </p>
                <p className="text-xs text-[#6E6E6E] truncate italic opacity-80">"{replyingTo.text}"</p>
              </div>
              <button 
                onClick={() => onSetReplyingTo(null)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-[#6E6E6E]/40" />
              </button>
            </motion.div>
          )}
          {editingMessage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 bg-[#FF8FA3]/10 rounded-t-2xl border-l-4 border-[#FF8FA3] flex items-center justify-between mb-1 mx-2"
            >
              <div className="flex-1 min-w-0 pr-4 text-[#FF8FA3]">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Editing Private Message</p>
                <p className="text-xs truncate italic opacity-80">"{editingMessage.text}"</p>
              </div>
              <button 
                onClick={() => onSetEditingMessage(null)}
                className="p-1 hover:bg-[#FF8FA3]/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-[#FF8FA3]/40" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <form 
          onSubmit={sendMessage}
          className="relative flex items-center px-4 gap-3 pb-4"
        >
          <button 
            type="button"
            onClick={() => onSetShowAttachmentMenu(true)}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white border border-[#FF8FA3]/20 text-[#FF8FA3] rounded-full hover:bg-[#FF8FA3]/5 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="relative flex-1">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              placeholder={`Whisper to ${role === 'owner' ? 'Nusrat' : 'Rahul'}...`}
              className="w-full px-6 py-4 bg-[var(--theme-input-bg)] text-[var(--theme-text)] border border-[#FF8FA3]/10 rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-[#FF8FA3]/5 transition-all shadow-sm pr-12 placeholder-[#6E6E6E]/40"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
               <button 
                type="button"
                onClick={() => onSetShowNudgeMenu(true)}
                className="p-1 text-[#FF8FA3]/60 hover:text-[#FF8FA3] transition-colors active:scale-90"
              >
                <Heart className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center bg-[#FF8FA3] text-white rounded-full hover:bg-[#FF8FA3]/90 disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-[#FF8FA3]/30"
          >
            <Send className="w-4 h-4 lg:w-5 lg:h-5 fill-white" />
          </button>
        </form>
      </div>

      <BottomSheet 
        isOpen={showAttachmentMenu} 
        onClose={() => onSetShowAttachmentMenu(false)}
        title="Share with Love"
      >
        <div className="grid grid-cols-4 gap-4 p-4 lg:p-6">
          <AttachmentOption icon={<Camera className="w-6 h-6" />} label="Camera" color="bg-[#FF8FA3]" onClick={() => onSetShowAttachmentMenu(false)} />
          <AttachmentOption icon={<ImageIcon className="w-6 h-6" />} label="Gallery" color="bg-[#FFD6C9]" onClick={() => onSetShowAttachmentMenu(false)} />
          <AttachmentOption icon={<Music className="w-6 h-6" />} label="Audio" color="bg-[#E9D5FF]" onClick={() => onSetShowAttachmentMenu(false)} />
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={showNudgeMenu}
        onClose={() => onSetShowNudgeMenu(false)}
        title="Send a Feeling ✨"
      >
        <div className="grid grid-cols-4 gap-3 p-4 lg:p-6 pb-8">
          {[
            { id: 'hug', label: 'Hug', emoji: '🤗', bg: 'bg-amber-100/90 text-amber-600 hover:bg-amber-200/90' },
            { id: 'kiss', label: 'Kiss', emoji: '💋', bg: 'bg-rose-100/90 text-rose-600 hover:bg-rose-200/90' },
            { id: 'love', label: 'Love', emoji: '💖', bg: 'bg-pink-100/90 text-pink-600 hover:bg-pink-200/90' },
            { id: 'miss', label: 'Miss You', emoji: '🥺', bg: 'bg-blue-100/90 text-blue-600 hover:bg-blue-200/90' },
            { id: 'cuddle', label: 'Cuddle', emoji: '🫂', bg: 'bg-purple-100/90 text-purple-600 hover:bg-purple-200/90' },
            { id: 'tickle', label: 'Tickle', emoji: '😂', bg: 'bg-yellow-100/90 text-yellow-600 hover:bg-yellow-200/90' },
            { id: 'adore', label: 'Adore', emoji: '😍', bg: 'bg-red-100/90 text-red-600 hover:bg-red-200/90' },
            { id: 'blowkiss', label: 'Blow Kiss', emoji: '😘', bg: 'bg-pink-100/90 text-pink-500 hover:bg-pink-200/90' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onSendNudge(f.id);
                onSetShowNudgeMenu(false);
              }}
              className="flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-transform duration-200 group-hover:rotate-6 ${f.bg}`}>
                <span className="select-none leading-none">{f.emoji}</span>
              </div>
              <span className="text-[12px] font-bold text-[#1a1a1a]/80 tracking-tight text-center whitespace-nowrap">
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet 
        isOpen={showGamesMenu} 
        onClose={() => onSetShowGamesMenu(false)}
        title="Play Together"
      >
        <div className="p-4 space-y-3 pb-6">
          <GameCard 
            title="Tic Tac Toe"
            subtitle={`Play with ${role === 'owner' ? 'Nusrat' : 'Rahul'} 💖`}
            icon={<Gamepad2 className="w-5 h-5" />}
            color="bg-[#FF8FA3]"
            isActive={true}
            onClick={() => sendGameInvite('tictactoe')}
          />
        </div>
      </BottomSheet>

      {activeGame && activeGame.type === 'tictactoe' && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
            <div className="w-8 h-8 border-3 border-[#FF8FA3]/20 border-t-[#FF8FA3] rounded-full animate-spin" />
          </div>
        }>
          <TicTacToe 
            sessionId={activeGame.id} 
            role={role} 
            userProfile={userProfile}
            partnerProfile={partnerProfile}
            onClose={() => onSetActiveGame(null)} 
          />
        </Suspense>
      )}
    </div>
  );
}

function NudgeOverlay({ nudge, onDismiss }: { nudge: { type: string, sender: string }, onDismiss?: () => void }) {
  const configs: Record<string, { label: string, emoji: string, color: string, bg: string }> = {
    hug: { label: 'Virtual Hug', emoji: '🤗', color: 'text-amber-600', bg: 'bg-amber-400/20' },
    kiss: { label: 'Sweet Kiss', emoji: '💋', color: 'text-rose-600', bg: 'bg-rose-500/20' },
    love: { label: 'Love You', emoji: '💖', color: 'text-pink-600', bg: 'bg-pink-500/20' },
    miss: { label: 'Miss You', emoji: '🥺', color: 'text-blue-600', bg: 'bg-blue-500/20' },
    cuddle: { label: 'Warm Cuddle', emoji: '🫂', color: 'text-purple-600', bg: 'bg-purple-500/20' },
    tickle: { label: 'Tickle Attack!', emoji: '😂', color: 'text-yellow-600', bg: 'bg-yellow-500/20' },
    adore: { label: 'Adore You', emoji: '😍', color: 'text-red-600', bg: 'bg-red-500/20' },
    blowkiss: { label: 'Blow Kiss', emoji: '😘', color: 'text-pink-500', bg: 'bg-pink-400/20' },
  };

  const config = configs[nudge.type] || configs.hug;

  const particles = [
    { x: 130, y: -120, scale: 1.3, delay: 0 },
    { x: -140, y: -100, scale: 1.2, delay: 0.1 },
    { x: 150, y: 80, scale: 1.4, delay: 0.2 },
    { x: -120, y: 120, scale: 1.3, delay: 0.15 },
    { x: 0, y: -160, scale: 1.5, delay: 0.05 },
    { x: -20, y: 160, scale: 1.3, delay: 0.25 },
    { x: 90, y: 140, scale: 1.2, delay: 0.1 },
    { x: -100, y: -140, scale: 1.4, delay: 0.2 },
    { x: 170, y: -40, scale: 1.2, delay: 0.3 },
    { x: -160, y: 30, scale: 1.4, delay: 0.05 },
    { x: 80, y: -70, scale: 1.2, delay: 0.18 },
    { x: -70, y: 80, scale: 1.3, delay: 0.22 }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className={`fixed inset-0 z-[200] cursor-pointer flex items-center justify-center backdrop-blur-[6px] transition-colors duration-500 ${config.bg}`}
    >
      <div className="relative flex flex-col items-center">
        <motion.div
           initial={{ scale: 0, rotate: -20 }}
           animate={{ 
             scale: [0, 1.2, 1], 
             rotate: [20, -10, 0],
             y: [0, -15, 0]
           }}
           transition={{ duration: 0.8, ease: "easeOut" }}
           className="relative flex items-center justify-center"
        >
          {nudge.type === 'tickle' ? (
             <motion.div 
              animate={{ x: [-14, 14, -14], y: [-6, 6, -6], rotate: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 0.18 }}
             >
                <div className="text-[130px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
             </motion.div>
          ) : nudge.type === 'miss' ? (
            <motion.div 
              animate={{ opacity: [0.8, 1, 0.8], y: [0, -12, 0], scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
             >
                <div className="text-[130px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
             </motion.div>
          ) : nudge.type === 'kiss' || nudge.type === 'blowkiss' ? (
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              <div className="text-[130px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <div className="text-[130px] drop-shadow-2xl select-none leading-none">{config.emoji}</div>
            </motion.div>
          )}
          
          {/* Floating mini celebration items - all matching the feeling's emoji */}
          {particles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, p.scale, 0.5],
                x: p.x,
                y: p.y,
              }}
              transition={{ 
                duration: 2.2,
                repeat: Infinity,
                delay: p.delay
              }}
              className="absolute top-1/2 left-1/2 -ml-4 -mt-4 select-none pointer-events-none"
            >
              <div className="text-3xl lg:text-4xl">{config.emoji}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-white/95 backdrop-blur-md px-8 py-4 rounded-[2rem] shadow-2xl border border-pink-100/80 flex flex-col items-center gap-1"
        >
          <span className={`text-sm font-black uppercase tracking-[0.2em] ${config.color}`}>{config.label}</span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest opacity-70">From {nudge.sender} {config.emoji}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function GameCard({ title, subtitle, icon, color, isActive, onClick, label }: { title: string, subtitle: string, icon: React.ReactNode, color: string, isActive: boolean, onClick?: () => void, label?: string }) {
  return (
    <button 
      onClick={isActive ? onClick : undefined}
      disabled={!isActive}
      className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] border transition-all active:scale-[0.97] text-left group
        ${isActive 
          ? 'bg-white border-[#FF8FA3]/5 hover:border-[#FF8FA3]/20 shadow-[0_4px_12px_rgba(255,143,163,0.05)] hover:shadow-[0_8px_20px_rgba(255,143,163,0.1)]' 
          : 'bg-gray-50/50 border-gray-100 opacity-60 cursor-not-allowed filter grayscale'
        }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 flex-shrink-0 ${isActive ? color : 'bg-gray-200'} text-white rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className={`font-black uppercase tracking-tight text-[13px] ${isActive ? 'text-[#1a1a1a]' : 'text-gray-400'}`}>{title}</h4>
            {isActive && (
              <span className="text-[7px] bg-[#FF8FA3]/10 text-[#FF8FA3] px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap">
                {label || 'Available 🎮'}
              </span>
            )}
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isActive ? 'text-[#6E6E6E] opacity-40' : 'text-gray-300'}`}>{subtitle}</p>
        </div>
      </div>
      {isActive && (
        <ChevronRight className="w-5 h-5 text-[#FF8FA3] transition-all -translate-x-2 group-hover:translate-x-0 group-hover:drop-shadow-sm opacity-20 group-hover:opacity-100" />
      )}
    </button>
  );
}

function CelebrateIcon({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.63 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    </div>
  );
}


function AttachmentOption({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className={`w-14 h-14 ${color} text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all group-hover:shadow-[#FF8FA3]/10`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
    </button>
  );
}

function BottomSheet({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#FFF8F6] rounded-[2.5rem] overflow-hidden shadow-2xl pt-2 pb-6 lg:pb-8"
          >
            <div className="w-12 h-1 bg-[#6E6E6E]/10 rounded-full mx-auto my-3" />
            <div className="px-6 pb-2">
              <h3 className="text-sm font-black text-[#FF8FA3] uppercase tracking-[0.3em] text-center">{title}</h3>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const MessageItem = React.memo(function MessageItem({ 
  msg, 
  role, 
  allMessages,
  onReact, 
  isSelected, 
  selectionCount,
  onToggleSelect, 
  selectionActive,
  onReply,
  userProfile,
  partnerProfile,
  onViewImage,
  isInteractionPoint,
  showSeenText,
  partnerLastReadAt,
  onJoinGame,
  onTriggerNudge
}: { 
  msg: Message, 
  role: UserRole, 
  allMessages?: Message[],
  onReact: (id: string, emoji: string) => Promise<void>,
  isSelected: boolean,
  selectionCount: number,
  onToggleSelect: (msg: Message) => void,
  selectionActive: boolean,
  onReply: (msg: Message) => void,
  userProfile: UserProfile | null,
  partnerProfile: UserProfile | null,
  onViewImage: (url: string) => void,
  isInteractionPoint?: boolean,
  showSeenText?: boolean,
  partnerLastReadAt: number,
  onJoinGame?: (game: { id: string, type: 'tictactoe' }) => void,
  onTriggerNudge?: (type: string) => void,
  key?: React.Key
}) {
  const isOwn = msg.sender_role === role;
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredTimeRef = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  const emojis = ['❤️', '😂', '😮', '😢', '😡', '👍'];
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('top');
  const [isSwiping, setIsSwiping] = useState(false);

  const resolvedReplyTo = useMemo(() => {
    const replyId = msg.replyTo?.id || (msg as any).reply_to;
    if (!replyId && !msg.replyTo) return null;
    
    // Check if original message is in allMessages
    if (replyId && allMessages) {
      const original = allMessages.find(m => m.id === replyId);
      if (original) {
        return {
          id: original.id,
          text: original.deleted 
            ? (original.deletedBy === original.sender_role ? 'You deleted this message' : 'This message was deleted') 
            : original.text,
          sender_role: original.sender_role
        };
      }
    }
    
    if (msg.replyTo && msg.replyTo.text && msg.replyTo.text !== 'Replied Message') {
      return msg.replyTo;
    }
    
    return msg.replyTo || null;
  }, [msg.replyTo, (msg as any).reply_to, allMessages]);

  // Close picker on outside click release (pointerup) or scroll
  useEffect(() => {
    if (!showPicker) return;
    const handleOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node;
      // If clicking inside this message item, let handleClick or emoji buttons handle it
      if (itemRef.current && itemRef.current.contains(target)) {
        return;
      }
      setShowPicker(false);
    };
    window.addEventListener('scroll', () => setShowPicker(false), true);
    document.addEventListener('pointerup', handleOutside, true);
    return () => {
      window.removeEventListener('scroll', () => setShowPicker(false), true);
      document.removeEventListener('pointerup', handleOutside, true);
    };
  }, [showPicker]);

  const getSenderName = (r: UserRole) => {
    if (r === role) return 'You';
    // Check if we have a nickname for the partner
    if (userProfile?.partnerNicknames) {
      const keys = Object.keys(userProfile.partnerNicknames);
      if (keys.length > 0) return userProfile.partnerNicknames[keys[0]]; // Simple for 2-user chat
    }
    return r === 'owner' ? 'Rahul' : 'Nusrat';
  };

  const triggerLongPress = () => {
    if (isSwiping) return;
    const now = Date.now();
    // Guard against multiple triggers within 800ms
    if (now - longPressTriggeredTimeRef.current < 800) return;
    longPressTriggeredTimeRef.current = now;

    // Clear any text selection immediately to prevent browser native selection haptics
    if (typeof window !== 'undefined' && window.getSelection) {
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_) {}
    }

    // Dynamically choose top vs bottom picker position so it never gets cut off by the top bar
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      // If the message bubble is within 140px of the viewport top, show the picker below the bubble
      if (rect.top < 140) {
        setPickerPosition('bottom');
      } else {
        setPickerPosition('top');
      }
    }

    // Exactly one crisp WhatsApp-style haptic feedback pulse
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { 
        window.navigator.vibrate(30); 
      } catch (_) {}
    }

    if (!msg.deleted) setShowPicker(true);
    if (!isSelected) onToggleSelect(msg);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSwiping) return;
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    // If selection mode is already active, simple tap will toggle selection
    if (selectionActive) return;
    
    longPressTimer.current = setTimeout(() => {
      triggerLongPress();
    }, 360);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.clientX - touchStartPos.current.x);
    const dy = Math.abs(e.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    const now = Date.now();
    // If this click is just the finger release immediately after a long press, ignore so it stays selected & open
    if (now - longPressTriggeredTimeRef.current < 350) {
      return;
    }

    if (isSwiping) return;

    // Instantly close emoji picker AND toggle/deselect message together in one single click!
    if (showPicker) {
      setShowPicker(false);
    }

    if (selectionActive || isSelected) {
      onToggleSelect(msg);
    }
  };

  const swipeX = useMotionValue(0);
  const swipeOpacity = useTransform(swipeX, [0, 50], [0, 1]);

  const formatSeenTime = (timestamp: any) => {
    if (!timestamp) return "Seen";
    const date = timestamp.toDate ? timestamp.toDate() : (typeof timestamp === 'number' ? new Date(timestamp) : new Date());
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return "Seen just now";
    if (diff < 3600) return `Seen ${Math.floor(diff / 60)}m ago`;
    return `Seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const displayTime = () => {
    if (!msg.timestamp) return "";
    const date = msg.timestamp.toDate ? msg.timestamp.toDate() : (typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : new Date());
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      ref={itemRef}
      id={`msg-${msg.id}`}
      className={`relative w-full flex transition-all duration-200 select-none py-1.5 cursor-default rounded-2xl ${
        isSelected ? 'bg-[#FF8FA3]/20 backdrop-blur-[1px]' : 'hover:bg-romantic-pink/5'
      } ${isOwn ? 'justify-end' : 'justify-start'} ${showPicker ? 'z-[60]' : 'z-auto'}`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Absolute Reply Hint behind the message */}
      <motion.div 
        style={{ opacity: swipeOpacity, x: useTransform(swipeX, [0, 60], [-20, 0]) }}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-0"
      >
        <div className="p-2 bg-[#FF8FA3]/10 rounded-full">
          <CornerUpLeft className="w-5 h-5 text-[#FF8FA3]" />
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 100 }}
        dragSnapToOrigin
        dragElastic={0.1}
        dragMomentum={false}
        dragDirectionLock
        dragListener={!showPicker && !selectionActive}
        dragTransition={{ power: 0.1, timeConstant: 200 }}
        style={{ 
          x: swipeX,
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          touchAction: 'pan-y' // Prevent vertical scroll from fighting horizontal drag
        }}
        onDragStart={() => {
          setIsSwiping(true);
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onDragEnd={(e, info) => {
          setTimeout(() => setIsSwiping(false), 50);
          if (info.offset.x > 60) {
            onReply(msg);
            if (window.navigator.vibrate) window.navigator.vibrate(30);
          }
        }}
        className="relative w-full flex items-end px-2 lg:px-4 select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {!isOwn && (
          <div className="flex-shrink-0 mr-2 self-end mb-1 cursor-pointer active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); partnerProfile?.photo_url && onViewImage(partnerProfile.photo_url); }}>
            {partnerProfile?.photo_url ? (
              <img 
                src={partnerProfile.photo_url} 
                alt="P" 
                className="w-8 h-8 rounded-full object-cover border border-[#FF8FA3]/10 shadow-sm" 
                referrerPolicy="no-referrer" 
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitTouchCallout: 'none' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#FFD6C9]/40 flex items-center justify-center text-[#FF8FA3] font-bold text-xs border border-[#FF8FA3]/10">
                {partnerProfile?.display_name?.[0] || 'P'}
              </div>
            )}
          </div>
        )}
        
        <div className={`flex flex-col max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} z-10`}>
          <div className="relative group">
            <AnimatePresence>
              {showPicker && !isSwiping && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, y: pickerPosition === 'bottom' ? -10 : 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: pickerPosition === 'bottom' ? -10 : 10 }}
                  className={`absolute ${
                    pickerPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
                  } z-50 bg-white/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(255,143,163,0.18)] border border-[#FF8FA3]/15 p-1.5 rounded-full flex gap-1 w-max ${
                    isOwn ? 'right-0' : 'left-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {emojis.map(e => {
                    const isActive = msg.reactions?.[role] === e;
                    return (
                      <motion.button 
                        key={e}
                        whileTap={{ scale: 0.8 }}
                        onClick={(eClick) => {
                          eClick.stopPropagation();
                          onReact(msg.id, e);
                          setShowPicker(false);
                        }}
                        className={`w-10 h-10 flex items-center justify-center text-xl rounded-full transition-all relative ${
                          isActive ? 'bg-[#FF8FA3]/20 scale-110' : 'hover:bg-[#FF8FA3]/5'
                        }`}
                      >
                        {e}
                        {isActive && (
                          <motion.div layoutId="reaction-bg" className="absolute inset-0 bg-[#FF8FA3]/10 rounded-full -z-10" />
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              className={`px-3 py-2 lg:px-4 lg:py-2.5 text-[15px] lg:text-[16px] leading-relaxed shadow-sm relative transition-all select-none ${
                isOwn ? 'chat-bubble-owner' : 'chat-bubble-partner'
              }`}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {/* Show reply context */}
              {resolvedReplyTo && !msg.deleted && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`msg-${resolvedReplyTo.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('bg-[#FF8FA3]/25');
                      setTimeout(() => el.classList.remove('bg-[#FF8FA3]/25'), 1400);
                    }
                  }}
                  className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all select-none ${
                    isOwn ? 'bg-black/15 border-white text-white/95' : 'bg-[#FF8FA3]/10 border-[#FF8FA3] text-[#1a1a1a]/95'
                  }`}
                >
                  <p className="font-bold mb-0.5 opacity-75">
                     {getSenderName(resolvedReplyTo.sender_role)}
                  </p>
                  <p className="italic truncate line-clamp-1 opacity-90">"{resolvedReplyTo.text}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-x-2 gap-y-1 min-w-[60px] select-none">
                <span 
                  className={`whitespace-pre-wrap flex-1 break-words select-none ${msg.deleted ? 'italic opacity-60' : ''}`}
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                >
                  {msg.deleted ? (
                    msg.deletedBy === role ? 'You deleted this message' : 'This message was deleted'
                  ) : (
                    msg.text
                  )}
                  {msg.isEdited && !msg.deleted && (
                    <span className="text-[9px] opacity-40 ml-1 italic tracking-tight">(edited)</span>
                  )}
                </span>
                <div className={`flex items-center gap-1 opacity-50 text-[10px] ml-auto h-4 mb-[-2px] tracking-tight font-medium select-none`}>
                  <span>{displayTime()}</span>
                  {isOwn && !msg.deleted && <RotateCcw className="w-2.5 h-2.5" />}
                </div>
              </div>

            {msg.gameInvite && !msg.deleted && (
              <div className="mt-4 pt-4 border-t border-black/5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOwn ? 'bg-white text-[#FF8FA3]' : 'bg-[#FF8FA3] text-white'}`}>
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-[11px] font-bold ${isOwn ? 'text-white' : 'text-[#1a1a1a]'}`}>
                      Tic Tac Toe
                    </p>
                    <p className={`text-[9px] uppercase tracking-wider opacity-60 ${isOwn ? 'text-white' : 'text-[#6E6E6E]'}`}>Match Challenge</p>
                  </div>
                </div>
                <button 
                  onClick={() => onJoinGame?.({ id: msg.gameInvite!.sessionId, type: msg.gameInvite!.gameType })}
                  className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-sm ${
                    isOwn 
                      ? 'bg-white text-[#FF8FA3] hover:bg-white/90 shadow-white/20' 
                      : 'bg-[#FF8FA3] text-white hover:bg-[#FF8FA3]/90 shadow-[#FF8FA3]/20'
                  }`}
                >
                  Join Game
                </button>
              </div>
            )}
          </div>

          {/* Reactions display - Instagram Style */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className={`absolute -bottom-3 flex -space-x-1.5 ${isOwn ? 'right-2' : 'left-5'} z-20`}>
              {Object.entries(
                Object.values(msg.reactions).reduce((acc: any, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]: [string, any]) => {
                const userReacted = msg.reactions?.[role] === emoji;
                return (
                  <motion.div 
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key={emoji}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onReact(msg.id, emoji);
                    }}
                    className={`flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-white border shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:scale-110 transition-transform cursor-pointer text-[13px] ${
                      userReacted 
                        ? 'border-[#FF8FA3]/50 z-10' 
                        : 'border-gray-100 z-0'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 1 && <span className="ml-1 text-[10px] font-bold text-[#6E6E6E]">{count}</span>}
                  </motion.div>
                );
              })}
            </div>
          )}
          {/* Read Receipt Area - Dynamic interaction point */}
          {isInteractionPoint && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-1.5 flex items-center gap-1.5 opacity-50 select-none ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {partnerProfile?.photo_url ? (
                <img 
                  src={partnerProfile.photo_url} 
                  alt="S" 
                  className="w-3.5 h-3.5 rounded-full object-cover grayscale opacity-60 grayscale-[0.5]" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-3 h-3 rounded-full bg-gray-200" />
              )}
              {showSeenText && (
                <span className="text-[10px] font-bold tracking-tight text-[#6E6E6E]">
                  {partnerProfile?.last_read_at ? formatSeenTime(partnerProfile.last_read_at) : "Seen"}
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  </div>
  );
});

function HeartFloating({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute top-0 right-0 pointer-events-none overflow-visible w-0 h-0">
      <Heart className="w-4 h-4 text-[#FF8FA3] fill-[#FF8FA3] animate-float-heart" />
    </div>
  );
}

function ProfileModal({ 
  profile, 
  partnerProfile,
  onClose, 
  config, 
  isOwner, 
  onLogout,
  onPartnerUpdated
}: { 
  profile: UserProfile, 
  partnerProfile: UserProfile | null,
  onClose: () => void, 
  config: AppConfig | null, 
  isOwner: boolean, 
  onLogout: () => void,
  onPartnerUpdated?: (partner: UserProfile) => void
}) {
  const [activeTab, setActiveTab] = useState<'me' | 'partner' | 'access'>('me');
  
  // My profile state
  const [name, setName] = useState(profile.display_name || "");
  const [photo, setPhoto] = useState(profile.photo_url || "");
  
  // Partner profile state
  const partnerRole = profile.role === 'owner' ? 'partner' : 'owner';
  const [partnerName, setPartnerName] = useState(partnerProfile?.display_name || (partnerRole === 'owner' ? 'Rahul' : 'Nusrat'));
  const [partnerPhoto, setPartnerPhoto] = useState(partnerProfile?.photo_url || "");
  const [partnerNickname, setPartnerNickname] = useState(profile.partnerNicknames?.[partnerProfile?.uid || ''] || "");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppingTarget, setCroppingTarget] = useState<'me' | 'partner'>('me');
  const [tempImage, setTempImage] = useState<string | null>(null);
  
  const myFileInputRef = useRef<HTMLInputElement>(null);
  const partnerFileInputRef = useRef<HTMLInputElement>(null);

  // Partner Management Logic (6-Digit Code + Email backup)
  const [partnerPasscode, setPartnerPasscode] = useState(config?.partner_passcode || '123456');
  const [copiedCode, setCopiedCode] = useState(false);
  const [emails, setEmails] = useState<string[]>(config?.partner_allowed_emails || []);
  const [newEmail, setNewEmail] = useState("");

  const generateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPartnerPasscode(randomPin);
  };

  const copyPasscodeToClipboard = () => {
    navigator.clipboard.writeText(partnerPasscode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const addEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail]);
      setNewEmail("");
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'me' | 'partner') => {
    const file = e.target.files?.[0];
    if (file) {
      setCroppingTarget(target);
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const onCropComplete = async (croppedImage: string) => {
    try {
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      const compressedFile = await imageCompression(blob as File, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        const compressedBase64 = reader.result as string;
        if (croppingTarget === 'me') {
          setPhoto(compressedBase64);
        } else {
          setPartnerPhoto(compressedBase64);
        }
        setShowCropper(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      alert("Failed to process image.");
    }
  };

  const saveMyProfile = async () => {
    setIsSaving(true);
    try {
      await supabase.from('users').update({
        display_name: name.trim(),
        photo_url: photo
      }).eq('role', profile.role);
      
      setSaveSuccessMsg("My Profile updated!");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const savePartnerProfile = async () => {
    setIsSaving(true);
    try {
      // 1. Update Partner's Global Profile in DB
      await supabase.from('users').update({
        display_name: partnerName.trim(),
        photo_url: partnerPhoto
      }).eq('role', partnerRole);

      // 2. Update Custom Nickname on My User Record
      const partnerUid = partnerProfile?.uid || partnerProfile?.id;
      if (partnerUid) {
        const updatedNicknames = { ...(profile.partnerNicknames || {}), [partnerUid]: partnerNickname.trim() };
        await supabase.from('users').update({
          partnerNicknames: updatedNicknames
        }).eq('id', profile.uid);
      }

      if (onPartnerUpdated && partnerProfile) {
        onPartnerUpdated({
          ...partnerProfile,
          display_name: partnerName.trim(),
          photo_url: partnerPhoto
        });
      }

      setSaveSuccessMsg("Partner Profile updated!");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
      alert("Failed to save partner profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const savePasscodeAndAccess = async () => {
    setIsSaving(true);
    try {
      if (isOwner) {
        await supabase.from('app_config').update({
          partner_allowed_emails: emails,
          partner_passcode: partnerPasscode.trim()
        }).eq('id', 'main');
      }
      setSaveSuccessMsg("Access settings saved!");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
      alert("Failed to save passcode.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] flex flex-col bg-white"
    >
      <div className="h-20 flex-shrink-0 border-b border-[#FF8FA3]/10 flex items-center justify-between px-6 bg-[#FFF8F6]/50">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 text-[#6E6E6E]">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-[#1a1a1a]">Settings & Profiles</h2>
        </div>
        {saveSuccessMsg && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 animate-pulse">
            {saveSuccessMsg}
          </span>
        )}
      </div>

      <div className="flex border-b border-[#FF8FA3]/10 px-4 pt-2 bg-white flex-shrink-0 gap-2">
        <button 
          onClick={() => setActiveTab('me')}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'me' ? 'border-[#FF8FA3] text-[#FF8FA3]' : 'border-transparent text-[#6E6E6E]/50'}`}
        >
          My Profile
        </button>
        <button 
          onClick={() => setActiveTab('partner')}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'partner' ? 'border-[#FF8FA3] text-[#FF8FA3]' : 'border-transparent text-[#6E6E6E]/50'}`}
        >
          Partner's Profile
        </button>
        {isOwner && (
          <button 
            onClick={() => setActiveTab('access')}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'access' ? 'border-[#FF8FA3] text-[#FF8FA3]' : 'border-transparent text-[#6E6E6E]/50'}`}
          >
            PIN Access
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'me' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-[#FFD6C9] overflow-hidden border-4 border-[#FF8FA3]/20 shadow-md relative">
                  {photo ? (
                    <img src={photo} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-[#FF8FA3]">
                      {name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => myFileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-[#FF8FA3] p-2.5 rounded-full text-white shadow-lg border-2 border-white hover:scale-110 active:scale-95 transition-transform"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" ref={myFileInputRef} onChange={(e) => handleFileChange(e, 'me')} 
                  accept="image/*" className="hidden" 
                />
              </div>
              <p className="mt-4 text-[11px] font-bold text-[#6E6E6E] uppercase tracking-widest opacity-60">Tap camera to change your photo</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block ml-1 opacity-60">Your Display Name</label>
                <input 
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="How your partner sees you..."
                  className="w-full bg-[#FFF8F6] border border-[#FF8FA3]/15 rounded-2xl px-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/20 font-medium"
                />
              </div>
              
              <div className="pt-6 border-t border-[#FF8FA3]/10 flex flex-col gap-4">
                <button 
                  type="button"
                  onClick={saveMyProfile}
                  disabled={isSaving}
                  className="w-full h-14 bg-[#FF8FA3] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[#FF8FA3]/15 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save My Profile"}
                </button>
                <button 
                  type="button"
                  onClick={onLogout}
                  className="w-full h-14 bg-[#FFF8F6] text-red-400 border border-red-100 rounded-2xl text-[13px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 active:scale-95 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'partner' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-[#FFD6C9] overflow-hidden border-4 border-[#FF8FA3]/20 shadow-md relative">
                  {partnerPhoto ? (
                    <img src={partnerPhoto} alt="Partner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-[#FF8FA3]">
                      {partnerName?.[0] || '?'}
                    </div>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => partnerFileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-[#FF8FA3] p-2.5 rounded-full text-white shadow-lg border-2 border-white hover:scale-110 active:scale-95 transition-transform"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" ref={partnerFileInputRef} onChange={(e) => handleFileChange(e, 'partner')} 
                  accept="image/*" className="hidden" 
                />
              </div>
              <p className="mt-4 text-[11px] font-bold text-[#FF8FA3] uppercase tracking-widest">
                Edit {partnerName}'s Photo & Profile
              </p>
              <p className="mt-1 text-[10px] text-[#6E6E6E] opacity-60 text-center">
                Both of you can update each other's photo anytime!
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block ml-1 opacity-60">Partner's Display Name</label>
                <input 
                  value={partnerName} onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Partner's display name..."
                  className="w-full bg-[#FFF8F6] border border-[#FF8FA3]/15 rounded-2xl px-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/20 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block ml-1 opacity-60">Custom Nickname (Only visible to you)</label>
                <input 
                  value={partnerNickname} onChange={(e) => setPartnerNickname(e.target.value)}
                  placeholder="e.g. My Queen, My Love..."
                  className="w-full bg-[#FFF8F6] border border-[#FF8FA3]/15 rounded-2xl px-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/20 font-medium"
                />
              </div>
              
              <div className="pt-6 border-t border-[#FF8FA3]/10">
                <button 
                  type="button"
                  onClick={savePartnerProfile}
                  disabled={isSaving}
                  className="w-full h-14 bg-[#FF8FA3] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[#FF8FA3]/15 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Updating Partner..." : `Save ${partnerName}'s Profile`}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'access' && isOwner && (
          <div className="max-w-md mx-auto space-y-8">
            {/* 6-Digit Passcode Section */}
            <section className="bg-gradient-to-br from-[#FFF0F3] to-[#FFF8F6] p-6 rounded-3xl border border-[#FF8FA3]/20 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FF8FA3]/15 flex items-center justify-center text-[#FF8FA3]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#1a1a1a]">Nusrat's 6-Digit Passcode</h3>
                    <p className="text-[10px] text-[#6E6E6E] opacity-70">Used for instant passcode login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateRandomPin}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#FF8FA3]/20 rounded-xl text-[10px] font-bold text-[#FF8FA3] hover:bg-[#FF8FA3]/5 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Random PIN</span>
                </button>
              </div>

              {/* PIN Display & Input */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={partnerPasscode}
                    onChange={(e) => setPartnerPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full h-14 bg-white border border-[#FF8FA3]/25 rounded-2xl px-5 text-center font-mono text-2xl font-bold tracking-[0.5em] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/30"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyPasscodeToClipboard}
                    className="flex-1 h-11 bg-white border border-[#FF8FA3]/20 text-[#1a1a1a] rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#FFF8F6] active:scale-95 transition-all"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#FF8FA3]" />
                        <span>Copy 6-Digit Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[#6E6E6E] leading-relaxed opacity-80">
                Nusrat can enter this 6-digit code on the login screen to enter OnlyUs immediately without any Google account.
              </p>
            </section>

            {/* Email Authorizations (Optional backup) */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-[#FF8FA3]" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] opacity-60">Backup Email Access (Optional)</h3>
              </div>
              <div className="space-y-2">
                {emails.map(email => (
                  <div key={email} className="flex items-center justify-between p-3.5 bg-[#FFF8F6] rounded-2xl border border-[#FF8FA3]/5">
                    <span className="text-xs font-mono text-[#6E6E6E] truncate">{email}</span>
                    <button onClick={() => removeEmail(email)} className="p-1.5 text-red-300 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addEmail} className="flex gap-2">
                <input 
                  type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Optional Google Email..."
                  className="flex-1 bg-[#FFF8F6] border border-[#FF8FA3]/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
                <button type="submit" className="px-4 bg-[#1a1a1a] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all">
                  Add
                </button>
              </form>
            </section>
            
            <button 
              type="button"
              onClick={savePasscodeAndAccess}
              disabled={isSaving || partnerPasscode.length !== 6}
              className="w-full h-14 bg-[#FF8FA3] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[#FF8FA3]/15 active:scale-95 transition-all disabled:opacity-50 mt-6"
            >
              {isSaving ? "Saving Settings..." : "Save Passcode & Settings"}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCropper && tempImage && (
          <ImageCropperModal 
            image={tempImage} 
            onCancel={() => setShowCropper(false)} 
            onDone={onCropComplete} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PartnerInfoModal({ 
  partner, 
  myProfile, 
  onClose, 
  onViewImage,
  onPartnerUpdated,
  onMyProfileUpdated,
  messages = [],
  isPartnerOnline = false
}: { 
  partner: UserProfile, 
  myProfile: UserProfile | null, 
  onClose: () => void, 
  onViewImage: (url: string) => void,
  onPartnerUpdated?: (partner: UserProfile) => void,
  onMyProfileUpdated?: (me: UserProfile) => void,
  messages?: Message[],
  isPartnerOnline?: boolean
}) {
  const [view, setView] = useState<'main' | 'nicknames'>('main');
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'reels' | 'links'>('media');
  
  // Custom Nicknames state
  const currentPartnerNickname = myProfile?.partnerNicknames?.[partner.uid] || partner.display_name || "";
  const currentMyNickname = myProfile?.display_name || "";
  
  const [editingTarget, setEditingTarget] = useState<'partner' | 'me' | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Dummy options & modals
  const [showCustomiseModal, setShowCustomiseModal] = useState(false);
  const [showWhoCanEditModal, setShowWhoCanEditModal] = useState(false);

  // Photo change logic
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'partner' | 'me'>('partner');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handlePhotoSelect = (target: 'partner' | 'me') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropTarget(target);
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const onCropComplete = async (croppedImage: string) => {
    try {
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      const compressedFile = await imageCompression(blob as File, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedBase64 = reader.result as string;
        setShowCropper(false);
        setIsSaving(true);
        try {
          if (cropTarget === 'partner') {
            await supabase.from('users').update({
              photo_url: compressedBase64
            }).eq('role', partner.role);

            if (onPartnerUpdated) {
              onPartnerUpdated({ ...partner, photo_url: compressedBase64 });
            }
            showToast("Partner photo updated!");
          } else if (myProfile) {
            await supabase.from('users').update({
              photo_url: compressedBase64
            }).eq('id', myProfile.uid);

            if (onMyProfileUpdated) {
              onMyProfileUpdated({ ...myProfile, photo_url: compressedBase64 });
            }
            showToast("Profile photo updated!");
          }
        } catch (err) {
          console.error("Error updating photo:", err);
          showToast("Failed to save photo.");
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      showToast("Failed to crop image.");
    }
  };

  const openEditNickname = (target: 'partner' | 'me') => {
    setEditingTarget(target);
    if (target === 'partner') {
      setNicknameInput(currentPartnerNickname);
    } else {
      setNicknameInput(currentMyNickname);
    }
  };

  const saveNickname = async () => {
    if (!editingTarget || !myProfile) return;
    setIsSaving(true);
    const newName = nicknameInput.trim();
    try {
      if (editingTarget === 'partner') {
        // Save to my custom partnerNicknames & update partner display name
        const updatedNicknames = { ...(myProfile.partnerNicknames || {}), [partner.uid]: newName };
        await supabase.from('users').update({
          partnerNicknames: updatedNicknames
        }).eq('id', myProfile.uid);

        await supabase.from('users').update({
          display_name: newName
        }).eq('role', partner.role);

        if (onPartnerUpdated) {
          onPartnerUpdated({ ...partner, display_name: newName });
        }
        showToast("Partner's nickname saved!");
      } else {
        // Save my own display name
        await supabase.from('users').update({
          display_name: newName
        }).eq('id', myProfile.uid);

        if (onMyProfileUpdated) {
          onMyProfileUpdated({ ...myProfile, display_name: newName });
        }
        showToast("Your name updated!");
      }
      setEditingTarget(null);
    } catch (err) {
      console.error("Error saving nickname:", err);
      showToast("Failed to save nickname.");
    } finally {
      setIsSaving(false);
    }
  };

  // Shared chat photos
  const sharedPhotos = useMemo(() => {
    const photos: string[] = [];
    messages.forEach((m: any) => {
      if (m.attachment_url && (typeof m.attachment_url === 'string') && (m.attachment_url.startsWith('data:image') || m.attachment_url.startsWith('http'))) {
        photos.push(m.attachment_url);
      }
      if (m.image_url && typeof m.image_url === 'string') {
        photos.push(m.image_url);
      }
    });
    return photos;
  }, [messages]);

  const partnerHandle = partner.email ? partner.email.split('@')[0] : '_btw.nusrat_';
  const myHandle = myProfile?.email ? myProfile.email.split('@')[0] : 'rafurumikey';

  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed inset-0 z-[110] flex flex-col bg-white text-[#111111] overflow-hidden"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a]/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'main' ? (
        /* ==================== INSTAGRAM PARTNER PROFILE VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Instagram Top Bar */}
          <div className="h-14 flex-shrink-0 flex items-center px-4">
            <button 
              onClick={onClose} 
              className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity active:scale-95"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Centered Avatar and Name */}
            <div className="flex flex-col items-center pt-2 pb-6 px-4">
              <div className="relative group">
                <div 
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border border-black/10 shadow-sm cursor-pointer active:scale-95 transition-transform bg-neutral-100"
                  onClick={() => partner.photo_url && onViewImage(partner.photo_url)}
                >
                  {partner.photo_url ? (
                    <img 
                      src={partner.photo_url} 
                      alt={currentPartnerNickname} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-bold text-neutral-400 bg-neutral-100">
                      {currentPartnerNickname?.[0] || 'P'}
                    </div>
                  )}
                </div>

                {/* Direct Camera Button to update photo */}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    photoInputRef.current?.click();
                  }}
                  title="Change partner's photo"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center border-2 border-white shadow-md hover:scale-105 active:scale-90 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={photoInputRef} 
                  onChange={handlePhotoSelect('partner')} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {/* Display Name directly below avatar */}
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mt-3.5 text-center px-4 tracking-tight leading-snug break-words">
                {currentPartnerNickname}
              </h2>
            </div>

            {/* Instagram Options List */}
            <div className="border-t border-b border-neutral-100 py-1">
              {/* Option 1: Customise (Dummy) */}
              <button 
                type="button"
                onClick={() => setShowCustomiseModal(true)}
                className="w-full px-5 py-3.5 flex items-center gap-3.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111111] leading-tight">Customise</p>
                  <p className="text-[12px] text-[#737373] mt-0.5 leading-tight">Theme and font</p>
                </div>
              </button>

              {/* Option 2: Nicknames (Opens Nicknames Screen) */}
              <button 
                type="button"
                onClick={() => setView('nicknames')}
                className="w-full px-5 py-3.5 flex items-center gap-3.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-[#111111] flex-shrink-0">
                  <UserCheck className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111111] leading-tight">Nicknames</p>
                </div>
              </button>
            </div>

            {/* Media Tabs Section */}
            <div className="mt-2">
              <div className="grid grid-cols-3 border-b border-neutral-200 text-neutral-400">
                <button 
                  onClick={() => setActiveMediaTab('media')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'media' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <LayoutGrid className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'media' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveMediaTab('reels')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'reels' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <Repeat className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'reels' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveMediaTab('links')}
                  className={`py-3 flex items-center justify-center transition-colors relative ${activeMediaTab === 'links' ? 'text-[#111111]' : 'hover:text-neutral-600'}`}
                >
                  <Link2 className="w-5 h-5 stroke-[1.75]" />
                  {activeMediaTab === 'links' && (
                    <motion.div layoutId="igTabIndicator" className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                  )}
                </button>
              </div>

              {/* Media Grid Tab Content */}
              {activeMediaTab === 'media' && (
                <div className="p-1">
                  {sharedPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1">
                      {sharedPhotos.map((imgUrl, idx) => (
                        <div 
                          key={idx}
                          onClick={() => onViewImage(imgUrl)}
                          className="aspect-square bg-neutral-100 overflow-hidden cursor-pointer hover:opacity-90 active:scale-98 transition-all"
                        >
                          <img 
                            src={imgUrl} 
                            alt={`Media ${idx}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-neutral-400">
                      <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                        <Camera className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-[14px] font-semibold text-neutral-700">No photos shared yet</p>
                      <p className="text-[12px] text-neutral-400 mt-1">Photos you share in this chat will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {activeMediaTab === 'reels' && (
                <div className="py-16 text-center text-neutral-400">
                  <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                    <Film className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <p className="text-[14px] font-semibold text-neutral-700">No clips or voice notes</p>
                  <p className="text-[12px] text-neutral-400 mt-1">Audio memories and clips will show here.</p>
                </div>
              )}

              {activeMediaTab === 'links' && (
                <div className="py-16 text-center text-neutral-400">
                  <div className="w-12 h-12 rounded-full border border-neutral-300 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                    <Link2 className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <p className="text-[14px] font-semibold text-neutral-700">No links shared</p>
                  <p className="text-[12px] text-neutral-400 mt-1">Shared web links in your chat will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== NICKNAMES SUB-VIEW ==================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          {/* Top Bar with Title */}
          <div className="h-14 flex-shrink-0 flex items-center px-4 border-b border-neutral-100">
            <button 
              onClick={() => setView('main')} 
              className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity active:scale-95"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2]" />
            </button>
            <h1 className="text-[18px] font-bold text-[#111111] ml-4">
              Nicknames
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            {/* Subtitle Info Box */}
            <div className="py-2 text-center">
              <p className="text-[13px] text-[#737373]">
                Nicknames are only displayed in this chat.
              </p>
              <button 
                type="button"
                onClick={() => setShowWhoCanEditModal(true)}
                className="text-[13px] text-[#0095F6] font-semibold mt-1 hover:underline active:opacity-70 transition-opacity"
              >
                Change who can edit your nickname
              </button>
            </div>

            {/* Member Nickname List */}
            <div className="mt-4 space-y-1">
              {/* Member 1: Rahul / Owner / Me */}
              <button 
                type="button"
                onClick={() => openEditNickname('me')}
                className="w-full py-3.5 flex items-center justify-between hover:bg-neutral-50 active:bg-neutral-100 rounded-xl px-2 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-13 h-13 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                    {myProfile?.photo_url ? (
                      <img 
                        src={myProfile.photo_url} 
                        alt={currentMyNickname} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-neutral-400 text-lg">
                        {currentMyNickname?.[0] || 'R'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#111111] leading-snug truncate">
                      {currentMyNickname || "Rahul"}
                    </p>
                    <p className="text-[13px] text-[#737373] leading-tight truncate">
                      {myHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              </button>

              {/* Member 2: Partner / Nusrat */}
              <button 
                type="button"
                onClick={() => openEditNickname('partner')}
                className="w-full py-3.5 flex items-center justify-between hover:bg-neutral-50 active:bg-neutral-100 rounded-xl px-2 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-13 h-13 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                    {partner.photo_url ? (
                      <img 
                        src={partner.photo_url} 
                        alt={currentPartnerNickname} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-neutral-400 text-lg">
                        {currentPartnerNickname?.[0] || 'N'}
                      </div>
                    )}
                    {isPartnerOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#4ade80] border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#111111] leading-snug truncate">
                      {currentPartnerNickname || "Nusrat"}
                    </p>
                    <p className="text-[13px] text-[#737373] leading-tight truncate">
                      {partnerHandle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Nickname Bottom Sheet / Dialog */}
      <AnimatePresence>
        {editingTarget && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTarget(null)}
              className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-white rounded-t-3xl p-5 pb-8 max-w-md mx-auto shadow-2xl"
            >
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#111111]">
                  Edit Nickname for {editingTarget === 'partner' ? 'Partner' : 'You'}
                </h3>
                <button 
                  onClick={() => setEditingTarget(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-3">
                <input 
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Enter nickname..."
                  autoFocus
                  className="w-full bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 text-[15px] font-medium text-[#111111] focus:outline-none focus:border-[#0095F6] pr-10"
                />
                {nicknameInput && (
                  <button 
                    type="button"
                    onClick={() => setNicknameInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-neutral-300 text-white flex items-center justify-center hover:bg-neutral-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick emoji bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-4 no-scrollbar">
                {['🥺', '🫶🏻', '💋', '💖', '🥰', '🍯', '🧸', '👑', '✨', '🤍'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNicknameInput(prev => prev + emoji)}
                    className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-lg active:scale-95 transition-transform flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                onClick={saveNickname}
                disabled={isSaving}
                className="w-full h-12 bg-[#0095F6] hover:bg-[#1877F2] text-white font-bold rounded-xl text-[15px] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-md shadow-[#0095F6]/20"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dummy Customise Bottom Sheet */}
      <AnimatePresence>
        {showCustomiseModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomiseModal(false)}
              className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-white rounded-t-3xl p-6 pb-8 max-w-md mx-auto shadow-2xl"
            >
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white mx-auto mb-3 shadow-md">
                  <Heart className="w-7 h-7 fill-white" />
                </div>
                <h3 className="text-lg font-bold text-[#111111]">Customise Theme & Fonts</h3>
                <p className="text-[13px] text-neutral-500 mt-1 max-w-xs mx-auto">
                  Custom chat gradients, romantic themes, and handwriting fonts are ready to customize in settings.
                </p>
                <button 
                  onClick={() => setShowCustomiseModal(false)}
                  className="mt-6 w-full h-11 bg-neutral-900 text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* "Change Who Can Edit Nickname" Modal */}
      <AnimatePresence>
        {showWhoCanEditModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhoCanEditModal(false)}
              className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[130] bg-white rounded-t-3xl p-6 pb-8 max-w-md mx-auto shadow-2xl"
            >
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
              <h3 className="text-base font-bold text-[#111111] mb-2">
                Who can edit nicknames
              </h3>
              <p className="text-[13px] text-neutral-500 mb-4">
                In OnlyUs, both Rahul and Nusrat have equal permissions to edit nicknames anytime.
              </p>
              <div className="p-4 bg-neutral-50 rounded-2xl flex items-center justify-between border border-neutral-200">
                <span className="text-[14px] font-semibold text-neutral-800">Everyone in this chat</span>
                <Check className="w-5 h-5 text-[#0095F6]" />
              </div>
              <button 
                onClick={() => setShowWhoCanEditModal(false)}
                className="mt-5 w-full h-11 bg-[#0095F6] text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
              >
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {showCropper && tempImage && (
          <ImageCropperModal 
            image={tempImage} 
            onCancel={() => setShowCropper(false)} 
            onDone={onCropComplete} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImageCropperModal({ image, onCancel, onDone }: { image: string, onCancel: () => void, onDone: (res: string) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_a: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const showResult = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels!);
      onDone(croppedImage);
    } catch (e) {
      console.error(e);
      alert("Cropping failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="h-16 flex items-center justify-between px-6 bg-black/60 backdrop-blur-md z-10">
        <button onClick={onCancel} className="text-white text-sm font-bold uppercase tracking-widest">Cancel</button>
        <h3 className="text-white text-sm font-bold uppercase tracking-widest">Crop Image</h3>
        <button onClick={showResult} className="text-[#FF8FA3] text-sm font-bold uppercase tracking-widest">Done</button>
      </div>
      
      <div className="relative flex-1 bg-[#1a1a1a]">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          cropShape="round"
          showGrid={false}
        />
      </div>

      <div className="h-24 px-10 flex items-center bg-black/80 z-10">
        <input 
          type="range" value={zoom} min={1} max={3} step={0.1}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-[#FF8FA3]"
        />
      </div>
    </div>
  );
}

function FullImageViewer({ url, onClose }: { url: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-6 left-6 p-3 text-white bg-white/10 rounded-full backdrop-blur-md">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <motion.img 
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        src={url} 
        alt="Full view" 
        className="max-w-full max-h-full object-contain rounded-xl" 
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
      />
    </motion.div>
  );
}

// Helper to create cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return "";

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg', 0.8);
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}
