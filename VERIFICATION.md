# Verification — 2026-11-07

## Automated

`node --test tests/game.test.mjs`: **8 tests passed**, zero failures. Uses isolated VM state and Node built-ins only; no game debug hooks are installed.

- Exact USDC reserve/mints, decimal-to-percent conversion, Meteora percentage preservation, Jito latest daily point and valid zero rates.
- Demo makes no rate requests; failed reads remain demo; expired live data reverts to fixed demo placeholders.
- Plant two wheat → mature → harvest to inventory → deliver order → replace order → consume exactly one 1.25× boost; duplicate delivery cannot pay twice; save reload preserves state.
- Lesson 3 unlocks Carrot; lesson 5 plus the existing level unlocks Pumpkin; repeated correct answers cannot repay.
- Rain gives exactly 10% faster growth and integrates correctly over a weather boundary.
- Wallet accounts are summed using integer USDC units; only `getTokenAccountsByOwner` is sent; zero, RPC failure and disconnect states are handled.
- Ready animal produce collects once and can be sold; all villager waypoints lie on painted paths.
- Simulated Phantom rejection resets the Connect button without any RPC call; a successful read and account disconnect update the separate wallet line.

`node --check public/cozy/game.js`, `rates.js`, `demo.js` and `capture-demo.mjs`: syntax checked.

## Real read-only endpoints

All four official rate endpoints returned HTTP 200 with usable browser CORS on 2026-11-07. Exact endpoints and field conversions are recorded in `public/cozy/rates.js`; full normalized cache records are in `apys.json`.

| Source | Verified response shape | Example at verification |
| --- | --- | --- |
| Kamino main market | Array; exact USDC reserve `D6q6…J59`; `supplyApy` decimal string | ~3.865% APY |
| Meteora SOL–USDC | Exact `address`, canonical token X/Y mints, `apy` numeric percentage | ~86.976% APY, based on 24h fees; highly variable |
| JitoSOL | `apy: [{data, date}]`; latest date; `data` decimal fraction | ~4.939% APY |
| Meteora USDC–USDT | Exact `address`, canonical token X/Y mints, `apy` numeric percentage | ~0.274% APY |

These are observations, not promised returns or fixed future values.

The actual `readUSDC` function was extracted into an isolated temporary Node evaluation and called against public mainnet owner `5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6`. It returned **1062674.44 USDC** at the later check. An earlier raw RPC call returned two USDC token accounts, proving the parser must sum all accounts. This is a public pool account, not the owner's wallet. No private keys, wallet signature, fund movement or persistent debug hook were used.

Vibe Station returned HTTP 200 and CORS `*`. Foundation mainnet returned 403 here; PublicNode required a personal token for indexed reads; dRPC required a paid plan. The latter two are not shipped as fallbacks.

## Interactive browser checks

In-app browser on the local static build:

- Loaded all four rates with `Live` and freshness labels in Vault; crop bubble linked the official source.
- Completed the LP lesson, observed Carrot unlock and one Study Star; repeated the answer and observed no extra coins.
- Planted two wheat through actual canvas clicks, harvested both, delivered Mara's order for 34 coins and XP, and observed the next wheat bubble showing `× 1.25 order boost`.
- Clicked **What's this?** on wheat and saw the lending lesson.
- Audio decoded successfully after a gesture; music off and volume 0 persisted through reload. Controls restored to music on / 45%; full credits visible. Browser console check was empty. Physical listening/iOS interruption behavior was not independently verified.
- No-Phantom state visibly showed `Phantom not found · demo play available`.
- Phone-sized rain view showed streaks, tint, and the `Rain · +10% growth` chip.

Headless screenshot matrix (`node scripts/snapshot-ui.mjs`): 1280×720, 390×844 and 647×764. Captured farm, Orders and LP lesson at each size plus rain. HUD/navigation bounds and document overflow checks passed; zero JavaScript exceptions. External HTTPS requests were blocked during these screenshots to exercise the cache path. Screenshots and bounds report are ignored under `.impeccable/review/screenshots/`.

The first sandboxed preview later stopped responding; checks resumed using an elevated loopback-only server. The first sandboxed recorder could not connect to Chrome; rerunning with the local browser permission succeeded. These were execution-environment limits, not application errors.

Independent finish review: **ship** for all ten captures and sampled UI source, with no material findings. `DESIGN-NOTES.md` records preserved visual decisions and the exact evidence reviewed. Tiny metadata and incomplete canvas accessibility remain documented limitations; the existing same-hue button lips were deliberately preserved.

## Recording

`node capture-demo.mjs`: **completed at 40.1 seconds**, 60 fps, 1920×1080 H.264 MP4, zero captured console errors. Output: `out/stable-acres-demo.mp4`. The recorder also saved the README screenshot at 12 seconds. Demo uses local assets/fonts, seeded randomness, fixed demo rates, a fixed virtual-clock origin and silent audio.

## Not verified / deferred

- Real Phantom extension approval/rejection/account switching and physical mobile audio.
- Broad device/performance/accessibility testing or financial/security audit.
- Cow art and milk production: image generation reached its usage limit, so this feature was not shipped.
- GitHub/Vercel publishing and live-host console: owner requested local completion and publication later.

See `LIMITATIONS.md` for why each gap matters, fixes with effort estimates, and ranked jam/product improvements.
