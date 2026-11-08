import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ AbortSignal, setTimeout });
vm.runInContext(readFileSync(new URL('../public/cozy/arc.js', import.meta.url), 'utf8'), context);
const Arc = context.StableArc;
const A = '0x' + '1'.repeat(40), B = '0x' + '2'.repeat(40), CONTRACT = '0x' + 'c'.repeat(40), HASH = '0x' + 'a'.repeat(64);
const word = n => BigInt(n).toString(16).padStart(64, '0');
const config = { chainId: 5042002, address: CONTRACT, runtimeBytecode: '0x60016002600360046005', selectors: { claimBadge: '0x11111111', claimedMask: '0x22222222' }, eventTopic: '0x' + 'b'.repeat(64) };
function fixture(options = {}) {
  const masks = new Map([[A, options.mask || 0n], [B, 0n]]), calls = [], handlers = {};
  let chain = options.chain || Arc.network.hex, accounts = [A], sent, receiptReads = 0, known = !options.unknownChain;
  const provider = {
    on: (event, fn) => handlers[event] = fn,
    removeListener: event => delete handlers[event],
    request: async request => {
      calls.push(request);
      if (request.method === 'eth_requestAccounts') { if (options.rejectConnect) throw Object.assign(Error('Rejected'), { code: 4001 }); return options.connectAccounts ? options.connectAccounts() : accounts; }
      if (request.method === 'eth_accounts') return accounts;
      if (request.method === 'eth_chainId') return chain;
      if (request.method === 'wallet_switchEthereumChain') {
        if (!known) throw Object.assign(Error('Unknown chain'), { code: 4902 });
        assert.equal(request.params[0].chainId, Arc.network.hex); chain = Arc.network.hex; return null;
      }
      if (request.method === 'wallet_addEthereumChain') {
        const n = request.params[0]; assert.equal(n.chainId, Arc.network.hex); assert.equal(n.nativeCurrency.decimals, 18); assert.equal(n.rpcUrls[0], Arc.network.rpc); known = true; return null;
      }
      if (request.method === 'eth_sendTransaction') {
        if (options.rejectSend) throw Object.assign(Error('Rejected'), { code: 4001 });
        sent = request.params[0]; assert.equal(sent.value, '0x0'); assert.equal(sent.from, A); assert.equal(sent.to, CONTRACT); return HASH;
      }
      throw Error('Unexpected wallet request: ' + request.method);
    },
  };
  const fetcher = async (url, request) => {
    if (url === 'arc-deployment.json') return { ok: true, json: async () => config };
    assert.equal(url, Arc.network.rpc);
    const { method, params } = JSON.parse(request.body); calls.push({ method, params, rpc: true });
    let result;
    if (method === 'eth_chainId') result = options.wrongRpc ? '0x1' : Arc.network.hex;
    else if (method === 'eth_getBalance') {
      if (options.balance) return { ok: true, json: async () => ({ result: await options.balance(params[0]) }) };
      result = '0x' + (123456n * 10n ** 14n).toString(16);
    } else if (method === 'eth_getCode') result = options.wrongCode ? '0x6000' : config.runtimeBytecode;
    else if (method === 'eth_call') {
      const account = '0x' + params[0].data.slice(-40); result = '0x' + word(masks.get(account) || 0n);
    } else if (method === 'eth_getTransactionReceipt') {
      if (options.foreverPending || options.pending && receiptReads++ === 0) result = null;
      else {
        const id = Number(BigInt('0x' + sent.data.slice(-64)));
        if (!options.revert) masks.set(A, (masks.get(A) || 0n) | 1n << BigInt(id - 1));
        result = { transactionHash: HASH, status: options.revert ? '0x0' : '0x1', from: A, to: options.wrongReceipt ? B : CONTRACT, blockNumber: '0x10', logs: [{ address: CONTRACT, topics: [config.eventTopic, '0x' + A.slice(2).padStart(64, '0'), '0x' + word(options.wrongEvent ? 7 : id)] }] };
      }
    } else if (method === 'eth_getTransactionByHash') result = { from: A, to: CONTRACT, input: sent.data, value: options.wrongValue ? '0x1' : '0x0', chainId: Arc.network.hex };
    else throw Error('Unexpected RPC request: ' + method);
    return { ok: true, json: async () => ({ result }) };
  };
  const client = Arc.createClient({ getProvider: () => options.noProvider ? null : provider, fetcher, wait: async () => {}, completed: () => options.completed || [0, 1, 2, 3, 4, 5, 6] });
  return { client, calls, masks, account: async account => { accounts = account ? [account] : []; return handlers.accountsChanged(accounts); }, disconnect: () => handlers.disconnect?.() };
}

