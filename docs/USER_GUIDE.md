# User Guide

## Students (holders)
1. Open the wallet app → **Create wallet** → a DID and keys are generated on your
   device. Write down the recovery phrase.
2. To receive a credential, scan the issuer's QR code → review → **Accept**.
3. When a verifier scans your ticket, the wallet shows exactly what they asked
   for. Toggle optional attributes, then **Share**. Proofs for things like
   "over 18" are generated without revealing your birthdate.

## Universities / organizers (issuers)
1. Register in the issuer portal; an admin approves you on-chain.
2. Build or pick a schema (Student ID, Event Ticket).
3. Issue to a single student (show them the QR) or upload a CSV batch.
4. Revoke any credential from the dashboard — verifications then fail.

## Verifiers (gate, library, employer)
1. In the verifier portal build a request, e.g. "valid ticket AND enrolled AND
   age ≥ 18".
2. Show the QR. Result appears live: **VERIFIED / INVALID / REVOKED** — you see
   only what you asked for.
