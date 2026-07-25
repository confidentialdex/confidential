const { ethers } = require("ethers");
const pythId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  
  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId.slice(2)}`);
  const data = await res.json();
  const updateData = data.binary.data.map((hex) => `0x${hex}`);

  const PYTH_ADDRESS = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729';
  const PYTH_ABI = ["function updatePriceFeeds(bytes[] calldata updateData) payable"];
  const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_ABI, provider);

  try {
    await pythContract.updatePriceFeeds.staticCall(updateData, { value: 0 });
    console.log("Success");
  } catch(e) {
    console.log("Pyth Revert:", e.reason || e.shortMessage || e.message);
  }
}
main();
