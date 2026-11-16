// Dependency-free client for StableAcresTestVault on Arc testnet (classroom lesson, test USDC only).
// Reuses the connected wallet from arc.js. Every write is verified against the receipt, the exact
// transaction, the event and fresh contract state before the game reports success.
(() => {
  'use strict';
  const net = () => globalThis.StableArc.network;
  const isAddr = v => /^0x[0-9a-f]{40}$/i.test(v || '');
  const isHash = v => /^0x[0-9a-f]{64}$/i.test(v || '');
  const isSel = v => /^0x[0-9a-f]{8}$/i.test(v || '');
  const hex = n => '0x' + BigInt(n).toString(16);
  const pad = a => a.slice(2).toLowerCase().padStart(64, '0');
  const big = v => { if (!/^0x[0-9a-f]+$/i.test(v || '')) throw Error('Invalid network response'); return BigInt(v); };
  const E18 = 10n ** 18n;
  const message = e => e?.code === 4001 ? 'Wallet request cancelled' : e?.message || 'Vault request failed';

  // "12.5" -> wei. At most 6 decimals, positive.
  function parseUSDC(text) {
    const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(text).trim());
    if (!m) throw Error('Enter an amount like 5 or 2.5');
    const wei = BigInt(m[1]) * E18 + BigInt((m[2] || '').padEnd(18, '0'));
    if (wei <= 0n) throw Error('Enter an amount above 0');
    return wei;
  }
  const formatWei = (wei, digits = 4) => { const w = BigInt(wei), d = 18 - digits; const frac = (w % E18) / 10n ** BigInt(d); return `${w / E18}.${frac.toString().padStart(digits, '0')}`.replace(/\.$/, ''); };

  function createVault(options) {
    const client = options.client;
    const fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
    const wait = options.wait || (ms => new Promise(r => setTimeout(r, ms)));
    const notify = options.onChange || (() => {});
    const state = { verified: false, busy: false, kind: null, txHash: null, problem: '', note: '', principal: 0n, pendingBase: 0n, claimable: 0n, reserve: 0n, readAt: 0, config: null };
    let configPromise, seq = 0, inFlight = false, reads = 0;
    const emit = () => notify({ ...state });

    async function rpc(method, params = []) {
      const r = await fetcher(net().rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }) });
      if (!r.ok) throw Error('Arc RPC is unavailable; try again');
      const j = await r.json();
      if (j.error || !Object.hasOwn(j, 'result')) throw Error(j.error?.message || 'Invalid Arc response');
      return j.result;
    }
    function config() {
      if (!configPromise) configPromise = (async () => {
        const r = await fetcher('vault-deployment.json', { signal: AbortSignal.timeout(10000), cache: 'no-cache' });
        if (!r.ok) throw Error('Vault contract is unavailable');
        const c = await r.json(), s = c.selectors || {};
        const ok = c.chainId === net().id && isAddr(c.address) && /^0x[0-9a-f]{16,}$/i.test(c.runtimeBytecode || '') &&
          ['deposit', 'withdrawAll', 'principalOf', 'pendingYieldOf', 'claimableYieldOf', 'reserveBalance'].every(k => isSel(s[k])) &&
          isHash(c.topics?.Deposited) && isHash(c.topics?.Withdrawn) && /^\d+$/.test(c.ratePerSecond) && /^\d+$/.test(c.perWalletCap);
        if (!ok) throw Error('Vault configuration is invalid');
        return c;
      })().catch(e => { configPromise = null; throw e; });
      return configPromise;
    }
    async function verify(c) {
      if (big(await rpc('eth_chainId')) !== BigInt(net().id)) throw Error('RPC network does not match Arc testnet');
      const code = await rpc('eth_getCode', [c.address, 'latest']);
      if (typeof code !== 'string' || code.toLowerCase() !== c.runtimeBytecode.toLowerCase()) throw Error('Vault contract does not match the verified deployment');
    }
    const call = async (c, name, account, block = 'latest') => {
      const data = c.selectors[name] + (account ? pad(account) : '');
      return big(await rpc('eth_call', [{ to: c.address, data }, block]));
    };
    const account = () => client.getState().account;

    async function read() {
      const acct = account(), n = ++reads;
      if (!acct) { Object.assign(state, { verified: false, principal: 0n, pendingBase: 0n, claimable: 0n, reserve: 0n, problem: '', config: null }); emit(); return; }
      try {
        const c = await config(); await verify(c);
        const [principal, pendingBase, claimable, reserve] = await Promise.all([call(c, 'principalOf', acct), call(c, 'pendingYieldOf', acct), call(c, 'claimableYieldOf', acct), call(c, 'reserveBalance')]);
        if (n !== reads || acct !== account()) return;
        Object.assign(state, { verified: true, config: c, principal, pendingBase, claimable, reserve, readAt: Date.now(), problem: '' }); emit();
      } catch (e) { if (n === reads) { state.verified = false; state.problem = message(e); emit(); } }
    }
    // Yield owed right now, extrapolated from the last read with the contract's own per-second formula.
    function pendingNow(now = Date.now()) {
      if (!state.config) return 0n;
      const secs = BigInt(Math.max(0, Math.floor((now - state.readAt) / 1000)));
      return state.pendingBase + state.principal * BigInt(state.config.ratePerSecond) * secs / E18;
    }

    async function send(kind, value, selector, check) {
      if (inFlight || state.busy) throw Error('A vault request is already in progress');
      const acct = account(), provider = client.provider?.();
      if (!acct || !provider) throw Error('Connect a wallet first');
      inFlight = true; Object.assign(state, { busy: true, kind, txHash: null, problem: '', note: '' }); emit();
      try {
        const c = await config(); await verify(c);
        if (big(await provider.request({ method: 'eth_chainId' })) !== BigInt(net().id)) throw Error('Switch your wallet to Arc testnet');
        const accts = await provider.request({ method: 'eth_accounts' });
        if (!Array.isArray(accts) || accts[0]?.toLowerCase() !== acct) throw Error('Wallet account changed; reconnect');
        const before = await call(c, 'principalOf', acct);
        check.before(c, before); // throws for the cap, or when there is nothing to withdraw
        const tx = { from: acct, to: c.address, value: value ? hex(value) : '0x0', data: selector(c) };
        const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
        if (!isHash(hash)) throw Error('Wallet returned an invalid transaction hash');
        state.txHash = hash; emit();
        let receipt;
        for (let i = 0; i < 60; i++) { receipt = await rpc('eth_getTransactionReceipt', [hash]); if (receipt) break; await wait(1500); }
        if (account() !== acct) throw Error('Wallet changed; refresh before trying again');
        if (!receipt) throw Error('Still pending. Check the transaction link, then refresh');
        if (receipt.status !== '0x1') throw Error('Transaction failed; nothing changed');
        if (receipt.transactionHash?.toLowerCase() !== hash.toLowerCase() || receipt.from?.toLowerCase() !== acct || receipt.to?.toLowerCase() !== c.address.toLowerCase()) throw Error('Receipt does not match this vault action');
        const t = await rpc('eth_getTransactionByHash', [hash]);
        if (!t || t.from?.toLowerCase() !== acct || t.to?.toLowerCase() !== c.address.toLowerCase() || t.input?.toLowerCase() !== tx.data.toLowerCase() || big(t.value) !== (value || 0n) || big(t.chainId) !== BigInt(net().id)) throw Error('Confirmed transaction does not match this vault action');
        const log = receipt.logs?.find(l => l.address?.toLowerCase() === c.address.toLowerCase() && l.topics?.[0]?.toLowerCase() === check.topic(c).toLowerCase() && l.topics?.[1]?.toLowerCase() === '0x' + pad(acct));
        if (!log) throw Error('Vault confirmation could not be verified; refresh before retrying');
        const after = await call(c, 'principalOf', acct, receipt.blockNumber);
        const result = check.after({ log, before, after });
        await read();
        state.note = result; emit();
        return result;
      } catch (e) { state.problem = message(e); emit(); throw e; }
      finally { inFlight = false; state.busy = false; emit(); }
    }

    const words = d => { const h = (d || '0x').slice(2); return [0, 1].map(i => BigInt('0x' + (h.slice(i * 64, i * 64 + 64) || '0'))); };
    async function deposit(wei) {
      return send('deposit', wei, c => c.selectors.deposit, {
        before: (c, principal) => { if (principal + wei > BigInt(c.perWalletCap)) throw Error(`The classroom cap is ${formatWei(c.perWalletCap, 0)} test USDC per wallet`); },
        topic: c => c.topics.Deposited,
        after: ({ log, before, after }) => {
          if (words(log.data)[0] !== wei || after !== before + wei) throw Error('Deposit could not be confirmed; refresh before retrying');
          return `Deposited ${formatWei(wei)} test USDC. It is now earning the classroom rate.`;
        },
      });
    }
    async function withdrawAll() {
      return send('withdraw', 0n, c => c.selectors.withdrawAll, {
        before: (c, principal) => { if (principal === 0n && state.claimable === 0n) throw Error('Nothing to withdraw yet'); },
        topic: c => c.topics.Withdrawn,
        after: ({ log, before, after }) => {
          const [paidPrincipal, paidYield] = words(log.data);
          if (paidPrincipal !== before || after !== 0n) throw Error('Withdrawal could not be confirmed; refresh before retrying');
          return `Withdrew ${formatWei(paidPrincipal)} principal + ${formatWei(paidYield, 6)} yield.`;
        },
      });
    }
    return Object.freeze({ read, deposit, withdrawAll, pendingNow, getState: () => ({ ...state }) });
  }
  globalThis.StableVault = Object.freeze({ createVault, parseUSDC, formatWei });
})();
