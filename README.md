# Stable Acres · Arc testnet edition

A cozy farm for learning about stablecoins, with optional onchain study badges on Arc testnet.

![Stable Acres](public/cozy/screenshot.jpg)

This edition lives on the `arc-edition` branch. The [Solana release](https://stable-acres.vercel.app/) remains separate on `main`.

## Play

Plant Wheat from Seeds, harvest into your basket, fulfil Orders and expand through Shop. Complete seven lessons to earn local Study Stars and unlock crops. Hens give eggs, sheep give wool, and weather, villagers, cars, butterflies and clouds bring the farm to life.

All crop APYs, farm USDC, stakes and rewards are demo examples. There is no live Arc yield integration, deposit, withdrawal or cash-out. Rain changes crop growth only. Lesson 5 teaches USDC gas on Arc. Saves are local to this edition.

Farming works without a wallet. To use optional badges:

1. Connect an injected EVM wallet; explicitly switch to Arc testnet if prompted.
2. Complete a lesson, then open **Learn → Arc study badges**.
3. **Record badge** requests a zero-value transaction. Your wallet shows the test-USDC network fee before confirmation. Test USDC has no cash value.
4. The game verifies the receipt, exact transaction, event and recorded mask. Pending claims have an explorer link and refresh control. Cancellation gives no badge or farm reward.

Badges are self-reported commemorative records, not verified qualifications or transferable tokens. Local quizzes gate the UI; the contract cannot prove they were taken. One claim per lesson per wallet is enforced onchain.

## Run and test

No frontend framework, runtime npm dependencies or application build:

```powershell
python -m http.server 8766 --bind 127.0.0.1 --directory public/cozy
node --test tests/*.test.mjs
```

Open http://127.0.0.1:8766/index.html. Add `?t=day`, `?t=night` or `?weather=rain` for visual checks. `?demo&t=day` runs the deterministic recording without saves, wallets or network data.

```powershell
$env:CAPTURE_URL='http://127.0.0.1:8766/index.html?demo&t=day'
node capture-demo.mjs out/stable-acres-arc-demo.mp4
```

Set `CHROME_PATH` and `FFMPEG_PATH` outside this workspace. Output is ignored under out/.

## Arc contract and evidence

- [Arc testnet contract](https://explorer.testnet.arc.io/address/0xc8658f2451928d02ae42f8d113e37d6c4c673853)
- [Deployment transaction](https://explorer.testnet.arc.io/tx/0xb8936b9aceb5959a559d974ca8f84e1b9590b143debe817cbfe7e0633bdecc18)
- [Arc Studio workspace](https://studio.arc.io/app/64b0aeab-08e0-4ded-ba95-fe70d83bb956)
- [Contract source](contracts/StableAcresStudyBadges.sol), [public ABI/runtime configuration](public/cozy/arc-deployment.json), [independent verification](contracts/evidence/independent-verification.json), [Studio test output](contracts/evidence/studio-test-output.txt).

Official [network settings](https://docs.arc.io/arc/references/connect-to-arc): chain ID **5042002**, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`, native USDC with **18 decimals**. Native and ERC-20 USDC are the same balance, displayed once. The client verifies wallet/RPC network identity and exact pinned contract code. It never requests token approvals or mainnet transactions.

Arc Studio CLI 1.2.2 generated, tested and deployed the contract. Studio reports 46 passing Foundry tests. Independent local solc 0.8.28 compilation exactly matches deployed bytecode, including metadata. Reproduce read-only verification with developer-only tooling:

```powershell
npm install --prefix out/contract-tools --no-save --package-lock=false solc@0.8.28
node scripts/verify-arc-deployment.mjs
```

A real signed claim remains unverified: Studio's faucet refused test-wallet funding because its account requires DEVELOPER_ADMIN_DEFAULT_ROLE. No smoke-test claim was broadcast. Browser checks used real testnet reads through an isolated read-only/rejecting test provider. See [VERIFICATION.md](VERIFICATION.md).

## Credits and scope

[Credits](public/cozy/CREDITS.md), [vehicle provenance](public/cozy/VEHICLE-ART.md) and [audio sources](public/cozy/audio-sources.json) are retained. Project AI credits: Claude, Codex, ChatGPT/GPT-Image and Gemini. This adaptation used Codex and Arc Studio CLI; painted vehicles were generated earlier in Gemini.

See [ARC-EDITION.md](ARC-EDITION.md), [LIMITATIONS.md](LIMITATIONS.md) and [contracts/README.md](contracts/README.md). This is a testnet learning prototype; the checks are not an independent security audit.
