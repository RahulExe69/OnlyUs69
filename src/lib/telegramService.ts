/**
 * Telegram Cloud Vault Service for OnlyUs
 * 
 * Provides an independent, free, End-to-End Encrypted (E2EE) 2nd chat room
 * backed by Telegram's Bot API and private channel storage.
 */

import { 
  getActiveSharedKey, 
  encryptChatMessage, 
  decryptChatMessage,
  bufferToBase64,
  base64ToBuffer 
} from './e2ee';
import { safeGetItem, safeSetItem } from './safeStorage';
import { supabase } from './supabase';

export interface TelegramVaultMessage {
  id: string; // string representation of Telegram message_id
  telegram_id: number;
  text: string;
  sender_role: 'owner' | 'partner';
  timestamp: string;
  created_at: string;
  is_encrypted: boolean;
  replyTo?: {
    id: string;
    text: string;
    sender_role: 'owner' | 'partner';
  } | null;
  reactions?: { [emoji: string]: number };
  user_reactions?: { [role: string]: string };
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    fileName?: string;
    fileSize?: number;
  };
  deleted?: boolean;
}

export interface TelegramVaultStatus {
  ok: boolean;
  hasToken: boolean;
  isChannelConnected: boolean;
  activeChatId?: string;
  configuredRawId?: string;
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  channel?: {
    id: number | string;
    title?: string;
    username?: string;
  };
  detectedChats?: Array<{
    id: number | string;
    title: string;
    type: string;
  }>;
  error?: string;
}

const STORAGE_KEY_MSGS = 'onlyus_telegram_vault_messages';
const STORAGE_KEY_LAST_UPDATE_ID = 'onlyus_telegram_last_update_id';
const STORAGE_KEY_CHAT_ID = 'onlyus_telegram_custom_chat_id';

const DEFAULT_BOT_TOKEN = '8749152226:AAGZWbysmPdOemnJRQ9JhDM7t7uLhFDtVHk';
const DEFAULT_CHANNEL_ID = '-1003839359301';
const DEFAULT_BOT_USERNAME = 'OnlyUs69Bot';

export interface TelegramVaultConfig {
  botToken: string;
  channelId: string;
  botUsername: string;
}

let _cachedVaultConfig: TelegramVaultConfig | null = null;

export async function getVaultTelegramConfig(): Promise<TelegramVaultConfig> {
  if (_cachedVaultConfig) return _cachedVaultConfig;

  let botToken = DEFAULT_BOT_TOKEN;
  let channelId = safeGetItem(STORAGE_KEY_CHAT_ID) || DEFAULT_CHANNEL_ID;
  let botUsername = DEFAULT_BOT_USERNAME;

  try {
    const { data } = await supabase
      .from('app_config')
      .select('telegram_bot_token, telegram_channel_id, telegram_bot_username')
      .eq('id', 'main')
      .maybeSingle();

    if (data) {
      if (data.telegram_bot_token) botToken = data.telegram_bot_token;
      if (data.telegram_channel_id && !safeGetItem(STORAGE_KEY_CHAT_ID)) channelId = data.telegram_channel_id;
      if (data.telegram_bot_username) botUsername = data.telegram_bot_username;
    }
  } catch (e) {
    console.warn('[TelegramVault] Failed to load config from Supabase:', e);
  }

  _cachedVaultConfig = { botToken, channelId, botUsername };
  return _cachedVaultConfig;
}

// Fallback CryptoKey derived deterministically for Vault room if ECDH isn't exchanged yet
let _fallbackVaultKey: CryptoKey | null = null;

