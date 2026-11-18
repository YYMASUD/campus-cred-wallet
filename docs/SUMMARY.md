# Summary Report — campus-cred-wallet v1.0.0

## What was built

A pnpm/Turborepo-style monorepo implementing a decentralized identity wallet for
campus verifiable credentials.

| Layer | Contents | State |
|-------|----------|-------|
| **Smart contracts** (`packages/contracts`) | `IssuerRegistry`, `CredentialSchemaRegistry`, `RevocationRegistry` (bitmap status list), `ZKVerifier` (Groth16 router + replay guard), `EventTicket` (ERC-5192 soulbound) | Compiles (solc 0.8.28, cancun) · **21/21 tests pass** |
| **ZK circuits** (`packages/zk-circuits`) | `ageOver`, `membership`, `nonRevocation`, `attributeEquals` (Circom 2.1.6) | All compile · Groth16 keys + Solidity verifiers generated · **3/3 real proof round-trips pass** |
| **SDK** (`packages/sdk`) | `did:key` create/resolve, SD-JWT VC issue/verify, selective-disclosure presentation builder, key-binding JWT (nonce+domain), Groth16 wrappers, AES-GCM IPFS helpers | **9/9 tests pass**, fully typed |
| **Services** (`services/*`) | `issuer-api` (issue/batch/revoke/offer), `verifier-api` (request/submit/status + full verification pipeline), `indexer` (viem event indexer → Postgres) | Typecheck clean · **5/5 E2E + 5/5 issuer tests pass** |
| **Apps** (`apps/*`) | `wallet-web` (PWA: onboarding, claim, credential cards, consent screen, PIN-encrypted keys), `issuer-portal` (issue/revoke), `verifier-portal` (request presets, QR, live status) | All typecheck and **build** |
| **Infra** | docker-compose (chain, Postgres, Redis, Kubo IPFS), seed script, CI matrix (4 jobs), manual testnet deploy workflow | Present |

## Verification summary

```
packages/contracts        21 passed  (Hardhat)
packages/sdk               9 passed  (vitest)
packages/zk-circuits       3 passed  (node --test, real Groth16 proofs)
services/verifier-api      5 passed  (vitest, full demo scenario)
services/issuer-api        5 passed  (vitest)
apps/*                     build OK  (vite + tsc)
```

The headline result: `services/verifier-api/test/e2e.test.ts` executes the spec's
demo scenario (issue → hold → selectively present → verify → replay rejected →
revoke → `REVOKED`) and asserts that no undisclosed claim leaks.

## Privacy & security properties implemented

- Nothing personal on-chain: contracts store only hashes, DIDs, schema IDs and revocation bits.
- IPFS helpers encrypt client-side (AES-GCM) before upload.
- Presentations bind `nonce` + `verifierDomain` + `sd_hash` in a holder-signed key-binding JWT → replay and phishing resistance (tested).
- Selective disclosure by construction: the issuer JWT commits to hashes only; the wallet ships just the consented disclosures.
- Consent screen enumerates every requested attribute and marks ZK-proven ones as "not shared".
- Revocation is a single bitmap bit; verifications flip to `REVOKED` (tested).

## Known limitations

1. **Web keystore is software-only.** Browser WebCrypto + PIN-encrypted localStorage is weaker than a hardware enclave. A native/mobile build should use Keychain/Keystore (deferred — see D6).
2. **Trusted setup is local/dev.** The ptau file was generated locally without a multi-party ceremony. Production must use a real powers-of-tau ceremony; script and warning are in `scripts/setup.mjs`.
3. **Scope circuits to the demo predicates.** `membership` (depth 8) and `nonRevocation` (one 256-bit word) are structurally complete but the wallet does not yet wire live Merkle paths/bitmap words into them at presentation time; the verifier's ZK hook is present (`vkeyFor`) and returns `null` by default.
4. **In-memory presentation store** in verifier-api (Redis is provisioned but unused). Requests are lost on restart.
5. **No mobile app.** React Native/Flutter holder was deferred in favour of the PWA.
6. **Testnet deploy is scripted, not executed** — needs `DEPLOYER_PRIVATE_KEY` + `TESTNET_RPC_URL` secrets. Address table in `docs/DEPLOYMENTS.md` is therefore intentionally empty.
7. **Correlation resistance is good, not perfect.** `credentialHash`/status index are stable per credential; BBS+ derived proofs would give stronger unlinkability.
8. `did:ethr`/`did:web` resolution for issuers is described but only `did:key` is implemented end to end.

## Roadmap

- **Mainnet readiness:** real ceremony, external audit of circuits + contracts, gas optimisation.
- **EUDI wallet compatibility:** align the VC/presentation layer with ARF and OpenID4VP final.
- **Cross-campus federation:** federated issuer trust lists; multi-tenant issuer hosting.
- **BBS+ presentations** for unlinkability across colluding verifiers.
- **Mobile wallets** with secure enclave key storage and NFC/QR handoff.
- **Live ZK wiring:** Merkle-path membership and bitmap non-revocation proofs generated in the wallet at presentation time.
- **Revocation push notifications** and credential expiry UX.