test('USDC formatting uses integer 18-decimal native units, once', () => {
  assert.equal(Arc.network.hex, '0x' + Arc.network.id.toString(16));
  assert.equal(Arc.formatUSDC('0x0'), '0.0000');
  assert.equal(Arc.formatUSDC('0x' + (123456n * 10n ** 14n).toString(16)), '12.3456');
  assert.equal(Arc.formatUSDC('0x' + (999999999999999999n * 10n ** 18n).toString(16)), '999999999999999999.0000');
  assert.throws(() => Arc.formatUSDC('bad'));
});
test('connect reads verified testnet balance/badges without sending a transaction', async () => {
  const f = fixture(); await f.client.connect();
  const state = f.client.getState(); assert.equal(state.account, A); assert.equal(state.balance, '12.3456'); assert.equal(state.mask, 0n); assert.equal(state.verified, true);
  assert.equal(f.calls.some(c => c.method === 'eth_sendTransaction'), false);
});
test('missing wallet and cancelled connection leave farming available', async () => {
  const missing = fixture({ noProvider: true }); await missing.client.connect(); assert.ok(missing.client.getState().problem.includes('EVM wallet'));
  const rejected = fixture({ rejectConnect: true }); await rejected.client.connect(); assert.equal(rejected.client.getState().account, null); assert.equal(rejected.client.getState().problem, 'Wallet request cancelled'); assert.equal(rejected.client.getState().busy, false);
});
test('wrong wallet network requires an explicit switch; unknown Arc chain is added correctly', async () => {
  const f = fixture({ chain: '0x1', unknownChain: true }); await f.client.connect();
  assert.equal(f.client.getState().verified, false); assert.equal(f.calls.some(c => c.rpc), false);
  await assert.rejects(f.client.claim(1), /Switch/); assert.equal(f.calls.some(c => c.method === 'eth_sendTransaction'), false);
  await f.client.switchNetwork(); assert.equal(f.client.getState().verified, true); assert.ok(f.calls.some(c => c.method === 'wallet_addEthereumChain'));
});
test('wrong RPC identity or mismatched bytecode cannot enable badge claims', async () => {
  for (const options of [{ wrongRpc: true }, { wrongCode: true }]) {
    const f = fixture(options); await f.client.connect(); assert.equal(f.client.getState().verified, false);
    await assert.rejects(f.client.claim(1)); assert.equal(f.calls.some(c => c.method === 'eth_sendTransaction'), false);
  }
});
test('claim verifies receipt, exact transaction, indexed event and recorded state', async () => {
  const f = fixture({ pending: true }); await f.client.connect(); await f.client.claim(3);
  assert.equal(f.client.getState().mask, 4n); assert.equal(f.client.getState().txHash, HASH); assert.equal(f.client.getState().busy, false);
  const send = f.calls.find(c => c.method === 'eth_sendTransaction'); assert.equal(send.params[0].data, config.selectors.claimBadge + word(3));
  assert.equal(f.client.getState().pending, null);
});
test('duplicate claim, unfinished lesson and invalid lesson never send a transaction', async () => {
  const f = fixture({ mask: 1n }); await f.client.connect(); await f.client.claim(1);
  assert.equal(f.calls.some(c => c.method === 'eth_sendTransaction'), false);
  const unfinished = fixture({ completed: [0] }); await unfinished.client.connect(); await assert.rejects(unfinished.client.claim(2), /Finish/);
  for (const id of [0, 8, 255, 1.1]) await assert.rejects(unfinished.client.claim(id));
  assert.equal(unfinished.calls.some(c => c.method === 'eth_sendTransaction'), false);
});
test('rejection, reverted receipt, wrong recipient/event/value never become a verified claim', async () => {
  for (const options of [{ rejectSend: true }, { revert: true }, { wrongReceipt: true }, { wrongEvent: true }, { wrongValue: true }]) {
    const f = fixture(options); await f.client.connect(); await assert.rejects(f.client.claim(1));
    assert.equal(f.client.getState().mask, 0n); assert.equal(f.client.getState().busy, false); assert.ok(f.client.getState().problem);
  }
});
test('account changes invalidate a slow balance response; disconnect clears onchain state', async () => {
  let start, resolve;
  const started = new Promise(r => start = r), delayed = new Promise(r => resolve = r);
  const f = fixture({ balance: account => { if (account === A) { start(); return delayed; } return '0x0'; } });
  const first = f.client.connect(); await started; await f.account(B); resolve('0x1'); await first;
  assert.equal(f.client.getState().account, B); assert.equal(f.client.getState().balance, '0.0000'); assert.equal(f.client.getState().mask, 0n);
  f.disconnect(); assert.equal(f.client.getState().account, null); assert.equal(f.client.getState().mask, null); assert.equal(f.client.getState().verified, false);
});
test('a disconnected pending connection cannot reconnect itself', async () => {
  let later = false, resolve;
  const gate = new Promise(r => resolve = r), f = fixture({ connectAccounts: () => later ? gate : [A] });
  await f.client.connect(); f.client.disconnect(); later = true;
  const connection = f.client.connect(); await Promise.resolve(); f.client.disconnect(); resolve([A]); await connection;
  assert.equal(f.client.getState().account, null);
});
test('a timed-out submitted claim remains pending and cannot be resubmitted', async () => {
  const f = fixture({ foreverPending: true }); await f.client.connect(); await assert.rejects(f.client.claim(1), /Still pending/);
  assert.equal(f.client.getState().pending, 1); assert.equal(f.client.getState().mask, 0n); assert.equal(f.client.getState().busy, false);
  await f.client.refresh(); await assert.rejects(f.client.claim(1), /still pending/);
  assert.equal(f.calls.filter(c => c.method === 'eth_sendTransaction').length, 1);
});
