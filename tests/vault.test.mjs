import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ AbortSignal, setTimeout, Date, BigInt, Math });
for (const f of ['arc.js', 'vault.js']) vm.runInContext(readFileSync(new URL(`../public/cozy/${f}`, import.meta.url), 'utf8'), context);
const { StableArc: Arc, StableVault: Vault } = context;

const E18 = 10n ** 18n, A = '0x' + '1'.repeat(40), VAULT = '0x' + 'd'.repeat(40), BADGE = '0x' + 'c'.repeat(40), HASH = '0x' + 'a'.repeat(64);
const word = n => BigInt(n).toString(16).padStart(64, '0');
const sel = { deposit: '0xd0e30db0', withdrawAll: '0x853828b6', principalOf: '0x61e20a1c', pendingYieldOf: '0x465495a7', claimableYieldOf: '0x8aae98b6', reserveBalance: '0xa10954fe' };
const vaultConfig = { chainId: 5042002, address: VAULT, runtimeBytecode: '0x6001600260036004', ratePerSecond: '2777777777777', perWalletCap: (50n * E18).toString(), selectors: sel, topics: { Deposited: '0x' + '1'.repeat(64), Withdrawn: '0x' + '2'.repeat(64), ReserveFunded: '0x' + '3'.repeat(64) } };
const badgeConfig = { chainId: 5042002, address: BADGE, runtimeBytecode: '0x60016002600360046005', selectors: { claimBadge: '0x11111111', claimedMask: '0x22222222' }, eventTopic: '0x' + 'b'.repeat(64) };

function fixture(o = {}) {
  const chain = { principal: o.principal ?? 0n, reserve: o.reserve ?? 10n * E18, pending: 0n };
  let sent, receiptCount = 0;
  const provider = {
    on() {}, removeListener() {},
    request: async r => {
      if (r.method === 'eth_requestAccounts' || r.method === 'eth_accounts') return [A];
      if (r.method === 'eth_chainId') return Arc.network.hex;
      if (r.method === 'eth_sendTransaction') {
        if (o.reject) throw Object.assign(Error('Rejected'), { code: 4001 });
        sent = r.params[0]; return HASH;
      }
      throw Error('Unexpected wallet request ' + r.method);
    },
  };
  const fetcher = async (url, req) => {
    if (url === 'arc-deployment.json') return { ok: true, json: async () => badgeConfig };
    if (url === 'vault-deployment.json') return { ok: true, json: async () => vaultConfig };
    const { method, params } = JSON.parse(req.body); let result;
    if (method === 'eth_chainId') result = Arc.network.hex;
    else if (method === 'eth_getBalance') result = '0x' + (5n * E18).toString(16);
    else if (method === 'eth_getCode') result = params[0].toLowerCase() === VAULT ? (o.wrongCode ? '0x6000' : vaultConfig.runtimeBytecode) : badgeConfig.runtimeBytecode;
    else if (method === 'eth_call') {
      const to = params[0].to.toLowerCase(), data = params[0].data;
      if (to === BADGE) result = '0x' + word(0);
      else if (data.startsWith(sel.principalOf)) result = '0x' + word(chain.principal);
      else if (data.startsWith(sel.pendingYieldOf)) result = '0x' + word(chain.pending);
      else if (data.startsWith(sel.claimableYieldOf)) result = '0x' + word(chain.pending < chain.reserve ? chain.pending : chain.reserve);
      else if (data.startsWith(sel.reserveBalance)) result = '0x' + word(chain.reserve);
      else throw Error('Unexpected call ' + data);
    } else if (method === 'eth_getTransactionReceipt') {
      if (o.foreverPending) result = null;
      else if (receiptCount++ === 0 && o.pendingOnce) result = null;
      else if (o.revert) result = { transactionHash: HASH, status: '0x0', from: A, to: VAULT, blockNumber: '0x10', logs: [] };
      else if (sent.data === sel.deposit) {
        const v = BigInt(sent.value); chain.principal += v;
        result = { transactionHash: HASH, status: '0x1', from: A, to: VAULT, blockNumber: '0x10', logs: [{ address: VAULT, topics: [vaultConfig.topics.Deposited, '0x' + A.slice(2).padStart(64, '0')], data: '0x' + word(o.wrongLogAmount ? v + 1n : v) }] };
      } else {
        const p = chain.principal, y = o.yield ?? 2n * E18 / 100n; chain.principal = 0n; chain.reserve -= y;
        result = { transactionHash: HASH, status: '0x1', from: A, to: VAULT, blockNumber: '0x10', logs: [{ address: VAULT, topics: [vaultConfig.topics.Withdrawn, '0x' + A.slice(2).padStart(64, '0')], data: '0x' + word(p) + word(y) }] };
      }
    } else if (method === 'eth_getTransactionByHash') result = { from: A, to: VAULT, input: sent.data, value: o.wrongValue ? '0x1' : sent.value, chainId: Arc.network.hex };
    else throw Error('Unexpected RPC ' + method);
    return { ok: true, json: async () => ({ result }) };
  };
  const client = Arc.createClient({ getProvider: () => provider, fetcher, wait: async () => {}, completed: () => [] });
  const vault = Vault.createVault({ client, fetcher, wait: async () => {} });
  return { client, vault, chain, sent: () => sent };
}
const ready = async (o) => { const f = fixture(o); await f.client.connect(); await f.vault.read(); return f; };

