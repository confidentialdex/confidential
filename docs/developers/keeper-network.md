# 🤖 Unified Keeper Network (feederBot V1)

Execution, liquidations, and price precision at **Confidential DEX V1** do not rely on a centralized matching engine. Instead, they are fully powered and secured by a permissionless, decentralized army of **Unified Keeper Bots (`feederBot.cjs`)**.

These bots monitor the network continuously (**every 4 seconds**) to capture user orders, fetch real-time Pyth Oracle VAA proofs, and match or liquidate positions instantly with **checks-effects-interactions (CEI)** and multi-call batch optimizations.

---

## Permissionless Nodes (Opportunities for Developers)

Unlike traditional exchanges where internal teams monopolize liquidation and execution revenue, our Keeper Network is **100% Permissionless and Decentralized**:
- Anyone—including developers, node operators, and traders—can run the Node Keeper script (`feederBot.cjs`) on a personal server or VPS.
- Keepers compete freely on-chain to execute *Pending Orders* and *Liquidations*, earning direct ARC payouts (`Execution Fee` & `Liquidation Reward`) sent immediately to their wallet (`msg.sender`).

---

## 💰 Keeper Economy & Fee Scheme

The financial incentive structure guarantees immediate on-chain settlement and positive cashflow for Node Operators:

| Operation Cycle | Fee Scheme / Compensation | Borne By |
| :--- | :--- | :--- |
| **Market Scanning (Every 4 Sec)** | **0 Gas** (Static RPC & Multicall3 read-only data) | None / Free |
| **Pending Order Execution** | **100% Execution Fee (0.013 ARC)** | Deposited by **Trader** upfront upon placing an order |
| **Liquidation Execution** | **1% of Trader's Effective Collateral** | Deducted automatically from the liquidated trader's collateral |
| **TP/SL Execution** | **Uncompensated (0 ARC)** | Gas & Oracle fees fronted by Keeper / Protocol fallback bots |

::: info Instant On-Chain Payouts
Whenever your bot successfully executes a pending order (`placeOrder` -> `executeOrder`) or triggers a liquidation (`liquidate`), the contract immediately transfers the `Execution Fee` or `1% Liquidation Reward` directly to your Keeper Wallet (`msg.sender`).
:::

---

## ⚡ Key Architectural Improvements in V1

The latest `feederBot.cjs` (V1 Batch Mode) introduces enterprise-grade resilience and gas optimizations:

### 1. Multi-Order & All-Type Coverage (Types 0 to 7)
The Keeper V1 engine natively handles every order type supported by `ConfidentialTradingV1.sol`:
- **Type 0 (Limit) & Type 1 (Stop):** Executes when oracle price crosses trigger thresholds.
- **Type 2 (Market Open) & Type 3 (Market Close):** Settles instant market entries and exits with fresh Pyth prices.
- **Type 4 (TWAP):** Executes large orders in timed slices (`twapSlices`). V1 accurately preserves the order in active status until all slices settle (`twapExecuted >= twapSlices`), distributing proportional execution fees per slice without premature deactivation.
- **Type 5 (Increase Margin/Size):** Executes position additions (`_executeIncrease`) with exact weighted-average entry calculation.
- **Type 6 (Partial Close):** Closes proportional shares (`closePercentBps`) and releases collateral seamlessly.
- **Type 7 (Remove Collateral):** Settles margin withdrawal requests while enforcing strict anti-self-liquidation safety bounds (`marginRatio >= 2000`).

### 2. High-Performance Multicall3 & JSON-RPC Batching
To eliminate RPC network congestion and latency:
- **Multicall3 Aggregation (`0xcA11bde0...`):** Queries up to **50 pending orders or positions in a single `aggregate3` call**, cutting RPC read overhead by 98%.
- **Batched JSON-RPC Fallback:** If `Multicall3` is unavailable on a local or custom chain, V1 automatically downgrades to parallel HTTP `eth_call` batches (`jsonrpc: "2.0"`).

