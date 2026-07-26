const { ethers } = require("ethers");
const CoreABI = require("../../../src/abis/ConfidentialCoreV1.json");
const VaultABI = require("../../../src/abis/ConfidentialVaultV1.json");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  const core = new ethers.Contract("0x9acec9Ad24870f95927224FfC5E1c94274492cd8", CoreABI.abi || CoreABI, provider);
  const vault = new ethers.Contract("0x31cabF85147b42184E2d053f0e9c0d60357ea1EC", VaultABI.abi || VaultABI, provider);


  
  const vBalance = await vault.getVaultBalance();
  console.log("Vault Balance:", ethers.formatUnits(vBalance, 6));

  const totalOI = await vault.getTotalOI();
  console.log("Vault Total OI:", ethers.formatUnits(totalOI, 6));
}
main();
