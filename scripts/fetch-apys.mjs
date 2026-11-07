// Optional static cache refresh; run at deploy time and manually for static hosting.
import '../public/cozy/rates.js';
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../public/cozy/apys.json', import.meta.url);
let cache = {}; try { cache = JSON.parse(await readFile(file, 'utf8')); } catch {}
const results = await Promise.allSettled(Object.keys(StableRates.sources).map(async key => {
  const rate = await StableRates.fetchRate(key, 15000);
  return [key, rate];
}));
for (let i = 0; i < results.length; i++) {
  const r = results[i], key = Object.keys(StableRates.sources)[i];
  if (r.status === 'fulfilled') { cache[r.value[0]] = r.value[1]; console.log(`${key}: ${r.value[1].apy.toFixed(3)}% APY`); }
  else console.warn(`${key}: keeping previous cache (${r.reason.message})`);
}
// Individual timestamps are preserved on failures; never freshen stale entries.
cache.updatedAt = new Date().toISOString();
await writeFile(file, JSON.stringify(cache, null, 2) + '\n');
