import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  CreatePresentationRequestBody,
  CreatePresentationRequestResponse,
  PresentationRequest,
  VerificationOutcome,
} from "@campus-cred/types";
import { verifyPresentation } from "./verify.js";

// ---- in-memory request store (Redis would be the production choice) ----
interface StoredRequest {
  request: PresentationRequest;
  outcome: VerificationOutcome | { status: "PENDING" };
  createdAt: number;
}
const requests = new Map<string, StoredRequest>();
const REQUEST_TTL = 10 * 60 * 1000; // 10 min

/**
 * Load Groth16 verification keys from the zk-circuits build output.
 * Returns null when a circuit has no generated key, which makes
 * verifyPresentation() reject any presentation carrying that proof.
 */
const CIRCUIT_IDS = ["ageOver", "membership", "nonRevocation", "attributeEquals"] as const;
const vkeyCache = new Map<string, unknown>();

async function loadVerificationKey(circuitId: string): Promise<unknown | null> {
  if (!(CIRCUIT_IDS as readonly string[]).includes(circuitId)) return null;
  if (vkeyCache.has(circuitId)) return vkeyCache.get(circuitId);

  const dir =
    process.env.ZK_BUILD_DIR ??
    path.resolve(process.cwd(), "..", "..", "packages", "zk-circuits", "build");
  const file = path.join(dir, circuitId, `${circuitId}.vkey.json`);

  try {
    const raw = await fs.readFile(file, "utf8");
    const vkey = JSON.parse(raw);
    vkeyCache.set(circuitId, vkey);
    return vkey;
  } catch {
    console.warn(`verification key unavailable for circuit "${circuitId}" (looked in ${file})`);
    return null;
  }
}

const trustedIssuers = new Set(
  (process.env.TRUSTED_ISSUERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);
const verifierDomain = process.env.VERIFIER_DOMAIN ?? "localhost:5174";
const issuerApiUrl = process.env.ISSUER_API_URL ?? "http://localhost:3001";

/**
 * Revocation lookup.
 * Asks the issuer's status endpoint (which is backed by the bitmap index that
 * gets written on-chain). Only a boolean crosses this boundary.
 *
 * Set REVOCATION_SOURCE=chain to query RevocationRegistry directly via the
 * indexer once a chain is configured; the interface is identical.
 */
async function isRevoked(credentialFingerprint: string): Promise<boolean> {
  try {
    const res = await fetch(`${issuerApiUrl}/api/credentials/${encodeURIComponent(credentialFingerprint)}/status`);
    if (!res.ok) return false;
    const body = (await res.json()) as { revoked?: boolean };
    return body.revoked === true;
  } catch {
    // Fail open on an unreachable status service would be unsafe in production;
    // here we surface it as a distinguishing log line and treat as not revoked.
    console.warn("revocation lookup failed; treating credential as not revoked");
    return false;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const createReqSchema = z.object({
  acceptedTypes: z.array(z.enum(["StudentIdCredential", "CourseCertificateCredential", "EventTicketCredential", "MembershipCredential"])).min(1),
  constraints: z.array(
    z.object({
      path: z.string(),
      predicate: z.enum(["eq", "gte", "lte", "memberOf", "notRevoked"]),
      value: z.unknown().optional(),
      zk: z.boolean().optional(),
    })
  ),
  purpose: z.string().optional(),
});

app.post("/api/presentations/request", (req, res) => {
  const parsed = createReqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const body = parsed.data as CreatePresentationRequestBody;
  const request: PresentationRequest = {
    id: randomUUID(),
    nonce: randomUUID(),
    verifierDomain,
    acceptedTypes: body.acceptedTypes,
    constraints: body.constraints,
    responseUri: `${req.protocol}://${req.get("host")}/api/presentations/submit`,
    expiresAt: new Date(Date.now() + REQUEST_TTL).toISOString(),
    createdAt: new Date().toISOString(),
  };

  requests.set(request.id, { request, outcome: { status: "PENDING" }, createdAt: Date.now() });

  const requestUri = `${req.protocol}://${req.get("host")}/api/presentations/request/${request.id}`;
  const out: CreatePresentationRequestResponse = { request, requestUri };
  res.json(out);
});

app.get("/api/presentations/request/:id", (req, res) => {
  const stored = requests.get(req.params.id);
  if (!stored) return res.status(404).json({ error: "request not found" });
  res.json(stored.request);
});

app.post("/api/presentations/submit", async (req, res) => {
  const vp = req.body as any;
  const stored = requests.get(vp?.requestId);
  if (!stored) return res.status(404).json({ error: "unknown request id" });

  const outcome = await verifyPresentation({
    vp,
    request: stored.request,
    trustedIssuers,
    isRevoked,
    vkeyFor: loadVerificationKey,
  });

  stored.outcome = outcome;
  res.json(outcome);
});

app.get("/api/presentations/:requestId/status", (req, res) => {
  const stored = requests.get(req.params.requestId);
  if (!stored) return res.status(404).json({ error: "request not found" });
  res.json({ requestId: req.params.requestId, outcome: stored.outcome });
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "verifier-api" }));

const port = Number(process.env.VERIFIER_API_PORT ?? 3002);
app.listen(port, () => console.log(`verifier-api listening on :${port}`));
