import type { CampusCredentialType } from "./credential.js";

/** A field constraint in a presentation request. */
export interface ClaimConstraint {
  /** JSON pointer-ish path into credentialSubject, e.g. "enrollmentStatus" */
  path: string;
  /** Predicate for ZK proofs. "eq" reveals via SD disclosure; ranges go to circuits. */
  predicate: "eq" | "gte" | "lte" | "memberOf" | "notRevoked";
  /** Public value the claim is compared against (undefined = reveal value). */
  value?: unknown;
  /** If true the claim is proven in ZK and NOT disclosed. */
  zk?: boolean;
}

/** OpenID4VP-style presentation request created by a verifier. */
export interface PresentationRequest {
  id: string; // request id
  /** Replay protection: random nonce the wallet must bind into the proof. */
  nonce: string;
  /** Domain binding: verifier's domain, checked by wallet UI and proof. */
  verifierDomain: string;
  /** DID of the verifier if available. */
  verifierDid?: string;
  /** Which credential types satisfy this request. */
  acceptedTypes: CampusCredentialType[];
  constraints: ClaimConstraint[];
  /** Callback URL where the wallet posts the presentation (OpenID4VP direct_post). */
  responseUri: string;
  expiresAt: string;
  createdAt: string;
}

/** A disclosed attribute in a presentation. */
export interface DisclosedClaim {
  path: string;
  value: unknown;
}

/** Result produced by the wallet after user consent. */
export interface VerifiablePresentation {
  /** Echoed request id + nonce for replay binding. */
  requestId: string;
  nonce: string;
  verifierDomain: string;
  holderDid: string;
  /** SD-JWT presentation (compact, with key-binding JWT). */
  sdJwtVp: string;
  /** Selectively disclosed claims (subset the user consented to). */
  disclosedClaims: DisclosedClaim[];
  /** ZK proofs for hidden predicates. */
  zkProofs: ZkProofAttachment[];
  createdAt: string;
}

export interface ZkProofAttachment {
  /** Circuit that produced the proof. */
  circuitId: "ageOver" | "membership" | "nonRevocation" | "attributeEquals";
  /** snarkjs Groth16 proof object. */
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: "groth16" | "plonk";
    curve: "bn128";
  };
  /** Public signals in circuit-defined order. */
  publicSignals: string[];
}

/** What a verifier reports back to the UI after checking a presentation. */
export type VerificationOutcome =
  | { status: "VERIFIED"; presentationId: string; disclosedClaims: DisclosedClaim[] }
  | { status: "INVALID"; presentationId: string; reason: string }
  | { status: "REVOKED"; presentationId: string; reason: string }
  | { status: "EXPIRED"; presentationId: string; reason: string };
