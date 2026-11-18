# Demo Script

The end-to-end scenario from the project spec, runnable locally.

## Prerequisites

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d     # chain, postgres, redis, ipfs
pnpm contracts:build && pnpm --filter @campus-cred/contracts run deploy:local
pnpm dev:services                                            # issuer-api, verifier-api, indexer, 3 apps
pnpm seed                                                    # deploys + issues Alice's credentials
```

Ports: wallet `5173`, verifier `5174`, issuer `5175`, issuer-api `3001`, verifier-api `3002`, indexer `3003`, chain `8545`.

## Walkthrough

### 1. The university is a trusted issuer
In the issuer portal (`http://localhost:5175`) the university DID is registered in
`IssuerRegistry` and approved by governance. Only approved issuers can anchor
schemas and issue verifiable credentials.

### 2. Issue a Student ID to Alice
1. In the wallet, open `http://localhost:5173` → **Create wallet** → set a PIN.
   The app generates a `did:key` and an Ed25519 keypair **on-device**; the private
   key is AES-GCM encrypted under a PBKDF2 key derived from the PIN.
2. Copy Alice's DID from the header.
3. In the issuer portal paste the DID, choose **StudentIdCredential**, fill
   givenName/familyName/studentNumber/program/enrollmentStatus/birthDate/university,
   click **Issue credential**.
4. Copy the offer ID. In the wallet go to **Receive credential**, paste it,
   **Fetch**, review, **Accept & store**.

### 3. Issue an event ticket
Same flow with **EventTicketCredential** (eventName, eventId, ticketId, seat).

### 4. Verifier asks: valid ticket AND enrolled student AND age ≥ 18
In the verifier portal (`http://localhost:5174`) select the preset
**"Event gate: valid ticket + enrolled student + age ≥ 18"** and click
**Create presentation request**. A QR code and a request ID appear. The request
carries a fresh `nonce` and the verifier's domain.

### 5. Alice approves; the proof is generated on her device
In the wallet open the ticket → **Present**, paste the request ID, **Load request**.
The consent screen lists exactly what is asked. Claims marked
*"proven without sharing"* never leave the device — only the ZK proof and its
public signals are sent. Toggle the raw claims you consent to disclose
(e.g. only `ticketId`), enter the PIN and **Approve & share**.
The wallet signs a key-binding JWT over `nonce` + `verifierDomain`.

### 6. The verifier sees VERIFIED — without Alice's name, student number or birthdate
The verifier portal polls and displays **VERIFIED** with the list of disclosed
claim *names*. Only what Alice consented to appears. The response for anything
else is `undefined`; the raw SD-JWT contains no private values.

### 7. Revoke, then verify again
In the issuer portal, click **Revoke** on the issued credential. The verifier's
next check returns **REVOKED** and the gate stays closed.

## Automated proof

```bash
pnpm --filter @campus-cred/verifier-api test
```

`services/verifier-api/test/e2e.test.ts` asserts the whole path:

| Test | Asserts |
|------|---------|
| verifies a minimal disclosure | `VERIFIED` + only `ticketId` disclosed; no PII |
| rejects an untrusted issuer | `INVALID` |
| rejects a replay (wrong nonce) | `INVALID`, reason mentions nonce |
| fails after revocation | `REVOKED` |
| never leaks undisclosed claims | raw VP has no name/studentNumber/birthDate |

Real Groth16 proofs (age-over-18, attribute-equality) are covered in
`packages/zk-circuits/test/proofs.test.mjs` using the generated `.zkey` files.
