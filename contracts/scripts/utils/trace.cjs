const { ethers } = require("ethers");
const fs = require("fs");
const deploy = JSON.parse(fs.readFileSync("scripts/latest_deploy_proxies.json"));
const TRADING_ADDRESS = deploy.tradingAddress;
const tradingAbi = JSON.parse(fs.readFileSync("artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json")).abi;
const pythId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.quicknode.testnet.arc.network");
  const trading = new ethers.Contract(TRADING_ADDRESS, tradingAbi, provider);

  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId.slice(2)}`);
  const data = await res.json();
  const updateData = data.binary.data.map((hex) => `0x${hex}`);

  const txReq = await trading.executeOrder.populateTransaction(11, updateData);
  
  try {
      const trace = await provider.send('debug_traceCall', [{
          to: txReq.to,
          data: txReq.data,
          value: "0x0"
      }, "latest", { tracer: "callTracer" }]);
      console.log(JSON.stringify(trace, null, 2));
  } catch(e) {
      console.log("Trace failed:", e);
  }
}
main();
