import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("IssuerRegistry", () => {
  async function deploy() {
    const [admin, uni, other, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IssuerRegistry");
    const registry = await Registry.deploy(admin.address);
    await registry.waitForDeployment();
    return { registry, admin, uni, other, stranger };
  }

  it("registers an issuer as Pending", async () => {
    const { registry, uni } = await loadFixture(deploy);
    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    const h = await registry.didHash("did:web:uni.edu");
    const rec = await registry.getIssuer(h);
    expect(rec.status).to.equal(1); // Pending
    expect(await registry.isTrustedIssuer("did:web:uni.edu")).to.equal(false);
  });

  it("governance approves and the issuer becomes trusted", async () => {
    const { registry, uni } = await loadFixture(deploy);
    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    const h = await registry.didHash("did:web:uni.edu");
    await registry.approveIssuer(h);
    expect(await registry.isTrustedIssuer("did:web:uni.edu")).to.equal(true);
    expect(await registry.approvedCount()).to.equal(1);
  });

  it("blocks double registration for the same DID and the same controller", async () => {
    const { registry, uni } = await loadFixture(deploy);
    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    await expect(registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni")).to.be.revertedWithCustomError(
      registry,
      "AlreadyRegistered"
    );
    await expect(registry.connect(uni).registerIssuer("did:web:uni2.edu", "Uni2")).to.be.revertedWithCustomError(
      registry,
      "AlreadyRegistered"
    );
  });

  it("reverts on empty DID and zero admin", async () => {
    const { registry, uni } = await loadFixture(deploy);
    await expect(registry.connect(uni).registerIssuer("", "Uni")).to.be.revertedWithCustomError(registry, "EmptyDid");
    const Registry = await ethers.getContractFactory("IssuerRegistry");
    await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(registry, "ZeroAddress");
  });

  it("only governance can approve", async () => {
    const { registry, uni, stranger } = await loadFixture(deploy);
    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    const h = await registry.didHash("did:web:uni.edu");
    await expect(registry.connect(stranger).approveIssuer(h)).to.be.reverted;
  });

  it("suspends a previously approved issuer", async () => {
    const { registry, uni } = await loadFixture(deploy);
    await registry.connect(uni).registerIssuer("did:web:uni.edu", "Uni");
    const h = await registry.didHash("did:web:uni.edu");
    await registry.approveIssuer(h);
    await registry.suspendIssuer(h);
    expect(await registry.isTrustedIssuer("did:web:uni.edu")).to.equal(false);
    await expect(registry.suspendIssuer(h)).to.be.revertedWithCustomError(registry, "InvalidStatus");
  });

  it("rejects approving an unknown issuer", async () => {
    const { registry } = await loadFixture(deploy);
    const h = ethers.keccak256(ethers.toUtf8Bytes("did:web:ghost.edu"));
    await expect(registry.approveIssuer(h)).to.be.revertedWithCustomError(registry, "NotRegistered");
  });
});
