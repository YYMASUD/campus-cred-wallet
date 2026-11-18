import { expect } from "chai";
import { ethers } from "hardhat";

describe("CredentialSchemaRegistry + ZKVerifier", () => {
  it("registers a schema only from a trusted issuer", async () => {
    const [admin, uni] = await ethers.getSigners();
    const R = await ethers.getContractFactory("IssuerRegistry");
    const registry = await R.deploy(admin.address);
    const S = await ethers.getContractFactory("CredentialSchemaRegistry");
    const schemas = await S.deploy(admin.address, await registry.getAddress());

    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    const h = await registry.didHash("did:web:uni.edu");
    const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("{}"));

    await expect(
      schemas.registerSchema(schemaHash, "bafyCID", "did:web:uni.edu", "StudentId", "1.0.0")
    ).to.be.revertedWithCustomError(schemas, "UntrustedIssuer");

    await registry.approveIssuer(h);
    await schemas.registerSchema(schemaHash, "bafyCID", "did:web:uni.edu", "StudentId", "1.0.0");
    const s = await schemas.getSchema(schemaHash);
    expect(s.cid).to.equal("bafyCID");
    expect(await schemas.schemaCount()).to.equal(1n);
    await expect(
      schemas.registerSchema(schemaHash, "bafyCID2", "did:web:uni.edu", "StudentId", "1.0.1")
    ).to.be.revertedWithCustomError(schemas, "SchemaExists");
  });

  it("ZKVerifier rejects proofs without a registered verifier", async () => {
    const [admin] = await ethers.getSigners();
    const V = await ethers.getContractFactory("ZKVerifier");
    const v = await V.deploy(admin.address);
    await expect(
      v.verify(0, [0, 0], [[0, 0], [0, 0]], [0, 0], [1])
    ).to.be.revertedWithCustomError(v, "NoVerifier");
  });

  it("ZKVerifier can register verifier addresses and rejects zero", async () => {
    const [admin, some] = await ethers.getSigners();
    const V = await ethers.getContractFactory("ZKVerifier");
    const v = await V.deploy(admin.address);
    await expect(v.setVerifier(0, some.address)).to.emit(v, "VerifierSet");
    expect(await v.verifierFor(0)).to.equal(some.address);
    await expect(v.setVerifier(1, ethers.ZeroAddress)).to.be.revertedWithCustomError(v, "ZeroAddress");
  });
});
