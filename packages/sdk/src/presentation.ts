import type {
  PresentationRequest,
  VerifiablePresentation,
  DisclosedClaim,
  ZkProofAttachment,
} from "@campus-cred/types";
import { createKeyBindingJwt } from "./vc-kb.js";
import { decodeDisclosure } from "./vc.js";

export interface BuildPresentationOptions {
  request: PresentationRequest;
  /** Full SD-JWT VC held by the wallet. */
  sdJwt: string;
  holderDid: string;
  holderPrivateKey: Uint8Array;
  /** Claim names the user consented to disclose. */
  disclose: string[];
  zkProofs?: ZkProofAttachment[];
}

/**
 * Build a VerifiablePresentation:
 * - keeps only the consented disclosures (data minimization)
 * - attaches a key-binding JWT over nonce + verifierDomain (replay protection)
 */
export function buildPresentation(opts: BuildPresentationOptions): VerifiablePresentation {
  const parts = opts.sdJwt.split("~");
  const issuerJwt = parts[0];
  const disclosures = parts.slice(1).filter((p) => p.length > 0);

  const wanted = new Set(opts.disclose);
  const kept = disclosures.filter((d) => {
    try {
      return wanted.has(decodeDisclosure(d).name);
    } catch {
      return false;
    }
  });

  const sdJwtWithoutKb = [issuerJwt, ...kept].join("~") + "~";
  const kbJwt = createKeyBindingJwt({
    sdJwt: sdJwtWithoutKb,
    holderPrivateKey: opts.holderPrivateKey,
    holderDid: opts.holderDid,
    nonce: opts.request.nonce,
    audience: opts.request.verifierDomain,
  });

  const disclosedClaims: DisclosedClaim[] = kept.map((d) => {
    const { name, value } = decodeDisclosure(d);
    return { path: name, value };
  });

  return {
    requestId: opts.request.id,
    nonce: opts.request.nonce,
    verifierDomain: opts.request.verifierDomain,
    holderDid: opts.holderDid,
    sdJwtVp: sdJwtWithoutKb + kbJwt,
    disclosedClaims,
    zkProofs: opts.zkProofs ?? [],
    createdAt: new Date().toISOString(),
  };
}

/** Split a presentation into its SD-JWT part and key-binding part. */
export function splitPresentation(sdJwtVp: string): { sdJwtWithoutKb: string; kbJwt: string } {
  const parts = sdJwtVp.split("~");
  const last = parts[parts.length - 1];
  if (last && last.split(".").length === 3) {
    return {
      sdJwtWithoutKb: parts.slice(0, -1).join("~") + "~",
      kbJwt: last,
    };
  }
  return { sdJwtWithoutKb: sdJwtVp, kbJwt: "" };
}
