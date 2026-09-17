import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory active channel and central poller state
let runtimeChannelId = (process.env.TELEGRAM_CHANNEL_ID && process.env.TELEGRAM_CHANNEL_ID !== '8992982820' ? process.env.TELEGRAM_CHANNEL_ID : '-1003839359301').trim();
let lastVerifiedChat: any = null;
let cachedBotInfo: any = null;
let cachedUpdates: any[] = [];
let lastTelegramUpdateId = 0;
let isPollingTelegram = false;

function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function cleanTelegramId(input: string): string[] {
  if (!input) return [];
  const s = String(input).trim();
  if (!s) return [];

  // If link like https://t.me/c/1234567890/1
  const cMatch = s.match(/t\.me\/c\/(\d+)/);
  if (cMatch) {
    return [`-100${cMatch[1]}`, cMatch[1], `-${cMatch[1]}`];
  }

  // If link like https://t.me/channel_name
  const uMatch = s.match(/t\.me\/([a-zA-Z0-9_]{4,})/);
  if (uMatch) {
    return [`@${uMatch[1]}`];
  }

  // If @username
  if (s.startsWith('@')) {
    return [s];
  }

  // If starts with -100
  if (s.startsWith('-100')) {
    const without100 = s.slice(4);
    return [s, without100, `-${without100}`];
  }

  // If starts with -
  if (s.startsWith('-')) {
    const digits = s.slice(1);
    return [s, `-100${digits}`, digits];
  }

  // Pure digits (e.g. 8992982820)
  if (/^\d+$/.test(s)) {
    return [`-100${s}`, s, `-${s}`];
  }

  return [s];
}

function getCandidateChatIds(customId?: string): string[] {
  const list: string[] = [];
  if (customId) list.push(...cleanTelegramId(customId));
  if (runtimeChannelId) list.push(...cleanTelegramId(runtimeChannelId));
  if (process.env.TELEGRAM_CHANNEL_ID) list.push(...cleanTelegramId(process.env.TELEGRAM_CHANNEL_ID));
  return Array.from(new Set(list));
}

// Background centralized poll so Telegram getUpdates is never called concurrently
async function pollTelegramUpdatesOnce() {
  const token = getBotToken();
  if (!token) return;

  try {
    const payload: any = {
      offset: lastTelegramUpdateId ? lastTelegramUpdateId + 1 : 0,
      limit: 50,
      timeout: 3,
      allowed_updates: ['message', 'channel_post', 'edited_channel_post', 'my_chat_member', 'chat_member', 'message_reaction']
    };

    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const u of data.result) {
        if (u.update_id > lastTelegramUpdateId) {
          lastTelegramUpdateId = u.update_id;
        }

        // Keep in cache (deduplicated by update_id)
        if (!cachedUpdates.some(c => c.update_id === u.update_id)) {
          cachedUpdates.push(u);
          if (cachedUpdates.length > 150) {
            cachedUpdates.shift();
          }
        }

        // Auto-detect chat
        const chat = u.channel_post?.chat || u.message?.chat || u.my_chat_member?.chat || u.chat_member?.chat;
        if (chat && chat.id) {
          if (!lastVerifiedChat || chat.type === 'channel' || chat.type === 'supergroup') {
            runtimeChannelId = String(chat.id);
            lastVerifiedChat = {
              id: chat.id,
              title: chat.title || chat.username || chat.first_name || String(chat.id),
              type: chat.type,
              username: chat.username
            };
            console.log(`[TelegramVault] Auto-detected active chat: ${lastVerifiedChat.title} (${lastVerifiedChat.id})`);
          }
        }
      }
    }
  } catch (err) {
    // network glitch, will retry in next loop
  }
}

function startCentralizedTelegramPoller() {
  if (isPollingTelegram) return;
  isPollingTelegram = true;

  const run = async () => {
    try {
      await pollTelegramUpdatesOnce();
    } catch (e) {
      // pass
    }
    setTimeout(run, 1500);
  };
  run();
}

