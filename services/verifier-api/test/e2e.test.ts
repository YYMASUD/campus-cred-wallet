import { describe, it, expect, beforeAll } from "vitest";
import {
  createDidKey,
  issueSdJwt,
  buildPresentation,
  verifySdJwt,
} from "@campus-cred/sdk";
import { verifyPresentation } from "../src/verify.js";
import type { PresentationRequest } from "@campus-cred/types";

/**
 * End-to-end demo scenario from the spec (docs/ARCHITECTURE.md §Demo):
 * 1. university issues a Student ID VC to Alice
 * 2. organizer issues an event ticket
 * 3. verifier asks: valid ticket AND enrolled student AND age >= 18
 * 4. Alice presents ONLY the ticket id (+ ZK facts in the circuits tests)
 * 5. verifier sees VERIFIED without her name/student number/birthdate
 * 6. university revokes -> next verification returns REVOKED
 */

function makeRequest(): PresentationRequest {
  return {
    id: "req-e2e-1",
    nonce: "nonce-e2e-123456",
    verifierDomain: "gate.example.edu",
    acceptedTypes: ["EventTicketCredential", "StudentIdCredential"],
    constraints: [
      { path: "ticketId", predicate: "eq" },
      { path: "enrollmentStatus", predicate: "eq", value: "enrolled", zk: true },
      { path: "birthDate", predicate: "lte", value: 18, zk: true },
    ],
    responseUri: "http://verifier/api/presentations/submit",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

describe("E2E demo: issue -> hold -> selectively present -> verify -> revoke", () => {
  let university: ReturnType<typeof createDidKey>;
  let alice: ReturnType<typeof createDidKey>;
  let studentId: string;
  let ticket: string;

  beforeAll(() => {
    university = createDidKey();
    alice = createDidKey();

    studentId = issueSdJwt({
      claims: {
        givenName: "Alice",
        familyName: "Lee",
        studentNumber: "S-2026-0042",
        program: "Computer Science",
        enrollmentStatus: "enrolled",
        birthDate: "2000-04-15",
        university: "Example University",
      },
      publicClaims: { vct: "StudentIdCredential", iss: university.did },
      issuerDid: university.did,
      issuerPrivateKey: university.privateKey,
    }).sdJwt;

    ticket = issueSdJwt({
      claims: { eventName: "Spring Gala", eventId: "evt-2026-spring", ticketId: "T-998877", seat: "A12" },
      publicClaims: { vct: "EventTicketCredential", iss: university.did },
      issuerDid: university.did,
      issuerPrivateKey: university.privateKey,
    }).sdJwt;
  });

  it("verifies a minimal disclosure: ticket id only, no PII", async () => {
    const request = makeRequest();

    const vp = buildPresentation({
      request,
      sdJwt: ticket,
      holderDid: alice.did,
      holderPrivateKey: alice.privateKey,
      disclose: ["ticketId"],
      zkProofs: [],
    });

    const outcome = await verifyPresentation({
      vp,
      request,
      trustedIssuers: new Set([university.did]),
      isRevoked: async () => false,
      vkeyFor: async () => null,
    });

    expect(outcome.status).toBe("VERIFIED");
    if (outcome.status !== "VERIFIED") return;

    expect(outcome.disclosedClaims).toEqual([{ path: "ticketId", value: "T-998877" }]);
    const paths = outcome.disclosedClaims.map((c) => c.path);
    expect(paths).not.toContain("givenName");
    expect(paths).not.toContain("studentNumber");
    expect(paths).not.toContain("birthDate");
  });

  it("rejects an untrusted issuer", async () => {
    const rogue = createDidKey();
    const badCred = issueSdJwt({
      claims: { ticketId: "T-000000" },
      publicClaims: { iss: rogue.did },
      issuerDid: rogue.did,
      issuerPrivateKey: rogue.privateKey,
    }).sdJwt;

    const request = makeRequest();
    const vp = buildPresentation({
      request,
      sdJwt: badCred,
      holderDid: alice.did,
      holderPrivateKey: alice.privateKey,
      disclose: ["ticketId"],
    });

    const outcome = await verifyPresentation({
      vp,
      request,
      trustedIssuers: new Set([university.did]),
      isRevoked: async () => false,
      vkeyFor: async () => null,
    });
    expect(outcome.status).toBe("INVALID");
  });

  it("rejects a replayed presentation (wrong nonce)", async () => {
    const request = makeRequest();
    const vp = buildPresentation({
      request,
      sdJwt: ticket,
      holderDid: alice.did,
      holderPrivateKey: alice.privateKey,
      disclose: ["ticketId"],
    });

    const outcome = await verifyPresentation({
      vp: { ...vp, nonce: "attacker-nonce" },
      request,
      trustedIssuers: new Set([university.did]),
      isRevoked: async () => false,
      vkeyFor: async () => null,
    });
    expect(outcome.status).toBe("INVALID");
    if (outcome.status === "INVALID") expect(outcome.reason).toMatch(/nonce/);
  });

  it("fails verification after the credential is revoked", async () => {
    const request = makeRequest();
    const vp = buildPresentation({
      request,
      sdJwt: studentId,
      holderDid: alice.did,
      holderPrivateKey: alice.privateKey,
      disclose: ["enrollmentStatus"],
    });

    const outcome = await verifyPresentation({
      vp,
      request,
      trustedIssuers: new Set([university.did]),
      isRevoked: async () => true,
      vkeyFor: async () => null,
    });
    expect(outcome.status).toBe("REVOKED");
  });

  it("never leaks undisclosed claims into the presentation", () => {
    const request = makeRequest();
    const vp = buildPresentation({
      request,
      sdJwt: studentId,
      holderDid: alice.did,
      holderPrivateKey: alice.privateKey,
      disclose: ["enrollmentStatus"],
    });

    expect(vp.sdJwtVp).not.toContain("S-2026-0042");
    expect(vp.sdJwtVp).not.toContain("Alice");
    expect(vp.sdJwtVp).not.toContain("2000-04-15");

    const verified = verifySdJwt(vp.sdJwtVp.split("~").slice(0, -1).join("~") + "~");
    expect(verified.claims.enrollmentStatus).toBe("enrolled");
    expect(verified.claims.studentNumber).toBeUndefined();
    expect(verified.claims.birthDate).toBeUndefined();
  });
});
