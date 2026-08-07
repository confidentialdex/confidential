const { ethers } = require("../contracts/node_modules/ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../contracts/.env") });

async function main() {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  // Using the trader's private key
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
      console.log("No PRIVATE_KEY found in .env");
      return;
  }
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`🔑 Connected as Trader: ${wallet.address}`);

  const TRADING_ADDRESS = "0x266C76800b5bdEd90c246AC60319831078fA28A4";
  const ap = path.join(__dirname, "../contracts/artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json");
  const tradingAbi = JSON.parse(fs.readFileSync(ap, "utf8")).abi;
  const contract = new ethers.Contract(TRADING_ADDRESS, tradingAbi, wallet);

  const nextId = Number(await contract.nextOrderId());
  let canceledCount = 0;

  for (let i = 1; i < nextId; i++) {
    try {
      const o = await contract.pendingOrders(i);
      // Only check active orders owned by the user
      if (o.isActive && o.trader.toLowerCase() === wallet.address.toLowerCase()) {
        console.log(`Found active order #${i} (Type: ${o.orderType}). Attempting to cancel...`);
        try {
            const tx = await contract.cancelOrder(i);
            console.log(`Transaction sent! Hash: ${tx.hash}`);
            await tx.wait();
            console.log(`✅ Order #${i} canceled successfully!`);
            canceledCount++;
        } catch (cancelErr) {
            console.log(`❌ Failed to cancel order #${i}: ${cancelErr.shortMessage || cancelErr.message}`);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (canceledCount === 0) {
      console.log("No stuck orders found for your wallet.");
  }
}

main().catch(console.error);
