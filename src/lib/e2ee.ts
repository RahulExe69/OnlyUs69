/**
 * End-to-End Encryption (E2EE) Module for OnlyUs
 * 
 * Cryptographic Architecture:
 * - Asymmetric Key Exchange: ECDH (P-256) via Web Crypto API (SubtleCrypto)
 * - Symmetric Encryption: AES-256-GCM with 96-bit random IV & 128-bit authentication tag
 * - Key Derivation & Wrapping: PBKDF2 (100,000 iterations, SHA-256) for Passcode/UID protection
 * - Zero external dependencies, pure hardware-accelerated Web Crypto API.
 */

import { supabase } from './supabase';
import { safeGetItem, safeSetItem } from './safeStorage';

// Base64 & Buffer utilities
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface E2EEStatus {
  isReady: boolean;
  hasMyKeys: boolean;
  hasPartnerKey: boolean;
  safetyNumber: string | null;
  error?: string;
}

// In-memory key caches
let _myKeyPair: CryptoKeyPair | null = null;
let _partnerPublicKey: CryptoKey | null = null;
let _sharedKey: CryptoKey | null = null;
let _cachedSafetyNumber: string | null = null;

// Decryption cache to prevent redundant decrypt cycles on re-renders
const _decryptedCache = new Map<string, any>();

// Event listeners for E2EE state changes
type E2EEListener = (status: E2EEStatus) => void;
const _statusListeners = new Set<E2EEListener>();

function notifyListeners(status: E2EEStatus) {
  _statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.warn('[E2EE] Listener error:', err);
    }
  });
}

export function onE2EEStatusChange(listener: E2EEListener): () => void {
  _statusListeners.add(listener);
  // Emit current state immediately
  listener({
    isReady: _sharedKey !== null,
    hasMyKeys: _myKeyPair !== null,
    hasPartnerKey: _partnerPublicKey !== null,
    safetyNumber: _cachedSafetyNumber,
  });
  return () => {
    _statusListeners.delete(listener);
  };
}

/**
 * Generate a new ECDH P-256 key pair
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Export a CryptoKey to JWK string
 */
export async function exportKeyToJWK(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

/**
 * Import a Public CryptoKey from JWK string
 */
export async function importPublicKeyFromJWK(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

/**
 * Import a Private CryptoKey from JWK string
 */
export async function importPrivateKeyFromJWK(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derive an AES-256-GCM key from a passcode/seed using PBKDF2
 */
async function deriveWrappingKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) a private key with a user passcode or account seed
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  passcode: string
): Promise<{ encryptedPrivateKey: string; salt: string; iv: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(passcode, salt);

  const privateJWK = await exportKeyToJWK(privateKey);
  const encodedData = new TextEncoder().encode(privateJWK);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encodedData
  );

  return {
    encryptedPrivateKey: bufferToBase64(cipherBuffer),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
  };
}

/**
 * Unwrap (decrypt) a private key using a passcode or account seed
 */
export async function unwrapPrivateKey(
  encryptedBase64: string,
  saltBase64: string,
  ivBase64: string,
  passcode: string
): Promise<CryptoKey> {
  const salt = base64ToBuffer(saltBase64);
  const iv = base64ToBuffer(ivBase64);
  const cipherBytes = base64ToBuffer(encryptedBase64);

  const wrappingKey = await deriveWrappingKey(passcode, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    cipherBytes
  );

  const privateJWK = new TextDecoder().decode(decryptedBuffer);
  return await importPrivateKeyFromJWK(privateJWK);
}

/**
 * Derive the Pairwise Shared AES-256-GCM Secret between two users
 */
export async function deriveSharedSecret(
  myPrivateKey: CryptoKey,
  partnerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: partnerPublicKey,
    },
    myPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Canonicalize a JWK string or object with alphabetically sorted keys
 * to ensure identical byte hashing across different browsers, platforms, and engines.
 */
