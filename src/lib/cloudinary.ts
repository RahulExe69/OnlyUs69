/**
 * Cloudinary Media Engine for OnlyUs
 * 
 * Features:
 * - Multi-account support with automatic failover/rollover
 * - Zero API secrets exposed to client: relies strictly on Unsigned Upload Presets
 * - Automatic resource detection (image / video / raw / audio)
 * - Auto-sync with Supabase app_config: configure once on one device, automatically hydrated everywhere
 * - Safe fallback to local base64 / Supabase storage if Cloudinary is unconfigured
 */

import { supabase } from './supabase';

export interface CloudinaryAccount {
  id: string;
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
  apiSecret?: string;
  label?: string;
  isActive: boolean;
}

/**
 * Verify Cloudinary API Key & Secret via the delete-cloudinary Edge Function
 */
export async function verifyCloudinaryCredentials(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-cloudinary', {
      body: {
        action: 'verify',
        cloud_name: cloudName,
        apiKey,
        apiSecret,
      },
    });
    if (error) {
      return { success: false, error: error.message || 'Verification failed' };
    }
    return data || { success: false, error: 'Unknown response' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

const STORAGE_KEY = 'onlyus_cloudinary_accounts';

/**
 * Get the list of configured Cloudinary accounts from localStorage
 */
export function getCloudinaryAccounts(): CloudinaryAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading cloudinary accounts from localStorage:', err);
  }
  return [];
}

/**
 * Save configured accounts locally and also sync to Supabase app_config if connected
 */
export async function saveCloudinaryAccounts(accounts: CloudinaryAccount[], syncToCloud = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (_) {}
  
  window.dispatchEvent(new CustomEvent('onlyus_cloudinary_updated', { detail: accounts }));

  if (syncToCloud) {
    try {
      await supabase
        .from('app_config')
        .update({ cloudinary_config: accounts })
        .eq('id', 'main');
    } catch (err) {
      console.warn('Notice: Could not sync cloudinary config to app_config:', err);
    }
  }
}

/**
 * Hydrate Cloudinary accounts from remote app_config (called when app_config loads or changes)
 */
export function syncCloudinaryFromAppConfig(remoteAccounts?: any) {
  if (Array.isArray(remoteAccounts)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteAccounts));
      window.dispatchEvent(new CustomEvent('onlyus_cloudinary_updated', { detail: remoteAccounts }));
    } catch (_) {}
  }
}

/**
 * Get active accounts in rotation order
 */
export function getActiveCloudinaryAccounts(): CloudinaryAccount[] {
  const accounts = getCloudinaryAccounts();
  const active = accounts.filter(a => a.isActive && a.cloudName?.trim() && a.uploadPreset?.trim());
  return active.length > 0 ? active : [];
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  thumbnailUrl?: string;
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  resourceType: 'image' | 'video' | 'raw';
}

/**
 * Upload a Blob or File directly to Cloudinary using an unsigned upload preset.
 * Automatically rotates to backup accounts if quota or network errors occur.
 */
export async function uploadToCloudinary(
  fileOrBlob: Blob | File,
  type: 'image' | 'video' | 'audio',
  fileName?: string
): Promise<CloudinaryUploadResult | null> {
  const accounts = getActiveCloudinaryAccounts();
  if (accounts.length === 0) {
    return null;
  }

  // 'image' for photos, 'video' for videos and audio files (Cloudinary handles audio under video endpoint)
  const resourceType = type === 'image' ? 'image' : (type === 'video' || type === 'audio') ? 'video' : 'auto';

  for (const account of accounts) {
    try {
      const formData = new FormData();
      formData.append('file', fileOrBlob, fileName || `media_${Date.now()}`);
      formData.append('upload_preset', account.uploadPreset.trim());
      formData.append('folder', 'onlyus_chat');

      const endpoint = `https://api.cloudinary.com/v1_1/${account.cloudName.trim()}/${resourceType}/upload`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`Cloudinary upload failed on account "${account.cloudName}":`, errJson);
        continue;
      }

      const data = await response.json();

      let thumbUrl: string | undefined = undefined;
      if (type === 'image' && data.secure_url) {
        thumbUrl = data.secure_url.replace('/upload/', '/upload/w_300,c_scale,q_auto,f_auto/');
      } else if (type === 'video' && data.secure_url) {
        thumbUrl = data.secure_url.replace(/\.[^/.]+$/, '.jpg').replace('/upload/', '/upload/w_400,c_scale,so_1/');
      }

      return {
        url: data.url,
        secureUrl: data.secure_url,
        publicId: data.public_id,
        thumbnailUrl: thumbUrl,
        bytes: data.bytes || fileOrBlob.size,
        format: data.format,
        width: data.width,
        height: data.height,
        duration: data.duration,
        resourceType: data.resource_type || resourceType,
      };
    } catch (err) {
      console.warn(`Network error uploading to Cloudinary account "${account.cloudName}":`, err);
    }
  }

  return null;
}

