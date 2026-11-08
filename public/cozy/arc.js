// Dependency-free Arc testnet wallet and study-badge client.
// Network: https://docs.arc.io/arc/references/connect-to-arc
(() => {
  'use strict';
  const network = Object.freeze({ id: 5042002, hex: '0x4cef52', rpc: 'https://rpc.testnet.arc.io', explorer: 'https://explorer.testnet.arc.io' });
  const isAddress = value => /^0x[0-9a-f]{40}$/i.test(value || '');
  const isHash = value => /^0x[0-9a-f]{64}$/i.test(value || '');
  const word = value => BigInt(value).toString(16).padStart(64, '0');
  const parseHex = value => { if (!/^0x[0-9a-f]+$/i.test(value || '')) throw Error('Invalid network response'); return BigInt(value); };
  const formatUSDC = value => { const raw = parseHex(value); return `${raw / 10n ** 18n}.${(raw % 10n ** 18n / 10n ** 14n).toString().padStart(4, '0')}`; };
  const lessonBit = id => { if (!Number.isInteger(id) || id < 1 || id > 7) throw Error('Choose a lesson from 1 to 7'); return 1n << BigInt(id - 1); };
  const message = error => error?.code === 4001 ? 'Wallet request cancelled' : error?.message || 'Arc request failed';

  function createClient(options = {}) {
    const fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
    const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const getProvider = options.getProvider || (() => globalThis.ethereum);
    const notify = options.onChange || (() => {});
    const completed = options.completed || (() => []);
    const state = { account: null, chainId: null, balance: null, mask: null, verified: false, busy: false, pending: null, txHash: null, problem: '', deployment: null };
    let provider, configPromise, sequence = 0, epoch = 0, reads = 0, inFlight = false;
    const pendingClaims = new Map();
    const emit = () => notify({ ...state });
    const current = (version, account) => version === epoch && account === state.account;
    const guard = (version, account) => { if (!current(version, account)) throw Error('Wallet changed; refresh before trying again'); };
    async function rpc(method, params = []) {
      const response = await fetcher(network.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }) });
      if (!response.ok) throw Error('Arc RPC is unavailable; try again');
      const result = await response.json();
      if (result.error || !Object.hasOwn(result, 'result')) throw Error(result.error?.message || 'Invalid Arc response');
      return result.result;
    }
    async function rpcChain() { if (parseHex(await rpc('eth_chainId')) !== BigInt(network.id)) throw Error('RPC network does not match Arc testnet'); }
    async function deployment() {
      if (!configPromise) configPromise = (async () => {
        const response = await fetcher('arc-deployment.json', { signal: AbortSignal.timeout(10000), cache: 'no-cache' });
        if (!response.ok) throw Error('Study badge contract is unavailable');
        const config = await response.json();
        if (config.chainId !== network.id || !isAddress(config.address) || !/^0x[0-9a-f]{16,}$/i.test(config.runtimeBytecode || '') || !/^0x[0-9a-f]{8}$/i.test(config.selectors?.claimBadge || '') || !/^0x[0-9a-f]{8}$/i.test(config.selectors?.claimedMask || '') || !isHash(config.eventTopic)) throw Error('Badge configuration is invalid');
        return config;
      })().catch(error => { configPromise = null; throw error; });
      return configPromise;
    }
    async function verifyContract(config) {
      await rpcChain();
      const code = await rpc('eth_getCode', [config.address, 'latest']);
      if (typeof code !== 'string' || code.toLowerCase() !== config.runtimeBytecode.toLowerCase()) throw Error('Badge contract does not match the verified deployment');
    }
    async function readMask(config, account, block = 'latest') {
      const result = await rpc('eth_call', [{ to: config.address, data: config.selectors.claimedMask + account.slice(2).toLowerCase().padStart(64, '0') }, block]);
      if (!/^0x[0-9a-f]{64}$/i.test(result || '')) throw Error('Invalid badge record');
      const mask = BigInt(result); if (mask > 127n) throw Error('Invalid badge record'); return mask;
    }
    async function refresh() {
      const account = state.account, version = epoch, read = ++reads;
      if (!account || !provider) return;
      try {
        const chainId = parseHex(await provider.request({ method: 'eth_chainId' })); guard(version, account);
        state.chainId = Number(chainId); state.balance = null; state.mask = null; state.verified = false; state.problem = '';
        if (chainId !== BigInt(network.id)) { state.problem = 'Switch your wallet to Arc testnet'; emit(); return; }
        await rpcChain();
        const balance = formatUSDC(await rpc('eth_getBalance', [account, 'latest']));
        guard(version, account); if (read !== reads) return;
        state.balance = balance; emit();
        const config = await deployment(); await verifyContract(config);
        const mask = await readMask(config, account); guard(version, account); if (read !== reads) return;
        let problem = '';
        const pending = pendingClaims.get(account);
        if (pending) {
          const receipt = await rpc('eth_getTransactionReceipt', [pending.hash]); guard(version, account); if (read !== reads) return;
          if (receipt?.status === '0x0') { pendingClaims.delete(account); problem = 'Last badge transaction failed; you can try again'; }
          else if (mask & lessonBit(pending.id)) pendingClaims.delete(account);
        }
        Object.assign(state, { mask, verified: true, deployment: config, pending: pendingClaims.get(account)?.id || null, problem }); emit();
      } catch (error) {
        if (current(version, account) && read === reads) { state.verified = false; state.problem = message(error); emit(); }
      }
    }
    function accountsChanged(accounts) {
      epoch++; reads++;
      const account = Array.isArray(accounts) && isAddress(accounts[0]) ? accounts[0].toLowerCase() : null;
      const pending = pendingClaims.get(account);
      Object.assign(state, { account, balance: null, mask: null, verified: false, busy: false, pending: pending?.id || null, txHash: pending?.hash || null, problem: '' });
      emit(); if (account) return refresh();
    }
    function chainChanged() { epoch++; reads++; Object.assign(state, { balance: null, mask: null, verified: false, busy: false, pending: null, txHash: null }); emit(); return refresh(); }
    async function connect() {
      if (state.busy) return;
      const version = epoch;
      state.busy = true; state.problem = ''; emit();
      try {
        const next = getProvider();
        if (!next?.request) throw Error('Open this game in an EVM wallet browser or enable your wallet extension');
        const accounts = await next.request({ method: 'eth_requestAccounts' });
        if (version !== epoch) return;
        if (!Array.isArray(accounts) || !isAddress(accounts[0])) throw Error('No wallet account selected');
        if (provider !== next) {
          provider?.removeListener?.('accountsChanged', accountsChanged); provider?.removeListener?.('chainChanged', chainChanged); provider?.removeListener?.('disconnect', disconnect);
          provider = next; provider.on?.('accountsChanged', accountsChanged); provider.on?.('chainChanged', chainChanged); provider.on?.('disconnect', disconnect);
        }
        await accountsChanged(accounts);
      } catch (error) { state.problem = message(error); }
      finally { state.busy = false; emit(); }
    }
    function disconnect() { epoch++; reads++; Object.assign(state, { account: null, balance: null, mask: null, verified: false, busy: false, pending: null, txHash: null, problem: '' }); emit(); }
    async function switchNetwork() {
      if (!provider || state.busy) return;
      state.busy = true; state.problem = ''; emit();
      try {
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.hex }] }); }
        catch (error) {
          if ((error.code ?? error.data?.originalError?.code) !== 4902) throw error;
          await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: network.hex, chainName: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: [network.rpc], blockExplorerUrls: [network.explorer] }] });
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.hex }] });
        }
        await chainChanged();
      } catch (error) { state.problem = message(error); }
      finally { state.busy = false; emit(); }
    }
    async function claim(id) {
      const bit = lessonBit(id);
      if (inFlight || state.busy) throw Error('A wallet request is already in progress');
      if (!completed().includes(id - 1)) throw Error('Finish this lesson before recording its badge');
      if (!state.account || !provider) throw Error('Connect a wallet first');
      const account = state.account, version = epoch;
      if (pendingClaims.has(account)) throw Error('A submitted badge is still pending. Refresh badges to check it');
      inFlight = true; Object.assign(state, { busy: true, pending: id, txHash: null, problem: '' }); emit();
      try {
        const config = await deployment(); await verifyContract(config); guard(version, account);
        if (parseHex(await provider.request({ method: 'eth_chainId' })) !== BigInt(network.id)) throw Error('Switch your wallet to Arc testnet');
        const accounts = await provider.request({ method: 'eth_accounts' }); guard(version, account);
        if (!Array.isArray(accounts) || accounts[0]?.toLowerCase() !== account) throw Error('Wallet account changed; reconnect');
        if ((await readMask(config, account)) & bit) { await refresh(); return; }
        guard(version, account);
        const data = config.selectors.claimBadge + word(id);
        const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: account, to: config.address, value: '0x0', data }] });
        guard(version, account); if (!isHash(hash)) throw Error('Wallet returned an invalid transaction hash');
        pendingClaims.set(account, { hash, id }); state.txHash = hash; emit();
        let receipt;
        for (let attempt = 0; attempt < 60; attempt++) {
          guard(version, account); receipt = await rpc('eth_getTransactionReceipt', [hash]);
          if (receipt) break; await wait(1500);
        }
        guard(version, account);
        if (!receipt) throw Error('Still pending. Check the transaction link, then refresh badges');
        if (receipt.status !== '0x1') { pendingClaims.delete(account); throw Error('Transaction failed; badge was not recorded'); }
        if (receipt.transactionHash?.toLowerCase() !== hash.toLowerCase() || receipt.to?.toLowerCase() !== config.address.toLowerCase() || receipt.from?.toLowerCase() !== account) throw Error('Receipt does not match this badge claim');
        const tx = await rpc('eth_getTransactionByHash', [hash]);
        if (!tx || tx.from?.toLowerCase() !== account || tx.to?.toLowerCase() !== config.address.toLowerCase() || tx.input?.toLowerCase() !== data.toLowerCase() || parseHex(tx.value) !== 0n || parseHex(tx.chainId) !== BigInt(network.id)) throw Error('Confirmed transaction does not match this badge claim');
        const event = receipt.logs?.some(log => log.address?.toLowerCase() === config.address.toLowerCase() && log.topics?.length === 3 && log.topics[0].toLowerCase() === config.eventTopic.toLowerCase() && log.topics[1].toLowerCase() === '0x' + account.slice(2).padStart(64, '0') && log.topics[2].toLowerCase() === '0x' + word(id));
        if (!event || !((await readMask(config, account, receipt.blockNumber)) & bit)) throw Error('Badge confirmation could not be verified; refresh before retrying');
        guard(version, account); await refresh();
        if (!state.verified || !(state.mask & bit)) throw Error('Refresh badges to check the confirmed claim');
      } catch (error) {
        if (current(version, account)) { state.problem = message(error); emit(); }
        throw error;
      } finally {
        inFlight = false; if (current(version, account)) { state.busy = false; state.pending = pendingClaims.get(account)?.id || null; emit(); }
      }
    }
    return Object.freeze({ connect, refresh, switchNetwork, disconnect, claim, getState: () => ({ ...state }) });
  }
  globalThis.StableArc = Object.freeze({ network, createClient, formatUSDC, lessonBit });
})();
