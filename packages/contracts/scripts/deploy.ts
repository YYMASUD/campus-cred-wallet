import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Deploys the full campus-cred registry stack and writes addresses to
 * deployments/<network>.json + exports ABIs into packages/sdk/src/abi.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying with", deployer.address, "to chain", network.chainId);

  const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistry.deploy(deployer.address);
  await issuerRegistry.waitForDeployment();

  const SchemaRegistry = await ethers.getContractFactory("CredentialSchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy(deployer.address, await issuerRegistry.getAddress());
  await schemaRegistry.waitForDeployment();

  const RevocationRegistry = await ethers.getContractFactory("RevocationRegistry");
  const revocationRegistry = await RevocationRegistry.deploy(deployer.address);
  await revocationRegistry.waitForDeployment();

  const zkVerifier = await (await ethers.getContractFactory("ZKVerifier")).deploy(deployer.address);
  await zkVerifier.waitForDeployment();

  const eventTicket = await (await ethers.getContractFactory("EventTicket")).deploy(deployer.address);
  await eventTicket.waitForDeployment();

  const deployed = {
    chainId: Number(network.chainId),
    deployer: deployer.address,
    IssuerRegistry: await issuerRegistry.getAddress(),
    CredentialSchemaRegistry: await schemaRegistry.getAddress(),
    RevocationRegistry: await revocationRegistry.getAddress(),
    ZKVerifier: await zkVerifier.getAddress(),
    EventTicket: await eventTicket.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${network.chainId}.json`);
  fs.writeFileSync(file, JSON.stringify(deployed, null, 2));
  console.log("Wrote", file);
  console.log(JSON.stringify(deployed, null, 2));

  // export ABIs for the SDK
  const abiDir = path.join(__dirname, "..", "..", "sdk", "src", "abi");
  fs.mkdirSync(abiDir, { recursive: true });
  for (const name of ["IssuerRegistry", "CredentialSchemaRegistry", "RevocationRegistry", "ZKVerifier", "EventTicket"]) {
    const art = await ethers.getContractFactory(name);
    const abi = art.interface.formatJson();
    fs.writeFileSync(path.join(abiDir, `${name}.json`), abi);
  }
  console.log("Exported ABIs to", abiDir);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
