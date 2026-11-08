# Stable Acres: Arc testnet edition

Scope approved on 2026-11-08: preserve the existing farm and build a separate Arc testnet edition using Arc Studio CLI. The Solana production release remains on main.

## First version

- Existing painted farm, seven lessons, orders, animals and weather.
- EVM wallet connection, Arc testnet chain check and a single native USDC balance (18 decimals; native and ERC-20 are the same underlying balance).
- All crop APYs and farm rewards are visibly simulated. No Solana protocol rate is presented as Arc yield. No verified Arc yield integration is claimed.
- Optional onchain study badges, one per lesson per wallet, on Arc testnet only. These are self-reported commemorative records, not verified qualifications, tradable assets or financial rewards. The client offers claims after its local quiz is complete; the contract does not pretend to prove the quiz was taken.
- Wallet claims are explicit user actions, with test-USDC gas explained, verified receipt/state and explorer links. Rejection, wrong-chain, disconnection, replacement account and failed receipts must never produce a false claimed state.
- No deposits, ERC-20 approvals, transfers, private keys or mainnet deployment. The badge method sends zero value. Test USDC has no cash value.

## Contract interface for Arc Studio

Name: StableAcresStudyBadges. Solidity, no external dependencies, no owner/admin/upgrade path, no token transfers or payable entry points.

- `claimBadge(uint8 lessonId)` — only IDs 1..7, exactly one claim per sender and lesson. Revert on invalid ID or duplicate. Records only msg.sender; no arbitrary-recipient method.
- `claimedMask(address account) external view returns (uint256)` — bits 0..6 correspond to lesson IDs 1..7.
- `hasBadge(address account, uint8 lessonId) external view returns (bool)` — IDs validated identically.
- `event BadgeClaimed(address indexed account, uint8 indexed lessonId)`.
- Named custom errors for invalid lesson and duplicate claim.

Test invalid IDs including 0, 8, 255; every valid bit; two separate wallets; duplicate rejection; no unintended clearing/other-wallet mutation; rejected nonzero-value call. Compile and test locally in Studio before deploying on chain ID 5042002. Return verified deployed runtime bytecode hash, compiler version/settings, ABI, selectors, test logs, deployment transaction, contract address and correct explorer URL. Never interact with mainnet or a user wallet.

## Network sources

Official Arc network reference: https://docs.arc.io/arc/references/connect-to-arc

Arc testnet: chain ID 5042002; RPC https://rpc.testnet.arc.io; explorer https://explorer.testnet.arc.io; native USDC, 18 decimals. The client must verify the RPC chain ID before trusting contract reads. Confirm the deployed contract bytecode independently after the Studio result.
