export interface InstagramReelInfo {
  originalUrl: string;
  cleanUrl: string;
  code: string;
  embedUrl: string;
  isReel: boolean;
  queryString?: string;
}

const INSTAGRAM_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|share\/reel)\/([A-Za-z0-9_-]+)(?:[\/?][^\s]*)?/i;
const INSTAGRAM_GLOBAL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|share\/reel)\/[A-Za-z0-9_-]+(?:[\/?][^\s]*)?/gi;

export function parseInstagramReel(text: string): InstagramReelInfo | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(INSTAGRAM_REGEX);
  if (!match || !match[1]) return null;

  const code = match[1];
  const matchedFull = match[0].trim();

  let queryString = '';
  try {
    const rawUrl = matchedFull.startsWith('http') ? matchedFull : `https://${matchedFull}`;
    const parsed = new URL(rawUrl);
    queryString = parsed.search; // e.g. "?stkn=NWhtd3FwOXYxZHJz"
  } catch {
    const qIndex = matchedFull.indexOf('?');
    if (qIndex !== -1) {
      queryString = matchedFull.substring(qIndex);
    }
  }

  // Preserve query string (crucial for stkn / igsh authentication tokens)
  const cleanUrl = `https://www.instagram.com/reel/${code}/${queryString}`;
  const embedUrl = `https://www.instagram.com/reel/${code}/embed/${queryString}`;

  return {
    originalUrl: matchedFull,
    cleanUrl,
    code,
    embedUrl,
    isReel: true,
    queryString,
  };
}

export function extractTextWithoutInstagramUrl(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(INSTAGRAM_GLOBAL_REGEX, '').trim();
}
