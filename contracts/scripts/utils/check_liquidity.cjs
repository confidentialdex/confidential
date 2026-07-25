const { ethers } = require("ethers");
const CoreABI = require("../../../src/abis/ConfidentialCoreV1.json");
const VaultABI = require("../../../src/abis/ConfidentialVaultV1.json");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  const core = new ethers.Contract("0x5539f6388B921aEA3df086A5704B049c41D6C110", CoreABI.abi || CoreABI, provider);
  const vault = new ethers.Contract("0xFA9eEC6c9D64DD4863fDb9990f5cb5b3CfE812C3", VaultABI.abi || VaultABI, provider);


  
  const vBalance = await vault.getVaultBalance();
  console.log("Vault Balance:", ethers.formatUnits(vBalance, 6));

  const totalOI = await vault.getTotalOI();
  console.log("Vault Total OI:", ethers.formatUnits(totalOI, 6));
}
main();
