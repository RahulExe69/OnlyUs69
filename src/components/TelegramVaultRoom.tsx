import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  Send, 
  Trash2, 
  Reply, 
  RefreshCw, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  Settings2, 
  Cloud, 
  MessageSquare,
  X,
  Heart,
  ExternalLink,
  Sparkles,
  Download
} from 'lucide-react';
import { UserProfile } from '../types';
import { 
  TelegramVaultMessage, 
  TelegramVaultStatus, 
  getTelegramStatus, 
  setTelegramChannelId, 
  loadCachedVaultMessages, 
  saveCachedVaultMessages, 
  sendTelegramVaultMessage, 
  reactTelegramVaultMessage, 
  deleteTelegramVaultMessage, 
  pullTelegramUpdates,
  subscribeToTelegramVaultRealtime
} from '../lib/telegramService';
import { useOverlayBack } from '../lib/overlayManager';
import { supabase } from '../lib/supabase';
import { TelegramMessageItem } from './TelegramMessageItem';
import { TelegramChatInputBar } from './TelegramChatInputBar';

interface TelegramVaultRoomProps {
  userProfile: UserProfile | null;
  partnerProfile: UserProfile | null;
  isOwner: boolean;
  onBack: () => void;
  onSwitchToOnlyUs: () => void;
}

