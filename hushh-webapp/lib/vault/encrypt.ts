// lib/vault/encrypt.ts

/**
 * Client-Side Data Encryption
 * 
 * Encrypts data with vault key before sending to server.
 * Uses AES-256-GCM (same as consent-protocol backend).
 */

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
  encoding: 'base64';
  algorithm: 'aes-256-gcm';
}

export async function encryptData(
  plaintext: string,
  vaultKeyHex: string
): Promise<EncryptedPayload> {
  const keyBytes = new Uint8Array(
    vaultKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  const ciphertext = new Uint8Array(encrypted.slice(0, -16));
  const tag = new Uint8Array(encrypted.slice(-16));

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag)),
    encoding: "base64",
    algorithm: "aes-256-gcm"
  };
}

export async function decryptData(
  payload: EncryptedPayload,
  vaultKeyHex: string
): Promise<string> {
  const keyBytes = new Uint8Array(
    vaultKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(payload.tag), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    combined
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