function canonicalizeJWK(keyInput: string | Record<string, any>): string {
  try {
    const obj = typeof keyInput === 'string' ? JSON.parse(keyInput) : keyInput;
    const sortedKeys = Object.keys(obj).sort();
    const canonical: Record<string, any> = {};
    for (const k of sortedKeys) {
      canonical[k] = obj[k];
    }
    return JSON.stringify(canonical);
  } catch {
    return typeof keyInput === 'string' ? keyInput.trim() : JSON.stringify(keyInput);
  }
}

/**
 * Calculate a matching Safety Number / Security Code (Signal / WhatsApp style)
 * Both users compute the exact same 12-digit number from their public keys.
 */
export async function computeSafetyNumber(
  pubKeyA: string,
  pubKeyB: string
): Promise<string> {
  const normA = canonicalizeJWK(pubKeyA);
  const normB = canonicalizeJWK(pubKeyB);
  const sorted = [normA, normB].sort().join('::ONLYUS_E2EE::');
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(sorted));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  let numStr = '';
  for (let i = 0; i < 6; i++) {
    const val = (hashArray[i * 2] * 256 + hashArray[i * 2 + 1]) % 1000;
    numStr += val.toString().padStart(3, '0');
  }
  return `${numStr.slice(0, 3)}-${numStr.slice(3, 6)}-${numStr.slice(6, 9)}-${numStr.slice(9, 12)}`;
}

/**
 * Encrypt a text or structured message payload
 */
export async function encryptChatMessage(
  payload: Record<string, any>,
  sharedKey?: CryptoKey | null
): Promise<{ ciphertext: string; iv: string }> {
  const key = sharedKey || _sharedKey;
  if (!key) {
    throw new Error('E2EE shared key not available for encryption');
  }

  const jsonStr = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(jsonStr);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt a message payload
 */
export async function decryptChatMessage(
  ciphertext: string,
  iv: string,
  sharedKey?: CryptoKey | null
): Promise<Record<string, any>> {
  const key = sharedKey || _sharedKey;
  if (!key) {
    throw new Error('E2EE shared key not available for decryption');
  }

  const cipherBytes = base64ToBuffer(ciphertext);
  const ivBytes = base64ToBuffer(iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBytes
  );

  const jsonStr = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonStr);
}

/**
 * High-level helper: Decrypts a raw database message record if ciphertext exists
 */
export async function decryptRawMessage(raw: any, sharedKey?: CryptoKey | null): Promise<any> {
  if (!raw || (!raw.ciphertext && !raw.is_encrypted)) {
    return raw;
  }

  if (!raw.ciphertext || !raw.iv) {
    return raw;
  }

  const cacheKey = `${raw.id || ''}_${raw.ciphertext}`;
  if (_decryptedCache.has(cacheKey)) {
    const cached = _decryptedCache.get(cacheKey);
    return {
      ...raw,
      ...cached,
      is_encrypted: true,
    };
  }

  const key = sharedKey || _sharedKey;
  if (!key) {
    return {
      ...raw,
      text: raw.text || '🔒 Encrypted message',
      is_encrypted: true,
    };
  }

  try {
    const payload = await decryptChatMessage(raw.ciphertext, raw.iv, key);
    _decryptedCache.set(cacheKey, payload);

    return {
      ...raw,
      text: payload.text !== undefined ? payload.text : raw.text,
      attachment_url: payload.attachment_url !== undefined ? payload.attachment_url : raw.attachment_url,
      reply_to: payload.reply_to !== undefined ? payload.reply_to : raw.reply_to,
      is_encrypted: true,
    };
  } catch (err) {
    console.warn('[E2EE] Decryption failed for message:', raw.id, err);
    return {
      ...raw,
      text: '🔒 Encrypted message (Decryption error)',
      is_encrypted: true,
    };
  }
}

/**
 * Decrypt a batch of messages simultaneously
 */
export async function decryptRawMessagesBatch(rawList: any[], sharedKey?: CryptoKey | null): Promise<any[]> {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];
  return await Promise.all(rawList.map((m) => decryptRawMessage(m, sharedKey)));
}

