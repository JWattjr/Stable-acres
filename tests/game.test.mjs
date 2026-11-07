import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../public/cozy/game.js', import.meta.url), 'utf8').split('// ---------- boot ----------')[0];
const rates = readFileSync(new URL('../public/cozy/rates.js', import.meta.url), 'utf8');
function farm(search = '?weather=clear', storage = new Map(), fetcher) {
  let now = Date.parse('2026-11-07T12:00:00Z'), requests = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const elements = new Map();
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set(), e = { id, style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', checked: false,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle: (x, b) => b ? classes.add(x) : classes.delete(x) },
      addEventListener() {}, setAttribute() {}, getBoundingClientRect: () => ({ left: 100, top: 20, width: 80, height: 40 }),
      animate: () => ({}), remove() {}, appendChild() {}, getContext: () => ({}),
    }; elements.set(id, e); return e;
  }
  const sheets = ['seedSheet', 'shop', 'vault', 'orders', 'learn', 'settings'].map(element);
  const c = vm.createContext({ URLSearchParams, AbortSignal, Date: Clock, Math: Object.create(Math), performance: { now: () => 0 },
    location: { search }, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: { getElementById: element, querySelectorAll: () => sheets, addEventListener() {}, createElement: () => element('temporary'), body: { appendChild() {} } },
    window: {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    Image: class {}, addEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {},
    fetch: async (url, options) => { requests.push({ url, options }); if (fetcher) return fetcher(url, options); throw Error('offline'); },
  });
  vm.runInContext(rates, c); vm.runInContext(game, c);
  const run = code => vm.runInContext(code, c);
  return { run, advance: ms => now += ms, setTime: value => now = value, storage, elements, requests };
}

test('official response units, exact pool/mint validation and zero rate', () => {
  const f = farm();
  assert.equal(f.run(`StableRates.parse('wheat', [
    {reserve:'wrong',liquidityTokenMint:USDC_MINT,supplyApy:'99'},
    {reserve:StableRates.sources.wheat.address,liquidityTokenMint:USDC_MINT,supplyApy:'0.038650688904832364'}]).apy`), 3.8650688904832364);
  assert.equal(f.run(`StableRates.parse('strawberry', {address:StableRates.sources.strawberry.address,token_x:{address:USDC_MINT},token_y:{address:'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'},apy:0.2739721361362246}).apy`), .2739721361362246);
  assert.equal(f.run(`StableRates.parse('pumpkin', {apy:[{data:.05,date:'2026-11-06T00:00:00Z'},{data:.049,date:'2026-11-07T00:00:00Z'}]}).apy`), 4.9);
  assert.equal(f.run(`StableRates.parse('wheat', [{reserve:StableRates.sources.wheat.address,liquidityTokenMint:USDC_MINT,supplyApy:'0'}]).apy`), 0);
  assert.throws(() => f.run(`StableRates.parse('wheat', [{reserve:'wrong',liquidityTokenMint:USDC_MINT,supplyApy:'1'}])`));
});

test('demo mode makes no rate requests, and expired real rates become demo placeholders', async () => {
  const f = farm('?demo&t=day'); await f.run('loadRates()'); assert.equal(f.requests.length, 0);
  assert.equal(f.run('weatherAt(Date.now())'), 'clear');
  const normal = farm(); await normal.run('loadRates()'); assert.equal(normal.run(`rateNote('wheat')`), 'Demo rates');
  normal.run(`rateState.wheat = {mode:'live',apy:3,updatedAt:new Date().toISOString(),observedAt:new Date().toISOString()}; CROPS.wheat.pool.apy=3`);
  normal.advance(86400001); normal.run('expireRates()'); assert.equal(normal.run('CROPS.wheat.pool.apy'), 6.2);
});

test('plant → harvest → order → next planting consumes exactly one demo boost', () => {
  const f = farm(); f.run('ensureOrders(); var plots = S.objects.filter(p => p.type === "plot"); plant(plots[0], "wheat"); plant(plots[1], "wheat")');
  assert.equal(f.run('S.coins'), 290); f.run('harvest(plots[0])'); assert.equal(f.run('S.inventory.wheat || 0'), 0);
  f.advance(20000); f.run('harvest(plots[0]); harvest(plots[1])');
  assert.equal(f.run('S.inventory.wheat'), 2); assert.equal(f.run('S.coins'), 290);
  f.run('var deliveredId = S.orders[0].id; var reward = S.orders[0].coins; deliverOrder(deliveredId)');
  assert.ok(f.run('reward > 2 * CROPS.wheat.sell')); assert.equal(f.run('S.orders.length'), 3); assert.equal(f.run('S.inventory.wheat'), 0);
  assert.equal(f.run('S.boosts.wheat'), 1); const coins = f.run('S.coins'); f.run('deliverOrder(deliveredId)'); assert.equal(f.run('S.coins'), coins);
  f.run('plant(plots[0], "wheat"); plant(plots[1], "wheat")'); assert.equal(f.run('plots[0].boost'), 1.25); assert.equal(f.run('plots[1].boost'), 1);
  f.advance(1000); assert.equal(f.run('earned(plots[0]) / earned(plots[1])'), 1.25);
  const reloaded = farm('?weather=clear', f.storage); assert.equal(reloaded.run('S.delivered'), 1); assert.equal(reloaded.run('S.objects.filter(p => p.crop).length'), 2);
});

