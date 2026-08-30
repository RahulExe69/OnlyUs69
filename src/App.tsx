import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { LogOut, Send, Settings as SettingsIcon, MessageSquare, ShieldCheck, Heart, User as UserIcon, Plus, X, Trash2, Smile, MoreVertical, Copy, RotateCcw, Reply, CornerUpLeft, Pencil, Camera, Image as ImageIcon, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, UserPlus, Gamepad2, Music, Settings2, Target, Download, Wifi, WifiOff, Palette, ListChecks, Wind, Laugh, Star, KeyRound, Lock, Sparkles, RefreshCw, LayoutGrid, Instagram, MessageSquareCode, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { MultiHubDashboard } from './components/MultiHubDashboard';
import { ExternalHubView } from './components/ExternalHubView';
import Cropper, { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

// Ludo Assets
import boardImg from './assets/ludo/ludo_board.webp';
import redToken from './assets/ludo/token_red.webp';
import blueToken from './assets/ludo/token_blue.webp';
import greenToken from './assets/ludo/token_green.webp';
import yellowToken from './assets/ludo/token_yellow.webp';
import diceBase from './assets/ludo/dice.webp';
import dice1 from './assets/ludo/1.webp';
import dice2 from './assets/ludo/2.webp';
import dice3 from './assets/ludo/3.webp';
import dice4 from './assets/ludo/4.webp';
import dice5 from './assets/ludo/5.webp';
import dice6 from './assets/ludo/6.webp';

const DICE_FACES = {
  1: dice1,
  2: dice2,
  3: dice3,
  4: dice4,
  5: dice5,
  6: dice6
};

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
  }
};

