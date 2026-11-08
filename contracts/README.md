# Study badge contract

Arc Studio generated and deployed this dependency-free registry on Arc testnet. IDs 1–7; one self-reported badge per sender/lesson; no owner, upgrades, payable methods or token transfers. It does not verify quizzes. Root README links contract evidence and the remaining signed-wallet check.

With Foundry installed, reproduce the retained tests using a pinned developer-only dependency:

```powershell
git clone https://github.com/foundry-rs/forge-std.git out/forge-std
git -C out/forge-std checkout 77041d2ce690e692d6e03cc812b57d1ddaa4d505
forge test -vv
```

The commit was verified against upstream tag v1.9.7. Dependencies/output are ignored. Root foundry.toml is for local tests; the independent source verifier reproduces Studio's original remapping metadata. No deployment keys are included.