export const TelegramVaultRoom: React.FC<TelegramVaultRoomProps> = ({
  userProfile,
  partnerProfile,
  isOwner,
  onBack,
  onSwitchToOnlyUs,
}) => {
  const [messages, setMessages] = useState<TelegramVaultMessage[]>(() => loadCachedVaultMessages());
  const [isSending, setIsSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<TelegramVaultMessage | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  
  // Status and setup state
  const [status, setStatus] = useState<TelegramVaultStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customChannelInput, setCustomChannelInput] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const myRole = isOwner ? 'owner' : 'partner';
  const myName = userProfile?.display_name || (isOwner ? 'Rahul' : 'Nusrat');
  const partnerName = userProfile?.partnerNicknames?.[partnerProfile?.uid || ''] || partnerProfile?.display_name || (isOwner ? 'Nusrat' : 'Rahul');

  useOverlayBack(showConfigModal, () => setShowConfigModal(false), 'telegram-config-modal');
  useOverlayBack(Boolean(viewingImageUrl), () => setViewingImageUrl(null), 'telegram-vault-image-viewer');

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Jump to quoted message with smooth scroll & temporary pulse highlight
  const handleScrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`vault-msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('theme-message-focus');
      setTimeout(() => el.classList.remove('theme-message-focus'), 1400);
    }
  }, []);

  // WhatsApp-style conversational grouping & avatar clustering
  const groupedMessages = useMemo(() => {
    return messages.map((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];

      const prevDate = prev ? new Date(prev.timestamp).getTime() : 0;
      const currDate = new Date(msg.timestamp).getTime();
      const nextDate = next ? new Date(next.timestamp).getTime() : 0;

      const timeDiffPrev = (currDate - prevDate) / (1000 * 60);
      const timeDiffNext = (nextDate - currDate) / (1000 * 60);

      const isFirstInGroup = !prev || prev.sender_role !== msg.sender_role || timeDiffPrev > 15;
      const isLastInGroup = !next || next.sender_role !== msg.sender_role || timeDiffNext > 15;
      const shouldShowAvatar = isFirstInGroup && msg.sender_role !== myRole;

      return {
        msg,
        isFirstInGroup,
        isLastInGroup,
        shouldShowAvatar
      };
    });
  }, [messages, myRole]);

  // Initial status check with auto-adoption
  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const s = await getTelegramStatus();
      setStatus(s);
      if (s.activeChatId) {
        setCustomChannelInput(s.activeChatId);
      } else if (s.detectedChats && s.detectedChats.length > 0) {
        const targetId = String(s.detectedChats[0].id);
        setCustomChannelInput(targetId);
        await setTelegramChannelId(targetId);
        const updated = await getTelegramStatus();
        setStatus(updated);
      }
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Real-time broadcast sync between devices (zero latency via Supabase WebSocket)
  useEffect(() => {
    const unsubscribe = subscribeToTelegramVaultRealtime((event) => {
      if (event.type === 'message') {
        setMessages((prev) => {
          if (prev.some(m => m.id === event.message.id || (m.telegram_id && m.telegram_id === event.message.telegram_id))) {
            return prev.map(m => (m.id === event.message.id || (m.telegram_id && m.telegram_id === event.message.telegram_id)) ? event.message : m);
          }
          const next = [...prev, event.message];
          saveCachedVaultMessages(next);
          return next;
        });
        scrollToBottom(true);
      } else if (event.type === 'reaction') {
        setMessages((prev) => prev.map(m => {
          if (m.id === String(event.messageId) || m.telegram_id === Number(event.messageId)) {
            const nextReactions = { ...(m.reactions || {}) };
            if (event.emoji) {
              nextReactions[event.emoji] = 1;
            } else if (event.previousEmoji) {
              delete nextReactions[event.previousEmoji];
            } else {
              delete nextReactions['❤️'];
            }
            return { ...m, reactions: nextReactions };
          }
          return m;
        }));
      } else if (event.type === 'delete') {
        setMessages((prev) => prev.filter(m => m.id !== String(event.messageId) && m.telegram_id !== Number(event.messageId)));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [scrollToBottom]);

  // Auto-detect polling when pending setup or setup modal is open
  useEffect(() => {
    if (!status?.isChannelConnected || showConfigModal) {
      const interval = setInterval(() => {
        refreshStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [status?.isChannelConnected, showConfigModal, refreshStatus]);

  // Initial scroll
  useEffect(() => {
    setTimeout(() => scrollToBottom(false), 60);
  }, [messages.length, scrollToBottom]);

  // Continuous sync loop for real-time delivery
  useEffect(() => {
    let isCancelled = false;
    let timer: any = null;

    const runSync = async () => {
      if (isCancelled) return;
      try {
        await pullTelegramUpdates((newMsg) => {
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) {
              return prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg } : m);
            }
            const next = [...prev, newMsg];
            saveCachedVaultMessages(next);
            return next;
          });
        });
      } catch (err) {
        // sync error
      }
      if (!isCancelled) {
        timer = setTimeout(runSync, 2500);
      }
    };

    runSync();
    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Send text message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const targetReply = replyTarget;
    setReplyTarget(null);
    setIsSending(true);

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: TelegramVaultMessage = {
      id: tempId,
      telegram_id: 0,
      text,
      sender_role: myRole,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_encrypted: true,
      replyTo: targetReply ? {
        id: targetReply.id,
        text: targetReply.text,
        sender_role: targetReply.sender_role
      } : null
    };

    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom(true);

    try {
      const sent = await sendTelegramVaultMessage(text, myRole, targetReply);
      setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
    } catch (err: any) {
      console.warn('[TelegramVault] Send error:', err);
      // Revert optimistic msg
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert(`Send failed: ${err.message || 'Check channel ID and bot administrator permissions.'}`);
      setShowConfigModal(true);
    } finally {
      setIsSending(false);
      scrollToBottom(true);
    }
  };

  // Send photo attachment
  const handleSendImage = async (file: File) => {
    if (isSending) return;
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const localPreviewUrl = URL.createObjectURL(file);
    const targetReply = replyTarget;
    setReplyTarget(null);

    const optimisticMsg: TelegramVaultMessage = {
      id: tempId,
      telegram_id: 0,
      text: '',
      sender_role: myRole,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_encrypted: true,
      replyTo: targetReply ? {
        id: targetReply.id,
        text: targetReply.text,
        sender_role: targetReply.sender_role
      } : null,
      media: {
        type: 'image',
        url: localPreviewUrl,
        fileName: file.name,
        fileSize: file.size
      }
    };

    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom(true);

    try {
      let finalUrl = localPreviewUrl;
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
      const storagePath = `vault_${Date.now()}_${safeName}`;

      try {
        const { error: uploadErr } = await supabase.storage
          .from('chat-media')
          .upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: true });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            finalUrl = pubData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('Storage bridge error:', storageErr);
      }

      const sent = await sendTelegramVaultMessage('', myRole, targetReply, {
        type: 'image',
        url: finalUrl,
        fileName: file.name,
        fileSize: file.size
      });

      setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
    } catch (err: any) {
      console.warn('[TelegramVault] Image upload error:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert(`Failed to send image: ${err.message || 'Error uploading to Vault'}`);
    } finally {
      setIsSending(false);
      scrollToBottom(true);
    }
  };

  // Double tap or reaction toggle
  const handleToggleReaction = async (msg: TelegramVaultMessage, emoji: string = '❤️') => {
    const current = msg.reactions?.[emoji] || 0;
    const nextReactions = { ...(msg.reactions || {}) };
    if (current > 0) {
      delete nextReactions[emoji];
    } else {
      nextReactions[emoji] = 1;
    }

    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: nextReactions } : m));
    saveCachedVaultMessages(messages.map(m => m.id === msg.id ? { ...m, reactions: nextReactions } : m));
    await reactTelegramVaultMessage(msg.telegram_id || msg.id, current > 0 ? '' : emoji, myRole);
  };

  // Delete message
  const handleDeleteMessage = async (msg: TelegramVaultMessage) => {
    if (!confirm('Delete this message for everyone from the Telegram Vault?')) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    saveCachedVaultMessages(messages.filter(m => m.id !== msg.id));
    await deleteTelegramVaultMessage(msg.telegram_id || msg.id);
  };

  // Save custom channel ID
  const handleSaveChannelId = async (overrideId?: string) => {
    const target = (overrideId || customChannelInput).trim();
    if (!target) return;
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      const res = await setTelegramChannelId(target);
      if (res.ok) {
        setConfigMessage('✅ Connected successfully to Telegram channel!');
        await refreshStatus();
        setTimeout(() => setShowConfigModal(false), 1000);
      } else {
        setConfigMessage(`⚠️ ${res.error || 'Chat not found'}`);
      }
    } catch (e: any) {
      setConfigMessage(`❌ Error: ${e.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[100dvh] max-h-[100dvh] bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden relative font-sans select-none">
      
      {/* Top Header */}
      <header className="h-[calc(4.25rem+env(safe-area-inset-top,0px))] flex-shrink-0 relative w-full z-40 bg-[var(--theme-bg)]/95 backdrop-blur-md border-b border-[var(--theme-border)]/70 px-3.5 sm:px-5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-[var(--theme-text)]/80 hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface)] rounded-full transition-all active:scale-90"
            title="Back to Hub"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.3]" />
          </button>

          {/* Room Title with Security Badge */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[var(--theme-text)] truncate">
                Telegram Vault
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                E2EE
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[var(--theme-text)]/70 font-medium">
              {status?.isChannelConnected ? (
                <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{status.channel?.title || 'OnlyUs69'} • Active</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-500 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Setup Channel Required</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Room Switcher */}
        <div className="flex items-center gap-2">
          {/* Direct Switch to OnlyUs Core Chat */}
          <button
            onClick={onSwitchToOnlyUs}
            className="px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-accent)] hover:text-white border border-[var(--theme-border)] text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs"
            title="Switch to OnlyUs Core (Supabase)"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">OnlyUs Chat</span>
          </button>

          {/* Connection Status / Setup Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className={`p-2 rounded-full border transition-all active:scale-95 ${
              status?.isChannelConnected 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
            }`}
            title="Telegram Vault Settings"
          >
            <Settings2 className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* Warning Banner if Channel not yet connected */}
      {!isLoadingStatus && !status?.isChannelConnected && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-500 font-medium z-30">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {status?.error || 'Telegram channel not connected yet. Tap Setup to link your private channel.'}
            </span>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="ml-3 px-2.5 py-1 rounded-md bg-amber-500 text-black font-bold shrink-0 text-[11px] shadow-2xs"
          >
            Setup
          </button>
        </div>
      )}

      {/* Main Messages Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 flex flex-col gap-2 relative z-10 overscroll-contain"
      >
        {/* Intro E2EE Notice (Compact WhatsApp / Signal style) */}
        <div className="max-w-xs sm:max-w-sm mx-auto my-1 px-3.5 py-1.5 rounded-full bg-[var(--theme-surface)]/90 backdrop-blur-md border border-[var(--theme-border)] text-center text-[11px] font-medium text-[var(--theme-text)]/75 shadow-2xs flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[2.5]" />
          <span>AES-256 Encrypted • Private Cloud Vault</span>
        </div>

        {/* Empty state if no messages yet */}
        {messages.length === 0 && (
          <div className="my-auto py-8 px-4 text-center max-w-sm mx-auto flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#0088cc] to-[#229ed9] text-white flex items-center justify-center shadow-lg">
              <Send className="w-7 h-7 stroke-[2.2] translate-x-[-1px] translate-y-[1px]" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--theme-text)]">
                Welcome to Telegram Vault
              </h3>
              <p className="text-xs text-[var(--theme-text)]/65 mt-1 leading-relaxed">
                Zero storage limits & permanent clean-phone recovery. Everything you send here is encrypted on your phone with AES-256 before being backed up to Telegram.
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Ready & Connected to {status?.channel?.title || 'OnlyUs69'}</span>
            </div>
          </div>
        )}

        {/* Render Messages with WhatsApp-style grouping, swipe-to-reply, double-tap ❤️ & reactions */}
        {groupedMessages.map(({ msg, isFirstInGroup, isLastInGroup, shouldShowAvatar }) => (
          <TelegramMessageItem
            key={msg.id}
            msg={msg}
            myRole={myRole}
            partnerName={partnerName}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            shouldShowAvatar={shouldShowAvatar}
            userProfile={userProfile}
            partnerProfile={partnerProfile}
            onReply={setReplyTarget}
            onReact={handleToggleReaction}
            onDelete={handleDeleteMessage}
            onScrollToMessage={handleScrollToMessage}
            onViewImage={setViewingImageUrl}
          />
        ))}
      </div>

      {/* WhatsApp-style Input Bar with Whisper Marquee Ticker, Emojis & Photo Attach */}
      <TelegramChatInputBar
        myRole={myRole}
        partnerName={partnerName}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
        onSendMessage={handleSendMessage}
        onSendImage={handleSendImage}
        isSending={isSending}
      />

      {/* Settings / Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-[var(--theme-text)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-base">Telegram Vault Setup</h3>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 rounded-full hover:bg-[var(--theme-bg)] text-[var(--theme-text)]/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Connected Success View */}
              {status?.isChannelConnected ? (
                <div className="flex flex-col items-center text-center gap-3.5 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/25 shadow-xs">
                    <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
                  </div>
                  
                  <div>
                    <h4 className="text-base font-black text-[var(--theme-text)]">
                      Connected to {status.channel?.title || 'OnlyUs69'}
                    </h4>
                    <p className="text-xs text-[var(--theme-text)]/70 mt-1">
                      Bot <strong className="text-emerald-500">@{status.bot?.username || 'OnlyUs69Bot'}</strong> is an Administrator with Post permissions.
                    </p>
                  </div>

                  <div className="w-full p-3.5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs flex flex-col gap-2 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--theme-text)]/60">Channel Name:</span>
                      <span className="font-bold text-[var(--theme-text)]">{status.channel?.title || 'OnlyUs69'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--theme-text)]/60">Channel ID:</span>
                      <span className="font-mono font-bold text-emerald-500">{status.activeChatId || status.channel?.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--theme-text)]/60">Status:</span>
                      <span className="font-semibold text-emerald-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Admin Active & E2EE Ready
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all cursor-pointer"
                  >
                    Start Chatting in Vault
                  </button>

                  <button
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="text-xs text-[var(--theme-text)]/50 hover:text-[var(--theme-text)] underline cursor-pointer mt-1"
                  >
                    {showAdvancedSettings ? 'Hide Channel Settings' : 'Switch or Change Channel'}
                  </button>

                  {/* Optional Advanced Settings */}
                  {showAdvancedSettings && (
                    <div className="w-full pt-3 border-t border-[var(--theme-border)]/50 flex flex-col gap-2 text-left">
                      <label className="text-xs font-bold text-[var(--theme-text)]/80">
                        Switch Channel ID or Link:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customChannelInput}
                          onChange={(e) => setCustomChannelInput(e.target.value)}
                          placeholder="e.g. -100xxxxxxxxxx"
                          className="flex-1 h-10 px-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs focus:outline-hidden focus:border-[var(--theme-accent)] font-mono"
                        />
                        <button
                          onClick={() => handleSaveChannelId()}
                          disabled={configSaving || !customChannelInput.trim()}
                          className="px-4 h-10 rounded-xl bg-[var(--theme-accent)] text-white text-xs font-bold disabled:opacity-50 active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          {configSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Switch'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Unconnected / Setup View */
                <div className="flex flex-col gap-3.5">
                  {/* Status overview */}
                  <div className="p-3.5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--theme-text)]/70">Bot Status:</span>
                      <span className="font-bold text-emerald-500 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        @{status?.bot?.username || 'OnlyUs69Bot'} (Verified)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--theme-text)]/70">Channel Connection:</span>
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Pending Setup
                      </span>
                    </div>
                  </div>

                  {/* Detected Channels 1-Tap Connect */}
                  {status?.detectedChats && status.detectedChats.length > 0 && (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2">
                      <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Channel Detected! Tap to Connect:
                      </span>
                      {status.detectedChats.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSaveChannelId(String(c.id))}
                          className="p-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center justify-between hover:bg-emerald-400 active:scale-98 transition-all cursor-pointer shadow-xs"
                        >
                          <span>Connect "{c.title}"</span>
                          <span className="text-[11px] opacity-80">({c.id}) →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Action 1-Tap Links */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-[var(--theme-text)]/80">1-Tap Telegram Setup:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={`https://t.me/${status?.bot?.username || 'OnlyUs69Bot'}?startchannel=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all text-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Add to Channel as Admin</span>
                      </a>
                      <a
                        href={`https://t.me/${status?.bot?.username || 'OnlyUs69Bot'}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-surface)] text-xs font-semibold flex items-center justify-center gap-2 transition-all text-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Open Direct Bot Chat</span>
                      </a>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="text-xs text-[var(--theme-text)]/70 leading-relaxed space-y-1.5 p-3 rounded-xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)]/50">
                    <p className="font-semibold text-[var(--theme-text)]">
                      How it works:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-0.5">
                      <li>Tap <strong>Add to Channel as Admin</strong> above to add <strong>@{status?.bot?.username || 'OnlyUs69Bot'}</strong> to your channel.</li>
                      <li>Enable <em>"Post Messages"</em> permission.</li>
                      <li>Post any message in the channel (or send <code>/start</code> in bot chat).</li>
                      <li>The app will <strong>auto-detect & connect</strong> instantly!</li>
                    </ol>
                  </div>

                  {/* Channel ID Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[var(--theme-text)]/80">
                      Manual Channel Link or ID (optional):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customChannelInput}
                        onChange={(e) => setCustomChannelInput(e.target.value)}
                        placeholder="e.g. -100xxxxxxxxxx or t.me/channel_name"
                        className="flex-1 h-10 px-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs focus:outline-hidden focus:border-[var(--theme-accent)] font-mono"
                      />
                      <button
                        onClick={() => handleSaveChannelId()}
                        disabled={configSaving || !customChannelInput.trim()}
                        className="px-4 h-10 rounded-xl bg-[var(--theme-accent)] text-white text-xs font-bold disabled:opacity-50 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        {configSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  </div>

                  {/* Re-check button */}
                  <button
                    onClick={refreshStatus}
                    className="w-full py-2.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs font-bold hover:bg-[var(--theme-surface)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                    <span>Re-Check Status & Auto-Detect</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Photo Viewer */}
      <AnimatePresence>
        {viewingImageUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={() => setViewingImageUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-3xl max-h-[85vh] flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <a
                  href={viewingImageUrl}
                  download="vault-media.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-full bg-black/50 hover:bg-black/75 text-white transition-all backdrop-blur-sm cursor-pointer"
                  title="Download Image"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setViewingImageUrl(null)}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/75 text-white transition-all backdrop-blur-sm cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <img
                src={viewingImageUrl}
                alt="Vault Attachment"
                className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
