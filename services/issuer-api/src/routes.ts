import { Router } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import { issueCredential } from "./issuer.js";
import type { IssueCredentialRequest, IssueCredentialResponse } from "@campus-cred/types";

export const api = Router();

const issueSchema = z.object({
  holderDid: z.string().min(8),
  type: z.enum(["StudentIdCredential", "CourseCertificateCredential", "EventTicketCredential", "MembershipCredential"]),
  claims: z.record(z.unknown()),
  expiresInDays: z.number().int().positive().optional(),
});

api.post("/api/credentials/issue", async (req, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { holderDid, type, claims, expiresInDays } = parsed.data as IssueCredentialRequest;
  const { credential, offerId } = await issueCredential({ holderDid, type, claims, expiresInDays });

  const offerUri = `${process.env.WALLET_BASE_URL ?? "http://localhost:5173"}/claim?offer=${offerId}`;
  const out: IssueCredentialResponse = { credential, credentialOfferUri: offerUri };
  res.json(out);
});

api.post("/api/credentials/batch", async (req, res) => {
  const parsed = z
    .object({
      type: issueSchema.shape.type,
      rows: z.array(z.object({ holderDid: z.string().min(8), claims: z.record(z.unknown()) })).min(1).max(1000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results = [];
  for (const row of parsed.data.rows) {
    results.push(await issueCredential({ holderDid: row.holderDid, type: parsed.data.type, claims: row.claims }));
  }
  res.json({ issued: results.length, results });
});

api.post("/api/credentials/revoke", async (req, res) => {
  const { credentialHash } = z.object({ credentialHash: z.string() }).parse(req.body);
  await pool.query(
    "INSERT INTO revoked(credential_hash, status_index) VALUES($1, COALESCE((SELECT MAX(status_index)+1 FROM revoked),0)) ON CONFLICT DO NOTHING",
    [credentialHash]
  );
  res.json({ ok: true, credentialHash });
});

api.get("/api/credentials/:hash/status", async (req, res) => {
  const r = await pool.query("SELECT status_index, revoked_at IS NOT NULL AS revoked FROM revoked WHERE credential_hash=$1", [
    req.params.hash,
  ]);
  res.json(r.rows[0] ?? { status_index: null, revoked: false });
});

api.get("/api/offer/:offerId", async (req, res) => {
  const r = await pool.query(
    "SELECT credential_json FROM credential_offers WHERE offer_id=$1 AND claimed=false AND expires_at > now()",
    [req.params.offerId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "offer not found or expired" });
  res.json({ credential: r.rows[0].credential_json });
});

api.post("/api/offer/:offerId/claim", async (req, res) => {
  const r = await pool.query(
    "UPDATE credential_offers SET claimed=true WHERE offer_id=$1 AND claimed=false RETURNING credential_json",
    [req.params.offerId]
  );
  if (r.rowCount === 0) return res.status(410).json({ error: "offer already claimed" });
  res.json({ credential: r.rows[0].credential_json });
});

api.get("/api/issuers", async (_req, res) => {
  const r = await pool.query("SELECT did,name,controller,status,created_at FROM issuers ORDER BY created_at DESC");
  res.json({ issuers: r.rows });
});
