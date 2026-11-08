import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../public/cozy/game.js', import.meta.url), 'utf8').split('// ---------- boot ----------')[0];
const arc = readFileSync(new URL('../public/cozy/arc.js', import.meta.url), 'utf8');
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
  vm.runInContext(arc, c); vm.runInContext(game, c);
  const run = code => vm.runInContext(code, c);
  return { run, advance: ms => now += ms, setTime: value => now = value, storage, elements, requests };
}

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

test('LP and Arc gas quizzes unlock crops; correct answers pay once', () => {
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

test('animal produce can be collected once, sold, and all visitor waypoints stay on paths', () => {
  const f = farm(); f.run('syncAnimals(); var coop=S.objects.find(o=>o.type==="coop")');
  f.advance(45000); f.run('collectProduce(coop); collectProduce(coop)'); assert.equal(f.run('S.produce.egg'), 2);
  const before = f.run('S.coins'); f.run(`sellProduce('egg')`); assert.equal(f.run('S.coins'), before + 16);
  assert.equal(f.run(`VISITOR_PATH.every(([x,y])=>{const [i,j]=tileAt(x,y);return GROUND[i][j]==='p'})`), true);
});


test('Arc farming and recording use labelled demo APYs without network requests', () => {
  const f = farm('?demo&t=day');
  assert.equal(f.requests.length, 0);
  assert.equal(f.run('weatherAt(Date.now())'), 'clear');
  assert.ok(f.run(`rateNote('wheat')`).includes('Demo APY'));
  assert.equal(f.run('arcWallet'), null);
  const normal = farm();
  assert.equal(normal.requests.length, 0);
  assert.equal(normal.run('CROPS.wheat.pool.apy'), 6.2);
  assert.equal(normal.run('LESSONS[4].short'), 'Network fees');
  assert.ok(normal.run(`rateSource('wheat')`).includes('example'));
});
