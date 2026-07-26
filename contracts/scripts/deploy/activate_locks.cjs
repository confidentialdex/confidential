const ethers = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://rpc.drpc.testnet.arc.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const abi = ['function setTieredLockups(uint256 _degenSeconds, uint256 _primeSeconds) external'];
    const vault = new ethers.Contract('0x31cabF85147b42184E2d053f0e9c0d60357ea1EC', abi, wallet);
    
    console.log('Activating lockups...');
    const tx = await vault.setTieredLockups(2 * 86400, 5 * 86400);
    console.log('Tx hash:', tx.hash);
    await tx.wait();
    console.log('Lockups activated');
}

main().catch(console.error);
