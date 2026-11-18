import { describe, it, expect } from "vitest";
import {
  createDidKey,
  issueSdJwt,
  credentialFingerprint,
  buildPresentation,
} from "@campus-cred/sdk";
import { verifyPresentation } from "../src/verify.js";
import type { PresentationRequest } from "@campus-cred/types";

/**
 * Regression tests for the revocation key.
 *
 * The bug this guards against: the issuer hashed the raw claim set while the
 * verifier hashed the presented SD-JWT, so the two keys could never match and
 * revocation silently never fired in the running services.
 *
 * The fix: both sides derive the key from the issuer JWT via
 * credentialFingerprint(), which is byte-identical across presentations.
 */

function makeRequest(): PresentationRequest {
  return {
    id: "req-rev-1",
    nonce: "nonce-revocation-1",
    verifierDomain: "gate.example.edu",
    acceptedTypes: ["StudentIdCredential"],
    constraints: [],
    responseUri: "http://verifier/api/presentations/submit",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

describe("revocation fingerprint consistency", () => {
  it("is identical whether computed from the full credential or a presentation", () => {
    const uni = createDidKey();
    const holder = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { givenName: "Alice", studentNumber: "S-1", enrollmentStatus: "enrolled" },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    });

    // issuer side: fingerprints the freshly issued credential
    const issuedFingerprint = credentialFingerprint(sdJwt);

    // verifier side: fingerprints the sd-jwt WITHOUT the key-binding JWT
    const vp = buildPresentation({
      request: makeRequest(),
      sdJwt,
      holderDid: holder.did,
      holderPrivateKey: holder.privateKey,
      disclose: ["enrollmentStatus"],
    });
    const sdJwtWithoutKb = vp.sdJwtVp.split("~").slice(0, -1).join("~") + "~";
    const verifiedFingerprint = credentialFingerprint(sdJwtWithoutKb);

    expect(verifiedFingerprint).toBe(issuedFingerprint);
  });

  it("is stable regardless of which claims are disclosed", () => {
    const uni = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { a: 1, b: 2, c: 3 },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    });
    const issuerJwt = sdJwt.split("~")[0];

    // a presentation with only one disclosure vs the full credential
    const minimal = [issuerJwt, sdJwt.split("~")[1]].join("~");

    expect(credentialFingerprint(minimal)).toBe(credentialFingerprint(sdJwt));
    expect(credentialFingerprint(issuerJwt)).toBe(credentialFingerprint(sdJwt));
  });

  it("differs between two different credentials from the same issuer", () => {
    const uni = createDidKey();
    const a = issueSdJwt({
      claims: { studentNumber: "S-1" },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    }).sdJwt;
    const b = issueSdJwt({
      claims: { studentNumber: "S-2" },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    }).sdJwt;

    expect(credentialFingerprint(a)).not.toBe(credentialFingerprint(b));
  });

  it("an issuer revoke key matches what the verifier looks up end to end", async () => {
    const uni = createDidKey();
    const holder = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { enrollmentStatus: "enrolled" },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    });

    // issuer's revocation store keys on this value
    const revokedSet = new Set<string>([credentialFingerprint(sdJwt)]);

    const request = makeRequest();
    const vp = buildPresentation({
      request,
      sdJwt,
      holderDid: holder.did,
      holderPrivateKey: holder.privateKey,
      disclose: ["enrollmentStatus"],
    });

    const outcome = await verifyPresentation({
      vp,
      request,
      trustedIssuers: new Set([uni.did]),
      isRevoked: async (key) => revokedSet.has(key),
      vkeyFor: async () => null,
    });

    expect(outcome.status).toBe("REVOKED");
  });
});
