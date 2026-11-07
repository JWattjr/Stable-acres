// Read-only official APIs, verified against real responses on 2026-11-07.
// Kamino schema: https://api.kamino.finance/openapi/json?openapi=3.0.0
// Meteora schema: https://dlmm.datapi.meteora.ag/api-docs/openapi.json
// Jito docs: https://www.jito.network/docs/jitosol/jitosol-liquid-staking/for-developers/stake-pool-api/
// Shared by the browser and Node 24 cache writer. No wallet or transaction methods.
(() => {
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SOL = 'So11111111111111111111111111111111111111112';
  const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  const sources = {
    wheat: { url: 'https://api.kamino.finance/kamino-market/7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF/reserves/metrics', source: 'Kamino main market · USDC supply', address: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59' },
    carrot: { url: 'https://dlmm.datapi.meteora.ag/pools/5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6', source: 'Meteora DLMM · SOL–USDC · 24h fees', address: '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6' },
    pumpkin: { url: 'https://kobe.mainnet.jito.network/api/v1/stake_pool_stats', source: 'JitoSOL · latest daily staking APY' },
    strawberry: { url: 'https://dlmm.datapi.meteora.ag/pools/ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq', source: 'Meteora DLMM · USDC–USDT · 24h fees', address: 'ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq' },
  };
  function parse(key, data, now = new Date().toISOString()) {
    const s = sources[key]; let apy, observedAt = now;
    if (key === 'wheat') {
      const r = Array.isArray(data) && data.find(r => r.reserve === s.address && r.liquidityTokenMint === USDC);
      if (!r || typeof r.supplyApy !== 'string' || !r.supplyApy.trim()) throw Error('Kamino reserve shape changed');
      apy = Number(r.supplyApy) * 100; // decimal fraction → percent
    } else if (key === 'pumpkin') {
      const points = data.apy?.filter(p => typeof p.data === 'number' && Number.isFinite(Date.parse(p.date)));
      const p = points?.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
      if (!p) throw Error('Jito APY history missing');
      apy = p.data * 100; observedAt = p.date; // decimal fraction → percent
    } else {
      const other = key === 'carrot' ? SOL : USDT;
      const mints = [data.token_x?.address, data.token_y?.address];
      if (data.address !== s.address || !mints.includes(USDC) || !mints.includes(other) || data.is_blacklisted || typeof data.apy !== 'number') throw Error('Meteora pool shape changed');
      // Meteora apy is already a percentage (24h fees compounded for a year).
      // Verified: apy ≈ ((1 + fees['24h']/tvl)^365 - 1) * 100. apr is NOT used.
      apy = data.apy;
    }
    if (!Number.isFinite(apy) || apy < 0 || apy > 10000 || !Number.isFinite(Date.parse(observedAt))) throw Error('Invalid rate');
    return { apy, source: s.source, url: s.url, address: s.address, updatedAt: now, observedAt };
  }
  async function fetchRate(key, timeout = 3000) {
    const r = await fetch(sources[key].url, { signal: AbortSignal.timeout(timeout) });
    if (!r.ok) throw Error(`Rate HTTP ${r.status}`);
    return parse(key, await r.json());
  }
  globalThis.StableRates = { sources, parse, fetchRate };
})();
