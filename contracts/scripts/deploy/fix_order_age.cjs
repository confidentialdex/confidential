const ethers = require('ethers');
async function main() {
    const provider = new ethers.JsonRpcProvider('https://rpc.drpc.testnet.arc.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const abi = ['function setMaxOrderAge(uint256 _seconds) external'];
    const trading = new ethers.Contract('0xc07368d1dfb34AB43c4c113aA87b656ee5B04634', abi, wallet);
    console.log('Fixing maxOrderAge...');
    const tx = await trading.setMaxOrderAge(7 * 86400);
    console.log('Tx hash:', tx.hash);
    await tx.wait();
    console.log('maxOrderAge fixed to 7 days');
}
main().catch(console.error);
