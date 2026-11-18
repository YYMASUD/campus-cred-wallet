# API Contracts

Base URLs (local dev): issuer `http://localhost:3001`, verifier `http://localhost:3002`.

## Issuer API

### `POST /api/credentials/issue`
Body: `IssueCredentialRequest` — see `packages/types/src/api.ts`.
Returns: `IssueCredentialResponse` (`credential` + `credentialOfferUri`).

### `POST /api/credentials/batch`
Body: `BatchIssueRequest` (CSV-upload equivalent, JSON rows).
Returns: array of `IssueCredentialResponse`.

### `POST /api/credentials/revoke`
Body: `RevokeCredentialRequest` → `{ ok: true, statusIndex }`.

### `GET /api/credentials/:hash/status`
→ `{ statusIndex, revoked }`.

### `GET /api/issuers` / `POST /api/issuers/register`
List approved issuers / submit registration (governance approves on-chain).

### `GET /api/offer/:offerId`
Wallet fetches the credential offer after scanning a QR (OpenID4VCI-like).

## Verifier API

### `POST /api/presentations/request`
Body: `CreatePresentationRequestBody` → `CreatePresentationRequestResponse`
(`request` + `requestUri` for QR).

### `GET /api/presentations/request/:id`
Wallet fetches the full `PresentationRequest`.

### `POST /api/presentations/submit`
Body: `VerifiablePresentation` → `VerificationOutcome`
(`VERIFIED | INVALID | REVOKED | EXPIRED`).

### `GET /api/presentations/:requestId/status`
Poll endpoint for the verifier portal → `PresentationStatusResponse`.

## Security notes

- All requests over TLS in production; local dev uses HTTP.
- `submit` must echo `nonce` and `verifierDomain`; verifier rejects mismatches.
- Audit logs store only request ids, outcomes, and timestamps — no claim values.
