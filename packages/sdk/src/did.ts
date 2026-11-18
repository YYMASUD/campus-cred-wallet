import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { sha256 } from "@noble/hashes/sha256";
import type { DidDocument, DidMethod, ParsedDid } from "@campus-cred/types";
import { bytesToBase64url, base64urlToBytes, toHex, fromHex } from "./encoding.js";

// @noble/ed25519 v2 requires an explicit SHA-512 implementation in sync mode
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

const MULTIBASE_BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

/** Minimal base58btc encoder (no deps). */
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += MULTIBASE_BASE58[digits[i]];
  return out;
}

/** Minimal base58btc decoder. */
export function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    let carry = MULTIBASE_BASE58.indexOf(s[i]);
    if (carry < 0) throw new Error(`invalid base58 char: ${s[i]}`);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
  return out;
}

export interface GeneratedKey {
  did: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyMultibase: string;
  method: DidMethod;
}

/**
 * Create a did:key identifier from a fresh Ed25519 keypair.
 * did:key = "did:key:" + multibase(base58btc, multicodec(ed25519-pub) || pubkey)
 */
export function createDidKey(): GeneratedKey {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);

  const multicodec = new Uint8Array(ED25519_MULTIBASE().length + publicKey.length);
  multicodec.set(ED25519_MULTIBASE(), 0);
  multicodec.set(publicKey, ED25519_MULTIBASE().length);

  const multibase = "z" + base58Encode(multicodec);
  return {
    did: `did:key:${multibase}`,
    publicKey,
    privateKey,
    publicKeyMultibase: multibase,
    method: "key",
  };
}

function ED25519_MULTIBASE(): Uint8Array {
  return ED25519_MULTICODEC;
}

/** Derive a did:key DID from an existing Ed25519 public key. */
export function didFromPublicKey(publicKey: Uint8Array): string {
  const multicodec = new Uint8Array(2 + publicKey.length);
  multicodec.set(ED25519_MULTICODEC, 0);
  multicodec.set(publicKey, 2);
  return `did:key:z${base58Encode(multicodec)}`;
}

/** Extract the raw Ed25519 public key from a did:key string. */
export function publicKeyFromDidKey(did: string): Uint8Array {
  const parsed = parseDid(did);
  if (parsed.method !== "key") throw new Error("not a did:key");
  const mb = parsed.id;
  if (!mb.startsWith("z")) throw new Error("expected base58btc multibase");
  const decoded = base58Decode(mb.slice(1));
  // strip multicodec prefix 0xed 0x01
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) throw new Error("unsupported multicodec prefix");
  return decoded.slice(2);
}

export function parseDid(did: string): ParsedDid {
  const m = /^did:([a-z0-9]+):(.+)$/.exec(did);
  if (!m) throw new Error(`invalid DID: ${did}`);
  const method = m[1] as DidMethod;
  if (!["key", "ethr", "web"].includes(method)) throw new Error(`unsupported DID method: ${method}`);
  return { method, id: m[2], did };
}

/** Build a DID Document for a did:key (no network resolution needed). */
export function resolveDidKey(did: string): DidDocument {
  const publicKey = publicKeyFromDidKey(did);
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: did,
    verificationMethod: [
      {
        id: `${did}#${did.split(":")[2]}`,
        type: "Ed25519VerificationKey2020",
        controller: did,
        publicKeyMultibase: did.split(":")[2],
      },
    ],
    authentication: [`${did}#${did.split(":")[2]}`],
    assertionMethod: [`${did}#${did.split(":")[2]}`],
  };
}

/** Sign arbitrary bytes with an Ed25519 private key. */
export function signEd25519(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed.sign(message, privateKey);
}

/** Verify an Ed25519 signature. */
export function verifyEd25519(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** SHA-256 hash of a credential body, used as the on-chain anchor. */
export function credentialHash(credentialJson: string): string {
  return "0x" + toHex(sha256(new TextEncoder().encode(credentialJson)));
}

export { bytesToBase64url, base64urlToBytes, fromHex, toHex };
