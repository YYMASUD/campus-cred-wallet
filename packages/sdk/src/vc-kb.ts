import { bytesToBase64url, jsonToBase64url, utf8ToBase64url } from "./encoding.js";
import { credentialHash, signEd25519, verifyEd25519, publicKeyFromDidKey } from "./did.js";
import { decodeJwt, sdJwtHash } from "./vc.js";

const enc = new TextEncoder();

/** Attach a holder key-binding JWT (binds nonce + verifier domain). */
export function createKeyBindingJwt(opts: {
  sdJwt: string;
  holderPrivateKey: Uint8Array;
  holderDid: string;
  nonce: string;
  audience: string;
}): string {
  const header = { alg: "EdDSA", typ: "kb+jwt", kid: `${opts.holderDid}#${opts.holderDid.split(":")[2]}` };
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    sd_hash: sdJwtHash(opts.sdJwt),
    nonce: opts.nonce,
    aud: opts.audience,
  };
  const signingInput = `${utf8ToBase64url(JSON.stringify(header))}.${jsonToBase64url(payload)}`;
  const sig = signEd25519(opts.holderPrivateKey, enc.encode(signingInput));
  return `${signingInput}.${bytesToBase64url(sig)}`;
}

/** Verify the key-binding JWT against the holder DID, nonce and audience. */
export function verifyKeyBindingJwt(opts: {
  kbJwt: string;
  sdJwtWithoutKb: string;
  holderDid: string;
  expectedNonce: string;
  expectedAudience: string;
}): { ok: boolean; reason?: string } {
  try {
    const decoded = decodeJwt(opts.kbJwt);
    const publicKey = publicKeyFromDidKey(opts.holderDid);
    if (!verifyEd25519(publicKey, enc.encode(decoded.signingInput), decoded.signature)) {
      return { ok: false, reason: "invalid key-binding signature" };
    }
    if (decoded.payload.nonce !== opts.expectedNonce) return { ok: false, reason: "nonce mismatch (replay?)" };
    if (decoded.payload.aud !== opts.expectedAudience) return { ok: false, reason: "audience/domain mismatch" };
    if (decoded.payload.sd_hash !== sdJwtHash(opts.sdJwtWithoutKb)) return { ok: false, reason: "sd_hash mismatch" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Hash used to store/revoke a credential (stable across presentations). */
export function hashCredential(claims: Record<string, unknown>, issuerDid: string): string {
  return credentialHash(JSON.stringify({ claims, issuerDid }));
}
