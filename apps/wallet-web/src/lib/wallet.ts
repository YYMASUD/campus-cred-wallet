import { createDidKey } from "@campus-cred/sdk";
import type { SdJwtVcCredential } from "@campus-cred/types";

/**
 * Local wallet storage.
 * Keys are generated on-device with @noble/ed25519 (software only — see
 * docs/SECURITY.md for the browser keystore limitation). The private key is
 * stored AES-GCM encrypted under a PBKDF2-derived key from the user PIN.
 */

export interface WalletState {
  did: string;
  publicKeyB64: string;
  /** base64( nonce || AES-GCM(privateKey) ) encrypted under PIN-derived key */
  encryptedPrivateKey?: string;
  createdAt: string;
}

export interface StoredCredential {
  credential: SdJwtVcCredential;
  alias: string;
  addedAt: string;
}

const WALLET_KEY = "ccw_wallet";
const CREDS_KEY = "ccw_credentials";

export function loadWallet(): WalletState | null {
  const raw = localStorage.getItem(WALLET_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function createWallet(pin: string): Promise<WalletState> {
  const k = createDidKey();
  const enc = await encryptKey(k.privateKey, pin);
  const state: WalletState = {
    did: k.did,
    publicKeyB64: b64encode(k.publicKey),
    encryptedPrivateKey: enc,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(WALLET_KEY, JSON.stringify(state));
  return state;
}

export async function unlockPrivateKey(pin: string): Promise<Uint8Array> {
  const w = loadWallet();
  if (!w?.encryptedPrivateKey) throw new Error("wallet not initialised");
  return decryptKey(w.encryptedPrivateKey, pin);
}

// ---- PBKDF2 -> AES-GCM ----

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", buf(new TextEncoder().encode(pin)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: buf(salt), iterations: 200_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Copy into a plain ArrayBuffer (WebCrypto's BufferSource typing is strict). */
function buf(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}

async function encryptKey(privateKey: Uint8Array, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(privateKey))
  );
  const packed = new Uint8Array(salt.length + nonce.length + cipher.length);
  packed.set(salt, 0);
  packed.set(nonce, salt.length);
  packed.set(cipher, salt.length + nonce.length);
  return b64encode(packed);
}

async function decryptKey(packedB64: string, pin: string): Promise<Uint8Array> {
  const packed = b64decode(packedB64);
  const salt = packed.slice(0, 16);
  const nonce = packed.slice(16, 28);
  const cipher = packed.slice(28);
  const key = await deriveKey(pin, salt);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(cipher)));
}

// ---- credentials ----

export function loadCredentials(): StoredCredential[] {
  const raw = localStorage.getItem(CREDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function storeCredential(credential: SdJwtVcCredential, alias = "Credential"): void {
  const creds = loadCredentials();
  creds.push({ credential, alias, addedAt: new Date().toISOString() });
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function removeCredential(hash: string): void {
  const creds = loadCredentials().filter((c) => c.credential.credentialHash !== hash);
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

// ---- helpers ----

function b64encode(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
