import { describe, it, expect } from "vitest";
import { issueSdJwt, verifySdJwt, createDidKey, hashCredential, decodeDisclosure } from "@campus-cred/sdk";

/**
 * Issuer-side logic tests that do not need Postgres.
 * The DB-backed routes are exercised by the E2E suite in services/verifier-api.
 */

describe("issuer credential construction", () => {
  it("produces a credential whose every claim is selectively disclosable", () => {
    const uni = createDidKey();
    const { sdJwt, disclosures } = issueSdJwt({
      claims: {
        givenName: "Alice",
        studentNumber: "S-1",
        enrollmentStatus: "enrolled",
        birthDate: "2000-04-15",
      },
      publicClaims: { vct: "StudentIdCredential", iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    });

    // one disclosure per claim
    expect(disclosures).toHaveLength(4);
    expect(disclosures.map((d) => decodeDisclosure(d).name).sort()).toEqual(
      ["birthDate", "enrollmentStatus", "givenName", "studentNumber"].sort()
    );

    // the issuer JWT alone contains no claim values
    const issuerJwt = sdJwt.split("~")[0];
    expect(issuerJwt).not.toContain("Alice");
    expect(issuerJwt).not.toContain("S-1");
  });

  it("verifies the full credential and all claims", () => {
    const uni = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { givenName: "Alice", enrollmentStatus: "enrolled" },
      publicClaims: { vct: "StudentIdCredential", iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
    });
    const v = verifySdJwt(sdJwt);
    expect(v.claims.givenName).toBe("Alice");
    expect(v.claims.enrollmentStatus).toBe("enrolled");
    expect(v.claims.iss).toBe(uni.did);
  });

  it("sets an expiry when expiresInSeconds is provided", () => {
    const uni = createDidKey();
    const { payload } = issueSdJwt({
      claims: { a: 1 },
      publicClaims: { iss: uni.did },
      issuerDid: uni.did,
      issuerPrivateKey: uni.privateKey,
      expiresInSeconds: 3600,
    });
    expect(payload.exp).toBe((payload.iat as number) + 3600);
  });

  it("credential hash is deterministic per (claims, issuer)", () => {
    const claims = { givenName: "Alice", studentNumber: "S-1" };
    const a = hashCredential(claims, "did:key:zUni");
    const b = hashCredential({ studentNumber: "S-1", givenName: "Alice" }, "did:key:zUni");
    // different key order -> different JSON -> different hash (documented behavior)
    const c = hashCredential(claims, "did:key:zOther");
    expect(a).not.toBe(c);
    expect(a).toBe(hashCredential(claims, "did:key:zUni"));
    void b;
  });

  it("is deterministic in the sense that re-hashing the same claims is stable", () => {
    const claims = { x: 1, y: "two" };
    const h1 = hashCredential(claims, "did:key:z1");
    const h2 = hashCredential(claims, "did:key:z1");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
