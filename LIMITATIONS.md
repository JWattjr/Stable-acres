# Arc edition limitations

2026-11-08. Separate Arc testnet learning prototype; the Solana release remains on main. Effort: S = hours to two days; M = several days; L = weeks or external review.

| Limitation | Why it matters | Next step / effort |
| --- | --- | --- |
| All farm APYs, balances and rewards are simulated. No Arc yield integration exists. | Crop earnings cannot be deposited, withdrawn or treated as investment returns. | Verify an Arc protocol and design a separate integration with explicit failure/withdrawal flows. L. |
| One second represents one simulated yield day; boosts are fictional and earnings cap. | These numbers do not predict real returns. | Add a realistic-clock learning mode. S–M. |
| Badges are self-reported. Local quiz completion is only a UI gate. | Records are not proof of knowledge, identity, attendance or prize eligibility. Wallets can call the contract directly. | Keep commemorative status; design issuer attestations if verified credentials are needed. M. |
| Studio faucet funding required an unavailable developer-admin role. No signed smoke claim was broadcast. | External-wallet signing, actual fee display and a live claim receipt still need testing. | Obtain test USDC through an authorized faucet and explicitly record a badge in the app. S. |
| Wallet integration uses an injected EVM provider; no wallet picker or WalletConnect. | Some mobile browsers lack a provider; multi-wallet selection is limited. | Test real desktop/mobile wallets and add deliberate selection if needed. M. |
| Pending submitted claims are tracked in memory; confirmed records are reread from chain. | Reloading loses a pending hash view. Check the explorer before resubmitting. | Persist/reconcile pending hashes by chain, contract and account. S. |
| Registry has no owner, upgrades or revocation. | A self-report cannot be removed; future versions need a new deployment. | Define migration/revocation only if the product needs it. M. |
| Tests and exact bytecode matching are not an independent audit. | Valuable rewards or fund custody would need stronger review. | Obtain independent review before adding value-bearing features. L. |
| Public RPC receives connected public addresses and may fail/rate-limit. | Balance/badge reads can become unavailable. | Add monitored read-only fallbacks while preserving fail-closed network/code checks. M. |
| localStorage saves can be edited or cleared; no cloud save/anti-cheat. | Progress is not recoverable across devices and cannot justify valuable rewards. | Add versioned export, then authenticated sync/authoritative rules. M–L. |
| One slab, four crops, seven lessons and scripted villagers limit depth; no cow/milk or multiplayer. | Long-term progression remains shallow. | Playtest economy and expand authored content/art. M–L. |
| Small inherited metadata, canvas-only farming, incomplete reduced motion and no pinch zoom. | Accessibility and physical-phone performance remain incomplete. | Add keyboard semantics, type options, touch zoom and device profiling. M–L. |
| Supplied art has mixed source history; generated vehicle/audio provenance is documented. | Production distribution needs a complete rights review. | Verify original assets and retain licence/attribution records. M. |

Highest-impact next steps: funded testnet claim, real-wallet/device tests, save recovery, economy/progression playtests, and a clearly separate verified Arc yield learning integration. Keep the Solana jam entry independent until its network rules are confirmed.
