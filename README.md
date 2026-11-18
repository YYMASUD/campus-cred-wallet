# campus-cred-wallet

![CI](https://github.com/YYMASUD/campus-cred-wallet/actions/workflows/ci.yml/badge.svg)
![contracts](https://img.shields.io/badge/contracts-21%20passing-brightgreen)
![sdk](https://img.shields.io/badge/sdk-9%20passing-brightgreen)
![e2e](https://img.shields.io/badge/e2e%20demo-5%20passing-brightgreen)
![zk](https://img.shields.io/badge/zk%20proofs-3%20passing-brightgreen)

Decentralized identity wallet for campus verifiable credentials. Students hold
W3C VCs (student ID, course certificates, event tickets) bound to a DID and
selectively disclose attributes with SD-JWT + Groth16 ZK proofs — prove *"I am an
enrolled student and over 18"* without revealing name, student number or birthdate.

## Quick start

```bash
pnpm install
pnpm dev:all          # docker compose (chain, postgres, redis, ipfs) + all dev servers
pnpm seed             # deploy contracts + issue Alice's demo credentials
```

Then open **wallet** http://localhost:5173 · **issuer portal** http://localhost:5175 ·
**verifier portal** http://localhost:5174.
Follow [docs/DEMO.md](docs/DEMO.md) for the full walkthrough.

## Verify everything works

```bash
pnpm test          # contracts (21) + sdk (9) + e2e demo (5)
pnpm zk:build      # compile the 4 circuits
pnpm zk:setup      # groth16 proving/verification keys + solidity verifiers
```

| Suite | Result |
|-------|--------|
| `packages/contracts` | 21 passing |
| `packages/sdk` | 9 passing |
| `services/verifier-api` | 9 passing (5 demo E2E + 4 revocation regression) |
| `services/issuer-api` | 5 passing |
| `packages/zk-circuits` | 3 real Groth16 proofs verified |
| `apps/*` | typecheck + production build OK |
| **GitHub Actions (CI)** | all 4 jobs green on ubuntu-latest |

## Monorepo

| Path | What |
|------|------|
| `apps/wallet-web` | Holder wallet PWA (React+Vite) — onboarding, claim, consent screen, PIN-encrypted keys |
| `apps/issuer-portal` | University/organizer dashboard — issue + revoke |
| `apps/verifier-portal` | Verifier request builder, QR, live VERIFIED/INVALID/REVOKED |
| `packages/types` | Shared types + credential JSON schemas |
| `packages/sdk` | DID (`did:key`), SD-JWT VC, selective disclosure, key-binding, `credentialFingerprint`, ZK wrappers, encrypted IPFS |
| `packages/contracts` | IssuerRegistry, SchemaRegistry, RevocationRegistry (bitmap), ZKVerifier, soulbound EventTicket |
| `packages/zk-circuits` | Circom circuits (ageOver, membership, nonRevocation, attributeEquals) + Groth16 artifacts |
| `packages/ui` | Shared React components (scaffold) |
| `services/issuer-api` | Issuance service |
| `services/verifier-api` | Presentation verification service |
| `services/indexer` | Chain event indexer |
| `infra/docker` | docker-compose one-command stack |
| `infra/scripts` | Seed script |

## Privacy model (non-negotiable)

- **No personal data on-chain** — only hashes, Merkle roots, schema CIDs, issuer DIDs, revocation bits.
- **Encrypted IPFS only** — AES-GCM client-side before upload.
- **Keys never leave the device** — Ed25519 on-device, PIN-encrypted at rest.
- **Replay + phishing protection** — every presentation binds a `nonce`, the `verifierDomain` and `sd_hash`.
- **Data minimisation** — the consent screen shows exactly what is shared; ZK-proven attributes are marked "not shared".

## Docs
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Security](docs/SECURITY.md)
- [API](docs/API.md)
- [User guide](docs/USER_GUIDE.md)
- [Demo script](docs/DEMO.md)
- [Summary report & roadmap](docs/SUMMARY.md)
- [Deployments](docs/DEPLOYMENTS.md)

## Deployments
Local dev chain only. Testnet deployment is a manual GitHub Actions workflow
(`.github/workflows/deploy-testnet.yml`) gated on `DEPLOYER_PRIVATE_KEY` and
`TESTNET_RPC_URL` secrets; addresses are recorded in
[`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md) after the first successful run.

## License
MIT
