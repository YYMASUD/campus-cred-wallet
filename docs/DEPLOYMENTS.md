# Contract deployment addresses

Filled in by `packages/contracts/scripts/deploy.ts` → `packages/contracts/deployments/<chainId>.json`.

## Local dev (chainId 31337)

Run `pnpm --filter @campus-cred/contracts deploy:local` against a running node.

| Contract | Address |
|----------|---------|
| IssuerRegistry | _(not deployed yet)_ |
| CredentialSchemaRegistry | _(not deployed yet)_ |
| RevocationRegistry | _(not deployed yet)_ |
| ZKVerifier | _(not deployed yet)_ |
| EventTicket | _(not deployed yet)_ |

## Testnet

Deployment is gated on `DEPLOYER_PRIVATE_KEY` + `TESTNET_RPC_URL` GitHub secrets
(see `.github/workflows/deploy-testnet.yml`). Addresses will be recorded here
after the first successful deploy.
