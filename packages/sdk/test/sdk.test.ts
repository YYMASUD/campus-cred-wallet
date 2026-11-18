import { describe, it, expect } from "vitest";
import {
  createDidKey,
  parseDid,
  publicKeyFromDidKey,
  resolveDidKey,
  verifyEd25519,
  signEd25519,
  issueSdJwt,
  verifySdJwt,
  decodeDisclosure,
  verifyKeyBindingJwt,
  buildPresentation,
  hashCredential,
} from "../src/index.js";
import type { PresentationRequest } from "@campus-cred/types";

describe("DID (did:key)", () => {
  it("creates and parses a did:key", () => {
    const k = createDidKey();
    expect(k.did).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
    expect(parseDid(k.did).method).toBe("key");
    expect(publicKeyFromDidKey(k.did)).toEqual(k.publicKey);
  });

  it("builds a DID document", () => {
    const k = createDidKey();
    const doc = resolveDidKey(k.did);
    expect(doc.id).toBe(k.did);
    expect(doc.verificationMethod?.[0].controller).toBe(k.did);
  });

  it("signs and verifies with Ed25519", () => {
    const k = createDidKey();
    const msg = new TextEncoder().encode("hello");
    const sig = signEd25519(k.privateKey, msg);
    expect(verifyEd25519(k.publicKey, msg, sig)).toBe(true);
    expect(verifyEd25519(k.publicKey, new TextEncoder().encode("x"), sig)).toBe(false);
  });
});

describe("SD-JWT VC", () => {
  it("issues and verifies a credential, disclosing selected claims", () => {
    const issuer = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { givenName: "Alice", familyName: "Lee", studentNumber: "S123", program: "CS", birthDate: "2000-01-01" },
      publicClaims: { vct: "StudentIdCredential", iss: issuer.did },
      issuerDid: issuer.did,
      issuerPrivateKey: issuer.privateKey,
    });

    const parts = sdJwt.split("~");
    const kept = parts.slice(1).filter((d) => ["givenName", "program"].includes(decodeDisclosure(d).name));
    const partial = [parts[0], ...kept].join("~");

    const verified = verifySdJwt(partial);
    expect(verified.issuer).toBe(issuer.did);
    expect(verified.claims.givenName).toBe("Alice");
    expect(verified.claims.program).toBe("CS");
    expect(verified.claims.studentNumber).toBeUndefined();
    expect(verified.claims.birthDate).toBeUndefined();
  });

  it("rejects a disclosure not committed by the issuer", () => {
    const issuer = createDidKey();
    const { sdJwt } = issueSdJwt({
      claims: { a: 1 },
      publicClaims: { iss: issuer.did },
      issuerDid: issuer.did,
      issuerPrivateKey: issuer.privateKey,
    });
    const tampered = [sdJwt.split("~")[0], "ZmFrZWRpc2Nsb3N1cmU"].join("~");
    expect(() => verifySdJwt(tampered)).toThrow();
  });

  it("credential hash is stable", () => {
    expect(hashCredential({ a: 1 }, "did:key:zX")).toBe(hashCredential({ a: 1 }, "did:key:zX"));
  });
});