const WALLPAPERS = [
  { id: 'none', name: 'None', url: '' },
  { id: 'dots', name: 'Sweet Dots', url: 'https://www.transparenttextures.com/patterns/p6.png' },
  { id: 'hearts', name: 'Little Hearts', url: 'https://www.transparenttextures.com/patterns/cut-copy-paste.png' },
  { id: 'minimal', name: 'Minimal Pink', url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop' },
  { id: 'night', name: 'Starry Night', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=800&auto=format&fit=crop' }
];

const applyTheme = (themeName: 'light' | 'dark' | 'romantic') => {
  const theme = THEMES[themeName];
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
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
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
  const [activeGame, setActiveGame] = useState<{ id: string, type: 'tictactoe' | 'ludo' } | null>(null);
  const [socketTypingUsers, setSocketTypingUsers] = useState<string[]>([]);
  const [socketOnlineUsers, setSocketOnlineUsers] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTabActive, setIsTabActive] = useState(true);
  const [activeNudge, setActiveNudge] = useState<{ type: string, sender: string } | null>(null);
  const [activeHubTab, setActiveHubTab] = useState<'dashboard' | 'chat' | 'instagram' | 'whatsapp'>('dashboard');
  const mainChannelRef = useRef<any>(null);

  const handleHubTabChange = (tab: 'dashboard' | 'chat' | 'instagram' | 'whatsapp') => {
    if (typeof window !== 'undefined' && window.AndroidBridge?.openTab) {
      try {
        window.AndroidBridge.openTab(tab);
        return;
      } catch (err) {
        console.warn('AndroidBridge call error:', err);
      }
    }

    if (tab === 'instagram') {
      window.location.href = 'https://www.instagram.com';
      return;
    }

    if (tab === 'whatsapp') {
      window.location.href = 'https://web.whatsapp.com';
      return;
    }

    setActiveHubTab(tab);
  };

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
        const mappedData = data.map((m: any) => ({
          ...m,
          timestamp: m.created_at || m.timestamp || new Date().toISOString(),
          replyTo: m.reply_to ? { id: m.reply_to, text: 'Replied Message', sender_role: m.sender_role || 'owner' } : null
        }));
        setMessages(mappedData as Message[]);
        localStorage.setItem('cached_msgs', JSON.stringify(mappedData));
      }
      setMessagesLoading(false);
    };

    fetchMessages();

    const unsubMsg = supabase.channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const raw = payload.new;
          const msg = {
            ...raw,
            timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            replyTo: raw.reply_to ? { id: raw.reply_to, text: 'Replied Message', sender_role: raw.sender_role || 'owner' } : null
          } as Message;

          setMessages(prev => {
            const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.text === msg.text && m.sender_role === msg.sender_role));
            const isDuplicate = filtered.some(m => m.id === msg.id);
            if (isDuplicate) return filtered;
            return [...filtered, msg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const raw = payload.new;
          const msg = {
            ...raw,
            timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            replyTo: raw.reply_to ? { id: raw.reply_to, text: 'Replied Message', sender_role: raw.sender_role || 'owner' } : null
          } as Message;
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(unsubMsg); };
  }, [user?.id]);

  const sendGameInvite = async (type: 'tictactoe' | 'ludo') => {
    if (!userProfile) return;
    const sessionId = Math.random().toString(36).substring(7);
    const senderName = userProfile.role === 'owner' ? 'Rahul' : 'Nusrat';
    const gameName = type === 'tictactoe' ? 'Tic Tac Toe' : 'Ludo';
    
    try {
      await supabase.from('messages').insert([{ 
        sender_role: userProfile.role,
        text: `🎮 ${senderName} invited you to play ${gameName}`,
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
        if (profile.theme) applyTheme(profile.theme as any);
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
      },
    });
    mainChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const presences = Object.values(state).flat() as any[];
        
        // WhatsApp style: Online ONLY if is_active is true (unminimized, foreground tab)
        const onlineIds = presences
          .filter(p => p.is_active === true)
          .map(p => p.user_id)
          .filter(Boolean);

        setSocketOnlineUsers([...new Set(onlineIds)]);

        // Safety: If they are not active/online, they are definitely not typing
        setSocketTypingUsers(prev => prev.filter(id => onlineIds.includes(id)));
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
        const { senderId, senderName, type } = payload;
        if (senderId !== user.id) {
          setActiveNudge({ type, sender: senderName });
          // Auto-clear nudge after 4 seconds
          setTimeout(() => setActiveNudge(null), 4000);
          // Haptic feedback if supported
          if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const currentVisible = document.visibilityState === 'visible' && !document.hidden;
          await presenceChannel.track({ 
            user_id: user.id, 
            online_at: new Date().toISOString(),
            is_active: currentVisible,
            role: role
          });
          setIsSocketConnected(true);
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

  const broadcastTyping = (isTyping: boolean) => {
    if (mainChannelRef.current && user && isTabActive) {
      mainChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping }
      });
    }
  };

  const sendNudge = (type: string = 'hug') => {
    if (mainChannelRef.current && user && userProfile) {
      const senderName = userProfile.role === 'owner' ? 'Rahul' : 'Nusrat';
      mainChannelRef.current.send({
        type: 'broadcast',
        event: 'nudge',
        payload: { 
          senderId: user.id, 
          senderName,
          type 
        }
      });
      // Show locally too
      setActiveNudge({ type, sender: 'You' });
      setTimeout(() => setActiveNudge(null), 4000);
    }
  };

  // Track Tab Visibility & Minimize/Focus events (WhatsApp-style instant hide/show)
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
    window.addEventListener('blur', handleHide);
    window.addEventListener('focus', handleShow);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('beforeunload', handleHide);
      window.removeEventListener('blur', handleHide);
      window.removeEventListener('focus', handleShow);
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
      applyTheme(userProfile.theme as any);
    }
  }, [userProfile?.theme]);

  const updateSettings = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    try {
      await supabase.from('users').update(updates).eq('id', userProfile.uid);
      setUserProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error("Error updating settings:", err);
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

  const getWallpaperUrl = () => {
    if (!userProfile?.wallpaper || userProfile.wallpaper === 'none') return '';
    const wp = WALLPAPERS.find(w => w.id === userProfile.wallpaper);
    return wp?.url || '';
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
        const messagesToUpdate = messagesToProcess.filter(m => m.sender_role === userProfile?.role && !m.deleted);
        
        for (const msg of messagesToUpdate) {
          const { error: updateError } = await supabase.from('messages').update({
            text: "",
            deleted: true,
            deletedBy: userProfile?.role,
            reactions: {}
          }).eq('id', msg.id);
          
          if (updateError) throw updateError;
        }
      } else {
        // Delete for Me (Persist in Database)
        const visibilityField = userProfile?.role === 'owner' ? 'hidden_for_owner' : 'hidden_for_partner';
        
        // Optimistic UI update: hide locally immediately
        setMessages(prev => prev.map(m => 
          messagesToProcess.some(sm => sm.id === m.id) 
            ? { ...m, [visibilityField]: true } 
            : m
        ));

        for (const msg of messagesToProcess) {
          const { error: updateError } = await supabase.from('messages')
            .update({ [visibilityField]: true })
            .eq('id', msg.id);
          
          if (updateError) throw updateError;
        }
      }
    } catch (err: any) {
      console.error("Deletion error:", err);
      setError(`Deletion failed: ${err.message || 'Unknown error'}`);
    }
  };

  const formatLastSeen = (timestamp: any, uid?: string) => {
    // 1. Instant Realtime Presence check
    const targetId = uid || partnerProfile?.uid || partnerProfile?.id;
    if (targetId && socketOnlineUsers.includes(targetId)) {
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

    if (isToday) {
      if (diffSeconds < 60) {
        return "Last seen just now";
      }
      return `Last seen today at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
    <div className="flex h-[100dvh] bg-[#FFF8F6] font-sans text-[#1a1a1a] overflow-hidden relative">
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
        <main className="flex-1 flex flex-col bg-[#FFF8F6] overflow-hidden z-30 transition-all w-full relative">
          <div className="h-20 lg:h-24 flex-shrink-0 relative w-full z-50 bg-[#FFF8F6] shadow-sm border-b border-[#FF8FA3]/10">
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
                  className="absolute inset-0 px-4 lg:px-6 flex items-center justify-between bg-white/95 backdrop-blur-md z-20"
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
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] border border-black/5 z-50 overflow-hidden py-1"
                            >
                              <button 
                                onClick={() => { handleHubTabChange('dashboard'); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors border-b border-gray-100"
                              >
                                <LayoutGrid className="w-4 h-4 text-[#FF4D6D]" />
                                OnlyUs Hub
                              </button>
                              <button 
                                onClick={() => { handleHubTabChange('instagram'); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <Instagram className="w-4 h-4 text-pink-600" />
                                Instagram
                              </button>
                              <button 
                                onClick={() => { handleHubTabChange('whatsapp'); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors border-b border-gray-100"
                              >
                                <MessageSquareCode className="w-4 h-4 text-emerald-600" />
                                WhatsApp Web
                              </button>
                              <button 
                                onClick={() => { setShowProfileModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <UserIcon className="w-4 h-4 text-[#FF8FA3]" />
                                My Profile
                              </button>
                              <button 
                                onClick={() => { setShowThemeModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <Palette className="w-4 h-4 text-[#FF8FA3]" />
                                Themes
                              </button>
                              <button 
                                onClick={() => { setShowWallpaperModal(true); setShowMenu(false); }}
                                className="w-full px-4 py-3 text-left text-sm font-medium text-[#1a1a1a] hover:bg-[#FF8FA3]/5 flex items-center gap-3 transition-colors"
                              >
                                <ImageIcon className="w-4 h-4 text-[#FF8FA3]" />
                                Wallpaper
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
            {getWallpaperUrl() && (
              <div 
                className="absolute inset-0 z-0 opacity-40 pointer-events-none" 
                style={{ 
                  backgroundImage: `url(${getWallpaperUrl()})`,
                  backgroundSize: userProfile?.wallpaper === 'dots' || userProfile?.wallpaper === 'hearts' ? 'auto' : 'cover',
                  backgroundPosition: 'center',
                  filter: userProfile?.theme === 'dark' ? 'invert(1) opacity(0.1)' : 'none'
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
          <NudgeOverlay nudge={activeNudge} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileModal && userProfile && (
          <ProfileModal 
            profile={userProfile} 
            onClose={() => setShowProfileModal(false)}
            config={appConfig}
            isOwner={isOwner}
            onLogout={handleLogout}
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
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullImage && (
          <FullImageViewer url={showFullImage} onClose={() => setShowFullImage(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showThemeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowThemeModal(false)}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#FF8FA3]" />
                  Choose Theme
                </h3>
                <button onClick={() => setShowThemeModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-3">
                {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${userProfile?.theme === t ? 'border-[#FF8FA3] bg-[#FF8FA3]/5' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border shadow-sm relative overflow-hidden" style={{ backgroundColor: THEMES[t].bg }}>
                        <div className="absolute top-0 left-0 w-full h-1/2" style={{ backgroundColor: THEMES[t].owner }} />
                        <div className="absolute bottom-0 right-0 w-1/2 h-1/2" style={{ backgroundColor: THEMES[t].partner }} />
                      </div>
                      <span className="font-semibold text-sm capitalize text-gray-800">{t}</span>
                    </div>
                    {userProfile?.theme === t && <Check className="w-5 h-5 text-[#FF8FA3]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWallpaperModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowWallpaperModal(false)}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#FF8FA3]" />
                  Chat Wallpaper
                </h3>
                <button onClick={() => setShowWallpaperModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto px-1 pb-2">
                {WALLPAPERS.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => updateSettings({ wallpaper: wp.id })}
                    className={`group relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${userProfile?.wallpaper === wp.id ? 'border-[#FF8FA3]' : 'border-transparent hover:border-gray-200'}`}
                  >
                    {wp.url ? (
                      <img src={wp.url} alt={wp.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <span className="text-gray-400 text-xs font-semibold">Default</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-white text-[10px] font-bold truncate">{wp.name}</p>
                    </div>
                    {userProfile?.wallpaper === wp.id && (
                      <div className="absolute top-2 right-2 p-1 bg-[#FF8FA3] rounded-full shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
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
  activeGame: { id: string, type: 'tictactoe' | 'ludo' } | null,
  onSetActiveGame: (game: { id: string, type: 'tictactoe' | 'ludo' } | null) => void,
  onSendGameInvite: (type: 'tictactoe' | 'ludo') => Promise<void>,
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

  const visibleMessages = messages.filter(m => {
    if (role === 'owner') return !m.hidden_for_owner;
    return !m.hidden_for_partner;
  });

  useEffect(() => {
    setTimeout(scrollToBottom, 50);
  }, [visibleMessages.length]);

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
        
        {messagesLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-6 h-6 border-2 border-gray-100 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center py-20 opacity-20 select-none grayscale">
            <Heart className="w-16 h-16 mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-xs italic">A clean slate for our story</p>
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <MessageItem 
              key={msg.id} 
              msg={msg} 
              role={role} 
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
              className="w-full px-6 py-4 bg-white border border-[#FF8FA3]/10 rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-[#FF8FA3]/5 transition-all shadow-sm pr-12 placeholder-[#6E6E6E]/40"
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
        title="Send a Feeling"
      >
        <div className="grid grid-cols-4 gap-4 p-4 lg:p-6 pb-10">
          <AttachmentOption 
            icon={<Heart className="w-6 h-6" />} 
            label="Hug" 
            color="bg-pink-400" 
            onClick={() => { onSendNudge('hug'); onSetShowNudgeMenu(false); }} 
          />
          <AttachmentOption 
            icon={<Wind className="w-6 h-6" />} 
            label="Kiss" 
            color="bg-red-400" 
            onClick={() => { onSendNudge('kiss'); onSetShowNudgeMenu(false); }} 
          />
          <AttachmentOption 
            icon={<Laugh className="w-6 h-6" />} 
            label="Tickle" 
            color="bg-yellow-400" 
            onClick={() => { onSendNudge('tickle'); onSetShowNudgeMenu(false); }} 
          />
          <AttachmentOption 
            icon={<Star className="w-6 h-6" />} 
            label="Miss" 
            color="bg-blue-400" 
            onClick={() => { onSendNudge('miss'); onSetShowNudgeMenu(false); }} 
          />
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
          
          <GameCard 
            title="Ludo Classic"
            subtitle={`Play with ${role === 'owner' ? 'Nusrat' : 'Rahul'} 💖`}
            icon={<ShieldCheck className="w-5 h-5" />}
            color="bg-gradient-to-br from-[#2ECC40] to-[#3D9970]"
            isActive={true}
            label="Ludo King Edition 👑"
            onClick={() => sendGameInvite('ludo')}
          />
          
          <GameCard 
            title="Coming soon 💖"
            subtitle="Stay Tuned"
            icon={<Heart className="w-5 h-5" />}
            color="bg-gray-200"
            isActive={false}
          />
        </div>
      </BottomSheet>

      {activeGame && activeGame.type === 'tictactoe' && (
        <TicTacToe 
          sessionId={activeGame.id} 
          role={role} 
          userProfile={userProfile}
          partnerProfile={partnerProfile}
          onClose={() => onSetActiveGame(null)} 
        />
      )}

      {activeGame && activeGame.type === 'ludo' && (
        <Ludo 
          sessionId={activeGame.id} 
          role={role} 
          userProfile={userProfile}
          partnerProfile={partnerProfile}
          onClose={() => onSetActiveGame(null)} 
        />
      )}
    </div>
  );
}

function TicTacToe({ sessionId, role, userProfile, partnerProfile, onClose }: { sessionId: string, role: UserRole, userProfile: UserProfile | null, partnerProfile: UserProfile | null, onClose: () => void }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<UserRole>('owner');
  const [winner, setWinner] = useState<UserRole | 'draw' | null>(null);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  useEffect(() => {
    // Sync with Supabase
    const unsub = onSnapshot({ coll: 'games', id: sessionId }, (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        setBoard(data.board);
        setTurn(data.turn);
        setWinner(data.winner);
        setStatus(data.status);
      } else {
        // Init game if not exists
        const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
        supabase.from('games').insert([{
          id: sessionId,
          board: Array(9).fill(null),
          turn: randomTurn,
          status: 'playing',
          winner: null,
          players: { [role]: userProfile?.uid }
        }]).then();
      }
    });
    return unsub;
  }, [sessionId]);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diags
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a] === 'X' ? 'owner' : 'partner';
      }
    }
    if (squares.every(s => s !== null)) return 'draw';
    return null;
  };

  const handleMove = async (index: number) => {
    if (board[index] || winner || turn !== role || status !== 'playing') return;

    const newBoard = [...board];
    newBoard[index] = role === 'owner' ? 'X' : 'O';
    const newWinner = checkWinner(newBoard);
    const newTurn = role === 'owner' ? 'partner' : 'owner';

    try {
      await supabase.from('games').update({
        board: newBoard,
        turn: newWinner ? turn : newTurn,
        winner: newWinner,
        status: newWinner ? 'finished' : 'playing'
      }).eq('id', sessionId);
    } catch (err) {
      console.error("Game move error:", err);
    }
  };

  const resetGame = async () => {
    try {
      const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
      await supabase.from('games').update({
        board: Array(9).fill(null),
        turn: randomTurn,
        status: 'playing',
        winner: null
      }).eq('id', sessionId);
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-white/80 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-[0_32px_64px_-16px_rgba(255,143,163,0.2)] border border-[#FF8FA3]/20"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#FF8FA3] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF8FA3]/20">
               <Gamepad2 className="w-5 h-5 transition-transform group-hover:rotate-12" />
             </div>
             <div className="text-left">
               <h3 className="text-sm font-black text-[#1a1a1a] uppercase tracking-wider">Tic Tac Toe</h3>
               <p className="text-[10px] text-[#6E6E6E] opacity-60 font-medium tracking-widest uppercase">Match with {role === 'owner' ? 'Nusrat' : 'Rahul'}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-8">
          {winner ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="py-2 px-6 bg-[#FF8FA3]/10 text-[#FF8FA3] rounded-2xl inline-block">
              <span className="text-lg font-black uppercase tracking-tighter">
                {winner === 'draw' ? "It's a Draw! 🤝" : winner === role ? "You Won! 🎉" : `${role === 'owner' ? 'Nusrat' : 'Rahul'} Won! 💖`}
              </span>
            </motion.div>
          ) : (
            <div className={`py-2 px-6 rounded-2xl inline-block transition-colors ${turn === role ? 'bg-[#FF8FA3] text-white shadow-lg shadow-[#FF8FA3]/20' : 'bg-gray-50 text-gray-400'}`}>
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                {turn === role ? "Your Turn ✨" : `${role === 'owner' ? "Nusrat's" : "Rahul's"} Turn ⏳`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleMove(i)}
              className={`aspect-square rounded-3xl text-3xl font-black flex items-center justify-center transition-all ${
                cell ? (cell === 'X' ? 'bg-[#FF8FA3] text-white' : 'bg-[#FFD6C9] text-[#FF8FA3]') : 'bg-gray-50 hover:bg-[#FF8FA3]/5 active:scale-95'
              }`}
            >
              {cell && (
                <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
                  {cell}
                </motion.span>
              )}
            </button>
          ))}
        </div>

        {winner && (
          <button 
            onClick={resetGame}
            className="w-full py-4 bg-[#FF8FA3] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#FF8FA3]/30 hover:bg-[#FF8FA3]/90 transition-all active:scale-95"
          >
            Play Again
          </button>
        )}
      </motion.div>
    </div>
  );
}

function NudgeOverlay({ nudge }: { nudge: { type: string, sender: string } }) {
  const configs: Record<string, { label: string, emoji: string, color: string, secondaryEmoji: string }> = {
    hug: { label: 'Virtual Hug', emoji: '💖', color: 'text-pink-500', secondaryEmoji: '❤️' },
    kiss: { label: 'Sweet Kiss', emoji: '💋', color: 'text-red-500', secondaryEmoji: '😘' },
    tickle: { label: 'Tickle!', emoji: '😂', color: 'text-yellow-500', secondaryEmoji: '🤭' },
    miss: { label: 'Miss You', emoji: '🥺', color: 'text-blue-500', secondaryEmoji: '💙' },
  };

  const config = configs[nudge.type] || configs.hug;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[200] pointer-events-none flex items-center justify-center backdrop-blur-[2px] transition-colors duration-500 ${
        nudge.type === 'kiss' ? 'bg-red-500/10' : 
        nudge.type === 'tickle' ? 'bg-yellow-500/10' : 
        nudge.type === 'miss' ? 'bg-blue-500/10' : 'bg-pink-400/10'
      }`}
    >
      <div className="relative flex flex-col items-center">
        <motion.div
           initial={{ scale: 0, rotate: -20 }}
           animate={{ 
             scale: [0, 1.2, 1], 
             rotate: [20, -10, 0],
             y: [0, -20, 0]
           }}
           transition={{ duration: 1, ease: "easeOut" }}
           className="relative flex items-center justify-center"
        >
          {nudge.type === 'kiss' ? (
             <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 2 }}
             >
                <div className="text-[120px] drop-shadow-2xl">💋</div>
             </motion.div>
          ) : nudge.type === 'tickle' ? (
             <motion.div 
              animate={{ x: [-10, 10, -10], y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 0.2 }}
             >
                <div className="text-[120px] drop-shadow-2xl">😂</div>
             </motion.div>
          ) : nudge.type === 'miss' ? (
            <motion.div 
              animate={{ opacity: [0.7, 1, 0.7], y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
             >
                <div className="text-[120px] drop-shadow-2xl">🥺</div>
             </motion.div>
          ) : (
            <Heart className={`w-40 h-40 ${config.color} fill-current drop-shadow-2xl`} />
          )}
          
          {/* Floating mini items */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5],
                x: (Math.random() - 0.5) * 400,
                y: (Math.random() - 0.5) * 400,
                rotate: Math.random() * 360
              }}
              transition={{ 
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 0.5
              }}
              className="absolute top-1/2 left-1/2"
            >
              <div className="text-2xl">{config.secondaryEmoji}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 bg-white/90 backdrop-blur-md px-8 py-4 rounded-[2rem] shadow-2xl border border-pink-100 flex flex-col items-center gap-1"
        >
          <span className={`text-sm font-black uppercase tracking-[0.2em] ${config.color}`}>{config.label}</span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest opacity-60">From {nudge.sender} {config.emoji}</span>
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

