// WhatsApp-like Local Device-First Media Storage & Peer Re-download Engine
// 1. Photos/Videos are stored directly on device storage (IndexedDB)
// 2. Cloud acts as an ephemeral bridge (temporary transfer)
// 3. When recipient views, it downloads into recipient's device IndexedDB
// 4. If recipient clears browser cache, app broadcasts a peer restore request to partner's device
// 5. Partner's device reads from local IndexedDB, re-bridges to temporary storage, and restores it

import { SupabaseClient } from '@supabase/supabase-js';

const DB_NAME = 'onlyus_media_store';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e: any) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// -------------------------------------------------------------
// Object URL Registry with LRU Eviction (prevents WebView memory leaks)
// -------------------------------------------------------------
const objectUrlRegistry = new Map<string, string>(); // mediaId -> objectUrl
const objectUrlAccessOrder: string[] = [];
const MAX_OBJECT_URLS = 120;

export function getTrackedObjectURL(mediaId: string, blob: Blob): string {
  if (objectUrlRegistry.has(mediaId)) {
    const existingUrl = objectUrlRegistry.get(mediaId)!;
    const idx = objectUrlAccessOrder.indexOf(mediaId);
    if (idx !== -1) objectUrlAccessOrder.splice(idx, 1);
    objectUrlAccessOrder.push(mediaId);
    return existingUrl;
  }

  // Evict oldest if limit reached
  if (objectUrlAccessOrder.length >= MAX_OBJECT_URLS) {
    const oldestId = objectUrlAccessOrder.shift();
    if (oldestId) {
      const oldUrl = objectUrlRegistry.get(oldestId);
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch (_) {}
        objectUrlRegistry.delete(oldestId);
      }
    }
  }

  const newUrl = URL.createObjectURL(blob);
  objectUrlRegistry.set(mediaId, newUrl);
  objectUrlAccessOrder.push(mediaId);
  return newUrl;
}

export function revokeTrackedObjectURL(mediaId: string): void {
  const url = objectUrlRegistry.get(mediaId);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
    objectUrlRegistry.delete(mediaId);
    const idx = objectUrlAccessOrder.indexOf(mediaId);
    if (idx !== -1) objectUrlAccessOrder.splice(idx, 1);
  }
}

export function revokeAllTrackedObjectURLs(): void {
  objectUrlRegistry.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  });
  objectUrlRegistry.clear();
  objectUrlAccessOrder.length = 0;
}

/**
 * Save raw Blob or data URL into local device IndexedDB
 */
export async function saveLocalMedia(mediaId: string, dataUrlOrBlob: string | Blob): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrlOrBlob, mediaId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save to local IndexedDB:', err);
    try {
      if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.length < 25000) {
        localStorage.setItem(`media_${mediaId}`, dataUrlOrBlob);
      }
    } catch (_) {}
  }
}

/**
 * Retrieve local object URL or string for rendering
 */
export async function getLocalMedia(mediaId: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(mediaId);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) {
          const fallback = localStorage.getItem(`media_${mediaId}`);
          resolve(fallback || null);
          return;
        }
        if (typeof res === 'string') {
          resolve(res);
        } else if (res instanceof Blob) {
          const url = getTrackedObjectURL(mediaId, res);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        const fallback = localStorage.getItem(`media_${mediaId}`);
        resolve(fallback || null);
      };
    });
  } catch (err) {
    const fallback = localStorage.getItem(`media_${mediaId}`);
    return fallback || null;
  }
}

/**
 * Retrieve raw Blob from local IndexedDB (used for re-uploading / peer restore)
 */
