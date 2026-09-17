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
 */
export async function getTelegramStatus(): Promise<TelegramVaultStatus> {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) {
      return {
        ok: false,
        hasToken: false,
        isChannelConnected: false,
        error: `Server status error ${res.status}`
      };
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      ok: false,
      hasToken: false,
      isChannelConnected: false,
      error: err.message || 'Cannot reach Telegram proxy API'
    };
  }
}

/**
 * Update or test channel ID
 */
export async function setTelegramChannelId(channelId: string): Promise<{ ok: boolean; error?: string; activeChatId?: string }> {
  try {
    safeSetItem(STORAGE_KEY_CHAT_ID, channelId.trim());
    const res = await fetch('/api/telegram/set-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId.trim() })
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to update channel ID' };
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

/**
 * Send an encrypted message to the Telegram Vault channel
 */
export async function sendTelegramVaultMessage(
  text: string, 
  senderRole: 'owner' | 'partner', 
  replyTo?: TelegramVaultMessage | null
): Promise<TelegramVaultMessage> {
  const key = await getVaultEncryptionKey();
  const timestamp = new Date().toISOString();

  const replyObj = replyTo ? {
    id: replyTo.id,
    text: replyTo.text,
    sender_role: replyTo.sender_role
  } : null;

  const payload = {
    text,
    sender_role: senderRole,
    created_at: timestamp,
    reply_to: replyObj
  };

  const { ciphertext, iv } = await encryptChatMessage(payload, key);
  const wireText = `🔒_E2EE:${iv}:${ciphertext}`;

  const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID);
  const res = await fetch('/api/telegram/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: wireText,
      chat_id: customChatId || undefined,
      reply_to_message_id: replyTo ? Number(replyTo.telegram_id || replyTo.id) : undefined
    })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Failed to send message to Telegram');
  }

  const tgResult = data.result;
  const newMsg: TelegramVaultMessage = {
    id: String(tgResult.message_id),
    telegram_id: tgResult.message_id,
    text,
    sender_role: senderRole,
    timestamp,
    created_at: timestamp,
    is_encrypted: true,
    replyTo: replyObj
  };

  // Update local cache
  const cached = loadCachedVaultMessages();
  const updated = [...cached.filter(m => m.id !== newMsg.id), newMsg];
  saveCachedVaultMessages(updated);

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
  try {
    const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID);
    const res = await fetch('/api/telegram/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: Number(messageId),
        emoji,
        chat_id: customChatId || undefined
      })
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    console.warn('[TelegramVault] Reaction failed:', e);
    return false;
  }
}

/**
 * Delete a message from the Telegram Vault channel
 */
export async function deleteTelegramVaultMessage(messageId: string | number): Promise<boolean> {
  try {
    const customChatId = safeGetItem(STORAGE_KEY_CHAT_ID);
    const res = await fetch('/api/telegram/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: Number(messageId),
        chat_id: customChatId || undefined
      })
    });
    const data = await res.json();
    if (data.ok) {
      const cached = loadCachedVaultMessages();
      saveCachedVaultMessages(cached.filter(m => m.id !== String(messageId)));
      return true;
    }
    return false;
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
    if (!res.ok) return;

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
    console.warn('[TelegramVault] Sync error:', err);
  }
}
