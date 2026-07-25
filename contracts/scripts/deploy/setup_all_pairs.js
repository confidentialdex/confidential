import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import CoreABI from "../../../src/abis/ConfidentialCoreV1.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAIR_PYTH_IDS = {
  'BTC/USDC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USDC': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USDC': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BNB/USDC': '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
  'XRP/USDC': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  'LINK/USDC': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  'ARB/USDC': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  'AVAX/USDC': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  'SUI/USDC': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  'APT/USDC': '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
  'NEAR/USDC': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  'DOGE/USDC': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  'PEPE/USDC': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
  'WIF/USDC': '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc',
  'AAPL/USDC': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  'TSLA/USDC': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  'GOLD/USDC': '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  'SILVER/USDC': '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
  'SPY/USDC': '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
  'NVDA/USDC': '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  'EUR/USDC': '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  'GBP/USDC': '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
  'USDJPY/USDC': '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const provider = new ethers.JsonRpcProvider("https://rpc.drpc.testnet.arc.network");
    const wallet = new ethers.Wallet("0xb9c19de91f3b552d22fafc73a94913e17706f69291fd525a70fd125ba9b9569b", provider);

    const deploymentsFile = path.join(__dirname, "../../deployments/v1.json");
    const { coreAddress } = JSON.parse(fs.readFileSync(deploymentsFile));

    const core = new ethers.Contract(coreAddress, CoreABI.abi || CoreABI, wallet);

    for (const [pairName, pythId] of Object.entries(PAIR_PYTH_IDS)) {
        let maxLongOI, maxShortOI;
        
        if (pairName === 'BTC/USDC' || pairName === 'ETH/USDC') {
            maxLongOI = ethers.parseUnits("10000000", 6); // 10m
            maxShortOI = ethers.parseUnits("10000000", 6); // 10m
        } else {
            maxLongOI = ethers.parseUnits("5000000", 6); // 5m
            maxShortOI = ethers.parseUnits("5000000", 6); // 5m
        }

        const maxLeverage = 50;
        const maxPositionPct = 2000; // 20% max position per user

        console.log(`Setting up pair ${pairName}...`);
        try {
            const tx = await core.addPair(
                pairName,
                pythId,
                maxLeverage,
                maxLongOI,
                maxShortOI,
                maxPositionPct
            );
            await tx.wait();
            console.log(`✅ ${pairName} successfully added!`);
            await sleep(2000); // Avoid rate limit
        } catch (e) {
            console.error(`❌ Failed to add ${pairName}:`, e.message);
        }
    }
    
    console.log("All pairs configured!");
}

main().catch(console.error);
