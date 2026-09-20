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
  label?: string;
  isActive: boolean;
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
