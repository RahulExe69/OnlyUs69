import { MediaAttachment } from '../types';

export const getMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const parseDate = (ts: any): Date => {
  const millis = getMillis(ts);
  return millis > 0 ? new Date(millis) : new Date();
};

export const hydrateMessageMedia = (raw: any): MediaAttachment | undefined => {
  if (raw.media?.url || (raw.media?.mediaList && raw.media.mediaList.length > 0) || raw.media?.thumbnailUrl) {
    if (raw.media && !raw.media.url && raw.media.thumbnailUrl) {
      raw.media.url = raw.media.thumbnailUrl;
    }
    return raw.media as MediaAttachment;
  }
  if (raw.mediaList && raw.mediaList.length > 0) {
    return {
      id: raw.id,
      type: raw.mediaList[0].type || 'image',
      url: raw.mediaList[0].url || raw.mediaList[0].thumbnailUrl || '',
      mediaList: raw.mediaList,
      fileName: raw.mediaList[0].fileName || 'Shared album'
    };
  }
  if (!raw.attachment_url) return undefined;

  if (typeof raw.attachment_url === 'string') {
    const trimmed = raw.attachment_url.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          if (parsed.mediaList || parsed.url || parsed.thumbnailUrl) {
            if (!parsed.url && parsed.thumbnailUrl) {
              parsed.url = parsed.thumbnailUrl;
            }
            return parsed as MediaAttachment;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            return {
              id: raw.id,
              type: parsed[0].type || 'image',
              url: parsed[0].url || parsed[0].thumbnailUrl || '',
              mediaList: parsed,
              fileName: parsed[0].fileName || 'Shared album'
            };
          }
        }
      } catch {
        // Fall back to standard URL interpretation
      }
    }
  }

  const isVideo = /^data:video\//.test(raw.attachment_url) || /\.(mp4|mov|webm)(?:\?|$)/i.test(raw.attachment_url);
  return {
    id: raw.id,
    type: isVideo ? 'video' : 'image',
    url: raw.attachment_url,
    fileName: isVideo ? 'Shared video' : 'Shared photo',
  };
};
