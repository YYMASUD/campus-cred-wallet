import {
  verifySdJwt,
  verifyKeyBindingJwt,
  verifyGroth16,
  sdJwtHash,
} from "@campus-cred/sdk";
import type { VerificationOutcome, VerifiablePresentation } from "@campus-cred/types";

/**
 * Full presentation verification pipeline:
 *  1. issuer SD-JWT signature is valid and issuer is in the allowlist
 *  2. holder key-binding binds nonce + verifier domain (replay protection)
 *  3. every ZK proof verifies
 *  4. credential is not revoked on-chain
 */
export async function verifyPresentation(opts: {
  vp: VerifiablePresentation;
  request: { id: string; nonce: string; verifierDomain: string };
  trustedIssuers: Set<string>;
  isRevoked: (credentialHash: string) => Promise<boolean>;
  vkeyFor: (circuitId: string) => Promise<unknown | null>;
}): Promise<VerificationOutcome> {
  const { vp, request } = opts;

  // basic shape checks
  if (vp.requestId !== request.id) return { status: "INVALID", presentationId: request.id, reason: "request id mismatch" };
  if (vp.nonce !== request.nonce) return { status: "INVALID", presentationId: request.id, reason: "nonce mismatch" };
  if (vp.verifierDomain !== request.verifierDomain)
    return { status: "INVALID", presentationId: request.id, reason: "verifier domain mismatch" };

  // split presentation: everything except trailing key-binding JWT
  const parts = vp.sdJwtVp.split("~");
  const last = parts[parts.length - 1];
  const hasKb = last && last.split(".").length === 3;
  const kbJwt = hasKb ? last : "";
  const sdJwtWithoutKb = hasKb ? parts.slice(0, -1).join("~") + "~" : vp.sdJwtVp;

  // 1. SD-JWT signature + disclosures
  let verified;
  try {
    verified = verifySdJwt(sdJwtWithoutKb);
  } catch (e) {
    return { status: "INVALID", presentationId: request.id, reason: `sd-jwt verify failed: ${(e as Error).message}` };
  }

  if (!opts.trustedIssuers.has(verified.issuer))
    return { status: "INVALID", presentationId: request.id, reason: `untrusted issuer ${verified.issuer}` };

  // 2. holder key-binding
  const kb = verifyKeyBindingJwt({
    kbJwt,
    sdJwtWithoutKb,
    holderDid: vp.holderDid,
    expectedNonce: request.nonce,
    expectedAudience: request.verifierDomain,
  });
  if (!kb.ok) return { status: "INVALID", presentationId: request.id, reason: `key-binding: ${kb.reason}` };

  // 3. ZK proofs
  for (const zkp of vp.zkProofs) {
    const vkey = await opts.vkeyFor(zkp.circuitId);
    if (!vkey) return { status: "INVALID", presentationId: request.id, reason: `no verifier for ${zkp.circuitId}` };
    const ok = await verifyGroth16({ vkeyJson: vkey, publicSignals: zkp.publicSignals, proof: zkp.proof });
    if (!ok) return { status: "INVALID", presentationId: request.id, reason: `zk proof ${zkp.circuitId} failed` };
  }

  // 4. revocation (the hash covers issuer + all claims of the ORIGINAL credential)
  //    The wallet proves knowledge of the hash binding inside its ZK membership
  //    proof; for the demo we additionally re-hash the disclosed set.
  const credentialHash = sdJwtHash(sdJwtWithoutKb);
  if (await opts.isRevoked(credentialHash)) {
    return { status: "REVOKED", presentationId: request.id, reason: "credential revoked" };
  }

  return {
    status: "VERIFIED",
    presentationId: request.id,
    disclosedClaims: vp.disclosedClaims,
  };
}