export async function getLocalMediaBlob(mediaId: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(mediaId);
      req.onsuccess = async () => {
        const res = req.result;
        if (!res) {
          const fallback = localStorage.getItem(`media_${mediaId}`);
          if (fallback && fallback.startsWith('data:')) {
            try {
              const fetchRes = await fetch(fallback);
              const blob = await fetchRes.blob();
              resolve(blob);
              return;
            } catch (_) {}
          }
          resolve(null);
          return;
        }

        if (res instanceof Blob) {
          resolve(res);
        } else if (typeof res === 'string') {
          try {
            const fetchRes = await fetch(res);
            const blob = await fetchRes.blob();
            resolve(blob);
          } catch (_) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Downloads a remote media file and saves directly into device IndexedDB
 */
export async function downloadAndCacheRemoteMedia(mediaId: string, remoteUrl: string): Promise<string | null> {
  if (!remoteUrl) return null;
  try {
    const response = await fetch(remoteUrl, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    await saveLocalMedia(mediaId, blob);
    return getTrackedObjectURL(mediaId, blob);
  } catch (err) {
    console.warn(`Could not cache remote media ${mediaId}:`, err);
    return null;
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// -------------------------------------------------------------
// Realtime Peer-to-Peer Media Sync & Re-download Relay
// -------------------------------------------------------------

export interface PendingMediaRestore {
  mediaId: string;
  messageId?: string;
  requestedBy: 'owner' | 'partner';
  requestedAt: number;
  attempts: number;
}

const PENDING_RESTORES_KEY = 'onlyus_pending_media_restores';

export function getPendingMediaRestores(): PendingMediaRestore[] {
  try {
    const raw = localStorage.getItem(PENDING_RESTORES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePendingMediaRestores(list: PendingMediaRestore[]): void {
  try {
    localStorage.setItem(PENDING_RESTORES_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function addPendingMediaRestore(req: Omit<PendingMediaRestore, 'attempts'>): void {
  const list = getPendingMediaRestores();
  const existing = list.find((item) => item.mediaId === req.mediaId);
  if (existing) {
    existing.requestedAt = Date.now();
  } else {
    list.push({ ...req, attempts: 0 });
  }
  const pruned = list.slice(-50);
  savePendingMediaRestores(pruned);
}

export function removePendingMediaRestore(mediaId: string): void {
  const list = getPendingMediaRestores();
  const filtered = list.filter((item) => item.mediaId !== mediaId);
  savePendingMediaRestores(filtered);
}

export async function flushPendingMediaRestores(
  supabase: SupabaseClient,
  currentRole: 'owner' | 'partner'
): Promise<void> {
  const list = getPendingMediaRestores();
  if (!list.length) return;

  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  const validRequests = list.filter(item => now - item.requestedAt < maxAge && item.attempts < 10);

  if (validRequests.length !== list.length) {
    savePendingMediaRestores(validRequests);
  }

  for (const item of validRequests) {
    if (item.requestedBy === currentRole) {
      item.attempts += 1;
      await broadcastRestoreRequest(supabase, item.mediaId, item.messageId, currentRole);
    }
  }
  savePendingMediaRestores(validRequests);
}

let syncChannel: any = null;

async function broadcastRestoreRequest(
  supabase: SupabaseClient,
  mediaId: string,
  messageId?: string,
  requestedBy: 'owner' | 'partner' = 'owner'
): Promise<void> {
  if (!syncChannel) {
    initMediaSyncListener(supabase, requestedBy);
  }

  try {
    if (syncChannel) {
      await syncChannel.send({
        type: 'broadcast',
        event: 'request_media_restore',
        payload: {
          mediaId,
          messageId,
          requestedBy,
          requestedAt: Date.now()
        }
      });
    }
  } catch (err) {
    console.warn('[MediaSync] Error broadcasting restore request:', err);
  }
}

/**
 * Initialize peer media restoration listener
 */
export function initMediaSyncListener(supabase: SupabaseClient, currentRole: 'owner' | 'partner') {
  if (syncChannel) return;

  syncChannel = supabase.channel('onlyus-media-peer-sync');

  syncChannel
    .on('broadcast', { event: 'peer_device_online' }, async ({ payload }: any) => {
      if (payload?.role && payload.role !== currentRole) {
        console.log('[MediaSync] Partner device online detected, flushing pending media restores...');
        flushPendingMediaRestores(supabase, currentRole);
      }
    })
    .on('broadcast', { event: 'request_media_restore' }, async ({ payload }: any) => {
      const { mediaId, requestedBy, messageId } = payload || {};
      if (!mediaId || requestedBy === currentRole) return;

      console.log(`[MediaSync] Partner requested restore for media: ${mediaId}`);
      // Check if we have this media in our local device storage
      const localBlob = await getLocalMediaBlob(mediaId);
      if (!localBlob) {
        console.log(`[MediaSync] Media ${mediaId} not found in our local IndexedDB.`);
        return;
      }

      console.log(`[MediaSync] Found media ${mediaId} locally! Re-bridging to cloud storage...`);
      try {
        const isVideo = localBlob.type.startsWith('video/');
        const ext = localBlob.type.split('/')[1] || (isVideo ? 'mp4' : 'jpg');
        const storagePath = `restored_${mediaId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(storagePath, localBlob, { contentType: localBlob.type, upsert: true });

        if (uploadError) {
          console.warn('[MediaSync] Failed to re-upload to cloud bridge:', uploadError);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
        const restoredUrl = publicUrlData.publicUrl;

        // Broadcast back to partner
        syncChannel.send({
          type: 'broadcast',
          event: 'media_restored_ready',
          payload: {
            mediaId,
            restoredUrl,
            messageId,
            restoredBy: currentRole
          }
        });

        // Also update message in database if messageId is provided so next fetches get the active bridge
        if (messageId) {
          supabase.from('messages').update({
            attachment_url: restoredUrl
          }).eq('id', messageId).then(undefined, () => {});
        }
      } catch (err) {
        console.warn('[MediaSync] Error restoring media for partner:', err);
      }
    })
    .on('broadcast', { event: 'media_restored_ready' }, async ({ payload }: any) => {
      const { mediaId, restoredUrl, restoredBy } = payload || {};
      if (!mediaId || !restoredUrl || restoredBy === currentRole) return;

      console.log(`[MediaSync] Received restored media from partner! Caching: ${mediaId}`);
      try {
        const localUrl = await downloadAndCacheRemoteMedia(mediaId, restoredUrl);
        removePendingMediaRestore(mediaId);
        // Dispatch window event so any visible UI elements immediately re-render
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(`onlyus_media_synced_${mediaId}`, {
            detail: { mediaId, localUrl: localUrl || restoredUrl }
          }));
        }
      } catch (err) {
        console.warn('[MediaSync] Failed to save restored media:', err);
      }
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence so partner can fulfill pending restore requests
        syncChannel.send({
          type: 'broadcast',
          event: 'peer_device_online',
          payload: { role: currentRole, at: Date.now() }
        }).catch(() => {});
        // Also flush any requests we have pending
        flushPendingMediaRestores(supabase, currentRole);
      }
    });
}

/**
 * Trigger a peer restore request to partner's phone
 */
export async function requestPeerMediaRestore(
  supabase: SupabaseClient,
  mediaId: string,
  messageId?: string,
  requestedBy: 'owner' | 'partner' = 'owner'
): Promise<void> {
  // First check if cloud storage already has this attachment on the message
  if (messageId) {
    try {
      const { data: msg } = await supabase
        .from('messages')
        .select('attachment_url')
        .eq('id', messageId)
        .single();
      if (msg?.attachment_url && msg.attachment_url.startsWith('http')) {
        const cachedUrl = await downloadAndCacheRemoteMedia(mediaId, msg.attachment_url);
        if (cachedUrl) {
          removePendingMediaRestore(mediaId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`onlyus_media_synced_${mediaId}`, {
              detail: { mediaId, localUrl: cachedUrl }
            }));
          }
          return;
        }
      }
    } catch (_) {}
  }

  // Queue into pending restores so even if partner is offline right now, it will re-trigger
  addPendingMediaRestore({
    mediaId,
    messageId,
    requestedBy,
    requestedAt: Date.now()
  });

  await broadcastRestoreRequest(supabase, mediaId, messageId, requestedBy);
}