/**
 * Extract Cloudinary public_id from a Cloudinary delivery URL
 */
export function extractPublicIdFromUrl(url?: string): string | null {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const afterUpload = parts[1];

    // If onlyus_chat/ folder is present, directly capture from folder onwards
    if (afterUpload.includes('onlyus_chat/')) {
      const idx = afterUpload.indexOf('onlyus_chat/');
      const pathWithExt = afterUpload.substring(idx).split('?')[0].split('#')[0];
      return pathWithExt.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
    }

    const segments = afterUpload.split('/');
    const pathSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (/^v\d+$/.test(seg)) continue; // skip version prefix like v1726827000
      if (
        seg.includes(',') ||
        /^[a-z]{1,3}_/i.test(seg) ||
        /^t_[a-zA-Z0-9_-]+/i.test(seg)
      ) {
        continue; // skip transformation segment
      }
      pathSegments.push(seg);
    }
    if (pathSegments.length === 0) return null;
    const fullPath = pathSegments.join('/').split('?')[0].split('#')[0];
    return fullPath.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  } catch {
    return null;
  }
}

/**
 * Extract all Cloudinary public_ids and URLs from a message or media object
 */
export function extractAllCloudinaryIds(obj: any): string[] {
  if (!obj) return [];
  const results = new Set<string>();

  function inspectItem(item: any) {
    if (!item) return;
    if (item.public_id && typeof item.public_id === 'string') {
      results.add(item.public_id.trim());
    }
    if (item.url && typeof item.url === 'string') {
      const ext = extractPublicIdFromUrl(item.url);
      if (ext) results.add(ext);
      if (item.url.includes('cloudinary.com')) results.add(item.url);
    }
    if (item.thumbnailUrl && typeof item.thumbnailUrl === 'string') {
      const ext = extractPublicIdFromUrl(item.thumbnailUrl);
      if (ext) results.add(ext);
    }
    if (Array.isArray(item.mediaList)) {
      item.mediaList.forEach(inspectItem);
    }
  }

  // If obj is a message
  if (obj.media) inspectItem(obj.media);
  if (Array.isArray(obj.mediaList)) obj.mediaList.forEach(inspectItem);

  // If obj is string attachment_url
  if (typeof obj.attachment_url === 'string') {
    const ext = extractPublicIdFromUrl(obj.attachment_url);
    if (ext) results.add(ext);
    try {
      const parsed = JSON.parse(obj.attachment_url);
      inspectItem(parsed);
    } catch (_) {}
  }

  // If obj is itself an item
  inspectItem(obj);

  return Array.from(results).filter(Boolean);
}

/**
 * Delete media from Cloudinary via the Supabase delete-cloudinary Edge Function
 */
export async function deleteFromCloudinary(publicIds: string[]): Promise<boolean> {
  const filtered = publicIds.filter(id => Boolean(id && typeof id === 'string' && id.trim()));
  if (filtered.length === 0) return true;

  try {
    // Check if we have credentials in localStorage accounts to pass as direct fallback
    const accounts = getCloudinaryAccounts();
    const activeWithKeys = accounts.find(a => a.cloudName && a.apiKey && a.apiSecret);

    const payload: any = {
      public_ids: filtered,
    };

    if (activeWithKeys) {
      payload.cloud_name = activeWithKeys.cloudName;
      payload.apiKey = activeWithKeys.apiKey;
      payload.apiSecret = activeWithKeys.apiSecret;
    }

    const { data, error } = await supabase.functions.invoke('delete-cloudinary', {
      body: payload,
    });

    if (error) {
      console.warn('Notice: delete-cloudinary Edge Function returned error:', error);
      return false;
    }
    return Boolean(data?.success);
  } catch (err) {
    console.warn('Network error invoking delete-cloudinary Edge Function:', err);
    return false;
  }
}

