// Pins the deployed StableAcresTestVault into public/cozy/vault-deployment.json.
// Reads Studio's manifest, then fetches the runtime code straight from Arc testnet and checks its length.
//   node scripts/build-vault-config.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const m = JSON.parse(readFileSync(new URL('../contracts/evidence/test-vault-manifest.json', import.meta.url), 'utf8'));
const rpc = async (method, params) => { const r = await (await fetch(m.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) throw Error(r.error.message); return r.result; };
if (parseInt(await rpc('eth_chainId', []), 16) !== 5042002) throw Error('Not Arc testnet');
const code = await rpc('eth_getCode', [m.contractAddress, 'latest']);
if ((code.length - 2) / 2 !== m.runtimeCode.byteLength) throw Error('Deployed code length differs from the manifest');
const sel = Object.fromEntries(m.functionSelectors.map(f => [f.name, f.selector]));
const topic = Object.fromEntries(m.eventTopics.map(e => [e.name, e.topic0]));
const need = ['deposit', 'withdraw', 'withdrawAll', 'principalOf', 'pendingYieldOf', 'claimableYieldOf', 'reserveBalance', 'totalPrincipal', 'ratePerSecond', 'perWalletCap'];
for (const n of need) if (!sel[n]) throw Error('Missing selector ' + n);
writeFileSync(new URL('../public/cozy/vault-deployment.json', import.meta.url), JSON.stringify({
  chainId: m.chainId, address: m.contractAddress, deployTxHash: m.deployTxHash,
  explorerUrl: m.explorer.addressUrl,
  ratePerSecond: m.constructorArgs.ratePerSecond, perWalletCap: m.constructorArgs.perWalletCap,
  selectors: Object.fromEntries(need.map(n => [n, sel[n]])),
  topics: { Deposited: topic.Deposited, Withdrawn: topic.Withdrawn, ReserveFunded: topic.ReserveFunded },
  runtimeBytecode: code,
}, null, 2) + '\n');
console.log('wrote vault-deployment.json', m.contractAddress, (code.length - 2) / 2, 'bytes');