test('amounts parse to wei and reject bad input', () => {
  assert.equal(Vault.parseUSDC('5'), 5n * E18);
  assert.equal(Vault.parseUSDC('0.000001'), 10n ** 12n);
  for (const bad of ['', '0', '-1', 'abc', '1.1234567', '1e3', '1,5']) assert.throws(() => Vault.parseUSDC(bad), /Enter an amount/);
  assert.equal(Vault.formatWei(1234500000000000000n, 4), '1.2345');
});

test('reads principal, yield and reserve only after the pinned code matches', async () => {
  const { vault } = await ready({ principal: 3n * E18, reserve: 7n * E18 });
  const s = vault.getState();
  assert.equal(s.verified, true); assert.equal(s.principal, 3n * E18); assert.equal(s.reserve, 7n * E18);
  const bad = await ready({ wrongCode: true });
  assert.equal(bad.vault.getState().verified, false); assert.match(bad.vault.getState().problem, /does not match/);
});

test('pendingNow extrapolates with the contract formula', async () => {
  const { vault } = await ready({ principal: 10n * E18 });
  const s = vault.getState();
  assert.equal(vault.pendingNow(s.readAt), 0n);
  assert.equal(vault.pendingNow(s.readAt + 3600_000), 10n * E18 * 2777777777777n * 3600n / E18);
});

test('deposit sends exact value, verifies receipt, event and state', async () => {
  const f = await ready();
  const note = await f.vault.deposit(5n * E18);
  assert.match(note, /Deposited 5\.0000/);
  assert.equal(f.sent().value, '0x' + (5n * E18).toString(16)); assert.equal(f.sent().data, sel.deposit); assert.equal(f.sent().to, VAULT);
  assert.equal(f.vault.getState().principal, 5n * E18);
});

test('deposit over the cap is refused before the wallet is asked', async () => {
  const f = await ready({ principal: 48n * E18 });
  await assert.rejects(f.vault.deposit(3n * E18), /classroom cap/);
  assert.equal(f.sent(), undefined);
});

test('wallet rejection, reverted tx and mismatched confirmations never report success', async () => {
  const rej = await ready({ reject: true }); await assert.rejects(rej.vault.deposit(E18), e => e.code === 4001); assert.match(rej.vault.getState().problem, /cancelled/);
  await assert.rejects((await ready({ revert: true })).vault.deposit(E18), /failed/);
  await assert.rejects((await ready({ wrongValue: true })).vault.deposit(E18), /does not match/);
  await assert.rejects((await ready({ wrongLogAmount: true })).vault.deposit(E18), /could not be confirmed/);
  await assert.rejects((await ready({ foreverPending: true })).vault.deposit(E18), /Still pending/);
});

test('withdraw all returns principal plus yield and clears the position', async () => {
  const f = await ready({ principal: 4n * E18, reserve: 5n * E18, yield: E18 / 50n });
  f.chain.pending = E18 / 50n;
  const note = await f.vault.withdrawAll();
  assert.match(note, /Withdrew 4\.0000 principal \+ 0\.020000 yield/);
  assert.equal(f.sent().data, sel.withdrawAll); assert.equal(BigInt(f.sent().value), 0n);
  assert.equal(f.vault.getState().principal, 0n);
});

test('withdraw with nothing deposited or owed is refused locally', async () => {
  const f = await ready();
  await assert.rejects(f.vault.withdrawAll(), /Nothing to withdraw/);
  assert.equal(f.sent(), undefined);
});

test('only one vault request can run at a time', async () => {
  const f = await ready({ pendingOnce: true });
  const first = f.vault.deposit(E18);
  await assert.rejects(f.vault.deposit(E18), /already in progress/);
  await first;
});

test('without a wallet there is no vault state', async () => {
  const f = fixture(); await f.vault.read();
  assert.equal(f.vault.getState().verified, false);
  await assert.rejects(f.vault.deposit(E18), /Connect a wallet/);
});
