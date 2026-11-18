import express from "express";
import pg from "pg";
import { createPublicClient, http, parseAbiItem, type Log } from "viem";

const { Pool } = pg;

const RPC_URL = process.env.RPC_URL ?? "http://localhost:8545";
const DATABASE_URL = process.env.INDEXER_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/indexer";
const PORT = Number(process.env.INDEXER_PORT ?? 3003);

const pool = new Pool({ connectionString: DATABASE_URL });
const client = createPublicClient({ transport: http(RPC_URL) });

/**
 * Indexer: listens for registry events and caches them in Postgres.
 * Stores ONLY public data: issuer DIDs, schema hashes/CIDs, revocation bits,
 * ticket ids. No personal data ever enters this service.
 */

const EVENTS = {
  IssuerRegistry: [
    parseAbiItem("event IssuerRegistered(bytes32 indexed didHash, string did, address indexed controller, string name)"),
    parseAbiItem("event IssuerApproved(bytes32 indexed didHash, string did)"),
    parseAbiItem("event IssuerSuspended(bytes32 indexed didHash, string did)"),
  ],
  RevocationRegistry: [
    parseAbiItem("event CredentialRevoked(bytes32 indexed issuerDidHash, uint256 statusIndex, uint256 page, uint256 bit)"),
    parseAbiItem("event CredentialUnrevoked(bytes32 indexed issuerDidHash, uint256 statusIndex)"),
  ],
  CredentialSchemaRegistry: [
    parseAbiItem("event SchemaRegistered(bytes32 indexed schemaHash, string cid, string issuerDid, string name, string version)"),
  ],
};

const ADDRESSES: Record<string, `0x${string}`> = JSON.parse(process.env.CONTRACT_ADDRESSES ?? "{}");

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chain_events (
      id BIGSERIAL PRIMARY KEY,
      contract TEXT NOT NULL,
      event TEXT NOT NULL,
      args JSONB NOT NULL,
      block_number BIGINT NOT NULL,
      tx_hash TEXT NOT NULL,
      UNIQUE(tx_hash, event, block_number)
    );
    CREATE TABLE IF NOT EXISTS issuer_status (
      did_hash TEXT PRIMARY KEY,
      did TEXT NOT NULL,
      name TEXT,
      controller TEXT,
      status TEXT NOT NULL,
      updated_block BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revoked_credentials (
      issuer_did_hash TEXT NOT NULL,
      status_index BIGINT NOT NULL,
      revoked BOOLEAN NOT NULL,
      updated_block BIGINT NOT NULL,
      PRIMARY KEY (issuer_did_hash, status_index)
    );
  `);
}

async function handleLog(contract: string, log: Log & { eventName?: string; args?: unknown }) {
  await pool.query(
    `INSERT INTO chain_events(contract, event, args, block_number, tx_hash)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [contract, log.eventName ?? "unknown", JSON.stringify(log.args ?? {}, bigintReplacer), Number(log.blockNumber), log.transactionHash]
  );

  const args = (log.args ?? {}) as Record<string, unknown>;

  if (contract === "IssuerRegistry") {
    const didHash = String(args.didHash ?? "");
    if (!didHash) return;
    const status =
      log.eventName === "IssuerApproved" ? "approved" : log.eventName === "IssuerSuspended" ? "suspended" : "pending";
    await pool.query(
      `INSERT INTO issuer_status(did_hash, did, name, controller, status, updated_block)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(did_hash) DO UPDATE SET status=EXCLUDED.status, updated_block=EXCLUDED.updated_block`,
      [didHash, String(args.did ?? ""), String(args.name ?? ""), String(args.controller ?? ""), status, Number(log.blockNumber)]
    );
  }

  if (contract === "RevocationRegistry" && args.issuerDidHash !== undefined) {
    await pool.query(
      `INSERT INTO revoked_credentials(issuer_did_hash, status_index, revoked, updated_block)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(issuer_did_hash, status_index) DO UPDATE SET revoked=EXCLUDED.revoked, updated_block=EXCLUDED.updated_block`,
      [String(args.issuerDidHash), Number(args.statusIndex), log.eventName === "CredentialRevoked", Number(log.blockNumber)]
    );
  }
}

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

async function startIndexing() {
  let fromBlock = 0n;
  for (;;) {
    const latest = await client.getBlockNumber();
    for (const [contract, events] of Object.entries(EVENTS)) {
      const address = ADDRESSES[contract];
      if (!address) continue;
      for (const event of events) {
        const logs = await client.getLogs({ address, event, fromBlock, toBlock: latest });
        for (const log of logs) await handleLog(contract, log as never);
      }
    }
    fromBlock = latest + 1n;
    await new Promise((r) => setTimeout(r, 4000));
  }
}

const app = express();
app.get("/health", (_r, res) => res.json({ ok: true, service: "indexer" }));
app.get("/api/events", async (_req, res) => {
  const r = await pool.query("SELECT * FROM chain_events ORDER BY id DESC LIMIT 100");
  res.json({ events: r.rows });
});
app.get("/api/issuers", async (_req, res) => {
  const r = await pool.query("SELECT * FROM issuer_status ORDER BY updated_block DESC");
  res.json({ issuers: r.rows });
});
app.get("/api/revoked/:issuerDidHash/:statusIndex", async (req, res) => {
  const r = await pool.query(
    "SELECT revoked FROM revoked_credentials WHERE issuer_did_hash=$1 AND status_index=$2",
    [req.params.issuerDidHash, Number(req.params.statusIndex)]
  );
  res.json({ revoked: r.rows[0]?.revoked ?? false });
});

migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`indexer listening on :${PORT}`));
    startIndexing().catch((e) => console.error("indexing loop failed", e));
  })
  .catch((e) => {
    console.error("migration failed", e);
    process.exit(1);
  });
