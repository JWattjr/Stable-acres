# Stable Acres: honest prototype limitations

Status: local read-only prototype, 2026-11-07. Publishing was explicitly deferred by the owner. Effort: **S** = roughly 0.5–2 days; **M** = roughly 3–10 days; **L** = multiple weeks or external review. Estimates are directional, not commitments.

## Yield and wallet safety

| Limitation | Why it matters | Suggested fix / effort |
| --- | --- | --- |
| Live rates are snapshots from official public APIs, not an on-chain return calculation. Cached entries are allowed for 24 hours; failures become visibly labelled demo rates. | Judges and players must distinguish protocol data from forecasts. API data and CORS can change. | Add historical rate charts, monitored schema checks and a service with explicit uptime/freshness guarantees. **M** |
| Kamino uses exact main-market USDC supply APY; Meteora uses specific SOL–USDC and USDC–USDT pools and 24h fee APY; Jito uses its latest daily APY. These have different calculation windows and risks. | A single average hides differences. DLMM out-of-range positions may earn no fees; recent fee APY is not a personal return. | Show comparable periods and position-specific ranges/fees; remove the simple average when real positions exist. **M** |
| The farm clock is accelerated: 1 real second = 1 day of simulated yield, even outside scripted demo mode. Earnings use a simple estimate, freeze the rate at planting, and cap at three grow cycles. Order boosts are entirely fictional. | Demo earnings must not be mistaken for achievable USDC payouts. APY compounding is not simulated. | Offer a realistic-clock learning mode with explicit cash-flow examples and a separate sandbox. **S–M** |
| All farm USDC is simulated. There are no deposits, withdrawals, signatures or real protocol positions. JitoSOL/SOL are not stablecoins. | The pitch describes a future experience; this prototype cannot create or cash out real yield. | Start with a clearly separate **devnet** deposit/withdraw prototype, transaction simulation, explain-before-sign screens, token/program allowlists and failure recovery. Add real withdraw flows before any mainnet launch. Get independent contract/integration audits and security review. **L** |
| Smart-contract exploits, stablecoin depegs, validator/pool failures, price changes and limited liquidity can lose real funds. | A real protocol link or audit is not a guarantee. | Before real deposits, commission a threat model, independent audits, monitoring, emergency procedures, loss disclosures and withdrawal stress tests. **L** |
| Wallet reads depend on public RPC availability. The default Foundation RPC blocked this environment; Vibe Station successfully returned mainnet accounts. A connected public address is shared with the RPC provider. | Players may see “balance unavailable”; connection does not verify ownership through a signed challenge. | Use a rate-limited backend or domain-restricted read-only provider, explain address sharing, and support Wallet Standard/mobile wallets. **M** |
| Phantom was not available for a real extension approval test. The shipped read function was called successfully against a real public mainnet address; zero/error/account-switch handling has automated coverage. | Actual extension and mobile-wallet behavior still need device verification. | Test connect/reject/account switch/disconnect on desktop Phantom and its mobile browser. **S** |

## Economy and persistence

| Limitation | Why it matters | Suggested fix / effort |
| --- | --- | --- |
| Coins start at 300 and follow an unbalanced local economy. Orders pay 30%+ above crop sell value; quiz rewards pay once through normal UI. Egg/wool collection and boosts add more coins. | The loop works, but long-term pacing, inflation and retention are unproven. | Playtest 10/30/60-minute sessions, measure sources/sinks, tune unlock timing and add friendly repeatable goals. **M** |
| Refreshing, changing the device clock, editing localStorage or executing console code can alter timers, inventory, coins and rewards. | No competitive leaderboard, valuable reward or cash prize should trust this state. | Move authoritative economy/timers to a server, use idempotent actions and audit logs; add anti-cheat proportional to actual stakes. **L** |
| Saves and audio preferences live only in localStorage. No account, cloud backup, export/import or cross-device recovery exists. Storage denial falls back to session-only play without a dedicated save warning. | Clearing browser data loses the farm. Private mode and shared devices are fragile. | Add versioned save validation/export first, then optional authenticated sync with conflict handling and recovery. **S** for export, **M–L** for sync |
| No token or paid advantage exists today. A future token could distort the relaxing loop or become pay-to-win. | Speculation and earnings pressure can crowd out play and harm trust. | Keep the core game playable without a token. If useful, consider optional cosmetic/community functions with no promised appreciation, cash-out or superior yield; review economics and legal implications first. **M–L** |

## Art, technology and accessibility

