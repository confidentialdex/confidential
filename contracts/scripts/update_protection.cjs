require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
    const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://5042002.rpc.thirdweb.com";
    const privateKey = process.env.PRIVATE_KEY;
    const vaultAddress = "0xd0ABFF86ED2493008A2d26C6dA44FE26581f0A79";

    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in .env");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const vaultAbi = [
        "function setPrimeProtection(uint256 _bps) external",
        "function primeProtectionBps() external view returns (uint256)"
    ];

    const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, wallet);

    console.log("Checking current protection bps...");
    const currentBps = await vaultContract.primeProtectionBps();
    console.log(`Current Prime Protection: ${currentBps.toString()} bps`);

    if (currentBps.toString() === "6000") {
        console.log("Already updated to 6000 bps!");
        return;
    }

    console.log("Updating prime protection to 60% (6000 bps)...");
    const tx = await vaultContract.setPrimeProtection(6000);
    console.log(`Tx hash: ${tx.hash}`);
    
    console.log("Waiting for confirmation...");
    await tx.wait();
    
    const newBps = await vaultContract.primeProtectionBps();
    console.log(`Update successful! New Prime Protection: ${newBps.toString()} bps`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