async function getVaultEncryptionKey(): Promise<CryptoKey> {
  const active = getActiveSharedKey();
  if (active) return active;

  if (_fallbackVaultKey) return _fallbackVaultKey;

  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode('onlyus_vault_cloud_secret_seed_2026'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  _fallbackVaultKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('onlyus_vault_salt_secure_69'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return _fallbackVaultKey;
}

/**
 * Check connectivity of the Telegram Bot and Channel
 * Supports both local proxy and direct Telegram API (for Vercel / Android APK)
 */
export async function getTelegramStatus(): Promise<TelegramVaultStatus> {
  // 1. Try local proxy first (works in Node dev server)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/telegram/status', { signal: controller.signal });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.ok) return data;
    }
  } catch (err) {
    // Local proxy not available or static host (Vercel)
  }

  // 2. Direct Telegram API fallback via Supabase config
  try {
    const config = await getVaultTelegramConfig();
    const botRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
    const botData = await botRes.json();

    if (!botData.ok) {
      return {
        ok: false,
        hasToken: false,
        isChannelConnected: false,
        error: botData.description || 'Invalid Telegram Bot Token'
      };
    }

    const botInfo = {
      id: botData.result.id,
      first_name: botData.result.first_name,
      username: botData.result.username || config.botUsername
    };

    // Test channel connectivity
    let isChannelConnected = false;
    let channelInfo: any = undefined;
    let activeChatId = config.channelId;

    if (config.channelId) {
      try {
        const chatRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getChat?chat_id=${encodeURIComponent(config.channelId)}`);
        const chatData = await chatRes.json();
        if (chatData.ok && chatData.result) {
          isChannelConnected = true;
          channelInfo = {
            id: chatData.result.id,
            title: chatData.result.title || 'OnlyUs69',
            username: chatData.result.username
          };
          activeChatId = String(chatData.result.id);
        }
      } catch (chatErr) {
        console.warn('[TelegramVault] getChat direct check failed:', chatErr);
      }
    }

    return {
      ok: true,
      hasToken: true,
      isChannelConnected,
      activeChatId,
      bot: botInfo,
      channel: channelInfo
    };
  } catch (err: any) {
    return {
      ok: false,
      hasToken: false,
      isChannelConnected: false,
      error: err.message || 'Cannot connect to Telegram'
    };
  }
}

/**
 * Update or test channel ID
 */
export async function setTelegramChannelId(channelId: string): Promise<{ ok: boolean; error?: string; activeChatId?: string }> {
  const cleanId = channelId.trim();
  safeSetItem(STORAGE_KEY_CHAT_ID, cleanId);

  // Invalidate local config cache
  _cachedVaultConfig = null;

  try {
    // 1. Update Supabase app_config so both partner devices sync to the same channel
    await supabase.from('app_config').update({ telegram_channel_id: cleanId }).eq('id', 'main');
  } catch (e) {
    console.warn('[TelegramVault] Failed to update channel in Supabase:', e);
  }

  // 2. Try proxy if available
  try {
    await fetch('/api/telegram/set-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: cleanId })
    });
  } catch (e) {}

  // 3. Test with Telegram API directly
  try {
    const config = await getVaultTelegramConfig();
    const chatRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getChat?chat_id=${encodeURIComponent(cleanId)}`);
    const chatData = await chatRes.json();
    if (chatData.ok && chatData.result) {
      return { ok: true, activeChatId: String(chatData.result.id) };
    }
    return { ok: false, error: chatData.description || 'Channel not accessible by bot' };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Failed to verify channel' };
  }
}

/**
 * Load cached messages from local storage
 */
export function loadCachedVaultMessages(): TelegramVaultMessage[] {
  try {
    const raw = safeGetItem(STORAGE_KEY_MSGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(m => m && m.id && !m.deleted);
    }
  } catch (e) {
    console.warn('[TelegramVault] Failed to load cached messages:', e);
  }
  return [];
}

/**
 * Save messages to local storage cache
 */
export function saveCachedVaultMessages(messages: TelegramVaultMessage[]): void {
  try {
    safeSetItem(STORAGE_KEY_MSGS, JSON.stringify(messages.slice(-200)));
  } catch (e) {
    console.warn('[TelegramVault] Failed to cache messages:', e);
  }
}

/**
 * Parse and decrypt an incoming raw Telegram message
 */
export async function parseAndDecryptTelegramMessage(rawTgMsg: any): Promise<TelegramVaultMessage | null> {
  if (!rawTgMsg || !rawTgMsg.message_id) return null;

  const msgId = String(rawTgMsg.message_id);
  const rawText = rawTgMsg.text || rawTgMsg.caption || '';
  const dateIso = rawTgMsg.date ? new Date(rawTgMsg.date * 1000).toISOString() : new Date().toISOString();

  // Check if encrypted payload format: 🔒_E2EE:{iv}:{ciphertext}
  if (rawText.startsWith('🔒_E2EE:')) {
    try {
      const parts = rawText.split(':');
      if (parts.length >= 3) {
        const iv = parts[1];
        const ciphertext = parts.slice(2).join(':');
        const key = await getVaultEncryptionKey();
        const payload = await decryptChatMessage(ciphertext, iv, key);

        return {
          id: msgId,
          telegram_id: rawTgMsg.message_id,
          text: payload.text || '',
          sender_role: payload.sender_role || 'partner',
          timestamp: payload.created_at || dateIso,
          created_at: payload.created_at || dateIso,
          is_encrypted: true,
          replyTo: payload.reply_to || null,
          media: payload.media || undefined,
          reactions: payload.reactions || undefined
        };
      }
    } catch (e) {
      console.warn('[TelegramVault] Failed to decrypt message:', msgId, e);
      return {
        id: msgId,
        telegram_id: rawTgMsg.message_id,
        text: '🔒 Encrypted message (Key mismatch or decryption error)',
        sender_role: 'partner',
        timestamp: dateIso,
        created_at: dateIso,
        is_encrypted: true
      };
    }
  }

  // Fallback for unencrypted raw message (e.g. user manually typed into channel)
  return {
    id: msgId,
    telegram_id: rawTgMsg.message_id,
    text: rawText || (rawTgMsg.photo ? '📷 Photo' : 'Sent an attachment'),
    sender_role: 'partner',
    timestamp: dateIso,
    created_at: dateIso,
    is_encrypted: false
  };
}

const VAULT_REALTIME_CHANNEL = 'onlyus_telegram_vault_realtime';

export type VaultRealtimeEvent = 
  | { type: 'message'; message: TelegramVaultMessage }
  | { type: 'reaction'; messageId: string | number; emoji: string; previousEmoji?: string; role: 'owner' | 'partner' }
  | { type: 'delete'; messageId: string | number };

/**
 * Subscribe to real-time events between Rahul and Nusrat for Telegram Vault
 */
export function subscribeToTelegramVaultRealtime(
  callback: (event: VaultRealtimeEvent) => void
): () => void {
  const channel = supabase.channel(VAULT_REALTIME_CHANNEL);

  channel
    .on('broadcast', { event: 'new_message' }, (payload) => {
      if (payload.payload?.message) {
        callback({ type: 'message', message: payload.payload.message });
      }
    })
    .on('broadcast', { event: 'reaction' }, (payload) => {
      if (payload.payload?.messageId) {
        callback({
          type: 'reaction',
          messageId: payload.payload.messageId,
          emoji: payload.payload.emoji,
          previousEmoji: payload.payload.previousEmoji,
          role: payload.payload.role
        });
      }
    })
    .on('broadcast', { event: 'delete' }, (payload) => {
      if (payload.payload?.messageId) {
        callback({ type: 'delete', messageId: payload.payload.messageId });
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

async function broadcastVaultEvent(event: string, payload: any): Promise<void> {
  try {
    const channel = supabase.channel(VAULT_REALTIME_CHANNEL);
    await channel.send({
      type: 'broadcast',
      event,
      payload
    });
  } catch (e) {
    console.warn('[TelegramVault] Broadcast event error:', event, e);
  }
}

/**
 * Send an encrypted message to the Telegram Vault channel
 */
export async function sendTelegramVaultMessage(
  text: string, 
  senderRole: 'owner' | 'partner', 
  replyTo?: TelegramVaultMessage | null,
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    fileName?: string;
    fileSize?: number;
  }
): Promise<TelegramVaultMessage> {
  const key = await getVaultEncryptionKey();
  const timestamp = new Date().toISOString();

  const replyObj = replyTo ? {
    id: replyTo.id,
    text: replyTo.text,
    sender_role: replyTo.sender_role
  } : null;

  const payload: any = {
    text,
    sender_role: senderRole,
    created_at: timestamp,
    reply_to: replyObj
  };

  if (media) {
    payload.media = media;
  }

  const { ciphertext, iv } = await encryptChatMessage(payload, key);
  const wireText = `🔒_E2EE:${iv}:${ciphertext}`;

  const config = await getVaultTelegramConfig();
  const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID) || config.channelId;

  let tgResult: any = null;

  // 1. Try local proxy first
  try {
    const proxyRes = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: wireText,
        chat_id: customChatId || undefined,
        reply_to_message_id: replyTo ? Number(replyTo.telegram_id || replyTo.id) : undefined
      })
    });
    const contentType = proxyRes.headers.get('content-type') || '';
    if (proxyRes.ok && contentType.includes('application/json')) {
      const data = await proxyRes.json();
      if (data && data.ok && data.result) {
        tgResult = data.result;
      }
    }
  } catch (e) {}

  // 2. Direct Telegram API fallback (works natively on Vercel & Android APKs)
  if (!tgResult) {
    const directPayload: any = {
      chat_id: customChatId,
      text: wireText
    };
    if (replyTo && (replyTo.telegram_id || replyTo.id)) {
      directPayload.reply_to_message_id = Number(replyTo.telegram_id || replyTo.id);
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(directPayload)
    });
    const tgData = await tgRes.json();
    if (!tgData.ok || !tgData.result) {
      throw new Error(tgData.description || 'Failed to post message to Telegram channel');
    }
    tgResult = tgData.result;
  }

  const newMsg: TelegramVaultMessage = {
    id: String(tgResult.message_id),
    telegram_id: tgResult.message_id,
    text,
    sender_role: senderRole,
    timestamp,
    created_at: timestamp,
    is_encrypted: true,
    replyTo: replyObj,
    media: media || undefined
  };

  // Update local cache
  const cached = loadCachedVaultMessages();
  const updated = [...cached.filter(m => m.id !== newMsg.id), newMsg];
  saveCachedVaultMessages(updated);

  // Broadcast to other device in real-time
  broadcastVaultEvent('new_message', { message: newMsg });

  return newMsg;
}

