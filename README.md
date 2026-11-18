# campus-cred-wallet

![CI](https://github.com/YYMASUD/campus-cred-wallet/actions/workflows/ci.yml/badge.svg)

Decentralized identity wallet for campus verifiable credentials. Students hold
W3C VCs (student ID, course certificates, event tickets) bound to a DID and
selectively disclose attributes with SD-JWT + Groth16 ZK proofs.

## Quick start

```bash
pnpm install
pnpm dev:all   # docker compose (chain, ipfs, db, redis) + all dev servers
```

## Monorepo

| Path | What |
|------|------|
| `apps/wallet-web` | Holder wallet PWA (React+Vite) |
| `apps/issuer-portal` | University/organizer dashboard |
| `apps/verifier-portal` | Verifier request builder + QR scanner |
| `packages/types` | Shared types + credential JSON schemas |
| `packages/sdk` | DID, VC (SD-JWT), ZK proof helpers |
| `packages/contracts` | Solidity registries + verifier + soulbound tickets |
| `packages/zk-circuits` | Circom circuits + snarkjs artifacts |
| `packages/ui` | Shared React components |
| `services/issuer-api` | Issuance service |
| `services/verifier-api` | Presentation verification service |
| `services/indexer` | Chain event indexer |
| `infra/docker` | docker-compose one-command stack |

## Docs
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Security](docs/SECURITY.md)
- [API](docs/API.md)
- [User guide](docs/USER_GUIDE.md)

## Deployments
Local dev chain only for now — testnet addresses will be listed here after
deployment (see `infra/scripts/deploy`).

## License
MIT
