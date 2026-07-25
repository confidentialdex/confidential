const { ethers } = require("ethers");
const pythId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
  
  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythId.slice(2)}`);
  const data = await res.json();
  const updateData = data.binary.data.map((hex) => `0x${hex}`);

  const PYTH_ADDRESS = '0x2880aB155794e7179c9eE2e38200202908C17B43';
  const PYTH_FEE_ABI = ["function getUpdateFee(bytes[] calldata updateData) view returns (uint256)"];
  const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_FEE_ABI, provider);

  try {
    const fee = await pythContract.getUpdateFee(updateData);
    console.log("Pyth Fee for this update:", fee.toString());
  } catch(e) {
    console.log("Pyth Error:", e.reason || e.shortMessage || e.message);
  }
}
main();
