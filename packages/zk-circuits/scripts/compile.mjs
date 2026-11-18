import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.join(__dirname, "..");
const TOOLS_DIR = path.join(PKG_ROOT, ".tools");
const CIRCUITS = ["ageOver", "membership", "nonRevocation", "attributeEquals"];

const CIRCOM_VERSION = "v2.1.9";
const CIRCOM_URL = `https://github.com/iden3/circom/releases/download/${CIRCOM_VERSION}/circom-windows-amd64.exe`;

/**
 * Locate a native circom binary. Order:
 *  1. CIRCOM_BIN env var
 *  2. packages/zk-circuits/.tools/circom(.exe)
 *  3. repo-root circom(.exe)
 *  4. `circom` on PATH (CI installs it to /usr/local/bin)
 *  5. download the Windows release binary into .tools (Windows only)
 *
 * The WASM compiler (circom2) is deliberately not used: its WASI sandbox
 * mishandles Windows paths.
 */
function resolveCircom() {
  const exeName = process.platform === "win32" ? "circom.exe" : "circom";

  const candidates = [
    process.env.CIRCOM_BIN,
    path.join(TOOLS_DIR, exeName),
    path.join(PKG_ROOT, "..", "..", exeName),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, exeName);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // unreadable PATH entry - skip
    }
  }

  if (process.platform === "win32") {
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    const dest = path.join(TOOLS_DIR, "circom.exe");
    console.log(`circom not found, downloading ${CIRCOM_VERSION} ...`);
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Invoke-WebRequest -Uri '${CIRCOM_URL}' -OutFile '${dest}'`],
      { stdio: "inherit" }
    );
    return dest;
  }

  throw new Error(
    "circom binary not found. Set CIRCOM_BIN, install circom on PATH (https://docs.circom.io), or add it to .tools/."
  );
}

const circom = resolveCircom();
console.log("Using circom:", circom);

let failed = 0;

for (const name of CIRCUITS) {
  fs.mkdirSync(path.join(PKG_ROOT, "build", name), { recursive: true });
  console.log(`\n=== compiling ${name} ===`);
  try {
    execFileSync(
      circom,
      [
        path.join("circuits", `${name}.circom`),
        "--r1cs",
        "--wasm",
        "--sym",
        "-o",
        path.join("build", name),
        "-l",
        "node_modules",
      ],
      { stdio: "inherit", cwd: PKG_ROOT }
    );
    console.log(`ok: ${name}`);
  } catch {
    console.error(`FAILED: ${name}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} circuit(s) failed to compile`);
  process.exit(1);
}

console.log("\nAll circuits compiled ->", path.join(PKG_ROOT, "build"));
