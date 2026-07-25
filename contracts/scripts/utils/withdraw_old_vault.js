import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const loadArtifact = (name, parentFile = name) => {
    const raw = fs.readFileSync(path.join(__dirname, `../artifacts/src/${parentFile}.sol/${name}.json`));
    return JSON.parse(raw);
};

async function main() {
    const OLD_VAULT_ADDRESS = "0xE9723B722Db4516F1e807ef25e15b61170459dA5";

    const rpcUrl = process.env.ARC_TESTNET_URL || "https://rpc.drpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Withdrawing from old Vault:", OLD_VAULT_ADDRESS);
    console.log("Using account:", wallet.address);

    const artifact = loadArtifact("ConfidentialVaultV1");
    const vault = new ethers.Contract(OLD_VAULT_ADDRESS, artifact.abi, wallet);

    // Check if locked
    const canWithdrawDegen = await vault.canWithdraw(wallet.address, true);
    console.log("Can withdraw Degen?", canWithdrawDegen);
    
    // Check Degen shares
    const degenShares = await vault.sharesOf(wallet.address, true);
    if (degenShares > 0n) {
        if (canWithdrawDegen) {
            console.log(`Found ${ethers.formatUnits(degenShares, 6)} Degen shares. Withdrawing...`);
            const tx = await vault.withdraw(degenShares, true, 0);
            await tx.wait();
            console.log("✅ Degen shares withdrawn successfully!");
        } else {
            console.log(`Found ${ethers.formatUnits(degenShares, 6)} Degen shares, but they are STILL LOCKED.`);
        }
    } else {
        console.log("No Degen shares found.");
    }

    const canWithdrawPrime = await vault.canWithdraw(wallet.address, false);
    console.log("Can withdraw Prime?", canWithdrawPrime);

    // Check Prime shares
    const primeShares = await vault.sharesOf(wallet.address, false);
    if (primeShares > 0n) {
        if (canWithdrawPrime) {
            console.log(`Found ${ethers.formatUnits(primeShares, 6)} Prime shares. Withdrawing...`);
            const tx = await vault.withdraw(primeShares, false, 0);
            await tx.wait();
            console.log("✅ Prime shares withdrawn successfully!");
        } else {
            console.log(`Found ${ethers.formatUnits(primeShares, 6)} Prime shares, but they are STILL LOCKED.`);
        }
    } else {
        console.log("No Prime shares found.");
    }
}

main().catch(console.error);
