const { ethers } = require("ethers");
const fs = require("fs");
const deploy = JSON.parse(fs.readFileSync("scripts/latest_deploy_proxies.json"));
const abi = ["function pairs(bytes32) view returns (bytes32,bytes32,uint256,uint256,uint256,uint256,bool)"];
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
const core = new ethers.Contract(deploy.coreAddress, abi, provider);
const pairId = ethers.keccak256(ethers.toUtf8Bytes("BTC/USDC"));
core.pairs(pairId).then(p => {
  console.log("BTC/USDC active:", p[6]);
  console.log("maxLev:", p[2].toString());
});
