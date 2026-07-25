const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting Proxy Deployment of Confidential DEX V1 on ARC Testnet");
    console.log("═══════════════════════════════════════════════════════");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from account: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ARC`);

    const usdcAddress = '0x3600000000000000000000000000000000000000';
    const pythContractAddress = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729'; 

    console.log("\n1️⃣  Deploying PythPriceOracle Proxy...");
    const OracleFactory = await ethers.getContractFactory("PythPriceOracle");
    const oracle = await upgrades.deployProxy(OracleFactory, [pythContractAddress], { initializer: 'initialize' });
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log(`✅ Oracle Proxy deployed to: ${oracleAddress}`);

    console.log("\n2️⃣  Deploying ConfidentialCoreV1 Proxy...");
    const CoreFactory = await ethers.getContractFactory("ConfidentialCoreV1");
    const core = await upgrades.deployProxy(CoreFactory, [usdcAddress, oracleAddress], { initializer: 'initialize' });
    await core.waitForDeployment();
    const coreAddress = await core.getAddress();
    console.log(`✅ ConfidentialCore Proxy deployed to: ${coreAddress}`);

    console.log("\n3️⃣  Deploying ConfidentialVaultV1 Proxy...");
    const VaultFactory = await ethers.getContractFactory("ConfidentialVaultV1");
    const vault = await upgrades.deployProxy(VaultFactory, [usdcAddress, coreAddress, deployer.address], { initializer: 'initialize' });
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✅ ConfidentialVault Proxy deployed to: ${vaultAddress}`);

    console.log("\n4️⃣  Deploying ConfidentialTradingV1 Proxy...");
    const TradingFactory = await ethers.getContractFactory("ConfidentialTradingV1");
    const trading = await upgrades.deployProxy(TradingFactory, [usdcAddress, coreAddress, vaultAddress, oracleAddress], { initializer: 'initialize' });
    await trading.waitForDeployment();
    const tradingAddress = await trading.getAddress();
    console.log(`✅ ConfidentialTrading Proxy deployed to: ${tradingAddress}`);

    console.log("\n5️⃣  Linking Core ↔ Vault ↔ Trading...");
    
    let tx = await vault.setTrading(tradingAddress);
    await tx.wait();
    console.log("   ✅ Vault → Trading linked");

    tx = await core.setVault(vaultAddress);
    await tx.wait();
    console.log("   ✅ Core → Vault linked");

    tx = await core.setTrading(tradingAddress);
    await tx.wait();
    console.log("   ✅ Core → Trading linked");

    tx = await core.setTreasury(deployer.address);
    await tx.wait();
    console.log("   ✅ Core → Treasury linked (deployer)");

    tx = await core.setKeeper(deployer.address);
    await tx.wait();
    console.log("   ✅ Core → Keeper registered (deployer)");

    const deployInfo = {
      version: "V1_PROXY",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      coreAddress,
      vaultAddress,
      tradingAddress,
      oracleAddress,
      usdcAddress
    };
    
    fs.writeFileSync(path.join(__dirname, 'latest_deploy_proxies.json'), JSON.stringify(deployInfo, null, 2));

    console.log("\n🎉 DEPLOYMENT V1 (PROXY) COMPLETE!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
