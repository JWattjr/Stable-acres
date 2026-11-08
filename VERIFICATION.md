# Arc edition verification

2026-11-08. Separate arc-edition worktree; the original Solana main/production is unchanged.

## Contract evidence

- [Contract on Arc testnet](https://explorer.testnet.arc.io/address/0xc8658f2451928d02ae42f8d113e37d6c4c673853)
- [Deployment transaction](https://explorer.testnet.arc.io/tx/0xb8936b9aceb5959a559d974ca8f84e1b9590b143debe817cbfe7e0633bdecc18)
- [Arc Studio workspace](https://studio.arc.io/app/64b0aeab-08e0-4ded-ba95-fe70d83bb956)

Arc Studio CLI 1.2.2 generated, tested and deployed StableAcresStudyBadges. Official RPC verified chain ID 5042002, successful deployment receipt and 673 bytes of runtime code. Explorer returned HTTP 200 with the exact address.

Independent local solc 0.8.28 compilation with matching optimizer/EVM/metadata/remapping settings matched deployed runtime byte-for-byte. Keccak256: 0x3111bf25f2d5c2144d7fa4257ae2c5f52c0385b88492f7303edbcf134391f4a6. Selectors and event topic match. Evidence: contracts/evidence/independent-verification.json.

Read-only eth_call simulations verified valid zero-value claim behavior, invalid IDs 0/8/255 reverting and nonzero value reverting. They changed no state. Studio's retained Foundry output reports **46 passing tests**, including fuzz tests, independent accounts, every bit, duplicates, invalid IDs, indexed events and nonpayable behavior. These ran in Studio, not a local Foundry installation.

## Client and game

`node --test tests/*.test.mjs`: **16 passed**. Coverage: native-USDC 18-decimal integer formatting; connection-only reads; wrong wallet/RPC chain; bytecode mismatch; exact receipt/transaction/event/state checks; rejection/revert; duplicate/unfinished-lesson prevention; pending timeout/resubmission lock; stale account reads/disconnected connections; farming/orders/boosts; quiz gates; weather integration and animal produce. Syntax checks pass.

All crop rates are labelled demo examples. Solana live-rate/cache and wallet integrations were removed from this edition. Normal farming and deterministic recording make no APY or wallet requests. No runtime npm dependency/framework/app build was introduced.

## Browser and recording

Isolated headless Chrome captured farm, Orders, Learn and rain at 1280×720, 390×844 and 647×764. Bounds fit without document overflow; no captured JavaScript exceptions. Additional visible Learn-panel captures under .impeccable/review/badges/ show ready and cancelled controls at each size.

The badge fixture injected a read-only/rejecting EVM test provider for public address 0x1111111111111111111111111111111111111111. This is **not the builder's wallet** and does not establish ownership. Actual RPC reads checked test-USDC balance, exact contract code and mask. The fixture rejected transaction requests and sent no transaction. Cancellation retained 0/7 recorded and an available retry.

`out/stable-acres-arc-demo.mp4`: **41.0 seconds**, 1920×1080, 12 fps, full deterministic demo complete with no console errors. README screenshot refreshed at 12 seconds. This is a functional capture, not a 60 fps performance benchmark.

Fresh scoped visual review: **SHIP**, all 13 required captures, both reports and relevant source inspected. No material findings. Inherited small metadata/button lips retained under the existing brief. This is not a contract audit, external-wallet signature, physical-device or full accessibility certification.

## Remaining signed-claim check

Studio's faucet refused funding a disposable sandbox test wallet: “Faucet drip requires the DEVELOPER_ADMIN_DEFAULT_ROLE on at least one available entity for this user.” Studio reported stopping before any claim broadcast; no claim hash or smoke artifact exists. No role/permission was changed. Funded external-wallet signing, wallet-native fees, replacement transactions and physical-mobile audio remain unverified. No real-money deposits/approvals/transfers or mainnet actions exist.