// -------------------------------------------------------------
// TELEGRAM API PROXY ROUTES (keeps TELEGRAM_BOT_TOKEN hidden)
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check status, bot details, and channel connectivity
app.get('/api/telegram/status', async (req, res) => {
  const token = getBotToken();
  if (!token) {
    return res.json({
      ok: false,
      hasToken: false,
      error: 'TELEGRAM_BOT_TOKEN is not configured in environment secrets.'
    });
  }

  // Ensure centralized poller is running
  startCentralizedTelegramPoller();

  try {
    if (!cachedBotInfo) {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json();
      if (meData.ok) {
        cachedBotInfo = meData.result;
      } else {
        return res.json({
          ok: false,
          hasToken: true,
          error: `Telegram bot authorization failed: ${meData.description || 'Invalid token'}`
        });
      }
    }

    // Extract any detected chats from cachedUpdates
    const detectedMap = new Map();
    for (const u of cachedUpdates) {
      const chat = u.channel_post?.chat || u.message?.chat || u.my_chat_member?.chat;
      if (chat && !detectedMap.has(chat.id)) {
        detectedMap.set(chat.id, {
          id: chat.id,
          title: chat.title || chat.username || chat.first_name || String(chat.id),
          type: chat.type
        });
      }
    }

    // If chat not verified yet, test candidates and any detected chats
    if (!lastVerifiedChat) {
      const candidates = [
        ...getCandidateChatIds(),
        ...Array.from(detectedMap.keys()).map(String),
        '-1003839359301'
      ];
      for (const id of candidates) {
        try {
          const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(id)}`);
          const chatData = await chatRes.json();
          if (chatData.ok && chatData.result) {
            lastVerifiedChat = chatData.result;
            runtimeChannelId = String(lastVerifiedChat.id);
            break;
          }
        } catch (e) {}
      }
    }

    return res.json({
      ok: true,
      hasToken: true,
      bot: cachedBotInfo,
      channel: lastVerifiedChat,
      activeChatId: lastVerifiedChat ? String(lastVerifiedChat.id) : (runtimeChannelId || process.env.TELEGRAM_CHANNEL_ID || ''),
      isChannelConnected: !!lastVerifiedChat,
      detectedChats: Array.from(detectedMap.values()),
      configuredRawId: process.env.TELEGRAM_CHANNEL_ID || ''
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal error' });
  }
});

// Update or set channel ID
app.post('/api/telegram/set-channel', async (req, res) => {
  const { channel_id } = req.body;
  if (!channel_id) {
    return res.status(400).json({ ok: false, error: 'Missing channel_id' });
  }
  const token = getBotToken();
  const candidates = getCandidateChatIds(channel_id);

  let verifiedChat: any = null;
  let verifiedId = '';

  for (const id of candidates) {
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(id)}`);
      const chatData = await chatRes.json();
      if (chatData.ok && chatData.result) {
        verifiedChat = chatData.result;
        verifiedId = String(verifiedChat.id);
        runtimeChannelId = verifiedId;
        lastVerifiedChat = verifiedChat;
        break;
      }
    } catch (e) {
      // try next
    }
  }

  if (verifiedChat) {
    return res.json({ ok: true, activeChatId: verifiedId, channel: verifiedChat });
  } else {
    runtimeChannelId = String(channel_id).trim();
    return res.json({
      ok: false,
      error: `Could not verify chat "${channel_id}". Ensure @${cachedBotInfo?.username || 'OnlyUs69Bot'} has been added as an Administrator to the channel.`,
      activeChatId: runtimeChannelId
    });
  }
});

// Send a message (Encrypted text payload)
app.post('/api/telegram/send', async (req, res) => {
  const token = getBotToken();
  if (!token) {
    return res.status(400).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  const { text, reply_to_message_id, chat_id } = req.body;
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Text is required' });
  }

  const targetChatIds = getCandidateChatIds(chat_id);
  if (targetChatIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'No channel connected. Please add the bot to your Telegram channel first.' });
  }

  let lastError = 'Chat not found';
  for (const targetId of targetChatIds) {
    try {
      const payload: any = {
        chat_id: targetId,
        text: text,
      };
      if (reply_to_message_id) {
        payload.reply_to_message_id = Number(reply_to_message_id);
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const tgData = await tgRes.json();
      if (tgData.ok && tgData.result) {
        runtimeChannelId = String(targetId);
        if (!lastVerifiedChat) {
          lastVerifiedChat = tgData.result.chat;
        }

        // Add to cached updates so all clients receive it immediately
        const syntheticUpdate = {
          update_id: ++lastTelegramUpdateId,
          channel_post: tgData.result
        };
        cachedUpdates.push(syntheticUpdate);

        return res.json({ ok: true, result: tgData.result });
      } else {
        lastError = tgData.description || 'Telegram API error';
      }
    } catch (err: any) {
      lastError = err.message || 'Network error';
    }
  }

  return res.status(400).json({ ok: false, error: lastError });
});

// Fetch updates (instant cache lookup from central poller)
app.get('/api/telegram/updates', async (req, res) => {
  const token = getBotToken();
  if (!token) {
    return res.status(400).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  // Ensure centralized poller is running
  startCentralizedTelegramPoller();

  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const matches = cachedUpdates.filter(u => u.update_id >= offset);
  return res.json({ ok: true, result: matches });
});

// Set reaction
app.post('/api/telegram/reaction', async (req, res) => {
  const token = getBotToken();
  if (!token) return res.status(400).json({ ok: false, error: 'Token missing' });

  const { message_id, emoji, chat_id } = req.body;
  const targetChatIds = getCandidateChatIds(chat_id);

  for (const targetId of targetChatIds) {
    try {
      const payload: any = {
        chat_id: targetId,
        message_id: Number(message_id),
      };
      if (emoji) {
        payload.reaction = [{ type: 'emoji', emoji }];
      } else {
        payload.reaction = []; // clear reaction
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return res.json({ ok: true, result: tgData.result });
      }
    } catch (e) {
      // try next
    }
  }

  return res.json({ ok: false, error: 'Failed to set reaction' });
});

// Delete message
app.post('/api/telegram/delete', async (req, res) => {
  const token = getBotToken();
  if (!token) return res.status(400).json({ ok: false, error: 'Token missing' });

  const { message_id, chat_id } = req.body;
  const targetChatIds = getCandidateChatIds(chat_id);

  for (const targetId of targetChatIds) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetId,
          message_id: Number(message_id)
        }),
      });
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return res.json({ ok: true });
      }
    } catch (e) {
      // try next
    }
  }

  return res.json({ ok: false, error: 'Failed to delete message' });
});

// -------------------------------------------------------------
// VITE SPA MIDDLEWARE / STATIC ASSETS
// -------------------------------------------------------------

async function startServer() {
  // Start centralized Telegram poller loop
  startCentralizedTelegramPoller();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OnlyUs Server running on http://localhost:${PORT}`);
  });
}

startServer();