test('LP and staking quizzes unlock crops; correct answers pay once', () => {
  const f = farm(); assert.ok(f.run(`seedLock('carrot')`).includes('Learn'));
  const answer = id => f.run(`openLesson(${id}); lessonCard=3; $('lessonContent').onclick({target:{closest:()=>({dataset:{answer:String(LESSONS[${id}].answer)},hasAttribute:()=>false})}})`);
  answer(2); assert.equal(f.run(`seedLock('carrot')`), ''); assert.equal(f.run('S.studyStars'), 1); assert.equal(f.run('S.coins'), 320);
  answer(2); assert.equal(f.run('S.coins'), 320); assert.equal(f.run('S.studyStars'), 1);
  answer(0); answer(4); assert.equal(f.run(`seedLock('pumpkin')`), '');
});

test('rain adds exactly 10% growth; seeded weather boundaries integrate correctly', () => {
  const rain = farm('?weather=rain'), clear = farm('?weather=clear');
  for (const f of [rain, clear]) { f.run('var p=S.objects.find(p=>p.type==="plot"); plant(p,"wheat")'); f.advance(10000); }
  assert.equal(clear.run('progress(p)'), .5); assert.equal(rain.run('progress(p)'), .55);
  const f = farm('');
  const bucket = f.run(`(()=>{let t=Date.now();t-=t%WEATHER_MS;while(weatherAt(t)!=='rain'||weatherAt(t+WEATHER_MS)==='rain')t+=WEATHER_MS;return t;})()`);
  f.setTime(bucket + 180000 - 5000); f.run('var p=S.objects.find(p=>p.type==="plot"); plant(p,"wheat")'); f.advance(10000);
  assert.equal(f.run('growthElapsed(p)'), 10500);
});

test('USDC uses only read-only RPC, sums accounts with integer precision and handles zero/error', async () => {
  const owner = '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6', mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const f = farm('', new Map(), (_url, o) => {
    const b = JSON.parse(o.body); assert.equal(b.method, 'getTokenAccountsByOwner'); assert.equal(b.params[1].mint, mint);
    return { ok: true, json: async () => ({ result: { value: ['1070776500534', '57132'].map(amount => ({ account: { data: { parsed: { info: { owner, mint, tokenAmount: { decimals: 6, amount } } } } } })) } }) };
  });
  assert.equal(await f.run(`readUSDC('${owner}')`), '1070776.55');
  const zero = farm('', new Map(), () => ({ ok: true, json: async () => ({ result: { value: [] } }) }));
  assert.equal(await zero.run(`readUSDC('${owner}')`), '0.00');
  const error = farm(); await assert.rejects(error.run(`readUSDC('${owner}')`));
  await error.run(`showWallet('${owner}')`); assert.ok(error.elements.get('walletBalance').textContent.includes('unavailable'));
  await error.run('showWallet(null)'); assert.equal(error.elements.get('wallet').textContent, 'Connect wallet');
});

test('animal produce can be collected once, sold, and all visitor waypoints stay on paths', () => {
  const f = farm(); f.run('syncAnimals(); var coop=S.objects.find(o=>o.type==="coop")');
  f.advance(45000); f.run('collectProduce(coop); collectProduce(coop)'); assert.equal(f.run('S.produce.egg'), 2);
  const before = f.run('S.coins'); f.run(`sellProduce('egg')`); assert.equal(f.run('S.coins'), before + 16);
  assert.equal(f.run(`VISITOR_PATH.every(([x,y])=>{const [i,j]=tileAt(x,y);return GROUND[i][j]==='p'})`), true);
});

test('Phantom connection rejection and account switching stay read-only', async () => {
  const f = farm();
  f.run(`window.phantom={solana:{isPhantom:true,connect:async()=>{throw Error('User rejected')}}}`);
  await f.run(`$('wallet').onclick()`);
  assert.equal(f.elements.get('toast').textContent, 'Wallet connection cancelled');
  assert.equal(f.elements.get('wallet').disabled, false); assert.equal(f.requests.length, 0);
  const zero = farm('', new Map(), () => ({ ok: true, json: async () => ({ result: { value: [] } }) }));
  zero.run(`var events={};window.phantom={solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=> '11111111111111111111111111111111'}}),on:(name,fn)=>events[name]=fn}}`);
  await zero.run(`$('wallet').onclick()`); assert.ok(zero.elements.get('walletBalance').textContent.includes('0.00 USDC'));
  await zero.run(`events.accountChanged(null)`); assert.equal(zero.elements.get('wallet').textContent, 'Connect wallet');
});
