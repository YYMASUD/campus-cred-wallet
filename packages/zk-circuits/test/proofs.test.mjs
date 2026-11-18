import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const BUILD = path.join(__dirname, "..", "build");

function pathsFor(name) {
  return {
    wasm: path.join(BUILD, name, `${name}_js`, `${name}.wasm`),
    zkey: path.join(BUILD, name, `${name}.zkey`),
    vkey: path.join(BUILD, name, `${name}.vkey.json`),
  };
}

async function proveAndVerify(name, input) {
  const p = pathsFor(name);
  if (!fs.existsSync(p.zkey)) throw new Error(`missing zkey for ${name} — run "pnpm setup"`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, p.wasm, p.zkey);
  const vkey = JSON.parse(fs.readFileSync(p.vkey, "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  return { ok, proof, publicSignals };
}

test("ageOver: proves age >= 18 without revealing birthdate", async () => {
  // born 2000-01-01, cutoff = today - 18y (2026-11-18 => 2008-11-18)
  const cutoff = 20081118;
  const { ok, publicSignals } = await proveAndVerify("ageOver", {
    birthDate: 20000101,
    cutoffDate: cutoff,
    minAge: 18,
  });
  assert.equal(ok, true, "valid proof must verify");
  // public signals order follows the .sym: [valid, cutoffDate, minAge]
  assert.equal(publicSignals[0], "1", "valid output is 1 for an adult");
  assert.equal(publicSignals[1], String(cutoff));
  assert.equal(publicSignals[2], "18");
});

test("ageOver: underage holder yields valid = 0", async () => {
  const { ok, publicSignals } = await proveAndVerify("ageOver", {
    birthDate: 20150101,
    cutoffDate: 20081118,
    minAge: 18,
  });
  // The witness is satisfiable (less-than is a real comparator), so the proof
  // verifies but the PUBLIC output is 0. Verifiers MUST reject valid=0.
  assert.equal(ok, true);
  assert.equal(publicSignals[0], "0", "valid output must be 0 for an underage holder");
});

test("attributeEquals: proves hidden attribute equals the public value", async () => {
  // Poseidon(42, salt) precomputed by the prover itself via the circuit;
  // we compute the commitment with snarkjs' Poseidon helper.
  const { buildPoseidon } = require("circomlibjs");
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const commitment = F.toString(poseidon([42, 7]));

  const { ok, publicSignals } = await proveAndVerify("attributeEquals", {
    attribute: 42,
    salt: 7,
    expected: 42,
    commitment,
  });
  assert.equal(ok, true);
  // .sym order: [match, expected, commitment]
  assert.equal(publicSignals[0], "1", "match output");
  assert.equal(publicSignals[1], "42", "expected (public)");
  assert.equal(publicSignals[2], commitment, "commitment (public)");
});
