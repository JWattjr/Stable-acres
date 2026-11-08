import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../out/contract-tools/package.json',import.meta.url)), solc = require('solc');
const { keccak256 } = require('js-sha3');
const source = readFileSync('contracts/StableAcresStudyBadges.sol', 'utf8');
const manifest = JSON.parse(readFileSync('contracts/evidence/studio-integration-manifest.json', 'utf8'));
const input = { language: 'Solidity', sources: { 'contracts/StableAcresStudyBadges.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', metadata: { bytecodeHash: 'ipfs' }, outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode.object', 'evm.methodIdentifiers'] } } } };
input.settings.remappings = ['@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/', 'forge-std/=lib/forge-std/src/'];
const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors?.some(e => e.severity === 'error')) throw Error(JSON.stringify(output.errors));
const built = output.contracts['contracts/StableAcresStudyBadges.sol'].StableAcresStudyBadges;
let id = 0;
async function rpc(method, params = []) {
  const response = await fetch('https://rpc.testnet.arc.io', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8766' }, body: JSON.stringify({jsonrpc:'2.0', id:++id, method, params}), signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); const value = await response.json(); return value;
}
const result = async (method, params) => { const r = await rpc(method, params); if (r.error) throw Error(JSON.stringify(r.error)); return r.result; };
assert.equal(Number(BigInt(await result('eth_chainId'))), 5042002);
const code = await result('eth_getCode', [manifest.contractAddress, 'latest']);
const config = JSON.parse(readFileSync('public/cozy/arc-deployment.json','utf8'));assert.equal(code.toLowerCase(),config.runtimeBytecode.toLowerCase());
assert.equal(code.slice(2).toLowerCase(), built.evm.deployedBytecode.object.toLowerCase());
for (const selector of manifest.functionSelectors) assert.equal('0x' + built.evm.methodIdentifiers[selector.signature], selector.selector);
const keccak = '0x' + keccak256(Buffer.from(code.slice(2), 'hex')); assert.equal(keccak, manifest.runtimeCode.hash);
const eventTopic = '0x' + keccak256('BadgeClaimed(address,uint8)'); assert.equal(eventTopic, manifest.event.topic0);
const receipt = await result('eth_getTransactionReceipt', [manifest.deployTxHash]); assert.equal(receipt.status, '0x1'); assert.ok(JSON.stringify(receipt.logs).toLowerCase().includes(manifest.contractAddress.slice(2).toLowerCase()));
const selectors = Object.fromEntries(manifest.functionSelectors.map(s => [s.name, s.selector]));
const account = '0x' + '1'.repeat(40), word = n => BigInt(n).toString(16).padStart(64, '0');
const read = await result('eth_call', [{ to: manifest.contractAddress, data: selectors.claimedMask + account.slice(2).padStart(64, '0') }, 'latest']); assert.equal(BigInt(read), 0n);
for (const lesson of [0, 8, 255]) {
  const bad = await rpc('eth_call', [{ from: account, to: manifest.contractAddress, data: selectors.claimBadge + word(lesson) }, 'latest']); assert.ok(bad.error, `Invalid lesson ${lesson} should revert`);
}
const valid = await result('eth_call', [{ from: account, to: manifest.contractAddress, value: '0x0', data: selectors.claimBadge + word(1) }, 'latest']); assert.equal(valid, '0x');
const nonzero = await rpc('eth_call', [{ from: account, to: manifest.contractAddress, value: '0x1', data: selectors.claimBadge + word(1) }, 'latest']); assert.ok(nonzero.error);
const evidence = { network:'Arc Testnet', chainId:5042002, address:manifest.contractAddress, explorer:manifest.explorer.addressUrl, deployTxHash:manifest.deployTxHash, deploymentReceiptStatus:receipt.status, bytecodeBytes:(code.length-2)/2, runtimeCodeKeccak256:keccak, localCompiler:solc.version(), localCompilationMatches:true, sourcePath:'contracts/StableAcresStudyBadges.sol', checks:['official RPC chain ID','deployment receipt and address log','exact local source compilation and Studio runtime bytecode match','selectors and event topic','zero initial record','invalid lessons revert','valid zero-value claim simulation','nonzero-value call reverts'], simulatedOnly:true };
writeFileSync('contracts/evidence/independent-verification.json', JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
