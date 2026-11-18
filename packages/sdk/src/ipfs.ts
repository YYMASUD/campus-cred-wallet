/**
 * Encrypted IPFS helpers: client-side AES-GCM before upload.
 * Raw personal data never touches IPFS.
 */

export interface EncryptedBlob {
  cid: string;
  /** base64url nonce used for AES-GCM */
  nonce: string;
}

async function getKey(secret: Uint8Array | CryptoKey): Promise<CryptoKey> {
  if (secret instanceof CryptoKey) return secret;
  return crypto.subtle.importKey("raw", toArrayBuffer(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export async function encryptBytes(plaintext: Uint8Array, secret: Uint8Array | CryptoKey) {
  const key = await getKey(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, toArrayBuffer(plaintext))
  );
  return { nonce, ciphertext };
}

export async function decryptBytes(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  secret: Uint8Array | CryptoKey
): Promise<Uint8Array> {
  const key = await getKey(secret);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, toArrayBuffer(ciphertext))
  );
}

/** Encrypt + pin to a local Kubo IPFS node. Returns the CID and nonce. */
export async function uploadEncrypted(opts: {
  data: Uint8Array | string;
  secret: Uint8Array | CryptoKey;
  ipfsApi: string; // e.g. http://localhost:5001
}): Promise<EncryptedBlob> {
  const bytes = typeof opts.data === "string" ? new TextEncoder().encode(opts.data) : opts.data;
  const { nonce, ciphertext } = await encryptBytes(bytes, opts.secret);

  const form = new FormData();
  form.append("file", new Blob([ciphertext]), "blob.enc");
  const res = await fetch(`${opts.ipfsApi}/api/v0/add`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`ipfs add failed: ${res.status}`);
  const { Hash } = (await res.json()) as { Hash: string };

  let bin = "";
  for (const b of nonce) bin += String.fromCharCode(b);
  const nonceB64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { cid: Hash, nonce: nonceB64 };
}

/** Fetch + decrypt a blob from the IPFS gateway. */
export async function downloadAndDecrypt(opts: {
  cid: string;
  nonce: string; // base64url
  secret: Uint8Array | CryptoKey;
  gateway: string; // e.g. http://localhost:8080
}): Promise<Uint8Array> {
  const res = await fetch(`${opts.gateway}/ipfs/${opts.cid}`);
  if (!res.ok) throw new Error(`ipfs fetch failed: ${res.status}`);
  const ciphertext = new Uint8Array(await res.arrayBuffer());
  const b64 = opts.nonce.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const nonce = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) nonce[i] = bin.charCodeAt(i);
  return decryptBytes(ciphertext, nonce, opts.secret);
}
