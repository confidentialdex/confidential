// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract DEXProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address initialOwner, bytes memory _data) payable TransparentUpgradeableProxy(_logic, initialOwner, _data) {}
}

contract DEXProxyAdmin is ProxyAdmin {
    constructor(address initialOwner) ProxyAdmin(initialOwner) {}
}
