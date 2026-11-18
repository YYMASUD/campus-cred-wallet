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
 *  4. download the release binary into .tools (Windows only)
 * The WASM compiler (circom2) is intentionally not used: its WASI sandbox
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

  throw new Error("circom binary not found. Set CIRCOM_BIN or install circom (https://docs.circom.io).");
}

const circom = resolveCircom();
console.log("Using circom:", circom);

for (const name of CIRCUITS) {
  const outDir = path.join(PKG_ROOT, "build", name);
  fs.mkdirSync(outDir, { recursive: true });
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
    process.exitCode = 1;
  }
}

console.log("\nDone compiling circuits ->", path.join(PKG_ROOT, "build"));


/**
 * circom2 runs the circom compiler inside WASI. Its CLI helper rewrites paths
 * with path.relative(), which produces backslashes on Windows and breaks the
 * sandbox. We drive CircomRunner directly with POSIX paths and feed it a
 * mapping that exposes only this package directory to the guest.
 */
function preopensFor(dir) {
  // expose the package directory as both "/" and "." inside the WASI guest
  const posix = dir.replace(/\\/g, "/");
  return { "/": posix, ".": posix };
}

async function compile(name) {
  const outDir = path.posix.join("build", name);
  fs.mkdirSync(path.join(PKG_ROOT, "build", name), { recursive: true });

  const args = [
    path.posix.join("circuits", `${name}.circom`),
    "--r1cs",
    "--wasm",
    "--sym",
    "-o",
    outDir,
    "-l",
    "node_modules",
  ];

  const runner = new CircomRunner({
    args,
    env: {},
    preopens: preopensFor(PKG_ROOT),
    bindings: {
      ...bindings,
      fs: {
        ...fs,
        // WASI passes POSIX-style paths; strip the leading slash
        openSync: (p, ...rest) => fs.openSync(p.replace(/^\//, ""), ...rest),
        readFileSync: (p, ...rest) => fs.readFileSync(p.replace(/^\//, ""), ...rest),
        writeFileSync: (p, ...rest) => fs.writeFileSync(p.replace(/^\//, ""), ...rest),
        mkdirSync: (p, ...rest) => fs.mkdirSync(p.replace(/^\//, ""), ...rest),
        statSync: (p, ...rest) => fs.statSync(p.replace(/^\//, ""), ...rest),
        lstatSync: (p, ...rest) => fs.lstatSync(p.replace(/^\//, ""), ...rest),
        readdirSync: (p, ...rest) => fs.readdirSync(p.replace(/^\//, ""), ...rest),
        unlinkSync: (p) => fs.unlinkSync(p.replace(/^\//, "")),
        rmdirSync: (p) => fs.rmdirSync(p.replace(/^\//, "")),
        renameSync: (a, b) => fs.renameSync(a.replace(/^\//, ""), b.replace(/^\//, "")),
        existsSync: (p) => fs.existsSync(p.replace(/^\//, "")),
      },
    },
  });

  const wasm = fs.readFileSync(require.resolve("circom2/circom.wasm"));
  await runner.execute(wasm);
}

for (const name of CIRCUITS) {
  console.log(`\n=== compiling ${name} ===`);
  try {
    await compile(name);
    console.log(`ok: ${name}`);
  } catch (err) {
    console.error(`FAILED: ${name}`, err?.message ?? err);
    process.exitCode = 1;
  }
}

console.log("\nDone compiling circuits ->", path.join(PKG_ROOT, "build"));


