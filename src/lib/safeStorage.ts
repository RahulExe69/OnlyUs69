import { Message } from '../types';

/**
 * Safe wrapper around localStorage that prevents QuotaExceededError crashes
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[SafeStorage] localStorage.setItem failed for key "${key}":`, err);
    try {
      // If quota exceeded, clean up cached messages and temporary keys
      if (key === 'cached_msgs') {
        localStorage.removeItem('cached_msgs');
      }
    } catch {
      // Ignore
    }
    return false;
  }
}

export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[SafeStorage] localStorage.getItem failed for key "${key}":`, err);
    return null;
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[SafeStorage] localStorage.removeItem failed for key "${key}":`, err);
  }
}

/**
 * Strips heavy base64 strings and blob URLs from messages before saving into localStorage
 * to ensure we never hit the browser's 5MB localStorage limit.
 */
export function sanitizeMessagesForCache(messages: Message[]): any[] {
  if (!Array.isArray(messages)) return [];

  // Limit to most recent 50 messages to save space
  const recent = messages.slice(-50);

  return recent.map((m) => {
    // Clone without mutating
    const sanitized: any = {
      id: m.id,
      sender_role: m.sender_role,
      text: m.text,
      timestamp: m.timestamp,
      reactions: m.reactions || {},
      deleted: !!m.deleted,
      deletedBy: m.deletedBy,
      deleted_from_media: !!m.deleted_from_media,
      deleted_from_media_by: m.deleted_from_media_by,
      deleted_from_media_at: m.deleted_from_media_at,
      deleted_links_from_media: Array.isArray(m.deleted_links_from_media) ? m.deleted_links_from_media : [],
      permanently_deleted_links: Array.isArray(m.permanently_deleted_links) ? m.permanently_deleted_links : [],
      media_deleted_by: m.media_deleted_by,
      media_deleted_at: m.media_deleted_at,
      hidden_for_owner: !!m.hidden_for_owner,
      hidden_for_partner: !!m.hidden_for_partner,
      isEdited: !!m.isEdited,
      deliveryStatus: m.deliveryStatus === 'sending' ? 'sent' : m.deliveryStatus,
      replyTo: m.replyTo ? {
        id: m.replyTo.id,
        text: m.replyTo.text,
        sender_role: m.replyTo.sender_role,
        mediaType: m.replyTo.mediaType
      } : undefined
    };

    if (m.media) {
      sanitized.media = {
        id: m.media.id,
        type: m.media.type,
        fileName: m.media.fileName,
        fileSize: m.media.fileSize,
        mimeType: m.media.mimeType,
        caption: m.media.caption,
        // Only keep remote http URLs or tiny thumbnails, never keep multi-megabyte data/blob strings in localStorage
        url: m.media.url && m.media.url.startsWith('http') ? m.media.url : '',
        thumbnailUrl: m.media.thumbnailUrl && m.media.thumbnailUrl.length < 15000 ? m.media.thumbnailUrl : undefined,
      };

      if (m.media.mediaList && Array.isArray(m.media.mediaList)) {
        sanitized.media.mediaList = m.media.mediaList.map(item => ({
          id: item.id,
          type: item.type,
          fileName: item.fileName,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          url: item.url && item.url.startsWith('http') ? item.url : '',
          thumbnailUrl: item.thumbnailUrl && item.thumbnailUrl.length < 15000 ? item.thumbnailUrl : undefined,
          deleted_from_media: !!item.deleted_from_media,
          deleted_from_media_by: item.deleted_from_media_by,
          deleted_from_media_at: item.deleted_from_media_at,
        }));
      }
    }

    if (m.mediaList && Array.isArray(m.mediaList)) {
      sanitized.mediaList = m.mediaList.map(item => ({
        id: item.id,
        type: item.type,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        url: item.url && item.url.startsWith('http') ? item.url : '',
        thumbnailUrl: item.thumbnailUrl && item.thumbnailUrl.length < 15000 ? item.thumbnailUrl : undefined,
        deleted_from_media: !!item.deleted_from_media,
        deleted_from_media_by: item.deleted_from_media_by,
        deleted_from_media_at: item.deleted_from_media_at,
      }));
    }

    return sanitized;
  });
}

/**
 * Cache sanitized messages safely
 */
export function cacheMessages(messages: Message[]): void {
  try {
    const sanitized = sanitizeMessagesForCache(messages);
    const jsonStr = JSON.stringify(sanitized);
    safeSetItem('cached_msgs', jsonStr);
  } catch (err) {
    console.warn('[SafeStorage] Failed to cache messages:', err);
  }
}

/**
 * Load cached messages safely
 */
export function loadCachedMessages(): Message[] {
  try {
    const cached = safeGetItem('cached_msgs');
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      // Deduplicate by ID
      const seen = new Set<string>();
      return parsed.filter(m => {
        if (!m || !m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
    return [];
  } catch (err) {
    console.warn('[SafeStorage] Failed to load cached messages, resetting cache:', err);
    safeRemoveItem('cached_msgs');
    return [];
  }
}
