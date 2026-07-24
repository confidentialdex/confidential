import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

async function main() {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Read core address from latest deploy
  const deployInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'latest_deploy.json'), 'utf8'));
  const CORE_ADDRESS = deployInfo.coreAddress;
  console.log(`Using Core: ${CORE_ADDRESS}`);

  const coreArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/src/ConfidentialCoreV1.sol/ConfidentialCoreV1.json')));
  const coreContract = new ethers.Contract(CORE_ADDRESS, coreArtifact.abi, wallet);

  const PAIRS = [
    { name: 'BTC/USDC', maxLev: 100, pythId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' },
    { name: 'ETH/USDC', maxLev: 100, pythId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' },
    { name: 'SOL/USDC', maxLev: 50, pythId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' },
    { name: 'BNB/USDC', maxLev: 50, pythId: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f' },
    { name: 'XRP/USDC', maxLev: 50, pythId: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8' },
    { name: 'LINK/USDC', maxLev: 50, pythId: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221' },
    { name: 'ARB/USDC', maxLev: 50, pythId: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5' },
    { name: 'AVAX/USDC', maxLev: 50, pythId: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7' },
    { name: 'SUI/USDC', maxLev: 50, pythId: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744' },
    { name: 'APT/USDC', maxLev: 50, pythId: '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5' },
    { name: 'NEAR/USDC', maxLev: 50, pythId: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750' },
    { name: 'DOGE/USDC', maxLev: 50, pythId: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c' },
    { name: 'PEPE/USDC', maxLev: 50, pythId: '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4' },
    { name: 'WIF/USDC', maxLev: 50, pythId: '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc' },
    { name: 'AAPL/USDC', maxLev: 20, pythId: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
    { name: 'TSLA/USDC', maxLev: 20, pythId: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
    { name: 'GOLD/USDC', maxLev: 50, pythId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2' },
    { name: 'SILVER/USDC', maxLev: 50, pythId: '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e' },
    { name: 'SPY/USDC', maxLev: 50, pythId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5' },
    { name: 'NVDA/USDC', maxLev: 20, pythId: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
    { name: 'EUR/USDC', maxLev: 100, pythId: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b' },
    { name: 'GBP/USDC', maxLev: 100, pythId: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1' },
    { name: 'USDJPY/USDC', maxLev: 100, pythId: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52' },
  ];

  console.log(`\nSetting up ${PAIRS.length} trading pairs...`);
  let success = 0;
  let skipped = 0;
  
  for (const pair of PAIRS) {
    const pairId = ethers.keccak256(ethers.toUtf8Bytes(pair.name));
    
    try {
      const existing = await coreContract.pairs(pairId);
      if (existing.active) {
        console.log(`  ⏭️  ${pair.name} already active, skipping`);
        skipped++;
        continue;
      }
      
      const maxLongOI = ethers.parseUnits("10000000", 6); // $10M
      const maxShortOI = ethers.parseUnits("10000000", 6); // $10M
      const maxPositionPct = 10000; // 100%

      const tx = await coreContract.addPair(
        pair.name,
        pair.pythId,
        pair.maxLev,
        maxLongOI,
        maxShortOI,
        maxPositionPct
      );
      console.log(`  📝 Adding ${pair.name} (${pair.maxLev}x)... tx: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ ${pair.name} added!`);
      success++;
    } catch (e) {
      console.error(`  ❌ Failed to add ${pair.name}:`, e.message?.slice(0, 100));
    }
  }
  
  console.log(`\n✅ Setup complete! Added: ${success}, Skipped: ${skipped}`);
}

main().catch(console.error);
