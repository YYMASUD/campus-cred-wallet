import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.join(__dirname, "..");
const BUILD = path.join(PKG_ROOT, "build");
const PTau = path.join(PKG_ROOT, ".ptau", "powersOfTau28_hez_final_12.ptau");
const PTAU_URL = "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau";

const CIRCUITS = ["ageOver", "membership", "nonRevocation", "attributeEquals"];

const SNARKJS = path.join(PKG_ROOT, "node_modules", "snarkjs", "build", "cli.cjs");

function run(args, label) {
  console.log(`\n$ snarkjs ${args.join(" ")}`);
  execFileSync(process.execPath, [SNARKJS, ...args], { stdio: "inherit", cwd: PKG_ROOT });
  if (label) console.log(`ok: ${label}`);
}

function ensurePtau() {
  if (fs.existsSync(PTau)) return PTau;
  fs.mkdirSync(path.dirname(PTau), { recursive: true });

  // Preferred: download the community powers-of-tau ceremony file.
  try {
    console.log("downloading ptau (may take a minute) ...");
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Invoke-WebRequest -Uri '${PTAU_URL}' -OutFile '${PTau}' -TimeoutSec 60`],
      { stdio: "inherit" }
    );
    return PTau;
  } catch {
    console.warn("ptau download failed; generating a LOCAL dev ptau instead.");
    console.warn("⚠  NOT FOR PRODUCTION: a local single-party setup has no ceremony guarantees.");
  }

  // Fallback: generate a DEV-ONLY powers-of-tau locally with snarkjs.
  // Our largest circuit (nonRevocation) needs ~2^12 constraints.
  fs.rmSync(PTau, { force: true });
  const tau0 = path.join(path.dirname(PTau), "t0.ptau");
  const tau1 = path.join(path.dirname(PTau), "t1.ptau");
  console.warn("generating local dev ptau (power 12) — this can take several minutes ...");
  run(["--", "powersoftau", "new", "bn128", "12", tau0].slice(1));
  run(["--", "powersoftau", "contribute", tau0, tau1, "--name=campus-cred-dev", "--entropy=campus-cred-dev-entropy"].slice(1));
  run(["--", "powersoftau", "prepare", "phase2", tau1, PTau].slice(1));
  return PTau;
}

const ptau = ensurePtau();

for (const name of CIRCUITS) {
  const dir = path.join(BUILD, name);
  const r1cs = path.join(dir, `${name}.r1cs`);
  const zkey = path.join(dir, `${name}.zkey`);
  const vkey = path.join(dir, `${name}.vkey.json`);
  const verifierSol = path.join(dir, `${name}Verifier.sol`);

  if (!fs.existsSync(r1cs)) {
    console.error(`missing ${r1cs} — run "pnpm build" (compile) first`);
    process.exitCode = 1;
    continue;
  }

  console.log(`\n###### ${name} ######`);
  run(["groth16", "setup", r1cs, ptau, zkey], `${name} zkey`);
  run(["zkey", "export", "verificationkey", zkey, vkey], `${name} vkey`);
  run(["zkey", "export", "solidityverifier", zkey, verifierSol], `${name} solidity verifier`);
}

console.log("\nSetup complete. Keys in", BUILD);
