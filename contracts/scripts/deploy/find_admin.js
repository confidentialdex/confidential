import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider('https://rpc.drpc.testnet.arc.network');
    const coreProxy = '0x9acec9Ad24870f95927224FfC5E1c94274492cd8';
    
    // Read the admin slot
    const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
    let adminBytes = await provider.getStorage(coreProxy, ADMIN_SLOT);
    const adminAddress = ethers.getAddress(ethers.dataSlice(adminBytes, 12));
    console.log('ProxyAdmin Address:', adminAddress);
}
main().catch(console.error);
