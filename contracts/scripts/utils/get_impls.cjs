const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, "../../deployments/v1.json")));

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  for (const [name, address] of Object.entries(deployments)) {
    if (name.endsWith("Address") && address !== "0x3600000000000000000000000000000000000000" && address !== "0x2880aB155794e7179c9eE2e38200202908C17B43") {
      try {
        const implBytes = await provider.getStorage(address, slot);
        const impl = ethers.getAddress("0x" + implBytes.slice(-40));
        console.log(`${name} Proxy: ${address} | Impl: ${impl}`);
      } catch (e) {}
    }
  }
}
main();
