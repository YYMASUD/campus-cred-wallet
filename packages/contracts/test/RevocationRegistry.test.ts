import { expect } from "chai";
import { ethers } from "hardhat";

describe("RevocationRegistry", () => {
  async function deploy() {
    const [admin, issuer, outsider] = await ethers.getSigners();
    const R = await ethers.getContractFactory("RevocationRegistry");
    const r = await R.deploy(admin.address);
    await r.waitForDeployment();
    const h = ethers.keccak256(ethers.toUtf8Bytes("did:web:uni.edu"));
    return { r, admin, issuer, outsider, h };
  }

  it("allocates sequential indices per issuer", async () => {
    const { r, h } = await deploy();
    expect(await r.allocateIndex.staticCall(h)).to.equal(0n);
    await r.allocateIndex(h);
    expect(await r.allocateIndex.staticCall(h)).to.equal(1n);
    await r.allocateIndex(h);
    expect(await r.issuedIndices(h)).to.equal(2n);
  });

  it("revokes and reports status", async () => {
    const { r, h } = await deploy();
    expect(await r.isRevoked(h, 5)).to.equal(false);
    await r.revoke(h, 5);
    expect(await r.isRevoked(h, 5)).to.equal(true);
    expect(await r.isRevoked(h, 6)).to.equal(false);
  });

  it("rejects double revocation and unrevoking a clear bit", async () => {
    const { r, h } = await deploy();
    await r.revoke(h, 1);
    await expect(r.revoke(h, 1)).to.be.revertedWithCustomError(r, "AlreadyRevoked");
    await expect(r.unrevoke(h, 2)).to.be.revertedWithCustomError(r, "NotRevoked");
  });

  it("isolates bitmaps per issuer", async () => {
    const { r, h } = await deploy();
    const h2 = ethers.keccak256(ethers.toUtf8Bytes("did:web:other.edu"));
    await r.revoke(h, 3);
    expect(await r.isRevoked(h2, 3)).to.equal(false);
  });

  it("handles cross-word and cross-page indices", async () => {
    const { r, h } = await deploy();
    for (const i of [255, 256, 1023, 1024, 2047]) {
      await r.revoke(h, i);
      expect(await r.isRevoked(h, i)).to.equal(true);
    }
    expect(await r.isRevoked(h, 257)).to.equal(false);
  });

  it("emits revocation event with page and bit", async () => {
    const { r, h } = await deploy();
    await expect(r.revoke(h, 300)).to.emit(r, "CredentialRevoked").withArgs(h, 300, 0, 44);
  });
});
