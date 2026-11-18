import pg from "pg";
import Redis from "ioredis";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.ISSUER_API_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/issuer",
});

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issuers (
      did TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      controller TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS credential_offers (
      offer_id TEXT PRIMARY KEY,
      holder_did TEXT NOT NULL,
      credential_json JSONB NOT NULL,
      claimed BOOLEAN DEFAULT false,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revoked (
      credential_hash TEXT PRIMARY KEY,
      status_index BIGINT NOT NULL,
      revoked_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS status_cursor (
      issuer_did TEXT PRIMARY KEY,
      next_index BIGINT NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_offers_holder ON credential_offers(holder_did);
  `);
}
