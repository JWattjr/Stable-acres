# Arc edition progress

- 2026-11-08: owner approved Arc testnet edition via Arc Studio CLI. Isolated arc-edition worktree from 027cb48; Solana main/production unchanged.
- Preserved painted farm, ambience, orders, quizzes, audio and deterministic demo. Arc saves/preferences are separate.
- Added injected EVM wallet connection and native USDC balance reads; checks provider/RPC chain identity and integer 18-decimal units.
- Replaced live Solana rates with labelled demo examples. Lesson 5 teaches USDC gas on Arc.
- Studio generated/deployed the self-reported study badge registry on chain 5042002; 46 contract tests reported. Independent local compilation exactly matches the deployed 673-byte code; simulations/explorer verified.
- Added explicit zero-value badge claims, test-gas disclosure, receipt/tx/event/state checks, pending reservation, cancellation and account-change guards.
- 16 local tests pass; browser captures fit three sizes with no exceptions. Real public testnet reads and a rejecting test provider were checked. The full 41-second, 12 fps demo completed without errors. Fresh visual review: SHIP.
- Signed smoke claim blocked by Studio faucet developer-admin permission; no claim broadcast or permissions changed. External-wallet signing still needs a funded testnet-wallet check.
- Published the Arc preview at https://stable-acres-arc.vercel.app/ in a separate CLI-deployed Vercel project. All 73 public assets match, hosted browser checks pass and original Solana main/live source remains unchanged. Arc source is pushed on arc-edition.