function Ludo({ sessionId, role, userProfile, partnerProfile, onClose }: { sessionId: string, role: UserRole, userProfile: UserProfile | null, partnerProfile: UserProfile | null, onClose: () => void }) {
  // Developer Debug Tool State
  const [debugConfig, setDebugConfig] = useState({
    boardTop: 0.15,
    boardBottom: -0.35,
    boardLeft: 1.2,
    boardRight: -1.4,
    baseOffset1: 1.775,
    baseOffset2: 3.725,
    tokenSizeBase: 10.5,
    tokenSizeGrid: 150,
    showDebug: false,
    enableDrag: false,
    snapToGrid: true,
    compact: true,
    selectedTarget: 'board' as 'board' | 'pockets'
  });

  const nudge = (horizontal: number, vertical: number) => {
    const amount = 0.05;
    setDebugConfig(prev => {
      if (prev.selectedTarget === 'board') {
        return {
          ...prev,
          boardLeft: prev.boardLeft + (horizontal * amount),
          boardRight: prev.boardRight - (horizontal * amount),
          boardTop: prev.boardTop + (vertical * amount),
          boardBottom: prev.boardBottom - (vertical * amount),
        };
      } else {
        return {
          ...prev,
          baseOffset1: prev.baseOffset1 + (horizontal * amount / 2) + (vertical * amount / 2),
          baseOffset2: prev.baseOffset2 - (horizontal * amount / 2) - (vertical * amount / 2),
        };
      }
    });
  };

  const [dragInfo, setDragInfo] = useState<string | null>(null);

  // Ludo Colors mapping to assets
  const TOKEN_ASSETS = {
    red: redToken,
    blue: blueToken,
    green: greenToken,
    yellow: yellowToken
  };

  // Assign colors based on role
  // Owner (You) = Blue (Bottom-Left)
  // Partner (Nusrat) = Red (Top-Left)
  const myColor = role === 'owner' ? 'blue' : 'red';
  const partnerColor = role === 'owner' ? 'red' : 'blue';

  const [gameState, setGameState] = useState<{
    pieces: { red: number[], blue: number[], green: number[], yellow: number[] },
    turn: 'owner' | 'partner',
    dice: number | null,
    status: 'rolling' | 'moving' | 'finished',
    winner: string | null,
    lastDiceRoll: number | null,
    moveHistory?: any[]
  } | null>(null);

  const [isRolling, setIsRolling] = useState(false);



  useEffect(() => {
    if (gameState) return; // Skip Firestore if we have fresh Socket state
    // Sync with Supabase
    const unsub = onSnapshot({ coll: 'games', id: sessionId }, (snap: any) => {
      if (snap.exists()) {
        setGameState(snap.data() as any);
      } else {
        const randomTurn = Math.random() < 0.5 ? 'owner' : 'partner';
        supabase.from('games').insert([{
          id: sessionId,
          pieces: {
            red: [-1, -1, -1, -1],
            blue: [-1, -1, -1, -1],
            green: [-1, -1, -1, -1],
            yellow: [-1, -1, -1, -1]
          },
          turn: randomTurn,
          dice: null,
          status: 'rolling',
          winner: null,
          lastDiceRoll: null
        }]).then();
      }
    });
    return unsub;
  }, [sessionId]);

  // Path Logic - 15x15 grid indices
  const commonPath = [
    [6,1], [6,2], [6,3], [6,4], [6,5], // Red stretch
    [5,6], [4,6], [3,6], [2,6], [1,6], [0,6], // To Green
    [0,7], [0,8], // Green top
    [1,8], [2,8], [3,8], [4,8], [5,8], // From Green
    [6,9], [6,10], [6,11], [6,12], [6,13], [6,14], // To Yellow
    [7,14], [8,14], // Yellow right
    [8,13], [8,12], [8,11], [8,10], [8,9], // From Yellow
    [9,8], [10,8], [11,8], [12,8], [13,8], [14,8], // To Blue
    [14,7], [14,6], // Blue bottom
    [13,6], [12,6], [11,6], [10,6], [9,6], // From Blue
    [8,5], [8,4], [8,3], [8,2], [8,1], [8,0], // To Red
    [7,0], [6,0] // Red start
  ];

  const redHomeStretch = [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]];
  const blueHomeStretch = [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]];
  const greenHomeStretch = [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]];
  const yellowHomeStretch = [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]];

  const getPosCoords = (color: 'red' | 'blue' | 'green' | 'yellow', pos: number) => {
    if (pos === -1) return null;
    const offsets = { red: 0, green: 13, yellow: 26, blue: 39 };
    const homeStretches = {
      red: redHomeStretch,
      blue: blueHomeStretch,
      green: greenHomeStretch,
      yellow: yellowHomeStretch
    };

    if (pos < 51) {
      let pathIdx = (pos + offsets[color]) % 52;
      return commonPath[pathIdx];
    }
    return homeStretches[color][pos - 51];
  };

  const rollDice = async () => {
    if (gameState?.turn !== role || gameState.status !== 'rolling' || isRolling) return;

    setIsRolling(true);
    // Broadcast visual start (Socket.io - Cost: 0)
    /* socket call removed */

    setTimeout(async () => {
      const roll = Math.floor(Math.random() * 6) + 1;
      const myPieces = gameState.pieces[myColor];
      
      const canMoveAny = myPieces.some(p => {
        if (p === -1) return roll === 6;
        if (p + roll > 56) return false;
        return true;
      });

      try {
        await supabase.from('games').update({
          dice: canMoveAny ? roll : null, // Clear dice if can't move
          lastDiceRoll: roll,
          status: canMoveAny ? 'moving' : 'rolling',
          turn: canMoveAny ? gameState.turn : (gameState.turn === 'owner' ? 'partner' : 'owner')
        }).eq('id', sessionId);
        // Broadcast visual end (Socket.io - Cost: 0)
        /* socket call removed */
        
        // Update Ephemeral State for reconnecting users (Cost: 0)
        /* socket call removed */
      } catch (err: any) { 
        console.error(err);
        if (err.code === 'resource-exhausted') {
          alert("Firebase Quota Exceeded: Your daily limit for game updates has been reached. Please try again tomorrow or wait for the reset.");
        }
      }
      setIsRolling(false);
    }, 800);
  };

  const movePiece = async (pieceIdx: number) => {
    if (!gameState || gameState.turn !== role || gameState.status !== 'moving') return;
    
    const roll = gameState.dice!;
    const pieces = [...gameState.pieces[myColor]];
    let pos = pieces[pieceIdx];

    if (pos === -1 && roll !== 6) return;
    if (pos !== -1 && pos + roll > 56) return;

    if (pos === -1) pos = 0; else pos += roll;
    pieces[pieceIdx] = pos;

    const updatedAllPieces = { ...gameState.pieces };
    updatedAllPieces[myColor] = pieces;

    // Capture logic
    if (pos < 51) {
      const myCoords = getPosCoords(myColor, pos);
      // Check other colors for capture
      (['red', 'blue', 'green', 'yellow'] as const).forEach(color => {
        if (color === myColor) return;
        updatedAllPieces[color] = updatedAllPieces[color].map(op => {
          if (op === -1 || op >= 51) return op;
          const otherCoords = getPosCoords(color, op);
          if (otherCoords?.[0] === myCoords?.[0] && otherCoords?.[1] === myCoords?.[1]) {
            // Check for safe zones (stars on board)
            const safeSpots = [[6,2], [2,8], [8,12], [12,6], [6,13], [1,6], [8,1], [13,8]];
            const isSafe = safeSpots.some(s => s[0] === myCoords?.[0] && s[1] === myCoords?.[1]);
            return isSafe ? op : -1;
          }
          return op;
        });
      });
    }

    const isWinner = pieces.every(p => p === 56);
    const nextTurn = (roll === 6 || isWinner) ? gameState.turn : (gameState.turn === 'owner' ? 'partner' : 'owner');
    
    // 1. Optimistic Local UI Update
    setGameState(prev => prev ? ({ 
      ...prev, 
      pieces: updatedAllPieces, 
      status: 'rolling' as const, 
      dice: null,
      turn: nextTurn
    }) : null);

    // 2. Optimistic Socket Broadcast (Cost: 0, Instant)
    /* socket call removed */

    // 2b. Sync to Ephemeral Server State (Cost: 0)
    /* socket call removed */

    try {
      // 3. Persistent Sync to Firestore (Cost: 1)
      await supabase.from('games').update({
        pieces: updatedAllPieces,
        status: 'rolling',
        dice: null,
        turn: nextTurn,
        winner: isWinner ? (role === 'owner' ? 'owner' : 'partner') : null
      }).eq('id', sessionId);
    } catch (err: any) { 
      console.error(err);
      if (err.code === 'resource-exhausted') {
        alert("Firebase Quota Exceeded: Cannot save move. Please wait for the daily quota to reset.");
      }
    }
  };

  if (!gameState) return null;

  const renderCellPieces = (r: number, c: number) => {
    const redPiecesAt = gameState.pieces.red.map((p, i) => ({ coords: getPosCoords('red', p), i })).filter(p => p.coords?.[0] === r && p.coords?.[1] === c);
    const bluePiecesAt = gameState.pieces.blue.map((p, i) => ({ coords: getPosCoords('blue', p), i })).filter(p => p.coords?.[0] === r && p.coords?.[1] === c);
    const greenPiecesAt = gameState.pieces.green.map((p, i) => ({ coords: getPosCoords('green', p), i })).filter(p => p.coords?.[0] === r && p.coords?.[1] === c);
    const yellowPiecesAt = gameState.pieces.yellow.map((p, i) => ({ coords: getPosCoords('yellow', p), i })).filter(p => p.coords?.[0] === r && p.coords?.[1] === c);

    const allAt = [
      ...redPiecesAt.map(p => ({ ...p, color: 'red' as const })), 
      ...bluePiecesAt.map(p => ({ ...p, color: 'blue' as const })), 
      ...greenPiecesAt.map(p => ({ ...p, color: 'green' as const })), 
      ...yellowPiecesAt.map(p => ({ ...p, color: 'yellow' as const }))
    ];

    if (allAt.length === 0) return null;

    return (
      <div className="absolute inset-0 pointer-events-none z-10 transition-all duration-300">
        <div className="relative w-full h-full">
          {allAt.map((p, idx) => (
            <motion.div
              key={`${p.color}-${p.i}`}
              layoutId={`${p.color}-piece-${p.i}`}
              drag={debugConfig.enableDrag}
              dragSnapToOrigin={!debugConfig.enableDrag}
              onDrag={(_: any, info: any) => {
                if (debugConfig.enableDrag) {
                   setDragInfo(`${p.color} piece ${p.i}: r:${r}, c:${c} + x:${info.offset.x.toFixed(1)}, y:${info.offset.y.toFixed(1)}`);
                }
              }}
              style={{
                width: `${debugConfig.tokenSizeGrid}%`,
                height: `${debugConfig.tokenSizeGrid}%`,
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10"
            >
              <motion.img 
                src={TOKEN_ASSETS[p.color]} 
                onClick={(e) => {
                  e.stopPropagation();
                  if (debugConfig.enableDrag) {
                    setDebugConfig(prev => ({ ...prev, selectedTarget: 'board' }));
                  } else if (p.color === myColor) {
                    movePiece(p.i);
                  }
                }}
                className={`w-full h-full object-contain pointer-events-auto transition-transform active:scale-90 cursor-pointer ${
                  gameState.status === 'moving' && p.color === myColor && gameState.turn === role
                  ? 'animate-bounce drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]' : 'drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)]'
                }`}
                alt="Piece"
              />
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const getPartnerName = () => {
    if (userProfile?.partnerNicknames) {
      const keys = Object.keys(userProfile.partnerNicknames);
      if (keys.length > 0) return userProfile.partnerNicknames[keys[0]];
    }
    return role === 'owner' ? 'Nusrat' : 'Rahul';
  };

  const turnText = gameState.turn === role 
    ? "It's your turn! 🎲" 
    : `${getPartnerName()}'s Turn ⏳`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }}
        className="relative w-full h-full bg-[#FFF9F9] flex flex-col pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] z-10"
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-[#FF8FA3]/10 shadow-sm relative z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#FFD600] to-[#FFE552] rounded-xl flex items-center justify-center shadow-lg transform -rotate-3 border border-white/50">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1a1a1a] uppercase tracking-tight">Ludo King Edition</h3>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${gameState.turn === role ? 'bg-[#FF8FA3]' : 'bg-gray-300'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-widest ${gameState.turn === role ? 'text-[#FF8FA3]' : 'text-gray-400'}`}>
                  {turnText}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-400 transition-all border border-gray-100">
            <X className="w-5 h-5 font-black" />
          </button>
        </div>

        {/* Board Container */}
        <div className="flex-1 relative flex items-center justify-center p-3 lg:p-6 overflow-hidden">
          <div className="relative w-full max-w-[min(90vw,calc(100vh-320px))] aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white border-4 border-white">
            <img 
              src={boardImg} 
              alt="Ludo Board" 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            
            {/* Logic Overlay Grid - Padded precisely to match the asset's geometric centers */}
            <div 
              className="absolute"
              style={{
                top: `${debugConfig.boardTop}%`,
                bottom: `${debugConfig.boardBottom}%`,
                left: `${debugConfig.boardLeft}%`,
                right: `${debugConfig.boardRight}%`
              }}
            >
              <div className="relative w-full h-full grid grid-cols-15 grid-rows-15">
                {Array.from({ length: 225 }).map((_, i) => {
                  const r = Math.floor(i / 15);
                  const c = i % 15;
                  return (
                    <div key={i} className="relative w-full h-full" style={{ border: debugConfig.showDebug ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                      {renderCellPieces(r, c)}
                    </div>
                  );
                })}

                {/* Base Piece Overlays - Moved inside the same padded container for perfect sync */}
                <LudoBaseOverlay 
                  color="red" 
                  r={0} c={0} 
                  pieces={gameState.pieces.red}
                  tokenImg={redToken}
                  debugConfig={debugConfig}
                  setDragInfo={setDragInfo}
                  setDebugConfig={setDebugConfig}
                  onPieceClick={(idx) => myColor === 'red' && movePiece(idx)}
                  active={gameState.turn === (myColor === 'red' ? 'owner' : 'partner') && gameState.status === 'moving'}
                />
                <LudoBaseOverlay 
                  color="blue" 
                  r={9} c={0} // Bottom Left
                  pieces={gameState.pieces.blue}
                  tokenImg={blueToken}
                  debugConfig={debugConfig}
                  setDragInfo={setDragInfo}
                  setDebugConfig={setDebugConfig}
                  onPieceClick={(idx) => myColor === 'blue' && movePiece(idx)}
                  active={gameState.turn === (myColor === 'blue' ? 'owner' : 'partner') && gameState.status === 'moving'}
                />
                <LudoBaseOverlay 
                  color="green" 
                  r={0} c={9} // Top Right
                  pieces={gameState.pieces.green}
                  tokenImg={greenToken}
                  debugConfig={debugConfig}
                  setDragInfo={setDragInfo}
                  setDebugConfig={setDebugConfig}
                  onPieceClick={(idx) => (myColor as string) === 'green' && movePiece(idx)}
                  active={gameState.turn === ((myColor as string) === 'green' ? 'owner' : 'partner') && gameState.status === 'moving'}
                />
                <LudoBaseOverlay 
                  color="yellow" 
                  r={9} c={9} // Bottom Right
                  pieces={gameState.pieces.yellow}
                  tokenImg={yellowToken}
                  debugConfig={debugConfig}
                  setDragInfo={setDragInfo}
                  setDebugConfig={setDebugConfig}
                  onPieceClick={(idx) => (myColor as string) === 'yellow' && movePiece(idx)}
                  active={gameState.turn === ((myColor as string) === 'yellow' ? 'owner' : 'partner') && gameState.status === 'moving'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Debug UI - Floating Panel */}
        <div className={`fixed bottom-4 left-4 z-[200] flex flex-col gap-2 transition-all duration-300 ${debugConfig.showDebug ? 'w-auto' : 'w-auto'}`}>
           <div className="flex gap-1">
             <button 
               onClick={() => setDebugConfig(prev => ({ ...prev, showDebug: !prev.showDebug }))}
               className="bg-black/60 backdrop-blur-md text-white text-[10px] px-3 py-2 rounded-xl font-mono uppercase tracking-widest shadow-xl border border-white/20 hover:bg-black transition-colors flex items-center gap-2"
             >
               {debugConfig.showDebug ? <ChevronDown className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
               {debugConfig.showDebug ? 'Hide' : 'Debug'}
             </button>
             {debugConfig.showDebug && (
               <button 
                 onClick={() => setDebugConfig(prev => ({ ...prev, compact: !prev.compact }))}
                 className="bg-black/60 backdrop-blur-md text-white text-[10px] px-3 py-2 rounded-xl border border-white/20 hover:bg-black transition-colors"
               >
                 {debugConfig.compact ? 'Expand' : 'Compact'}
               </button>
             )}
           </div>

           {debugConfig.showDebug && (
             <div className={`bg-black/60 backdrop-blur-xl border border-white/20 rounded-[2rem] p-4 shadow-2xl flex flex-col gap-3 transition-all duration-300 ${debugConfig.compact ? 'w-24' : 'w-72'}`}>
                <div className="flex items-center justify-between">
                  {!debugConfig.compact && <h4 className="text-white font-mono text-[9px] uppercase tracking-tighter opacity-30">Dev Tool</h4>}
                  <button 
                    onClick={() => {
                        // Generate a snapshot of all token coordinates based on current config
                        const tokenManifest: any = {};
                        ['red', 'blue', 'green', 'yellow'].forEach((color: any) => {
                          tokenManifest[color] = gameState.pieces[color as keyof typeof gameState.pieces].map((pos, idx) => {
                            const gridPos = getPosCoords(color, pos);
                            if (pos === -1) {
                               // Calculate pocket pos for manifest
                               const rBase = color === 'red' || color === 'green' ? 0 : 9;
                               const cBase = color === 'red' || color === 'blue' ? 0 : 9;
                               const baseCells = [
                                 [rBase + debugConfig.baseOffset1, cBase + debugConfig.baseOffset1], [rBase + debugConfig.baseOffset1, cBase + debugConfig.baseOffset2],
                                 [rBase + debugConfig.baseOffset2, cBase + debugConfig.baseOffset1], [rBase + debugConfig.baseOffset2, cBase + debugConfig.baseOffset2]
                               ];
                               return { type: 'pocket', idx, relX: (baseCells[idx][1]/15)*100, relY: (baseCells[idx][0]/15)*100 };
                            }
                            return { type: 'grid', pos, r: gridPos?.[0], c: gridPos?.[1], relX: ((gridPos?.[1] || 0) + 0.5)/15*100, relY: ((gridPos?.[0] || 0) + 0.5)/15*100 };
                          });
                        });

                        const exportData = {
                           config: debugConfig,
                           manifest: tokenManifest,
                           timestamp: new Date().toISOString()
                        };

                        const json = JSON.stringify(exportData, null, 2);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `ludo-coordinates-${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        alert("Manifest & Config downloaded!");
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 transition-colors"
                    title="Download Coordinates Manifest"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>

                {/* Smart Nudge D-Pad */}
                <div className="flex flex-col items-center gap-1 bg-white/5 p-2 rounded-2xl">
                  <div className="text-[8px] text-white/40 uppercase font-bold mb-1">Nudge {debugConfig.selectedTarget}</div>
                  <button onClick={() => nudge(0, -1)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><ChevronUp className="w-3 h-3" /></button>
                  <div className="flex gap-1">
                    <button onClick={() => nudge(-1, 0)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><ChevronLeft className="w-3 h-3" /></button>
                    <button 
                      onClick={() => setDebugConfig(prev => ({ ...prev, selectedTarget: prev.selectedTarget === 'board' ? 'pockets' : 'board' }))}
                      className="p-2 bg-[#FF8FA3]/20 rounded-lg text-[#FF8FA3]"
                    >
                      <Target className="w-3 h-3" />
                    </button>
                    <button onClick={() => nudge(1, 0)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => nudge(0, 1)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"><ChevronDown className="w-3 h-3" /></button>
                </div>

                {!debugConfig.compact && (
                  <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                    {/* Token Sizes */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="flex justify-between text-[9px] text-white/50 uppercase font-bold">
                        <span>Sizes</span>
                        <span>{debugConfig.tokenSizeBase}% / {debugConfig.tokenSizeGrid}%</span>
                      </div>
                      <input 
                        type="range" min="5" max="25" step="0.1" 
                        value={debugConfig.tokenSizeBase || 10.5} 
                        onChange={e => setDebugConfig(prev => ({ ...prev, tokenSizeBase: parseFloat(e.target.value) || 0 }))}
                        className="w-full accent-[#FF8FA3] h-1" 
                      />
                      <input 
                        type="range" min="50" max="250" step="1" 
                        value={debugConfig.tokenSizeGrid || 150} 
                        onChange={e => setDebugConfig(prev => ({ ...prev, tokenSizeGrid: parseFloat(e.target.value) || 0 }))}
                        className="w-full accent-blue-400 h-1" 
                      />
                    </div>

                    {/* Precise Inputs */}
                    <div className="space-y-3 border-t border-white/5 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Top</label>
                          <input type="number" step="0.05" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.boardTop) ? '' : debugConfig.boardTop} onChange={e => setDebugConfig(p => ({...p, boardTop: parseFloat(e.target.value)}))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Bottom</label>
                          <input type="number" step="0.05" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.boardBottom) ? '' : debugConfig.boardBottom} onChange={e => setDebugConfig(p => ({...p, boardBottom: parseFloat(e.target.value)}))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Left</label>
                          <input type="number" step="0.05" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.boardLeft) ? '' : debugConfig.boardLeft} onChange={e => setDebugConfig(p => ({...p, boardLeft: parseFloat(e.target.value)}))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Right</label>
                          <input type="number" step="0.05" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.boardRight) ? '' : debugConfig.boardRight} onChange={e => setDebugConfig(p => ({...p, boardRight: parseFloat(e.target.value)}))} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Pkt Off 1</label>
                          <input type="number" step="0.01" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.baseOffset1) ? '' : debugConfig.baseOffset1} onChange={e => setDebugConfig(p => ({...p, baseOffset1: parseFloat(e.target.value)}))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-white/30 uppercase">Pkt Off 2</label>
                          <input type="number" step="0.01" className="w-full bg-white/5 border border-white/5 text-white rounded p-1 text-[9px]" value={Number.isNaN(debugConfig.baseOffset2) ? '' : debugConfig.baseOffset2} onChange={e => setDebugConfig(p => ({...p, baseOffset2: parseFloat(e.target.value)}))} />
                        </div>
                      </div>
                    </div>

                    <button 
                       onClick={() => setDebugConfig(prev => ({ ...prev, enableDrag: !prev.enableDrag }))}
                       className={`w-full py-2 rounded-xl text-[9px] font-bold uppercase transition-all ${debugConfig.enableDrag ? 'bg-red-500/80 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white/50'}`}
                    >
                      {debugConfig.enableDrag ? 'Drag Active' : 'Enable Drag'}
                    </button>
                  </div>
                )}
             </div>
           )}
        </div>

        {/* Controls Section */}
        <div className="px-6 py-6 bg-white border-t border-[#FF8FA3]/10 flex flex-col items-center gap-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] relative z-20">
          <div className="flex items-center justify-around w-full max-w-md">
            <LudoDice 
              name={role === 'owner' ? 'You' : 'Rahul'} 
              active={gameState.turn === 'owner'} 
              diceVal={gameState.turn === 'owner' ? gameState.dice : null} 
              isRolling={isRolling && gameState.turn === 'owner'}
              onRoll={rollDice}
            />
            <div className="h-12 w-px bg-gradient-to-b from-gray-50 via-gray-200 to-gray-50 opacity-50" />
            <LudoDice 
              name={role === 'partner' ? 'You' : getPartnerName()} 
              active={gameState.turn === 'partner'} 
              diceVal={gameState.turn === 'partner' ? gameState.dice : null}
              isRolling={isRolling && gameState.turn === 'partner'}
              onRoll={rollDice}
            />
          </div>
          
          <div className="flex gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
               <div className={`w-2.5 h-2.5 rounded-full ${myColor === 'red' ? 'bg-[#FF3D3D]' : 'bg-[#00A3FF]'}`} />
               <span className="text-[10px] font-black text-[#1a1a1a] uppercase tracking-tighter">You ({myColor})</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
               <div className={`w-2.5 h-2.5 rounded-full ${partnerColor === 'red' ? 'bg-[#FF3D3D]' : 'bg-[#00A3FF]'}`} />
               <span className="text-[10px] font-black text-[#1a1a1a] uppercase tracking-tighter">{getPartnerName()} ({partnerColor})</span>
             </div>
          </div>
        </div>

        {/* Win/Overlay */}
        <AnimatePresence>
          {gameState.winner && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#FF8FA3]/95 backdrop-blur-lg z-[130] flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl relative">
                  <Heart className="w-12 h-12 text-white fill-white animate-pulse" />
                  <div className="absolute -top-2 -right-2 bg-white text-[#FF8FA3] px-3 py-1 rounded-full text-[10px] font-black uppercase">Champion</div>
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">LUDO KING! 👑</h2>
              <p className="text-xl font-bold opacity-90 mb-10">
                {gameState.winner === role ? "You claimed the throne!" : `${getPartnerName()} won our hearts!`}
              </p>
              <button 
                onClick={onClose}
                className="w-full max-w-[200px] py-4 bg-white text-[#FF8FA3] rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                End Game
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function LudoBaseOverlay({ color, r, c, pieces, tokenImg, onPieceClick, active, debugConfig, setDragInfo, setDebugConfig }: { 
  color: string, 
  r: number, 
  c: number, 
  pieces: number[], 
  tokenImg: string, 
  onPieceClick?: (idx: number) => void, 
  active: boolean,
  debugConfig: any,
  setDragInfo: (info: string | null) => void,
  setDebugConfig: any
}) {
  // Geometric center of pockets in a 6x6 base grid
  const baseCells = [
    [r + debugConfig.baseOffset1, c + debugConfig.baseOffset1], [r + debugConfig.baseOffset1, c + debugConfig.baseOffset2],
    [r + debugConfig.baseOffset2, c + debugConfig.baseOffset1], [r + debugConfig.baseOffset2, c + debugConfig.baseOffset2]
  ];

  return (
    <>
      {pieces.map((p, idx) => {
        if (p !== -1) return null;
        const [row, col] = baseCells[idx];
        return (
          <div 
            key={idx}
            className="absolute flex items-center justify-center z-20 pointer-events-none"
            style={{ 
              top: `${(row/15)*100}%`, 
              left: `${(col/15)*100}%`,
              width: `${debugConfig.tokenSizeBase}%`, 
              height: `${debugConfig.tokenSizeBase}%`,
              transform: 'translate(-50%, -50%)' 
            }}
          >
            <motion.img 
              layoutId={`${color}-piece-${idx}`}
              drag={debugConfig.enableDrag}
              dragSnapToOrigin={!debugConfig.enableDrag}
              onDrag={(_: any, info: any) => {
                if (debugConfig.enableDrag) {
                   setDragInfo(`${color} base piece ${idx}: offset x:${info.offset.x.toFixed(1)}, y:${info.offset.y.toFixed(1)}`);
                }
              }}
              src={tokenImg}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (debugConfig.enableDrag) {
                  setDebugConfig(prev => ({ ...prev, selectedTarget: 'pockets' }));
                } else {
                  onPieceClick?.(idx); 
                }
              }}
              className={`w-full h-full object-contain pointer-events-auto cursor-pointer transition-all active:scale-75 ${active ? 'animate-bounce drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]' : 'drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)]'}`}
              alt="Token"
            />
          </div>
        );
      })}
    </>
  );
}

function DiceFace({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <img 
        src={DICE_FACES[value as keyof typeof DICE_FACES]} 
        className="w-[85%] h-[85%] object-contain" 
        alt={`Dice ${value}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function LudoDice({ name, active, diceVal, isRolling, onRoll }: { name: string, active: boolean, diceVal: number | null, isRolling: boolean, onRoll: () => void }) {
  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${active ? 'scale-105' : 'opacity-30 grayscale scale-90'}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a1a1a] mb-1">{name}</span>
      <div className="relative">
        <button 
          onClick={onRoll}
          disabled={!active || isRolling || diceVal !== null}
          className={`w-20 h-20 flex items-center justify-center transition-all z-10 relative group
            ${!active ? 'cursor-not-allowed' : 'cursor-pointer active:translate-y-1'}
            ${isRolling ? 'animate-bounce' : ''}
          `}
        >
          {/* Dice Base */}
          <img 
            src={diceBase} 
            className="absolute inset-0 w-full h-full object-contain filter drop-shadow-lg" 
            alt="Dice Base" 
            referrerPolicy="no-referrer"
          />
          
          <div className="w-full h-full relative z-20 flex items-center justify-center">
            {isRolling ? (
               <div className="w-full h-full opacity-40 animate-pulse flex items-center justify-center">
                  <div className="w-12 h-12 rounded-lg bg-gray-200/50" />
               </div>
            ) : diceVal !== null ? (
               <DiceFace value={diceVal} />
            ) : null}
          </div>
        </button>
        
        {active && !isRolling && diceVal === null && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
             <span className="text-[9px] font-black text-[#FF8FA3] uppercase tracking-widest bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md border border-[#FF8FA3]/20 animate-bounce block">
               ROLL!
             </span>
          </motion.div>
        )}
      </div>
    </div>
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

function MessageItem({ 
  msg, 
  role, 
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
  onJoinGame
}: { 
  msg: Message, 
  role: UserRole, 
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
  onJoinGame?: (game: { id: string, type: 'tictactoe' | 'ludo' }) => void,
  key?: React.Key
}) {
  const isOwn = msg.sender_role === role;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  const emojis = ['❤️', '😂', '😮', '😢', '😡', '👍'];
  const [showPicker, setShowPicker] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  // Close picker on outside click elsewhere or scroll
  useEffect(() => {
    if (showPicker) {
      const handleClose = () => setShowPicker(false);
      window.addEventListener('scroll', handleClose, true);
      window.addEventListener('click', handleClose, true);
      return () => {
        window.removeEventListener('scroll', handleClose, true);
        window.removeEventListener('click', handleClose, true);
      };
    }
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSwiping || selectionActive) return;
    longPressTimer.current = setTimeout(() => {
      if (!msg.deleted) setShowPicker(true);
      if (!isSelected) onToggleSelect(msg);
      if (window.navigator.vibrate) window.navigator.vibrate(40);
    }, 400);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (selectionActive && !isSwiping) onToggleSelect(msg);
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
      className={`relative w-full flex transition-all duration-200 select-none py-1.5 cursor-default ${
        isSelected ? 'bg-[#FF8FA3]/20 backdrop-blur-[1px]' : 'hover:bg-romantic-pink/5'
      } ${isOwn ? 'justify-end' : 'justify-start'} ${showPicker ? 'z-[60]' : 'z-auto'}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (isSwiping) return;
        if (!msg.deleted) setShowPicker(true);
        if (!isSelected) onToggleSelect(msg);
        if (window.navigator.vibrate) window.navigator.vibrate(50);
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
        dragListener={!showPicker}
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
        onPointerMove={(e) => {
          // If finger moves more than 10px, cancel long press
          // Note: we don't have start position here easily, but dragStart will also clear it.
          // For now, let's rely on dragStart and a slightly more lenient pointermove.
        }}
        onClick={handleClick}
        className="relative w-full flex items-end px-2 lg:px-4"
      >
        {!isOwn && (
          <div className="flex-shrink-0 mr-2 self-end mb-1 cursor-pointer active:scale-95 transition-transform" onClick={() => partnerProfile?.photo_url && onViewImage(partnerProfile.photo_url)}>
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
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className={`absolute bottom-full mb-3 z-50 bg-white/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(255,143,163,0.15)] border border-[#FF8FA3]/10 p-1.5 rounded-full flex gap-1 w-max ${
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
                        onClick={() => {
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
              className={`px-3 py-2 lg:px-4 lg:py-2.5 text-[15px] lg:text-[16px] leading-relaxed shadow-sm relative transition-all ${
                isOwn ? 'chat-bubble-owner' : 'chat-bubble-partner'
              } ${msg.deleted ? 'select-none' : ''}`}
            >
              {/* Show reply context */}
              {msg.replyTo && !msg.deleted && (
                <div className={`mb-2 p-2 rounded-lg text-[11px] border-l-4 ${isOwn ? 'bg-white/10 border-white/50 text-white/90' : 'bg-[#FF8FA3]/5 border-[#FF8FA3]/50 text-[#6E6E6E]/90'}`}>
                  <p className="font-bold mb-0.5 opacity-60">
                     {getSenderName(msg.replyTo.sender_role)}
                  </p>
                  <p className="italic truncate line-clamp-1 opacity-80">"{msg.replyTo.text}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-x-2 gap-y-1 min-w-[60px]">
                <span className={`whitespace-pre-wrap flex-1 break-words ${msg.deleted ? 'italic opacity-60' : ''}`}>
                  {msg.deleted ? (
                    msg.deletedBy === role ? 'You deleted this message' : 'This message was deleted'
                  ) : (
                    msg.text
                  )}
                  {msg.isEdited && !msg.deleted && (
                    <span className="text-[9px] opacity-40 ml-1 italic tracking-tight">(edited)</span>
                  )}
                </span>
                <div className={`flex items-center gap-1 opacity-50 text-[10px] ml-auto h-4 mb-[-2px] tracking-tight font-medium`}>
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
                      {msg.gameInvite.gameType === 'tictactoe' ? 'Tic Tac Toe' : 'Ludo Classic'}
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
}

function HeartFloating({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute top-0 right-0 pointer-events-none overflow-visible w-0 h-0">
      <Heart className="w-4 h-4 text-[#FF8FA3] fill-[#FF8FA3] animate-float-heart" />
    </div>
  );
}

function ProfileModal({ profile, onClose, config, isOwner, onLogout }: { profile: UserProfile, onClose: () => void, config: AppConfig | null, isOwner: boolean, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'me' | 'partner'>('me');
  const [name, setName] = useState(profile.display_name || "");
  const [photo, setPhoto] = useState(profile.photo_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
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
        setPhoto(reader.result as string);
        setShowCropper(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      alert("Failed to process image.");
    }
  };

  const save = async () => {
    setIsSaving(true);
    try {
      // Save Profile across all accounts with same role to keep identity consistent
      await supabase.from('users').update({
        display_name: name,
        photo_url: photo
      }).eq('role', profile.role);
      
      // Save Partner Config if Owner
      if (isOwner) {
        await supabase.from('app_config').update({
          partner_allowed_emails: emails,
          partner_passcode: partnerPasscode.trim()
        }).eq('id', 'main');
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
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
      <div className="h-20 flex-shrink-0 border-b border-[#FF8FA3]/10 flex items-center px-6 gap-4 bg-[#FFF8F6]/50">
        <button onClick={onClose} className="p-2 -ml-2 text-[#6E6E6E]">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-[#1a1a1a]">Settings</h2>
      </div>

      <div className="flex border-b border-[#FF8FA3]/5 px-6 pt-2 bg-white flex-shrink-0">
        <button 
          onClick={() => setActiveTab('me')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'me' ? 'border-[#FF8FA3] text-[#FF8FA3]' : 'border-transparent text-[#6E6E6E]/40'}`}
        >
          My Profile
        </button>
        {isOwner && (
          <button 
            onClick={() => setActiveTab('partner')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'partner' ? 'border-[#FF8FA3] text-[#FF8FA3]' : 'border-transparent text-[#6E6E6E]/40'}`}
          >
            Partner Access
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'me' ? (
          <div className="max-w-md mx-auto space-y-8">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-[#FFD6C9] overflow-hidden border-4 border-[#FF8FA3]/10 relative">
                  {photo ? (
                    <img src={photo} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-[#FF8FA3]">
                      {name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-[#FF8FA3] p-2.5 rounded-full text-white shadow-lg border-2 border-white group-hover:scale-110 transition-transform"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" ref={fileInputRef} onChange={handleFileChange} 
                  accept="image/*" className="hidden" 
                />
              </div>
              <p className="mt-4 text-[10px] font-bold text-[#6E6E6E] uppercase tracking-widest opacity-40">Tap camera to change photo</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block ml-1 opacity-60">Display Name</label>
                <input 
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="How your partner sees you..."
                  className="w-full bg-[#FFF8F6] border border-[#FF8FA3]/10 rounded-2xl px-5 py-4 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF8FA3]/10"
                />
              </div>
              
              <div className="pt-8 border-t border-[#FF8FA3]/5 flex flex-col gap-4">
                <button 
                  onClick={save}
                  disabled={isSaving}
                  className="w-full h-14 bg-[#FF8FA3] text-white rounded-2xl text-[13px] font-bold uppercase tracking-widest shadow-xl shadow-[#FF8FA3]/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Synchronizing..." : "Apply Changes"}
                </button>
                <button 
                  onClick={onLogout}
                  className="w-full h-14 bg-[#FFF8F6] text-red-400 border border-red-100 rounded-2xl text-[13px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>
              </div>
            </div>
          </div>
        ) : (
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
              onClick={save}
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

function PartnerInfoModal({ partner, myProfile, onClose, onViewImage }: { partner: UserProfile, myProfile: UserProfile | null, onClose: () => void, onViewImage: (url: string) => void }) {
  const [nickname, setNickname] = useState(myProfile?.partnerNicknames?.[partner.uid] || "");
  const [isSaving, setIsSaving] = useState(false);

  const saveNickname = async () => {
    if (!myProfile) return;
    setIsSaving(true);
    try {
      const updatedNicknames = { ...(myProfile.partnerNicknames || {}), [partner.uid]: nickname };
      await supabase.from('users').update({
        partnerNicknames: updatedNicknames
      }).eq('id', myProfile.uid);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[110] flex flex-col bg-white"
    >
      <div className="h-20 flex-shrink-0 border-b border-[#FF8FA3]/10 flex items-center px-6 gap-4 bg-[#FFF8F6]/50">
        <button onClick={onClose} className="p-2 -ml-2 text-[#6E6E6E]">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-[#1a1a1a]">Contact Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-md mx-auto flex flex-col items-center">
      <div 
        className="w-48 h-48 rounded-full bg-[#FFD6C9] overflow-hidden border-8 border-[#FF8FA3]/5 shadow-xl cursor-pointer active:scale-95 transition-transform"
        onClick={() => partner.photo_url && onViewImage(partner.photo_url)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {partner.photo_url ? (
          <img 
            src={partner.photo_url} 
            alt={partner.display_name} 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
            style={{ WebkitTouchCallout: 'none' }}
          />
        ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl font-bold text-[#FF8FA3]">
                {partner.display_name?.[0] || '?'}
              </div>
            )}
          </div>

          <div className="mt-8 text-center space-y-1 w-full">
            <h3 className="text-2xl font-bold text-[#1a1a1a]">{partner.display_name}</h3>
            <p className="text-sm font-mono text-[#6E6E6E] opacity-40">{partner.email}</p>
          </div>

          <div className="w-full mt-12 space-y-6">
            <div className="bg-[#FFF8F6] p-6 rounded-3xl border border-[#FF8FA3]/10 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E6E] mb-2 block opacity-60">Custom Nickname</label>
                <div className="relative">
                  <input 
                    value={nickname} onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter nickname..."
                    className="w-full bg-white border border-[#FF8FA3]/10 rounded-2xl px-5 py-4 text-[16px] focus:outline-none shadow-sm"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2">
                    <Pencil className="w-4 h-4 text-[#FF8FA3]/40" />
                  </div>
                </div>
                <p className="mt-3 text-[10px] italic text-[#6E6E6E]/60 text-center">This will only change the name <span className="font-bold underline">you</span> see for them.</p>
              </div>

              <button 
                onClick={saveNickname}
                disabled={isSaving}
                className="w-full h-14 bg-[#FF8FA3] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#FF8FA3]/10 active:scale-95 transition-all mt-4"
              >
                {isSaving ? "Saving..." : "Set Nickname"}
              </button>
            </div>
          </div>
        </div>
      </div>
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





