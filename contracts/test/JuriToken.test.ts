import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, parseUnits } from "ethers";

import type { JuriToken } from "../typechain-types";

const TOKENS_PER_ETH = 10000n;
const FAUCET_AMOUNT = parseUnits("5000", 18);
const FAUCET_COOLDOWN = 0n;

describe("JuriToken", () => {
  async function deployFixture() {
    const [owner, buyer, user] = await ethers.getSigners();
    const token = (await ethers.deployContract("JuriToken", [
      owner.address,
      TOKENS_PER_ETH,
      FAUCET_AMOUNT,
      FAUCET_COOLDOWN,
    ])) as unknown as JuriToken;
    return { token, owner, buyer, user };
  }

  it("is JURI, 18 decimals, default total supply 0", async () => {
    const { token } = await loadFixture(deployFixture);
    expect(await token.symbol()).to.equal("JURI");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("mints msg.value * tokensPerEth", async () => {
    const { token, buyer } = await loadFixture(deployFixture);
    const value = parseEther("1");
    await expect(token.connect(buyer).buyTokens({ value }))
      .to.emit(token, "TokensBought")
      .withArgs(buyer.address, value, value * TOKENS_PER_ETH);
    expect(await token.balanceOf(buyer.address)).to.equal(value * TOKENS_PER_ETH);
  });

  it("reverts on zero ETH buy", async () => {
    const { token, buyer } = await loadFixture(deployFixture);
    await expect(token.connect(buyer).buyTokens({ value: 0n })).to.be.revertedWith("amount is zero");
  });

  it("faucet mints faucetAmount", async () => {
    const { token, user } = await loadFixture(deployFixture);
    await expect(token.connect(user).faucet())
      .to.emit(token, "FaucetClaimed")
      .withArgs(user.address, FAUCET_AMOUNT);
    expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT);
  });

  it("faucet repeats allowed when cooldown is 0", async () => {
    const { token, user } = await loadFixture(deployFixture);
    await token.connect(user).faucet();
    await token.connect(user).faucet();
    expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT * 2n);
  });

  it("only owner may withdraw ETH", async () => {
    const { token, owner, buyer, user } = await loadFixture(deployFixture);
    await token.connect(buyer).buyTokens({ value: parseEther("2") });
    await expect(token.connect(user).withdrawEth(user.address)).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount"
    );
    await expect(token.connect(owner).withdrawEth(user.address)).to.changeEtherBalance(user, parseEther("2"));
    expect(await token.balanceOf(buyer.address)).to.equal(parseEther("2") * TOKENS_PER_ETH);
  });

  it("withdrawEth reverts on zero address", async () => {
    const { token, owner } = await loadFixture(deployFixture);
    await expect(token.connect(owner).withdrawEth(ethers.ZeroAddress)).to.be.revertedWith(
      "zero address"
    );
  });
});