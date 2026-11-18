/** Well-known credential types in the campus domain. */
export type CampusCredentialType =
  | "StudentIdCredential"
  | "CourseCertificateCredential"
  | "EventTicketCredential"
  | "MembershipCredential";

/** W3C VC Data Model 2.0 credential (pre-proof). */
export interface VerifiableCredential<T extends CredentialSubject = CredentialSubject> {
  "@context": string[];
  id?: string;
  type: ["VerifiableCredential", ...string[]];
  issuer: string | { id: string; name?: string };
  validFrom: string;
  validUntil?: string;
  credentialSubject: T;
  credentialSchema?: CredentialSchemaRef;
  credentialStatus?: CredentialStatusRef;
  proof?: Proof | Proof[];
}

export interface CredentialSubject {
  id?: string; // holder DID
  [claim: string]: unknown;
}

export interface CredentialSchemaRef {
  id: string; // IPFS CID or URL
  type: "JsonSchema" | "JsonSchemaValidator2019";
}

/** Privacy-preserving status: points at an on-chain bitmap/status list index.
 *  Never contains personal data. */
export interface CredentialStatusRef {
  id: string; // e.g. eip155:31337:0xRegistry#42
  type: "BitmapStatusList" | "StatusList2021Entry";
  statusListIndex: string;
  statusListCredential?: string;
}

/** SD-JWT VC as stored/transmitted (compact serialization plus metadata). */
export interface SdJwtVcCredential {
  /** Compact SD-JWT: jwt~disclosure1~disclosure2~...~kbjwt? */
  sdJwt: string;
  /** Hash of the credential — used for on-chain anchoring, revocation index. */
  credentialHash: string;
  issuerDid: string;
  holderDid: string;
  type: CampusCredentialType;
  issuedAt: string;
  expiresAt?: string;
  statusIndex?: string;
}

/** Proof attached to a VC/presentation. */
export interface Proof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod" | "authentication";
  proofValue?: string;
  jws?: string;
  challenge?: string;
  domain?: string;
}

/** Student ID credential claims (demo schema). */
export interface StudentIdClaims extends CredentialSubject {
  givenName: string;
  familyName: string;
  studentNumber: string;
  program: string;
  enrollmentStatus: "enrolled" | "graduated" | "suspended";
  birthDate: string; // ISO date
  university: string;
}

/** Event ticket claims. */
export interface EventTicketClaims extends CredentialSubject {
  eventName: string;
  eventId: string;
  seat?: string;
  ticketId: string;
}
