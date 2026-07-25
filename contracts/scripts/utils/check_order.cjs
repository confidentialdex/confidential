const { ethers } = require("ethers");
const fs = require("fs");
const deploy = JSON.parse(fs.readFileSync("scripts/latest_deploy_proxies.json"));
const TRADING_ADDRESS = deploy.tradingAddress;
const tradingAbi = JSON.parse(fs.readFileSync("artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json")).abi;

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  const trading = new ethers.Contract(TRADING_ADDRESS, tradingAbi, provider);

  const order = await trading.pendingOrders(11);
  console.log("createdAt:", order.createdAt.toString());
  
  const block = await provider.getBlock("latest");
  console.log("Current block timestamp:", block.timestamp);
}
main();