### 3. Smart Arc Network Rate-Limit & Cooldown Protection
High-frequency bots often get throttled (`HTTP 429` / `Too Many Requests`). V1 integrates:
- **Adaptive Bucket Cool-downs:** Automatically pauses (`isRpcRateLimitError`) for 4s–6s when Arc Network RPC rate limits trigger, allowing tokens/buckets to replenish.
- **Pre-Execution Simulation (`staticCall`):** Simulates every transaction before broadcasting. If an order reverts (`Limit not reached`, `TWAP: too early`), the bot skips gas expenditure.

### 4. Gas & Nonce Caching
- **Memory Gas Cache (`getCachedGasPrice`):** Refreshes network fee data once per minute (`25 Gwei` default) to prevent underpriced transactions during gas spikes.
- **Incremental Nonce Tracking (`getNextNonce`):** Manages local nonces cleanly across rapid back-to-back executions, resetting only upon confirmed chain rejections.

---

## 🚀 How to Run Your Own Keeper Bot (V1)

### 1. Prerequisites & Server Specs
We recommend deploying the bot on a dedicated Linux VPS with high connection stability to the Arc Testnet RPC:
- **CPU:** 1 vCore (2+ vCores recommended for rapid Multicall parsing)
- **RAM:** 1 GB–2 GB Minimum
- **OS:** Ubuntu 22.04 LTS (or Debian/CentOS)
- **Node.js:** v18.0.0 or higher (`node -v`)

### 2. Setup the Bot Script (`feederBot.cjs`)

Create a file named `feederBot.cjs` inside your server directory (`contracts/`) and copy the complete production script below:

<details>
<summary>Click here to view and copy the full <b>feederBot.cjs V1</b> script (645 lines)</summary>

