# Architecture & Engineering Decisions

| # | Decision | Choice | Rationale / Alternatives |
|---|----------|--------|--------------------------|
| D1 | Credential format | **SD-JWT VC** (IETF) | Mature JS libs (@sd-jwt), simple holder-side selective disclosure. BBS+ considered — stronger unlinkability but heavier deps & fewer maintained TS libs. ZK circuits provide the unlinkable-predicate story. |
| D2 | DID methods | **did:key (holder), did:web/did:ethr (issuer)** | did:key needs no infra for students; issuers get resolvable did:web. did:ethr optional for on-chain control. |
| D3 | ZK stack | **Circom 2 + snarkjs, Groth16, bn128** | Required verifier is a single Solidity contract, cheapest on-chain verify. PLONK considered (universal setup) but Groth16 fits fixed circuits. |
| D4 | Revocation | **On-chain bitmap status list** | Compact, privacy-preserving (index is unlinkable), constant-time check, no personal data. Alternative (StatusList2021 IPFS) adds pinning dependency. |
| D5 | Backend | **Express + TypeScript** | Prompt allows NestJS or Express; Express chosen for speed of delivery, thin service needs. |
| D6 | Wallet | **Web PWA first** (`apps/wallet-web`) | React Native/Flutter mobile deferred — documented limitation. PWA covers E2E demo including QR via camera libs. |
| D7 | Chain | **Hardhat + Solidity ^0.8, local Anvil/Hardhat node; Sepolia/Amoy scripts** | Hardhat matches JS monorepo. Testnet deploy is scripted but gated on GitHub Secrets. |
| D8 | Tickets | **Soulbound (ERC-5192-style, non-transferable ERC-721)** | Simple non-transferability for event gate scenario. |
| D9 | Monorepo | **pnpm workspaces** | Simpler than Turborepo for this scope; `pnpm dev:all` script wraps docker-compose + parallel dev servers. |
| D10 | Exchange protocol | **OpenID4VCI/OpenID4VP-inspired** QR/deep-link flow | Full OID4VCI spec simplified to offer/request + direct_post; documented in API.md. |
| D11 | Storage | **PostgreSQL + Redis, IPFS (Kubo) for encrypted blobs** | No unencrypted personal data on IPFS. Local Kubo node in docker-compose. |
| D12 | Key storage (web) | **WebCrypto non-extractable keys + encrypted IndexedDB backup (PBKDF2→AES-GCM)** | Browser has no secure enclave; limitation documented in SECURITY.md. |
| D13 | Revocation key | **`credentialFingerprint` = keccak256(issuer-JWT)** | Issuer and verifier must derive the same revocation key from the same bytes. Hashing the claims (issuer) vs. the presented SD-JWT (verifier) silently broke revocation — fixed and guarded by `services/verifier-api/test/revocation-key.test.ts`. |
| D14 | ZK in the verifier | **Load real `.vkey.json` files, reject when absent** | `loadVerificationKey` reads `packages/zk-circuits/build/<id>/<id>.vkey.json` and caches it; an absent key returns `null` → `INVALID`, never silently `VERIFIED`. |
| D15 | pnpm CI | **No explicit `version:` in `pnpm/action-setup`** | pnpm reads `packageManager: pnpm@12.21.0` from package.json; passing a second version triggers "Multiple versions of pnpm specified" — documented because it cost a CI cycle. |
