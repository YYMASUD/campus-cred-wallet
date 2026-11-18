# campus-cred-wallet — Architecture

## Overview

A decentralized identity wallet for campus verifiable credentials. Students hold
W3C Verifiable Credentials bound to a DID, and selectively disclose attributes to
verifiers using SD-JWT selective disclosure plus Groth16 ZK proofs for hidden
predicates (age-over-X, membership, non-revocation, attribute-equality).

## System diagram

```
                 ┌─────────────────────────────┐
                 │        EVM chain (Anvil)     │
                 │  IssuerRegistry             │
                 │  SchemaRegistry             │
                 │  RevocationRegistry(bitmap) │
                 │  ZKVerifier (Groth16)       │
                 │  EventTicket (soulbound)    │
                 └──────────────┬──────────────┘
                                │ events
                          ┌─────▼─────┐
                          │  indexer  │──► PostgreSQL
                          └───────────┘
┌───────────────┐   OpenID4VCI-like   ┌────────────┐
│ issuer-portal │◄───────────────────►│ issuer-api │──► IPFS (encrypted schemas/meta)
│  (React+Vite) │                     │  (Express) │──► PostgreSQL / Redis
└───────────────┘                     └─────┬──────┘
                                            │ credential offer (QR)
                                            ▼
                                     ┌────────────┐    SD-JWT VP + ZK proof   ┌───────────────┐
                                     │ wallet-web │──────────────────────────►│ verifier-api  │
                                     │  (PWA)     │◄──────────────────────────│  (Express)    │
                                     └────────────┘   presentation request    └───────▲───────┘
                                                                                      │
                                                                              ┌───────┴────────┐
                                                                              │verifier-portal │
                                                                              │ (QR + scanner) │
                                                                              └────────────────┘
```

## Trust model

- **Issuers** (universities, event organizers) are registered and approved in
  `IssuerRegistry` by a governance admin. Their DIDs are the root of trust for
  credential signatures.
- **Holders** (students) generate `did:key` / `did:ethr` identifiers on-device.
  Private keys never leave device storage (WebCrypto + IndexedDB wrap for web,
  Keychain/Keystore for mobile).
- **Verifiers** create `PresentationRequest`s bound to a `nonce` and their
  domain. Presentations bind both, preventing replay and phishing.
- **Chain** stores only hashes, Merkle roots, schema CIDs, issuer DIDs and
  revocation bits. No personal data on-chain, ever.

## Data flows

### Issuance
1. University approved on-chain (IssuerRegistry).
2. Issuer API builds an SD-JWT VC (`sdJwt`), computes `credentialHash`, assigns a
   revocation bitmap index, optionally anchors a Merkle root of issued hashes.
3. Holder wallet scans QR → fetches credential offer → validates schema → stores
   credential encrypted locally.

### Presentation (selective disclosure + ZK)
1. Verifier portal creates a `PresentationRequest` (e.g. "valid ticket AND
   enrolled AND age ≥ 18") → QR.
2. Wallet shows exactly what will be shared; user toggles disclosures.
3. For hidden predicates wallet runs a Groth16 prover (snarkjs WASM) producing a
   proof with public signals (thresholds, Merkle roots) — no raw attributes.
4. Verifier API checks: SD-JWT signature + issuer trusted + nonce/domain binding
   + ZK proof validity + revocation bitmap clear → `VERIFIED`.

### Revocation
Issuer flips the credential's bitmap index in `RevocationRegistry`; verifier
reads the bit → next verification returns `REVOKED`.

## Repo layout

See README. Packages: `types` (shared contracts), `sdk` (DID/VC/ZK helpers),
`contracts` (Hardhat), `zk-circuits` (snarkjs artifacts + circuit sources),
`ui` (shared React). Services: `issuer-api`, `verifier-api`, `indexer`.
Apps: `wallet-web` (PWA), `issuer-portal`, `verifier-portal`.
