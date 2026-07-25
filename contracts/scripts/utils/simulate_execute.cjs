const { ethers } = require("ethers");
const fs = require("fs");
const deploy = JSON.parse(fs.readFileSync("scripts/latest_deploy_proxies.json"));
const TRADING_ADDRESS = deploy.tradingAddress;
const tradingAbi = JSON.parse(fs.readFileSync("artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json")).abi;
const pythId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const trading = new ethers.Contract(TRADING_ADDRESS, tradingAbi, provider);

  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId.slice(2)}`);
  const data = await res.json();
  const updateData = data.binary.data.map((hex) => `0x${hex}`);

  const PYTH_ADDRESS = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729';
  const PYTH_FEE_ABI = ["function getUpdateFee(bytes[] calldata updateData) view returns (uint256)"];
  const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_FEE_ABI, provider);
  const pythFee = await pythContract.getUpdateFee(updateData);

  console.log("Pyth Fee:", pythFee.toString());

  try {
    await trading.executeOrder.staticCall(11, updateData, { value: pythFee });
    console.log("Success");
  } catch (err) {
    console.log("Revert reason:", err.reason);
    console.log("Short MSG:", err.shortMessage);
    if (err.info && err.info.error && err.info.error.data) {
        console.log("Data:", err.info.error.data);
        const iface = new ethers.Interface(tradingAbi);
        try {
            const decoded = iface.parseError(err.info.error.data);
            console.log("Decoded Custom Error:", decoded.name, decoded.args);
        } catch(e) {
            console.log("Could not decode custom error");
        }
    }
  }
}
main();