/**
 * Encrypt a media file (image, audio, video) before uploading to Supabase Storage
 */
export async function encryptMediaBlob(
  blob: Blob,
  sharedKey?: CryptoKey | null
): Promise<{ encryptedBlob: Blob; iv: string }> {
  const key = sharedKey || _sharedKey;
  if (!key) throw new Error('E2EE key not available');

  const arrayBuffer = await blob.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    arrayBuffer
  );

  return {
    encryptedBlob: new Blob([cipherBuffer], { type: 'application/octet-stream' }),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt an encrypted media ArrayBuffer back into its original Blob
 */
export async function decryptMediaBlob(
  cipherBuffer: ArrayBuffer,
  ivBase64: string,
  mimeType: string,
  sharedKey?: CryptoKey | null
): Promise<Blob> {
  const key = sharedKey || _sharedKey;
  if (!key) throw new Error('E2EE key not available');

  const ivBytes = base64ToBuffer(ivBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBuffer
  );

  return new Blob([decryptedBuffer], { type: mimeType });
}

/**
 * Initialize E2EE for the current user session:
 * 1. Checks or restores the user's private key (using local storage or unwrapping with passcode/seed)
 * 2. Uploads public key and wrapped private key to Supabase if newly generated
 * 3. Fetches partner's public key
 * 4. Derives the pairwise shared AES-256-GCM key and computes Safety Number
 */
export async function initializeE2EE(
  userId: string,
  role: 'owner' | 'partner',
  passcode?: string
): Promise<E2EEStatus> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    const status: E2EEStatus = {
      isReady: false,
      hasMyKeys: false,
      hasPartnerKey: false,
      safetyNumber: null,
      error: 'Web Crypto API is not available in this environment',
    };
    notifyListeners(status);
    return status;
  }

  try {
    const keyStoragePrefix = `onlyus_e2ee_${userId}`;
    let myKeyPair = _myKeyPair;

    // A. Retrieve from local storage if previously saved
    const cachedPrivateJWK = safeGetItem(`${keyStoragePrefix}_priv`);
    const cachedPublicJWK = safeGetItem(`${keyStoragePrefix}_pub`);

    if (!myKeyPair && cachedPrivateJWK && cachedPublicJWK) {
      try {
        const [priv, pub] = await Promise.all([
          importPrivateKeyFromJWK(cachedPrivateJWK),
          importPublicKeyFromJWK(cachedPublicJWK),
        ]);
        myKeyPair = { privateKey: priv, publicKey: pub };
        _myKeyPair = myKeyPair;
      } catch (err) {
        console.warn('[E2EE] Could not load local cached keys:', err);
      }
    }

    // B. Check user profile row in Supabase
    const { data: myProfile } = await supabase
      .from('users')
      .select('id, public_key, encrypted_private_key, key_salt, key_iv')
      .eq('id', userId)
      .single();

    // Candidate secrets for resilient key unwrapping (account-seed is permanent; passcodes as fallback)
    const candidateSecrets = Array.from(new Set([
      `onlyus_acc_${userId}`,
      passcode,
      role === 'partner' ? safeGetItem('onlyus_partner_passcode') : null,
      '999999',
      '123456'
    ].filter(Boolean) as string[]));

    // C. If user has keys in database but not locally, unwrap them
    if (!myKeyPair && myProfile?.encrypted_private_key && myProfile?.key_salt && myProfile?.key_iv) {
      for (const secret of candidateSecrets) {
        try {
          const priv = await unwrapPrivateKey(
            myProfile.encrypted_private_key,
            myProfile.key_salt,
            myProfile.key_iv,
            secret
          );
          const pub = await importPublicKeyFromJWK(myProfile.public_key);
          myKeyPair = { privateKey: priv, publicKey: pub };
          _myKeyPair = myKeyPair;

          // Cache locally for faster next boot
          safeSetItem(`${keyStoragePrefix}_priv`, await exportKeyToJWK(priv));
          safeSetItem(`${keyStoragePrefix}_pub`, myProfile.public_key);
          break;
        } catch {
          // Continue trying next candidate secret
        }
      }
    }

    // D. If still no keys, generate a fresh key pair and persist to database
    if (!myKeyPair) {
      myKeyPair = await generateECDHKeyPair();
      _myKeyPair = myKeyPair;

      const pubJWK = await exportKeyToJWK(myKeyPair.publicKey);
      const privJWK = await exportKeyToJWK(myKeyPair.privateKey);

      // Cache locally
      safeSetItem(`${keyStoragePrefix}_pub`, pubJWK);
      safeSetItem(`${keyStoragePrefix}_priv`, privJWK);

      // Wrap with permanent account seed and upload to Supabase
      const permanentSecret = `onlyus_acc_${userId}`;
      const wrapped = await wrapPrivateKey(myKeyPair.privateKey, permanentSecret);
      await supabase
        .from('users')
        .update({
          public_key: pubJWK,
          encrypted_private_key: wrapped.encryptedPrivateKey,
          key_salt: wrapped.salt,
          key_iv: wrapped.iv,
        })
        .eq('id', userId);
    } else if (myProfile && !myProfile.public_key) {
      // Ensure database has our public key
      const pubJWK = await exportKeyToJWK(myKeyPair.publicKey);
      await supabase.from('users').update({ public_key: pubJWK }).eq('id', userId);
    }

    // E. Fetch partner's public key
    const partnerRole = role === 'owner' ? 'partner' : 'owner';
    const { data: partnerProfile } = await supabase
      .from('users')
      .select('id, public_key')
      .eq('role', partnerRole)
      .single();

    if (partnerProfile?.public_key) {
      const partnerKey = await importPublicKeyFromJWK(partnerProfile.public_key);
      _partnerPublicKey = partnerKey;

      // F. Derive shared symmetric AES-256-GCM secret
      _sharedKey = await deriveSharedSecret(myKeyPair.privateKey, partnerKey);

      // G. Compute Signal/WhatsApp style matching Safety Number
      const myPubJWK = await exportKeyToJWK(myKeyPair.publicKey);
      _cachedSafetyNumber = await computeSafetyNumber(myPubJWK, partnerProfile.public_key);

      const status: E2EEStatus = {
        isReady: true,
        hasMyKeys: true,
        hasPartnerKey: true,
        safetyNumber: _cachedSafetyNumber,
      };
      notifyListeners(status);
      return status;
    }

    const status: E2EEStatus = {
      isReady: false,
      hasMyKeys: true,
      hasPartnerKey: false,
      safetyNumber: null,
    };
    notifyListeners(status);
    return status;
  } catch (err: any) {
    console.error('[E2EE] Initialization error:', err);
    const status: E2EEStatus = {
      isReady: false,
      hasMyKeys: false,
      hasPartnerKey: false,
      safetyNumber: null,
      error: err?.message || 'Failed to initialize E2EE',
    };
    notifyListeners(status);
    return status;
  }
}

/**
 * Access the active shared AES-256-GCM secret key
 */
export function getActiveSharedKey(): CryptoKey | null {
  return _sharedKey;
}

/**
 * Check if E2EE is active and ready for encryption/decryption
 */
export function isE2EEReady(): boolean {
  return _sharedKey !== null;
}

/**
 * Get current verified Safety Number
 */
export function getSafetyNumber(): string | null {
  return _cachedSafetyNumber;
}

/**
 * Export raw shared secret key in base64 format for native background decryption
 */
export async function exportSharedSecretBase64(): Promise<string | null> {
  if (!_sharedKey) return null;
  try {
    const rawBuffer = await window.crypto.subtle.exportKey('raw', _sharedKey);
    const bytes = new Uint8Array(rawBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('Failed to export raw shared secret key:', err);
    return null;
  }
}

/**
 * Reset memory cache (on logout)
 */
export function resetE2EECache(): void {
  _myKeyPair = null;
  _partnerPublicKey = null;
  _sharedKey = null;
  _cachedSafetyNumber = null;
  _decryptedCache.clear();
}
