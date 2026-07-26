import hre from "hardhat";
async function main() {
  console.log(typeof hre.ethers.getContractFactory);
}
main().catch(console.error);