/**
 * React to a message in the Telegram Vault channel
 */
export async function reactTelegramVaultMessage(
  messageId: string | number, 
  emoji: string, 
  role: 'owner' | 'partner'
): Promise<boolean> {
  const config = await getVaultTelegramConfig();
  const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID) || config.channelId;

  // Broadcast reaction immediately so partner sees it
  broadcastVaultEvent('reaction', {
    messageId,
    emoji,
    role
  });

  // 1. Try proxy first
  try {
    const res = await fetch('/api/telegram/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: Number(messageId),
        emoji,
        chat_id: customChatId || undefined
      })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.ok) return true;
    }
  } catch (e) {}

  // 2. Direct Telegram API fallback
  try {
    const payload: any = {
      chat_id: customChatId,
      message_id: Number(messageId)
    };
    if (emoji) {
      payload.reaction = [{ type: 'emoji', emoji }];
    } else {
      payload.reaction = [];
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${config.botToken}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const tgData = await tgRes.json();
    return !!tgData.ok;
  } catch (e) {
    console.warn('[TelegramVault] Reaction failed:', e);
    return false;
  }
}

/**
 * Delete a message from the Telegram Vault channel
 */
export async function deleteTelegramVaultMessage(messageId: string | number): Promise<boolean> {
  const config = await getVaultTelegramConfig();
  const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID) || config.channelId;

  // Broadcast deletion immediately
  broadcastVaultEvent('delete', { messageId });

  // Update local cache
  const cached = loadCachedVaultMessages();
  saveCachedVaultMessages(cached.filter(m => m.id !== String(messageId)));

  // 1. Try proxy first
  try {
    const res = await fetch('/api/telegram/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: Number(messageId),
        chat_id: customChatId || undefined
      })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.ok) return true;
    }
  } catch (e) {}

  // 2. Direct Telegram API fallback
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${config.botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: customChatId,
        message_id: Number(messageId)
      })
    });
    const tgData = await tgRes.json();
    return !!tgData.ok;
  } catch (e) {
    console.warn('[TelegramVault] Deletion failed:', e);
    return false;
  }
}

/**
 * Sync / Pull updates from Telegram
 */
export async function pullTelegramUpdates(
  onNewMessage: (msg: TelegramVaultMessage) => void
): Promise<void> {
  let lastUpdateId = Number(safeGetItem(STORAGE_KEY_LAST_UPDATE_ID) || 0);

  try {
    const res = await fetch(`/api/telegram/updates?offset=${lastUpdateId ? lastUpdateId + 1 : 0}`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return;

    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        if (update.update_id > lastUpdateId) {
          lastUpdateId = update.update_id;
          safeSetItem(STORAGE_KEY_LAST_UPDATE_ID, String(lastUpdateId));
        }

        const rawMsg = update.channel_post || update.message || update.edited_channel_post;
        if (rawMsg) {
          const parsed = await parseAndDecryptTelegramMessage(rawMsg);
          if (parsed) {
            onNewMessage(parsed);
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback for static hosting
  }
}
