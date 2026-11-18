import { sha256 } from "@noble/hashes/sha256";
import { bytesToBase64url, base64urlToBytes, jsonToBase64url, base64urlToJson, utf8ToBase64url } from "./encoding.js";
import { credentialHash, signEd25519, verifyEd25519, publicKeyFromDidKey } from "./did.js";

/**
 * SD-JWT VC subset (RFC 9901 draft).
 * Format: <issuer-jwt>~<disclosure>~<disclosure>~...~[<key-binding-jwt>]
 * - The issuer JWT header carries "_sd_alg": "sha-256".
 * - The payload has "_sd" = array of base64url(SHA-256(disclosure)).
 * - A disclosure = base64url([salt, name, value]).
 * - The key-binding JWT carries "nonce" + "aud" (verifier domain) and is signed
 *   by the holder key over the SD-JWT hash, defeating replay + phishing.
 */

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: Uint8Array;
  signingInput: string;
}

const enc = new TextEncoder();

export function sha256B64url(input: string): string {
  return bytesToBase64url(sha256(enc.encode(input)));
}

export function randomSalt(size = 16): string {
  const b = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(b);
  } else {
    // Node fallback
    for (let i = 0; i < size; i++) b[i] = Math.floor(Math.random() * 256);
  }
  return bytesToBase64url(b);
}

/** Create a disclosure for claim `name` => `value`. */
export function createDisclosure(name: string, value: unknown): string {
  return jsonToBase64url([randomSalt(), name, value]);
}

export function decodeDisclosure(d: string): { salt: string; name: string; value: unknown } {
  const [salt, name, value] = base64urlToJson<[string, string, unknown]>(d);
  return { salt, name, value };
}

export interface IssuerJwtInput {
  /** Flat claim set; every claim becomes selectively disclosable. */
  claims: Record<string, unknown>;
  /** Claims that must always be visible (e.g. vct, iss, iat). */
  publicClaims: Record<string, unknown>;
  issuerDid: string;
  issuerPrivateKey: Uint8Array;
  kid?: string;
  expiresInSeconds?: number;
}

export interface IssuedSdJwt {
  sdJwt: string;
  disclosures: string[];
  payload: Record<string, unknown>;
}

/** Issue an SD-JWT VC. */
export function issueSdJwt(input: IssuerJwtInput): IssuedSdJwt {
  const iat = Math.floor(Date.now() / 1000);
  const header = {
    alg: "EdDSA",
    typ: "vc+sd-jwt",
    kid: input.kid ?? `${input.issuerDid}#${input.issuerDid.split(":")[2] ?? "key"}`,
    _sd_alg: "sha-256",
  };

  const disclosures: string[] = [];
  const sdHashes: string[] = [];

  for (const [name, value] of Object.entries(input.claims)) {
    const d = createDisclosure(name, value);
    disclosures.push(d);
    sdHashes.push(sha256B64url(d));
  }

  const payload: Record<string, unknown> = {
    iss: input.issuerDid,
    iat,
    ...(input.expiresInSeconds ? { exp: iat + input.expiresInSeconds } : {}),
    ...input.publicClaims,
    _sd: sdHashes,
  };

  const signingInput = `${utf8ToBase64url(JSON.stringify(header))}.${jsonToBase64url(payload)}`;
  const signature = signEd25519(input.issuerPrivateKey, enc.encode(signingInput));
  const jwt = `${signingInput}.${bytesToBase64url(signature)}`;

  return { sdJwt: [jwt, ...disclosures].join("~"), disclosures, payload };
}

export function decodeJwt(token: string): DecodedJwt {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error("malformed JWT");
  return {
    header: base64urlToJson<Record<string, unknown>>(headerB64),
    payload: base64urlToJson<Record<string, unknown>>(payloadB64),
    signature: base64urlToBytes(sigB64),
    signingInput: `${headerB64}.${payloadB64}`,
  };
}

export interface VerifiedSdJwt {
  issuer: string;
  payload: Record<string, unknown>;
  disclosures: { name: string; value: unknown }[];
  claims: Record<string, unknown>;
}

/**
 * Verify an SD-JWT presentation (no key binding).
 * 1. Decode the issuer JWT and verify its signature with the issuer did:key.
 * 2. For every disclosure provided, check it is committed in `_sd`.
 * 3. Return the disclosed claims only.
 */
export function verifySdJwt(sdJwt: string): VerifiedSdJwt {
  const parts = sdJwt.split("~");
  const [issuerJwt, ...rest] = parts;
  // Key-binding JWTs are JWTs (3 dot-separated parts); disclosures are not.
  const disclosures = rest.filter((p) => p.length > 0 && p.split(".").length !== 3);
  const decoded = decodeJwt(issuerJwt);

  const issuer = decoded.payload.iss as string;
  if (!issuer) throw new Error("missing iss");
  const publicKey = publicKeyFromDidKey(issuer);
  const ok = verifyEd25519(publicKey, enc.encode(decoded.signingInput), decoded.signature);
  if (!ok) throw new Error("issuer signature invalid");

  const committed = new Set((decoded.payload._sd as string[]) ?? []);
  const claims: Record<string, unknown> = {};
  const decodedDisclosures: { name: string; value: unknown }[] = [];

  for (const d of disclosures) {
    const hash = sha256B64url(d);
    if (!committed.has(hash)) throw new Error("disclosure not committed by issuer");
    const { name, value } = decodeDisclosure(d);
    claims[name] = value;
    decodedDisclosures.push({ name, value });
  }

  for (const [k, v] of Object.entries(decoded.payload)) {
    if (k !== "_sd" && k !== "_sd_alg") claims[k] = v;
  }

  return { issuer, payload: decoded.payload, disclosures: decodedDisclosures, claims };
}

/** Compute the SD-JWT hash used in the key-binding JWT (`sd_hash`). */
export function sdJwtHash(sdJwtWithoutKb: string): string {
  return sha256B64url(sdJwtWithoutKb);
}

export { base64urlToBytes };
