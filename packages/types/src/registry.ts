/** On-chain registry models — mirror the Solidity contracts.
 *  NOTHING here may contain personal data: only hashes, DIDs, IDs, bits. */

export interface IssuerRecord {
  /** Issuer DID, e.g. did:web:university.edu or did:ethr:0x... */
  did: string;
  /** Issuer's controller address on-chain. */
  controller: `0x${string}`;
  name: string;
  status: "pending" | "approved" | "suspended";
  registeredAtBlock: number;
}

export interface CredentialSchemaRecord {
  /** keccak256 of the schema JSON. */
  schemaHash: `0x${string}`;
  /** IPFS CID where the schema JSON lives (public, no personal data). */
  cid: string;
  /** Issuer DID that registered it. */
  issuerDid: string;
  name: string;
  version: string;
}

/** Bitmap-style revocation: index -> bit. The index is assigned at issuance
 *  and is unlinkable on its own. */
export interface RevocationEntry {
  statusIndex: string;
  revoked: boolean;
}

export interface AnchorRecord {
  /** Merkle root anchoring a batch of issued credential hashes. */
  merkleRoot: `0x${string}`;
  issuerDid: string;
  anchoredAtBlock: number;
  txHash: `0x${string}`;
}
