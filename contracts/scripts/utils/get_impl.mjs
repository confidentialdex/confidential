import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });

async function getImpl(proxy) {
    const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    let data = await provider.getStorage(proxy, slot);
    const impl = ethers.getAddress(ethers.dataSlice(data, 12));
    console.log(`${proxy} -> ${impl}`);
}

async function main() {
    await getImpl("0x0026Ceb6a0dB61224a1A94EfDDd3A37C424cF797"); // Core
    await getImpl("0xFE7f9dDc814D51d487510BA32BD5F611Af131C20"); // Trading
}
main();
