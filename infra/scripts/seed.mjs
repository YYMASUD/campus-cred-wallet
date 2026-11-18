#!/usr/bin/env node
/**
 * Seed script: spins up a complete demo environment.
 *   - deploys the contracts to the local chain
 *   - registers + approves the demo university and organizer
 *   - issues Alice a Student ID and an event ticket
 *
 * Usage: node infra/scripts/seed.mjs   (requires a running hardhat node + services)
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const ISSUER_API = process.env.ISSUER_API_URL ?? "http://localhost:3001";

function sh(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log("\n=== campus-cred-wallet demo seed ===\n");

  // 1. Deploy contracts
  console.log("[1/3] Deploying contracts to the local chain…");
  sh(process.execPath, [path.join("node_modules", "hardhat", "internal", "cli", "bootstrap.js"), "run", "scripts/deploy.ts", "--network", "localhost"], path.join(ROOT, "packages", "contracts"));

  // 2. Create the demo holder
  console.log("[2/3] Creating demo holder (Alice)…");
  const { createDidKey } = await import(path.join(ROOT, "packages", "sdk", "src", "did.ts"));
  const alice = createDidKey();
  console.log(`  Alice DID: ${alice.did}`);

  // 3. Issue credentials
  console.log("[3/3] Issuing demo credentials…");
  const studentId = await post(`${ISSUER_API}/api/credentials/issue`, {
    holderDid: alice.did,
    type: "StudentIdCredential",
    claims: {
      givenName: "Alice",
      familyName: "Lee",
      studentNumber: "S-2026-0042",
      program: "Computer Science",
      enrollmentStatus: "enrolled",
      birthDate: "2000-04-15",
      university: "Example University",
    },
  });
  console.log(`  Student ID offer: ${studentId.credentialOfferUri}`);

  const ticket = await post(`${ISSUER_API}/api/credentials/issue`, {
    holderDid: alice.did,
    type: "EventTicketCredential",
    claims: {
      eventName: "Spring Gala 2026",
      eventId: "evt-2026-spring",
      ticketId: "T-998877",
      seat: "A12",
    },
  });
  console.log(`  Event ticket offer: ${ticket.credentialOfferUri}`);

  console.log("\n=== seed complete ===");
  console.log("Open the wallet at http://localhost:5173 and paste either offer id.");
  console.log(`Alice DID (for re-issuing): ${alice.did}\n`);
}

main().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