```javascript
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config();

// ──────────── Pair Mapping ────────────
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

const PAIR_ID_TO_PYTH = {};
const PAIR_ID_TO_NAME = {};
for (const [name, pythId] of Object.entries(PAIR_PYTH_IDS)) {
  const pairId = ethers.keccak256(ethers.toUtf8Bytes(name));
  PAIR_ID_TO_PYTH[pairId] = pythId;
  PAIR_ID_TO_NAME[pairId] = name;
}

const ORDER_TYPE_NAMES = {
  0: 'Limit', 1: 'Stop', 2: 'MarketOpen', 3: 'MarketClose',
  4: 'TWAP', 5: 'Increase', 6: 'PartialClose', 7: 'RemoveCol'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ──────────── Multicall3 ────────────
const MULTICALL3_ADDR = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])"
];

// ──────────── Batch RPC via JSON-RPC ────────────
async function batchJsonRpc(rpcUrl, calls) {
  const batch = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_call",
    params: [{ to: c.to, data: c.data }, "latest"]
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();
    if (Array.isArray(results)) {
      results.sort((a, b) => a.id - b.id);
      return results.map(r => r.result || null);
    }
    return [results.result || null];
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ──────────── Pyth VAA Fetch ────────────
async function fetchPythVaa(pythPriceId) {
  try {
    const cleanId = pythPriceId.startsWith('0x') ? pythPriceId.slice(2) : pythPriceId;
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${cleanId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.binary.data.map((hex) => `0x${hex}`);
  } catch (err) {
    console.error(`[Pyth] VAA error: ${err.message}`);
    return [];
  }
}

// ──────────── Error Helpers ────────────
function extractRevertReason(err) {
  if (err.reason) return err.reason;
  if (err.shortMessage && !err.shortMessage.includes('missing revert data') && !err.shortMessage.includes('could not coalesce')) return err.shortMessage;
  if (err.info?.error?.message) return err.info.error.message;
  if (err.error?.message) return err.error.message;
  return err.shortMessage || err.message || "Unknown";
}

const EXPECTED_REVERTS = ['Limit not reached', 'Stop not reached', 'TWAP: too early', 'Not liquidatable', 'TP not reached', 'SL not reached', 'Not active', 'Cooldown active'];
function isExpected(reason) { return EXPECTED_REVERTS.some(r => reason.includes(r)); }

function isRpcRateLimitError(reason) {
  const r = reason.toLowerCase();
  return r.includes('request limit') || r.includes('rate limit') || r.includes('429') || r.includes('missing revert data') || r.includes('could not coalesce') || r.includes('network error') || r.includes('timeout') || r.includes('bad response');
}

async function waitReceipt(provider, txHash, maxRetries = 15) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch (e) {
      // If rate limited checking receipt, sleep and retry without throwing
    }
    await sleep(3000);
  }
  return null;
}

let cachedGasPrice = 25_000_000_000n; // default 25 gwei
let lastGasPriceFetch = 0;
async function getCachedGasPrice(provider) {
  const now = Date.now();
  if (now - lastGasPriceFetch > 60_000) {
    try {
      const fd = await provider.getFeeData();
      if (fd && fd.gasPrice) {
        cachedGasPrice = fd.gasPrice;
        lastGasPriceFetch = now;
      }
    } catch {}
  }
  return cachedGasPrice;
}

let currentNonce = null;
async function getNextNonce(wallet, provider) {
  if (currentNonce === null) {
    currentNonce = await provider.getTransactionCount(wallet.address, "pending");
  }
  return currentNonce++;
}
function resetNonce() {
  currentNonce = null;
}

// ══════════════════════════════════════════════════════════
//                          MAIN
// ══════════════════════════════════════════════════════════
async function main() {
  console.log("🤖 Starting Confidential DEX Keeper Bot v1 (Batch Mode)...");
  console.log("═══════════════════════════════════════════════════════");

  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 5042002, { staticNetwork: true });
  const pk = process.env.BOT_KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!pk) { console.error("❌ No private key found!"); process.exit(1); }

  const wallet = new ethers.Wallet(pk, provider);
  console.log(`🔑 Keeper: ${wallet.address}`);

  try {
    const bal = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(bal)} ARC`);
  } catch { }

  let TRADING_ADDRESS = "0x266C76800b5bdEd90c246AC60319831078fA28A4";
  try {
    const dpProxies1 = path.join(__dirname, "latest_deploy_proxies.json");
    const dpProxies2 = path.join(__dirname, "scripts/latest_deploy_proxies.json");
    const dp1 = path.join(__dirname, "latest_deploy.json");
    const dp2 = path.join(__dirname, "scripts/latest_deploy.json");
    const dp = fs.existsSync(dpProxies1) ? dpProxies1 : 
               fs.existsSync(dpProxies2) ? dpProxies2 : 
               fs.existsSync(dp1) ? dp1 : dp2;
    if (fs.existsSync(dp)) {
      TRADING_ADDRESS = JSON.parse(fs.readFileSync(dp, "utf8")).tradingAddress;
    }
  } catch { }
  console.log(`📈 Trading: ${TRADING_ADDRESS}`);

  let tradingAbi = [
    "function nextOrderId() view returns (uint256)",
    "function pendingOrders(uint256) view returns (bytes32 pairId, address trader, bool isLong, uint256 sizeUsd, uint256 collateral, uint256 leverage, uint256 triggerPrice, uint8 orderType, bool isActive, uint256 createdAt, uint256 positionId, uint256 feePaid, uint256 executionFee, uint256 tpPrice, uint256 slPrice, uint256 twapSlices, uint256 twapInterval, uint256 twapExecuted, uint256 twapLastExec)",
    "function executeOrder(uint256 orderId, bytes[] calldata updateData) payable",
    "function nextPositionId() view returns (uint256)",
    "function positions(uint256) view returns (bytes32 pairId, address trader, bool isLong, uint256 sizeUsd, uint256 collateral, uint256 entryPrice, uint256 leverage, uint256 liquidationPrice, uint256 openedAt, bool isOpen, uint256 tpPrice, uint256 slPrice, int256 entryFundingIndex, uint256 lastRolloverSettled)",
    "function liquidate(uint256 positionId, bytes[] calldata updateData) payable",
    "function executeTPSL(uint256 positionId, bytes[] calldata updateData) payable"
  ];

  try {
    const ap1 = path.join(__dirname, "artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json");
    const ap2 = path.join(__dirname, "../artifacts/src/ConfidentialTradingV1.sol/ConfidentialTradingV1.json");
    const ap = fs.existsSync(ap1) ? ap1 : ap2;
    if (fs.existsSync(ap)) {
      tradingAbi = JSON.parse(fs.readFileSync(ap, "utf8")).abi;
      console.log("✅ Full ABI loaded");
    }
  } catch { }

  const tradingContract = new ethers.Contract(TRADING_ADDRESS, tradingAbi, wallet);
  const tradingIface = tradingContract.interface;

  let useMulticall = false;
  let multicall;
  try {
    const mc3Code = await provider.getCode(MULTICALL3_ADDR);
    if (mc3Code && mc3Code !== '0x' && mc3Code.length > 10) {
      multicall = new ethers.Contract(MULTICALL3_ADDR, MULTICALL3_ABI, provider);
      useMulticall = true;
      console.log("✅ Multicall3 available — batch reads enabled");
    }
  } catch { }

  if (!useMulticall) {
    console.log("ℹ️  Multicall3 not found, using JSON-RPC batch fallback");
  }

  const PYTH_FEE = ethers.parseUnits("0.01", 18);

  // ──────────── State ────────────
  let lastKnownNextOrderId = 1;
  let lastKnownNextPosId = 1;
  let confirmedDone = new Set();
  let confirmedClosed = new Set();
  let failedOrders = new Map();
  let loopCount = 0;
  let isRunning = false;

  async function batchReadOrders(orderIds) {
    if (orderIds.length === 0) return new Map();

    const fnData = orderIds.map(id => tradingIface.encodeFunctionData('pendingOrders', [id]));
    let results;

    if (useMulticall) {
      const calls = fnData.map(data => ({
        target: TRADING_ADDRESS,
        allowFailure: true,
        callData: data
      }));
      try {
        const mcResults = await multicall.aggregate3.staticCall(calls);
        results = mcResults.map(r => r.success ? r.returnData : null);
      } catch (e) {
        const msg = e.message || '';
        if (isRpcRateLimitError(msg)) {
          console.log("[Multicall] Rate limited on orders, cooldown 6s...");
          await sleep(6000);
        } else {
          console.error("[Multicall] Error:", msg.slice(0, 80));
        }
        return new Map();
      }
    } else {
      const calls = fnData.map(data => ({ to: TRADING_ADDRESS, data }));
      try {
        results = await batchJsonRpc(rpcUrl, calls);
        await sleep(300);
      } catch (e) {
        const msg = e.message || '';
        if (isRpcRateLimitError(msg)) {
          console.log("[Batch RPC] Rate limited on orders, cooldown 6s...");
          await sleep(6000);
        } else {
          console.error("[Batch RPC] Error:", msg.slice(0, 80));
        }
        return new Map();
      }
    }

    const parsed = new Map();
    for (let i = 0; i < orderIds.length; i++) {
      const raw = results[i];
      if (!raw) continue;
      try {
        const decoded = tradingIface.decodeFunctionResult('pendingOrders', raw);
        parsed.set(orderIds[i], {
          pairId: decoded[0],
          trader: decoded[1],
          isLong: decoded[2],
          sizeUsd: decoded[3],
          collateral: decoded[4],
          leverage: decoded[5],
          triggerPrice: decoded[6],
          orderType: Number(decoded[7]),
          isActive: decoded[8],
          createdAt: Number(decoded[9]),
        });
      } catch { }
    }
    return parsed;
  }

  async function batchReadPositions(posIds) {
    if (posIds.length === 0) return new Map();

    const fnData = posIds.map(id => tradingIface.encodeFunctionData('positions', [id]));
    let results;

    if (useMulticall) {
      const calls = fnData.map(data => ({
        target: TRADING_ADDRESS,
        allowFailure: true,
        callData: data
      }));
      try {
        const mcResults = await multicall.aggregate3.staticCall(calls);
        results = mcResults.map(r => r.success ? r.returnData : null);
      } catch (e) {
        const msg = e.message || '';
        if (isRpcRateLimitError(msg)) {
          console.log("[Multicall Positions] Rate limited, cooldown 6s...");
          await sleep(6000);
        } else {
          console.error("[Multicall] Error:", msg.slice(0, 80));
        }
        return new Map();
      }
    } else {
      const calls = fnData.map(data => ({ to: TRADING_ADDRESS, data }));
      try {
        results = await batchJsonRpc(rpcUrl, calls);
        await sleep(300);
      } catch (e) {
        const msg = e.message || '';
        if (isRpcRateLimitError(msg)) {
          console.log("[Batch RPC Positions] Rate limited, cooldown 6s...");
          await sleep(6000);
        } else {
          console.error("[Batch RPC Positions] Error:", msg.slice(0, 80));
        }
        return new Map();
      }
    }

    const parsed = new Map();
    for (let i = 0; i < posIds.length; i++) {
      const raw = results[i];
      if (!raw) continue;
      try {
        const decoded = tradingIface.decodeFunctionResult('positions', raw);
        parsed.set(posIds[i], {
          pairId: decoded[0],
          trader: decoded[1],
          isLong: decoded[2],
          sizeUsd: decoded[3],
          collateral: decoded[4],
          entryPrice: decoded[5],
          leverage: decoded[6],
          liquidationPrice: decoded[7],
          openedAt: Number(decoded[8]),
          isOpen: decoded[9],
          tpPrice: decoded[10],
          slPrice: decoded[11],
          entryFundingIndex: decoded[12],
          lastRolloverSettled: Number(decoded[13]),
        });
      } catch { }
    }
    return parsed;
  }

  async function scanAndExecute() {
    if (isRunning) return;
    isRunning = true;
    loopCount++;

    try {
      let nextOrderId, nextPosId;
      try {
        nextOrderId = Number(await tradingContract.nextOrderId());
        await sleep(500);
        nextPosId = Number(await tradingContract.nextPositionId());
      } catch (e) {
        const reason = e.message || '';
        if (isRpcRateLimitError(reason)) {
          if (loopCount % 5 === 0) console.log(`[Cycle ${loopCount}] ⏳ RPC rate limited or busy, backing off 6s...`);
          await sleep(6000);
        } else {
          console.error(`[Sync Error] ${reason.slice(0, 100)}`);
        }
        isRunning = false;
        return;
      }

      if (nextOrderId > lastKnownNextOrderId) {
        console.log(`[Sync] New orders: ${lastKnownNextOrderId} → ${nextOrderId - 1}`);
        lastKnownNextOrderId = nextOrderId;
      }
      if (nextPosId > lastKnownNextPosId) {
        console.log(`[Sync] New positions: ${lastKnownNextPosId} → ${nextPosId - 1}`);
        lastKnownNextPosId = nextPosId;
      }

      const orderIdsToCheck = [];
      for (let i = 1; i < nextOrderId; i++) {
        if (!confirmedDone.has(i)) orderIdsToCheck.push(i);
      }

      if (orderIdsToCheck.length > 0) {
        await sleep(500);

        const CHUNK_SIZE = useMulticall ? 50 : 4;
        for (let chunk = 0; chunk < orderIdsToCheck.length; chunk += CHUNK_SIZE) {
          const chunkIds = orderIdsToCheck.slice(chunk, chunk + CHUNK_SIZE);
          const ordersMap = await batchReadOrders(chunkIds);

          const activeOrders = [];
          for (const [orderId, order] of ordersMap) {
            if (!order.isActive) {
              confirmedDone.add(orderId);
              failedOrders.delete(orderId);
              continue;
            }
            activeOrders.push({ orderId, ...order });
          }

          if (loopCount % 5 === 1) {
            console.log(`[Cycle ${loopCount}] Orders checked: ${chunkIds.length}, Active: ${activeOrders.length}, Done total: ${confirmedDone.size}`);
          }

          if (activeOrders.length > 0) {
            await sleep(1000);
          }

          for (const order of activeOrders) {
            const failCount = failedOrders.get(order.orderId) || 0;
            if (failCount >= 5 && loopCount % 30 !== 0) continue;

            const typeName = ORDER_TYPE_NAMES[order.orderType] || `T${order.orderType}`;
            const pythId = PAIR_ID_TO_PYTH[order.pairId];
            const pairName = PAIR_ID_TO_NAME[order.pairId] || '???';
            if (!pythId) continue;

            const updateData = await fetchPythVaa(pythId);
            if (updateData.length === 0) continue;

            try {
              await tradingContract.executeOrder.staticCall(order.orderId, updateData, { value: PYTH_FEE });
            } catch (simErr) {
              const reason = extractRevertReason(simErr);
              if (isRpcRateLimitError(reason)) {
                console.log(`[Rate Limit] Hit during sim of Order #${order.orderId} (${reason.slice(0, 40)}). Cooldown 4s...`);
                await sleep(4000);
                continue;
              }
              failedOrders.set(order.orderId, failCount + 1);
              if (reason.includes('Not active')) { confirmedDone.add(order.orderId); continue; }
              if (isExpected(reason)) continue;
              if (failCount === 0) console.error(`[Order #${order.orderId}] ${typeName} ${pairName} sim: ${reason}`);
              continue;
            }

            console.log(`[Order #${order.orderId}] ✅ ${typeName} ${pairName} — executing...`);
            await sleep(1500);

            try {
              const gp = await getCachedGasPrice(provider);
              const nonce = await getNextNonce(wallet, provider);
              const txReq = await tradingContract.executeOrder.populateTransaction(order.orderId, updateData, {
                value: PYTH_FEE,
                gasLimit: 1_000_000n,
                gasPrice: gp,
                nonce: nonce,
                chainId: 5042002
              });

              const signedTx = await wallet.signTransaction(txReq);
              const txHash = await provider.send('eth_sendRawTransaction', [signedTx]);
              console.log(`  🚀 Tx: ${txHash}`);
              const receipt = await waitReceipt(provider, txHash);
              if (receipt && receipt.status === 1) {
                console.log(`  ✅ Order #${order.orderId} EXECUTED! Gas: ${receipt.gasUsed}`);
                if (order.orderType !== 4) {
                  confirmedDone.add(order.orderId);
                }
                failedOrders.delete(order.orderId);
              } else if (receipt && receipt.status === 0) {
                console.error(`  ❌ Order #${order.orderId} tx reverted on-chain!`);
                failedOrders.set(order.orderId, failCount + 1);
              }
            } catch (txErr) {
              resetNonce();
              const reason = extractRevertReason(txErr);
              if (isRpcRateLimitError(reason)) {
                console.log(`  ⏳ Tx rate limited (${reason.slice(0, 40)}). Cooldown 4s...`);
                await sleep(4000);
                continue;
              }
              failedOrders.set(order.orderId, failCount + 1);
              console.error(`  ❌ Order #${order.orderId} tx failed: ${reason}`);
            }

            await sleep(500);
          }

          if (chunk + CHUNK_SIZE < orderIdsToCheck.length) await sleep(1000);
        }
      }

      if (loopCount % 3 === 0) {
        const posIdsToCheck = [];
        for (let i = 1; i < nextPosId; i++) {
          if (!confirmedClosed.has(i)) posIdsToCheck.push(i);
        }

        if (posIdsToCheck.length > 0) {
          await sleep(500);

          const CHUNK_SIZE = useMulticall ? 50 : 4;
          for (let chunk = 0; chunk < posIdsToCheck.length; chunk += CHUNK_SIZE) {
            const chunkIds = posIdsToCheck.slice(chunk, chunk + CHUNK_SIZE);
            const posMap = await batchReadPositions(chunkIds);

            for (const [posId, pos] of posMap) {
              if (!pos.isOpen) {
                confirmedClosed.add(posId);
                continue;
              }

              const pythId = PAIR_ID_TO_PYTH[pos.pairId];
              const pairName = PAIR_ID_TO_NAME[pos.pairId] || '???';
              if (!pythId) continue;

              const updateData = await fetchPythVaa(pythId);
              if (updateData.length === 0) continue;

              try {
                await tradingContract.liquidate.staticCall(posId, updateData, { value: PYTH_FEE });
                await sleep(1500);
                const gp = await getCachedGasPrice(provider);
                const nonce = await getNextNonce(wallet, provider);
                const txReq = await tradingContract.liquidate.populateTransaction(posId, updateData, {
                  value: PYTH_FEE, gasLimit: 1_000_000n, gasPrice: gp, nonce: nonce, chainId: 5042002
                });
                const signedTx = await wallet.signTransaction(txReq);
                const txHash = await provider.send('eth_sendRawTransaction', [signedTx]);
                console.log(`[Pos #${posId}] 💥 LIQ ${pairName} tx: ${txHash}`);
                const receipt = await waitReceipt(provider, txHash);
                if (receipt && receipt.status === 1) {
                  console.log(`[Pos #${posId}] ✅ LIQUIDATED!`);
                  confirmedClosed.add(posId);
                  continue;
                }
              } catch { resetNonce(); }

              if (pos.tpPrice > 0n || pos.slPrice > 0n) {
                try {
                  await tradingContract.executeTPSL.staticCall(posId, updateData, { value: PYTH_FEE });
                  await sleep(1500);
                  const gp = await getCachedGasPrice(provider);
                  const nonce = await getNextNonce(wallet, provider);
                  const txReq = await tradingContract.executeTPSL.populateTransaction(posId, updateData, {
                    value: PYTH_FEE, gasLimit: 1_000_000n, gasPrice: gp, nonce: nonce, chainId: 5042002
                  });
                  const signedTx = await wallet.signTransaction(txReq);
                  const txHash = await provider.send('eth_sendRawTransaction', [signedTx]);
                  console.log(`[Pos #${posId}] 🎯 TP/SL ${pairName} tx: ${txHash}`);
                  const receipt = await waitReceipt(provider, txHash);
                  if (receipt && receipt.status === 1) {
                    console.log(`[Pos #${posId}] ✅ TP/SL EXECUTED!`);
                    confirmedClosed.add(posId);
                  }
                } catch { resetNonce(); }
              }

              await sleep(300);
            }

            if (chunk + CHUNK_SIZE < posIdsToCheck.length) await sleep(1000);
          }
        }
      }

      if (loopCount % 30 === 1) {
        try {
          await sleep(500);
          const bal = await provider.getBalance(wallet.address);
          console.log(`[Cycle ${loopCount}] 💰 Balance: ${Number(ethers.formatEther(bal)).toFixed(4)} ARC | Done: ${confirmedDone.size} orders, ${confirmedClosed.size} positions`);
        } catch { }
      }

    } catch (err) {
      console.error("[Loop Error]", err.message?.slice(0, 150));
    } finally {
      isRunning = false;
    }
  }

  const INTERVAL = 4000;
  console.log(`🟢 Bot v1 running. Polling every ${INTERVAL / 1000}s...\n`);
  setInterval(scanAndExecute, INTERVAL);
  scanAndExecute();
}

main().catch(console.error);
```
</details>

### 3. Environment & Configuration Setup

Create a `.env` file inside your `contracts/` folder and insert your Keeper Wallet's private key along with the Arc Testnet RPC URL:

```bash
# contracts/.env
BOT_KEEPER_PRIVATE_KEY=your_private_key_here
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
```

::: warning Private Key Security & Wallet Isolation
Never commit your `.env` file to public repositories or share your private key. Always use a dedicated, isolated wallet specifically loaded with ARC testnet tokens solely for Keeper bot operations.
:::

### 4. Install Dependencies & Launch

Navigate into your `contracts` directory and install required Node.js libraries:

```bash
cd contracts
npm install ethers dotenv node-fetch
```

To run the bot directly in your terminal:

```bash
node feederBot.cjs
```

If you prefer to keep it running in the background persistently on a VPS, use PM2:

```bash
npm install -g pm2
pm2 start feederBot.cjs --name "KeeperBot"
pm2 logs KeeperBot
```

### 4. Monitor Your Earnings
Once running, the bot will output logs every 2.5 seconds. Whenever it successfully executes an order or a liquidation, you will see a success message in the console, and the **Execution Fee** or **Liquidation Reward** will be automatically deposited directly into your Keeper Wallet address!
