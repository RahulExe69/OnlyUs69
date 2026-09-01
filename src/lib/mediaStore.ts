// Local device-first media storage engine using IndexedDB
// Photos and videos are saved directly on device storage (offline-first & fast cache)

const DB_NAME = 'onlyus_media_store';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
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
      if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.length < 2000000) {
        localStorage.setItem(`media_${mediaId}`, dataUrlOrBlob);
      }
    } catch (_) {}
  }
}

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
          const url = URL.createObjectURL(res);
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

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
