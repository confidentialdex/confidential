# Terms of Service

**Last Updated: July 27, 2026**

Please read these Terms of Service ("Terms") carefully before using the Confidential DEX decentralized application, smart contracts, website, and associated software (collectively, the "Protocol" or "Services"). 

By accessing, connecting your wallet, or using any part of the Protocol, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Protocol.

---

## 1. Nature of the Protocol
Confidential DEX is a decentralized, non-custodial protocol operating via smart contracts on the Arc Network blockchain. 
- **Non-Custodial:** We do not hold, control, or manage your digital assets. All transactions are executed directly between the trader and the Protocol's on-chain Liquidity Vault (Direct-to-Vault execution model) through self-executing smart contracts.
- **No Intermediaries:** You interact directly with the blockchain. We do not act as your broker, intermediary, agent, or advisor.

## 2. Eligibility & Restrictions
By using the Protocol, you represent and warrant that:
1. You are at least 18 years of age and of legal capacity to form a binding contract.
2. You are not a citizen, resident, or entity located in a jurisdiction where the use of the Protocol or trading in cryptographic assets is prohibited by law (including comprehensively sanctioned countries).
3. You are not listed on any sanctions lists (e.g., the U.S. Treasury Department's Specially Designated Nationals List).

## 3. Assumption of Risk
Trading digital assets and utilizing leveraged perpetual contracts involves substantial risk. You acknowledge and accept that:
- **Smart Contract Risk:** While our contracts are battle-tested and include anti-exploit mechanisms (anti-reentrancy, anti-flash-loan cooldowns, oracle confidence checks), blockchain software can contain bugs or vulnerabilities. You use the Protocol at your own risk.
- **Liquidation Risk:** Due to the nature of leveraged trading (up to 100x for major assets), volatile market movements can result in the total loss of your collateral through forced liquidation at 90% loss of margin.
- **Market Risk:** Digital asset prices are highly volatile. We are not responsible for any financial losses incurred due to market fluctuations, Oracle delays, or price impacts resulting from our Quadratic Impact algorithm.
- **Auto-Deleveraging (ADL) Risk:** In extreme market conditions where Vault utilization exceeds 95%, the Protocol may forcibly close profitable positions to protect Vault solvency. This is an automated on-chain mechanism over which we have no manual control.
- **No Guarantees:** Past performance of Vault yields (Degen/Prime) does not guarantee future returns. The Degen Vault carries a "Proportional Shared-Loss and Overflow" risk up to the total capital invested, protecting the Prime Vault floor. The Degen Vault can be depleted to $0 (triggering an Epoch Reset).

## 4. Fee Structure & Disclosure
The Protocol charges the following fees, all of which are transparently enforced on-chain:
- **Market Order Fee:** 0.05% (5 basis points) of position notional value.
- **Limit Order Fee:** 0.03% (3 basis points) of position notional value.
- **Fee Distribution:** 70% of trading fees are allocated to Vault Liquidity Providers, 30% to the Protocol Treasury.
- **Contrarian Fee Rebate:** Traders who open positions on the minority side (helping to balance Long/Short OI skew) receive a 25% discount on their entire trading fee.
- **Execution Fee:** A small flat fee in native ARC tokens to compensate Keeper Bots for on-chain execution gas costs.
- **Borrow Fee:** 0% — eliminated entirely. Carrying costs are managed through a Dynamic Skew-Based P2P Funding Rate.
- **Price Impact Penalty:** Up to 2% maximum, calculated quadratically based on position size relative to maximum open interest per pair.

## 5. User Responsibilities
- You are entirely responsible for the security of your Web3 wallet, private keys, and passwords. 
- You are responsible for paying all blockchain gas fees and applicable protocol fees associated with your transactions.
- You agree not to engage in any activity that attempts to exploit, manipulate, or degrade the performance of the Protocol (e.g., sybil attacks, front-running bots bypassing standard execution, or spamming the Keeper network).

## 6. Intellectual Property
The Confidential DEX frontend interface, logos, documentation, and original graphics are the intellectual property of the developers. The underlying Smart Contracts and Keeper Bot scripts are open-source and released under the MIT License, allowing public review and community contribution.

## 7. Limitation of Liability
To the maximum extent permitted by applicable law, in no event shall the developers, contributors, or affiliates of Confidential DEX be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, digital assets, or use, arising out of or in any way connected with your use or inability to use the Protocol. 

**THE PROTOCOL IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.**

## 8. Governing Law
As a decentralized protocol deployed on a borderless blockchain network, these Terms are not governed by the laws of any single jurisdiction. Any disputes arising from your use of the Protocol must be resolved through community governance or individual responsibility, as there is no central corporate entity to sue or be sued.

## 9. Amendments
We reserve the right to update these Terms at any time without prior individual notice. The updated Terms will be posted on this page. Your continued use of the Protocol constitutes acceptance of any updated Terms.
