import { expect } from "chai";
import { ethers } from "hardhat";

describe("EventTicket (soulbound)", () => {
  async function deploy() {
    const [admin, uni, alice, bob] = await ethers.getSigners();
    const T = await ethers.getContractFactory("EventTicket");
    const t = await T.deploy(admin.address);
    await t.waitForDeployment();
    const eventId = ethers.keccak256(ethers.toUtf8Bytes("evt-2026-spring"));
    const aliceDid = ethers.keccak256(ethers.toUtf8Bytes("did:key:z6MkAlice"));
    return { t, admin, uni, alice, bob, eventId, aliceDid };
  }

  it("issues a soulbound ticket and locks it", async () => {
    const { t, eventId, aliceDid } = await deploy();
    await expect(t.issueTicket(eventId, aliceDid, "ipfs://meta"))
      .to.emit(t, "TicketIssued")
      .withArgs(1n, eventId, aliceDid);
    expect(await t.ownerOf(1)).to.equal((await ethers.getSigners())[0].address);
    expect(await t.locked(1)).to.equal(true);
    expect(await t.tokenURI(1)).to.equal("ipfs://meta");
  });

  it("blocks transfers (ERC-5192)", async () => {
    const { t, alice, bob, eventId, aliceDid } = await deploy();
    await t.issueTicket(eventId, aliceDid, "");
    await expect(t.transferFrom((await ethers.getSigners())[0].address, bob.address, 1)).to.be.revertedWithCustomError(
      t,
      "Soulbound"
    );
    await expect(t.connect(alice).setApprovalForAll(bob.address, true)).to.be.revertedWithCustomError(t, "Soulbound");
  });

  it("prevents duplicate tickets for the same event+holder", async () => {
    const { t, eventId, aliceDid } = await deploy();
    await t.issueTicket(eventId, aliceDid, "");
    await expect(t.issueTicket(eventId, aliceDid, "")).to.be.revertedWithCustomError(t, "TicketExists");
  });

  it("revokes a ticket", async () => {
    const { t, eventId, aliceDid } = await deploy();
    await t.issueTicket(eventId, aliceDid, "");
    await expect(t.revokeTicket(1)).to.emit(t, "TicketRevoked").withArgs(1n);
    expect(await t.isRevoked(1)).to.equal(true);
    await expect(t.revokeTicket(1)).to.be.revertedWithCustomError(t, "AlreadyRevoked");
  });

  it("reports ERC-5192 interface support", async () => {
    const { t } = await deploy();
    expect(await t.supportsInterface("0x2b3e2a2c")).to.equal(true);
    expect(await t.supportsInterface("0x80ac58cd")).to.equal(true); // ERC721
  });
});
