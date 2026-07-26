const { ethers, upgrades } = require("hardhat");

async function main() {
  const ConfidentialCore = await ethers.getContractFactory("ConfidentialCoreV1");
  console.log("Upgrading ConfidentialCoreV1...");
  const core = await upgrades.upgradeProxy("0x9acec9Ad24870f95927224FfC5E1c94274492cd8", ConfidentialCore);
  console.log("ConfidentialCore upgraded at:", await core.getAddress());
}

main().catch(console.error);
