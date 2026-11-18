# Security & Privacy

## Non-negotiable invariants

1. **No personal data on-chain.** Only hashes, Merkle roots, schema CIDs,
   issuer DIDs, revocation bits. Enforced by contract design (all fields are
   bytes32/uint) and review checklist.
2. **IPFS holds only encrypted data.** Client-side AES-GCM before upload.
3. **Private keys never leave the device.** Web: non-extractable WebCrypto keys,
   encrypted-at-rest backup via PBKDF2→AES-GCM. (Limitation: browser keystore is
   weaker than a hardware enclave; mobile would use Keychain/Keystore.)
4. **Replay protection.** Every presentation binds `nonce` + `verifierDomain`
   into the SD-JWT key-binding JWT and the ZK public signals.
5. **Unlinkability.** Verifiers receive SD disclosures or fresh ZK proofs, never
   a stable holder identifier beyond the requested claims. (Full unlinkability
   across colluding verifiers is a known limitation vs. pure BBS+.)
6. **Data minimization.** Consent screen lists every attribute before sharing;
   hidden predicates are proven, not disclosed.
7. **GDPR/FERPA.** Student data lives only in the wallet and the issuer's
   (consented) records; on-chain/indexed data is unlinkable. Right-to-erasure is
   honored by deleting off-chain records — on-chain hashes are pseudonymous
   commitments, not personal data per GDPR recitals.

## STRIDE threat model (summary)

| Threat | Mitigation |
|--------|-----------|
| Spoofing | DID signatures, issuer allowlist on-chain, TLS |
| Tampering | SD-JWT integrity, on-chain anchors, ZK soundness |
| Repudiation | Signed audit events (no personal data) |
| Info disclosure | Selective disclosure, encrypted storage/IPFS |
| DoS | Rate limits on APIs, local-chain isolation |
| Elevation | RBAC on registry contracts (OpenZeppelin AccessControl) |

## Known limitations

- Web key storage is software-only (no TEE).
- Groth16 needs a per-circuit trusted setup; ceremony script provided, demo uses
  a local single-party setup (documented, NOT for production).
- Correlation resistance is good-but-not-perfect: credentialHash and status
  index are stable per credential.
