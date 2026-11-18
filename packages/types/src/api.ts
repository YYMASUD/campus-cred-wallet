import type { CampusCredentialType, SdJwtVcCredential } from "./credential.js";
import type { PresentationRequest, VerificationOutcome } from "./presentation.js";

/** ===== Issuer API contracts ===== */

export interface IssueCredentialRequest {
  /** Holder DID receiving the credential. */
  holderDid: string;
  type: CampusCredentialType;
  /** Raw claims to include (server-side, over TLS; never logged). */
  claims: Record<string, unknown>;
  expiresInDays?: number;
}

export interface IssueCredentialResponse {
  credential: SdJwtVcCredential;
  /** OpenID4VCI-style offer URI the wallet scans. */
  credentialOfferUri: string;
}

export interface RevokeCredentialRequest {
  credentialHash: string;
  reason?: string;
}

export interface BatchIssueRequest {
  type: CampusCredentialType;
  /** Rows of claims; each row must include holderDid. */
  rows: Array<{ holderDid: string; claims: Record<string, unknown> }>;
}

/** ===== Verifier API contracts ===== */

export interface CreatePresentationRequestBody {
  acceptedTypes: CampusCredentialType[];
  constraints: PresentationRequest["constraints"];
  /** Human-readable purpose shown in wallet consent screen. */
  purpose?: string;
}

export interface CreatePresentationRequestResponse {
  request: PresentationRequest;
  /** Content to encode in the QR / deep link. */
  requestUri: string;
}

export interface PresentationStatusResponse {
  requestId: string;
  outcome: VerificationOutcome | { status: "PENDING" };
}

/** ===== Indexer API ===== */

export interface IndexedEvent {
  contract: "IssuerRegistry" | "SchemaRegistry" | "RevocationRegistry" | "EventTicket";
  event: string;
  args: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
}
