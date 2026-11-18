/** DID method identifiers supported by the wallet. */
export type DidMethod = "key" | "ethr" | "web";

/** A parsed DID, e.g. did:key:z6Mk... */
export interface ParsedDid {
  method: DidMethod;
  /** Method-specific identifier (everything after did:<method>:) */
  id: string;
  /** Full DID string */
  did: string;
}

/** W3C DID Core verification method (simplified). */
export interface DidVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: JsonWebKey;
}

/** W3C DID Document (simplified, JSON representation). */
export interface DidDocument {
  "@context": string | string[];
  id: string;
  controller?: string;
  verificationMethod?: DidVerificationMethod[];
  authentication?: (string | DidVerificationMethod)[];
  assertionMethod?: (string | DidVerificationMethod)[];
  keyAgreement?: (string | DidVerificationMethod)[];
  service?: DidServiceEndpoint[];
}

export interface DidServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | Record<string, unknown>;
}

/** A holder's local keypair record. Private material stays in secure storage;
 *  this record only references it by kid. */
export interface KeyRecord {
  kid: string;
  did: string;
  algorithm: "Ed25519" | "ES256" | "secp256k1" | "BBS+";
  /** Public key multibase (public material only). */
  publicKeyMultibase: string;
  createdAt: string; // ISO-8601
}
