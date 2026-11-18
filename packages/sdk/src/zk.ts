import type { ZkProofAttachment } from "@campus-cred/types";

/**
 * ZK proof generation/verification wrappers around snarkjs.
 * snarkjs is a *peer* dependency: the wallet bundles it (WASM prover) and the
 * verifier service uses the verification key directly.
 */

export interface Groth16ProofInput {
  wasmPath: string; // circuit wasm build dir (…_js/<name>.wasm)
  zkeyPath: string; // circuit proving key
  input: Record<string, unknown>;
}

export interface Groth16Output {
  proof: ZkProofAttachment["proof"];
  publicSignals: string[];
}

/** Lazily resolve snarkjs so the SDK stays browser-friendly.
 *  Typed as `any` because snarkjs ships no TS types. */
type Snarkjs = {
  groth16: {
    fullProve: (input: Record<string, unknown>, wasm: string, zkey: string) => Promise<{ proof: any; publicSignals: string[] }>;
    verify: (vkey: unknown, publicSignals: string[], proof: unknown) => Promise<boolean>;
  };
};

async function snarkjs(): Promise<Snarkjs> {
  // @ts-expect-error snarkjs is a peer dependency with no type declarations
  const mod = await import("snarkjs");
  return (mod.default ?? mod) as Snarkjs;
}

/** Generate a Groth16 proof. */
export async function proveGroth16(opts: Groth16ProofInput): Promise<Groth16Output> {
  const snark = await snarkjs();
  const { proof, publicSignals } = await snark.groth16.fullProve(opts.input, opts.wasmPath, opts.zkeyPath);
  return { proof, publicSignals };
}

/** Verify a Groth16 proof off-chain with the verification key. */
export async function verifyGroth16(opts: {
  vkeyJson: unknown;
  publicSignals: string[];
  proof: ZkProofAttachment["proof"];
}): Promise<boolean> {
  const snark = await snarkjs();
  return snark.groth16.verify(opts.vkeyJson, opts.publicSignals, opts.proof);
}

/** Encode a birthDate "YYYY-MM-DD" to the circuit's YYYYMMDD integer. */
export function encodeDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

/** Compute the public cutoff for "age >= X" given today. */
export function ageCutoff(minAge: number, today = new Date()): number {
  const t = new Date(today);
  t.setFullYear(t.getFullYear() - minAge);
  return encodeDate(t.toISOString().slice(0, 10));
}

/** Expand a bigint word into 256 bits (LSB first) for the nonRevocation circuit. */
export function wordToBits(word: bigint): string[] {
  const bits: string[] = new Array(256).fill("0");
  let w = word;
  for (let i = 0; i < 256; i++) {
    bits[i] = (w & 1n).toString();
    w >>= 1n;
  }
  return bits;
}
