import { createDidKey, issueSdJwt, hashCredential } from "@campus-cred/sdk";
import type { CampusCredentialType, SdJwtVcCredential } from "@campus-cred/types";
import { pool } from "./db.js";

/** Issuer identity — in a real deployment the key lives in a KMS/HSM. */
export function loadIssuerIdentity() {
  const privB64 = process.env.ISSUER_SIGNING_KEY;
  if (!privB64) {
    // dev fallback: deterministic ephemeral key for local testing only.
    const k = createDidKey();
    console.warn("ISSUER_SIGNING_KEY not set — using ephemeral dev key");
    return { did: process.env.ISSUER_DID ?? k.did, privateKey: k.privateKey };
  }
  const privateKey = Uint8Array.from(Buffer.from(privB64, "base64"));
  return { did: process.env.ISSUER_DID ?? "did:web:issuer.example.edu", privateKey };
}

export interface IssuedCredential {
  credential: SdJwtVcCredential;
  offerId: string;
}

export async function issueCredential(opts: {
  holderDid: string;
  type: CampusCredentialType;
  claims: Record<string, unknown>;
  expiresInDays?: number;
}): Promise<IssuedCredential> {
  const issuer = loadIssuerIdentity();
  const expiresInSeconds = (opts.expiresInDays ?? 365) * 86400;

  // every claim becomes a selectively disclosable disclosure
  const { sdJwt } = issueSdJwt({
    claims: { ...opts.claims, sub: opts.holderDid },
    publicClaims: {
      iss: issuer.did,
      vct: opts.type,
      cnf: { kid: opts.holderDid },
    },
    issuerDid: issuer.did,
    issuerPrivateKey: issuer.privateKey,
    expiresInSeconds,
  });

  const credentialHash = hashCredential(opts.claims, issuer.did);
  const statusIndex = Number(await nextStatusIndex());

  const credential: SdJwtVcCredential = {
    sdJwt,
    credentialHash,
    issuerDid: issuer.did,
    holderDid: opts.holderDid,
    type: opts.type,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    statusIndex: String(statusIndex),
  };

  const offerId = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min claim window

  await pool.query(
    `INSERT INTO credential_offers(offer_id, holder_did, credential_json, expires_at)
     VALUES($1,$2,$3,$4)`,
    [offerId, opts.holderDid, JSON.stringify(credential), expiresAt]
  );

  return { credential, offerId };
}

async function nextStatusIndex(): Promise<number> {
  const r = await pool.query(
    "INSERT INTO revoked(credential_hash, status_index) VALUES($1, (SELECT COALESCE(MAX(status_index)+1,0) FROM revoked)) ON CONFLICT DO NOTHING RETURNING status_index",
    [`idx_${Date.now()}`]
  );
  return r.rows[0]?.status_index ?? Math.floor(Math.random() * 16384);
}