| Limitation | Why it matters | Suggested fix / effort |
| --- | --- | --- |
| One painted slab and a fixed 16×16 grid limit terrain editing, road routing, expansion and camera angles. | Extending the world can expose inconsistencies between painted scenery and objects. | Separate terrain, paths and road layers, then add authored adjacent regions. **L** |
| Existing sprites have mixed source history; villagers reuse farmer frames with colour changes. Cars now use original Gemini-generated painted sprites; butterflies remain small original canvas shapes. | Visual consistency and character identity are below a full production art set; existing art rights are not independently established. | Verify asset provenance and commission a consistent directional character/animal/vehicle sheet. **M–L** |
| Cow image generation hit a service usage limit. There is no cow or milk mechanic. Barns currently add sheep with wool; hens produce eggs. | The requested richer livestock world is only partly covered, and judges should not be shown nonexistent milk gameplay. | Produce an original cow set matching the herd, add a dairy pasture, saved milk readiness and distinct collection feedback. **S–M** after assets |
| Villagers follow a fixed path loop and use short scripted speech. They do not have schedules, branching conversations or player relationship states. | Ambient life adds warmth but is not a social simulation. | Add per-villager daily routines, readable needs, order-related dialogue and modest friendship rewards. **M** |
| Mobile layouts and pointer input work in browser checks, but there is no pinch zoom, native wrapper or physical-device performance/audio coverage. | Touch ergonomics, iOS Web Audio interruptions and small-screen legibility remain risks. | Test on representative iPhone/Android devices; add pinch zoom, safe-area checks and device-specific audio recovery. **M** |
| Canvas redraws and sorts the scene every frame; DPR is capped at 2, with small fixed rain/butterfly counts. There is no broad device benchmark. | Low-end phones may drain battery or drop frames as buildings grow. | Profile full farms; cache static layers, reduce hidden-tab visual work and offer a low-motion/low-effects mode. **M** |
| Sheets have native buttons, keyboard focus, readable locks and reduced-motion CSS, but farm actions remain primarily canvas/touch-based. Ambient animation and coin flights still run under reduced motion. | Screen-reader and keyboard-only users cannot fully farm. | Add a DOM plot/animal action list and keyboard map navigation, meaningful announcements, scalable type and a genuine reduced-motion render path. **M–L** |

## Content, release and legal scope

| Limitation | Why it matters | Suggested fix / effort |
| --- | --- | --- |
| Four crops, fifteen purchasable catalog items, seven lessons, three active orders, and two produce types. No seasons, quests, multiplayer or social visiting. | Long-term retention and variety are shallow despite a complete short-session loop. | Add a small themed quest chain, spaced lesson reviews and village events before expanding to social features. **M**; multiplayer **L** |
| The recording is silent by design and uses fixed demo rates. Audio controls apply to interactive play. | A judge watching only the MP4 will not hear the game’s music or see live network behavior. | Provide an interactive play link plus a separately edited, correctly credited trailer with clear demo labels. **S** |
| GitHub and Vercel publication were deferred at the owner's request; no public repo URL or playable hosted URL has been verified. | Judges cannot access this local build from another machine. | Owner authenticates with `gh auth login` and `vercel login`; scan staged content, publish this isolated repo, deploy the static output, and check the live console. **S** |
| Educational copy is neutral and labelled “not financial advice,” but that label alone does not resolve financial-promotion, consumer-protection or regional restrictions. | Real-money features may change the legal classification and permitted audience. | Obtain qualified jurisdiction-specific review, age/region policies and appropriate disclosures before money movement or token sales. **M–L** |
| Carefree is CC BY 4.0; foley metadata is CC0 from Openverse; Fredoka uses OFL. Licences and processing are recorded, but no music is guaranteed immune to automated Content ID claims. | Credits must travel with distributed builds/videos; rights disputes still need handling. | Preserve CREDITS.md, licence links and provenance in every release; archive source licence evidence and review any later assets. **S** |

## Top five improvements

Ranks are independent: **1** is highest impact for that goal.

| Improvement | Loadout jam rank | Real-product rank | Why / effort |
| --- | --- | --- | --- |
| Publish a tested playable build and a concise credited trailer showing plant → learn → deliver → boost, with live/demo labels | 1 | 5 | Makes the work immediately judgeable and understandable. **S** |
| Playtest/tune the opening 10 minutes, add a short village quest and stronger characters, and finish cow/milk activity | 2 | 3 | Turns a technical demo into a memorable game with a reason to return. **M** |
| Validate physical mobile devices and make farming accessible via DOM/keyboard controls | 3 | 4 | Improves first impressions and includes more players. **M–L** |
| Add versioned save export, then trustworthy optional accounts/cloud saves and an authoritative economy | 4 | 2 | Protects progress and enables reliable progression before competition or valuable rewards. **M–L** |
| Build an audited, separately explained devnet-first deposit-and-withdraw path with simulation and clear risk/fee review before signing | 5 | 1 | Required if real yield is the product promise. It is a larger safety project, not a last-minute jam addition. **L** |
