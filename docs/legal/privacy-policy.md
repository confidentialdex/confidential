# Privacy Policy

**Last Updated: July 27, 2026**

This Privacy Policy explains how Confidential DEX ("we", "us", or "our") collects, uses, and discloses your information when you access or use our decentralized application (dApp), website, and related services (collectively, the "Services"). 

By accessing or using the Services, you signify that you have read, understood, and agree to our collection, storage, use, and disclosure of your information as described in this Privacy Policy.

---

## 1. Information We Do Not Collect
As a non-custodial and decentralized protocol, we prioritize your privacy by default. We do **NOT** collect or store the following information:
- **Personally Identifiable Information (PII):** We do not require or collect your name, email address, physical address, phone number, or government-issued identification.
- **Private Keys & Seed Phrases:** We never ask for, collect, or have access to your wallet's private keys or seed phrases. You maintain full custody and control over your digital assets at all times.
- **Financial Information:** We do not collect credit card numbers, bank account details, or traditional fiat financial data.
- **Trading History (Off-Chain):** We do not maintain off-chain databases of your trading activity. All trade records exist exclusively on the Arc Network blockchain.

## 2. Information We Automatically Collect
When you interact with our Services, certain technical data may be collected automatically by the network or third-party infrastructure providers:

- **Blockchain Data:** Due to the public nature of blockchains (such as the Arc Network), your wallet address, transaction history, token balances, and smart contract interactions are publicly visible and permanently recorded on the blockchain. This data is not controlled or stored directly by us.
- **Subgraph Indexing (Goldsky):** Our platform uses Goldsky GraphQL subgraphs to index on-chain events (such as order placements, position openings, and vault deposits) for frontend display purposes. This data is a read-only mirror of publicly available blockchain data and does not include any private or off-chain information.
- **Oracle Data (Pyth Network):** Price feeds from the Pyth Network are consumed in real-time for trade execution. We do not store Oracle data beyond what is recorded on-chain during transaction execution.
- **Technical Log Data:** Our frontend hosting provider may temporarily log standard technical information, such as your IP address, browser type, operating system, and timestamp of access. We use this data solely to monitor platform health, prevent DDoS attacks, and improve the user experience.

## 3. How We Use Information
Any non-personally identifiable technical information we collect is used strictly for the following purposes:
- To provide, maintain, and improve the performance of the dApp.
- To detect, prevent, and address technical issues or malicious activities (e.g., botting, spamming, or exploitation).
- To optimize the user interface and understand broad, aggregated user demographics and behavior.

## 4. Third-Party Services
Our Services integrate or interact with the following third-party tools, each governed by their own privacy policies:

| Service | Purpose | Data Accessed |
| :--- | :--- | :--- |
| **Pyth Network** | Real-time price oracle feeds | Public price data only |
| **Goldsky** | Subgraph indexing of on-chain events | Public blockchain data only |
| **Web3 Wallet Providers** (MetaMask, etc.) | Wallet connection and transaction signing | Wallet address (public key) only |
| **Arc Network RPC Nodes** | Blockchain read/write operations | Transaction data (public) |

We are not responsible for the privacy practices or the content of these third-party platforms.

## 5. Cookies & Local Storage
Our frontend application uses browser **Local Storage** (not cookies) to persist user preferences such as selected trading pairs, watchlists, UI timeframes, and mock wallet balances. This data is stored entirely on your device and is never transmitted to our servers.

## 6. Security
We implement commercially reasonable security measures to protect the limited technical data we collect. Our smart contracts incorporate multiple layers of on-chain security including anti-reentrancy guards, anti-flash-loan cooldowns, oracle confidence checks, and 2-step ownership transfer mechanisms. However, no internet or blockchain transmission is entirely secure. You are solely responsible for maintaining the security of your Web3 wallet, private keys, and passwords.

## 7. Children's Privacy
Our Services are not directed to individuals under the age of 18. We do not knowingly collect any data from children. If you become aware that a child has provided us with personal data, please cease their use of the platform immediately.

## 8. Data Retention
Since we do not collect personal data, there is no personal data to retain or delete. On-chain data (transaction history, positions, vault deposits) is permanent and immutable by the nature of blockchain technology and cannot be modified or deleted by us or anyone.

## 9. Changes to This Policy
We reserve the right to update or modify this Privacy Policy at any time. Any changes will be reflected on this page with an updated "Last Updated" date. Continued use of the Services after changes have been made constitutes your acceptance of the revised Privacy Policy.

---

*For inquiries or concerns regarding this Privacy Policy, please engage with our community developers via our official GitHub repository at [confidentialdex/confidential](https://github.com/confidentialdex/confidential) or our community channels.*
