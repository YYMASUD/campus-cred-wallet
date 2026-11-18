import { describe, it, expect } from "vitest";
import {
  createDidKey,
  issueSdJwt,
  verifyKeyBindingJwt,
  buildPresentation,
} from "../src/index.js";
import type { PresentationRequest } from "@campus-cred/types";

const request: PresentationRequest = {
  id: "req-1",
  nonce: "nonce-abc-123",
  verifierDomain: "gate.uni.edu",
  acceptedTypes: ["StudentIdCredential"],
  constraints: [],
  responseUri: "https://verifier/cb",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: new Date().toISOString(),
};

function makeSetup() {
  const issuer = createDidKey();
  const holder = createDidKey();
  const { sdJwt } = issueSdJwt({
    claims: { givenName: "Alice", studentNumber: "S123", enrollmentStatus: "enrolled" },
    publicClaims: { iss: issuer.did },
    issuerDid: issuer.did,
    issuerPrivateKey: issuer.privateKey,
  });
  return { issuer, holder, sdJwt };
}

describe("Presentation + key binding (replay protection)", () => {
  it("builds a bound presentation and verifies it", () => {
    const { holder, sdJwt } = makeSetup();
    const vp = buildPresentation({
      request,
      sdJwt,
      holderDid: holder.did,
      holderPrivateKey: holder.privateKey,
      disclose: ["enrollmentStatus"],
    });
    const parts = vp.sdJwtVp.split("~");
    const kbJwt = parts[parts.length - 1];
    const sdJwtWithoutKb = parts.slice(0, -1).join("~") + "~";

    const check = verifyKeyBindingJwt({
      kbJwt,
      sdJwtWithoutKb,
      holderDid: holder.did,
      expectedNonce: request.nonce,
      expectedAudience: request.verifierDomain,
    });
    expect(check.ok).toBe(true);
    expect(vp.disclosedClaims).toEqual([{ path: "enrollmentStatus", value: "enrolled" }]);
    // nothing else is disclosed
    expect(vp.disclosedClaims.find((c) => c.path === "studentNumber")).toBeUndefined();
  });

  it("rejects a replay with the wrong nonce", () => {
    const { holder, sdJwt } = makeSetup();
    const vp = buildPresentation({
      request,
      sdJwt,
      holderDid: holder.did,
      holderPrivateKey: holder.privateKey,
      disclose: ["enrollmentStatus"],
    });
    const parts = vp.sdJwtVp.split("~");
    const kbJwt = parts[parts.length - 1];
    const sdJwtWithoutKb = parts.slice(0, -1).join("~") + "~";
    const bad = verifyKeyBindingJwt({
      kbJwt,
      sdJwtWithoutKb,
      holderDid: holder.did,
      expectedNonce: "different-nonce",
      expectedAudience: request.verifierDomain,
    });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/nonce/);
  });

  it("rejects a presentation sent to a different domain", () => {
    const { holder, sdJwt } = makeSetup();
    const vp = buildPresentation({
      request,
      sdJwt,
      holderDid: holder.did,
      holderPrivateKey: holder.privateKey,
      disclose: ["enrollmentStatus"],
    });
    const parts = vp.sdJwtVp.split("~");
    const kbJwt = parts[parts.length - 1];
    const sdJwtWithoutKb = parts.slice(0, -1).join("~") + "~";
    const bad = verifyKeyBindingJwt({
      kbJwt,
      sdJwtWithoutKb,
      holderDid: holder.did,
      expectedNonce: request.nonce,
      expectedAudience: "evil.example.com",
    });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/audience|domain/);
  });
});
