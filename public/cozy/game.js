// Stable Acres — cozy farm on an empty slab: buy and place buildings, plots and decor on a tile grid.
// Stablecoin yield is layered under the crops (tap a crop to see what it's farming).
// One canvas: slab image + sprites. HUD/sheets are plain DOM.

const MAP_W = 1672, MAP_H = 941;
const DEMO = new URLSearchParams(location.search).has('demo'); // scripted recording run: fresh farm, fast crops, no saving
if (DEMO) { let seed = 0x51ab1e; Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
const GROW_SCALE = DEMO ? 0.3 : 1;
if (new URLSearchParams(location.search).has('debug')) window.__dbg = true; // draw footprints
const DEMO_DAY_MS = 1000; // demo time-warp: 1 real second = 1 day of yield
const STAKE = 10;         // USDC staked under each planted crop

// Fixed demo rates; loadRates replaces each independently with a verified API/cache value.
const CROPS = {
  wheat:      { name: 'Wheat',      grow: 20, cost: 5,  sell: 12, xp: 2, lvl: 1, pool: { token: 'USDC',      where: 'Kamino Lend',         apy: 6.2 } },
  carrot:     { name: 'Carrot',     grow: 45, cost: 10, sell: 26, xp: 4, lvl: 1, pool: { token: 'SOL–USDC',  where: 'Meteora DLMM',        apy: 18.4 } },
  pumpkin:    { name: 'Pumpkin',    grow: 90, cost: 20, sell: 55, xp: 7, lvl: 2, pool: { token: 'JitoSOL',   where: 'Jito liquid staking', apy: 7.9 } },
  strawberry: { name: 'Strawberry', grow: 60, cost: 15, sell: 40, xp: 5, lvl: 3, pool: { token: 'USDC–USDT', where: 'Meteora stable pool', apy: 9.1 } },
};
const XP_FOR = l => 10 + (l - 1) * 15;
// Editable lesson content: three small cards, one question, one first-completion reward.
const LESSONS = [
  { title: 'What is a stablecoin?', short: 'USDC', cards: [
    ['A dollar-shaped token', 'USDC is a digital token designed to track one US dollar. On Solana, it can move between wallet addresses.'],
    ['Designed to stay steady', 'Circle backs USDC with reserves. USDC is redeemable 1:1 for US dollars.'],
    ['Our farm is pretend money', 'The blue balance here is demo USDC. Connecting a wallet only reads its real mainnet USDC balance; planting never moves it.'],
  ], question: 'What does USDC aim to track?', options: ['One US dollar', 'The price of SOL', 'A guaranteed profit'], answer: 0, why: 'USDC is designed to track the US dollar, supported by reserve backing and 1:1 dollar redemption.' },
  { title: 'What is lending yield?', short: 'Lending', cards: [
    ['A shared lending pot', 'A lending service such as Kamino lets people supply tokens that other people may borrow. Borrowers generally put up collateral: assets backing their loan.'],
    ['Where the interest comes from', 'Borrowers pay interest. Some goes to suppliers after protocol charges. When demand to borrow changes, the supply rate can change too.'],
    ['A rate is a snapshot', 'Wheat shows the Kamino main-market USDC supply APY when available. The farm simulates earnings; real lending also has contract and withdrawal-liquidity risks.'],
  ], question: 'Who mainly pays lending interest?', options: ['The wheat sprite', 'Borrowers', 'Every wallet that connects'], answer: 1, why: 'Borrowers pay interest; the protocol distributes a share to suppliers.' },
  { title: 'What is an LP?', short: 'Liquidity pools', unlock: 'Carrot', cards: [
    ['A stall with two baskets', 'A liquidity pool holds tokens that traders can swap between. An LP, or liquidity provider, supplies tokens to that pool.'],
    ['Traders pay a small fee', 'Meteora pools earn trading fees. SOL–USDC uses SOL and USDC. DLMM splits liquidity into price bands, so a position outside the active price may stop earning fees.'],
    ['Fees are not the whole result', 'Your token mix and its value can change. A displayed pool APY estimates recent fees over a year; it is neither a promise nor your personal return. Carrot unlocks after this quiz.'],
  ], question: 'Where do pool trading fees come from?', options: ['Guaranteed rewards', 'The crop timer', 'People swapping tokens'], answer: 2, why: 'Traders pay swap fees. Price changes and position range also affect an LP’s result.' },
  { title: 'Impermanent loss', short: 'The fruit stand', cards: [
    ['Imagine apples and oranges', 'You share a fruit stand with equal value in apples and oranges. The stand lets shoppers swap fruit, and you share its fees.'],
    ['Then apples become dearer', 'Shoppers take apples and leave more oranges as prices change. Your share now contains a different mix than if you had kept your original baskets.'],
    ['Compare with simply holding', 'Your share can be worth less than holding the original mix. That difference is called impermanent loss. Withdrawing can lock it in; fees may or may not cover it. Concentrated pools can amplify this risk.'],
  ], question: 'Do trading fees always cover impermanent loss?', options: ['Yes, always', 'No, they may not', 'Only when it rains'], answer: 1, why: 'Fees can help, but do not guarantee you outperform holding the original tokens.' },
  { title: 'Liquid staking', short: 'JitoSOL', unlock: 'Pumpkin', cards: [
    ['Helping secure Solana', 'Staking delegates SOL to validators, the computers that help run Solana. Staking rewards vary with network conditions and validator performance.'],
    ['A token for a staked share', 'JitoSOL represents a share of SOL staked through Jito’s pool. Rewards generally increase how much SOL each JitoSOL represents rather than adding more tokens to your wallet.'],
    ['Liquid does not mean risk-free', 'You can trade JitoSOL, but its market price can differ from its redemption value. Pool software, validator and unstaking risks remain. JitoSOL is SOL exposure, not a stablecoin.'],
  ], question: 'What does JitoSOL represent?', options: ['A share of staked SOL', 'A dollar guarantee', 'USDC in a bank'], answer: 0, why: 'JitoSOL represents staked SOL. Its dollar value can rise or fall with SOL.' },
  { title: 'APY vs APR', short: 'Reading rates', cards: [
    ['Both look a year ahead', 'APR is an annual rate without compounding. APY includes an assumption that earnings are reinvested and earn more. They are different ways to describe a rate.'],
    ['Today is not a promise', 'A rate based on the last day or week stretches that short period into a yearly estimate. Borrowing demand, trading activity and staking rewards keep changing.'],
    ['Read the label', 'Our pool labels link to the source and show freshness. Demo rates are fixed examples. Farm yield uses a simple estimate and a fast clock; order boosts change only the demo reward.'],
  ], question: 'Which rate includes compounding assumptions?', options: ['APR', 'Both are fixed guarantees', 'APY'], answer: 2, why: 'APY includes compounding assumptions. Neither rate guarantees future earnings.' },
  { title: 'Risk basics', short: 'Before real money', cards: [
    ['Software can fail', 'A smart contract is code that controls on-chain assets. Bugs, exploits or a compromised service can cause losses, even in an audited protocol.'],
    ['Backing and market prices', 'Stablecoins are designed to track their target currency. During market stress, exchange prices can differ from that target; this is called a depeg. Lost keys and limited withdrawal access are separate risks.'],
    ['Keep your choices yours', 'Never invest money you cannot afford to lose. Understand an action, its fees and how to withdraw before signing. This prototype asks for no signature and takes no deposits.'],
  ], question: 'What does an audit guarantee?', options: ['No losses', 'It does not guarantee safety', 'A fixed APY'], answer: 1, why: 'An audit may reduce some risks; it cannot remove all bugs, market risks or losses.' },
];
const CROP_LESSON = { wheat: 1, carrot: 2, pumpkin: 4, strawberry: 2 };
const REQUIRED_LESSON = { carrot: 2, pumpkin: 4 };
const rateState = Object.fromEntries(Object.keys(CROPS).map(k => [k, { mode: 'demo', source: CROPS[k].pool.where }]));
const DEMO_APYS = Object.fromEntries(Object.entries(CROPS).map(([k, c]) => [k, c.pool.apy]));
const RATE_MAX_AGE = 24 * 60 * 60 * 1000;
function rateFresh(r) {
  return r && Number.isFinite(r.apy) && r.apy >= 0 && r.apy <= 10000 &&
    [r.updatedAt, r.observedAt].every(d => Number.isFinite(Date.parse(d)) && Date.now() - Date.parse(d) >= -300000 && Date.now() - Date.parse(d) < RATE_MAX_AGE);
}
function rateNote(k) {
  const r = rateState[k];
  if (r.mode === 'demo' || !rateFresh(r)) return 'Demo rates';
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(r.observedAt)) / 60000));
  return `${r.mode === 'live' ? 'Live' : 'Cached'} · updated ${min < 1 ? 'just now' : min < 60 ? min + ' min ago' : Math.floor(min / 60) + 'h ago'}`;
}
async function loadRates() {
  if (DEMO) return; // no protocol/cache requests: frame-exact, offline-safe demo
  const apply = (key, r, mode) => {
    if (!rateFresh(r) || r.url !== StableRates.sources[key].url || r.source !== StableRates.sources[key].source) return;
    CROPS[key].pool.apy = r.apy; rateState[key] = { ...r, mode };
  };
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem('stable-acres-rates') || '{}'); } catch {}
  Object.keys(CROPS).forEach(k => apply(k, cache[k], 'cached'));
  try {
    const r = await fetch('apys.json', { signal: AbortSignal.timeout(3000) });
    if (r.ok) { const j = await r.json(); Object.keys(CROPS).forEach(k => { if (!rateFresh(cache[k]) || Date.parse(j[k]?.updatedAt) > Date.parse(cache[k].updatedAt)) apply(k, j[k], 'cached'); }); }
  } catch {}
  await Promise.allSettled(Object.keys(CROPS).map(async k => {
    try { const r = await StableRates.fetchRate(k); apply(k, r, 'live'); cache[k] = r; } catch {}
  }));
  try { localStorage.setItem('stable-acres-rates', JSON.stringify(cache)); } catch {}
  renderVault(); if (bubblePlot) renderBubble();
}
function expireRates() {
  for (const [k, r] of Object.entries(rateState)) if (r.mode !== 'demo' && !rateFresh(r)) {
    CROPS[k].pool.apy = DEMO_APYS[k]; rateState[k] = { mode: 'demo', source: CROPS[k].pool.where };
  }
}
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function rateSource(k) {
  const r = rateState[k];
  return r.url ? `<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener">${escapeHTML(r.source)}</a>` : escapeHTML(r.source);
}

// Things you can buy and place. w/h = footprint in tiles.
// Buildings are fitted from their measured ground base (sprites/fit.json) so they sit inside their own tiles.
// trunk: thin-based things (trees, poles) — k = image width vs tile width, anchored at the trunk.
const CATALOG = {
  plot:      { name: 'Soil plot',    cost: 60,  lvl: 1, w: 1, h: 1, ground: true },
  tree:      { name: 'Round tree',   cost: 30,  lvl: 1, w: 1, h: 1, trunk: true, k: 1.2 },
  tree_pink: { name: 'Cherry tree',  cost: 45,  lvl: 1, w: 1, h: 1, trunk: true, k: 1.2 },
  tree_pine: { name: 'Pine tree',    cost: 30,  lvl: 1, w: 1, h: 1, trunk: true, k: 0.72 },
  bush:      { name: 'Flower bush',  cost: 15,  lvl: 1, w: 1, h: 1, k: 0.9 },
  bench:     { name: 'Bench',        cost: 25,  lvl: 1, w: 1, h: 1, trunk: true, k: 0.82, cx: 'img' },
  scarecrow: { name: 'Scarecrow',    cost: 20,  lvl: 1, w: 1, h: 1, trunk: true, k: 0.55 },
  hay:       { name: 'Hay bales',    cost: 20,  lvl: 1, w: 1, h: 1, k: 0.9 },
  well:      { name: 'Well',         cost: 150, lvl: 1, w: 1, h: 1 },
  coop:      { name: 'Chicken coop', cost: 300, lvl: 1, w: 2, h: 2, hens: 3 },
  coin_tree: { name: 'Coin tree',    cost: 100, lvl: 2, w: 1, h: 1, trunk: true, k: 1.05 },
  market:    { name: 'Market stall', cost: 400, lvl: 2, w: 2, h: 2 },
  pond:      { name: 'Pond',         cost: 250, lvl: 2, w: 3, h: 2, flat: true },
  windmill:  { name: 'Windmill',     cost: 500, lvl: 3, w: 2, h: 2, k: 0.95 },
  barn:      { name: 'Red barn',     cost: 800, lvl: 3, w: 3, h: 3 },
  farmhouse: { name: 'Farmhouse',    cost: 0,   lvl: 99, w: 3, h: 3 }, // starter only
};

// Slab tile grid measured on slab-empty.png: centre(i,j) = T + (i+.5)*A + (j+.5)*B.
// g = grass (buildable), p = painted path, r = road.
const T0 = [835, 41], A = [-51.5, 27.56], B = [51.5, 27.31], N = 16;
const GROUND = [
  'gggggpggggggggrr', 'ggggppggggggggrr', 'ggggppggggggggrr', 'ggggppggggggggrr',
  'ggggppggggggggrr', 'ggggpgggggggggrr', 'ppppppppggggggrr', 'gpgggggppppppgrr',
  'gpgggggpggggpprr', 'gpgggggpggggpprr', 'gpgggggpggggpprr', 'gpgggggpggggpppp',
  'gpgggggpgggggrrr', 'gpppppppgggggrrr', 'gggggggggggggrrr', 'pggggggggggggrrr',
];
const tileXY = (i, j) => [T0[0] + (i + .5) * A[0] + (j + .5) * B[0], T0[1] + (i + .5) * A[1] + (j + .5) * B[1]];
function tileAt(wx, wy) { // invert the grid
  const dx = wx - T0[0], dy = wy - T0[1], det = A[0] * B[1] - A[1] * B[0];
  const i = Math.floor((dx * B[1] - dy * B[0]) / det), j = Math.floor((A[0] * dy - A[1] * dx) / det);
  return i >= 0 && i < N && j >= 0 && j < N ? [i, j] : null;
}
// footprint helpers: an object at (i,j) covers rows i..i+h-1, cols j..j+w-1
const fpCenter = (o, c = CATALOG[o.type]) => { const [x1, y1] = tileXY(o.i, o.j), [x2, y2] = tileXY(o.i + c.h - 1, o.j + c.w - 1); return [(x1 + x2) / 2, (y1 + y2) / 2]; };
const fpFront = (o, c = CATALOG[o.type]) => { const [x, y] = tileXY(o.i + c.h - 1, o.j + c.w - 1); return [x + (A[0] + B[0]) / 2, y + (A[1] + B[1]) / 2]; };

// ---------- state ----------
const STARTER = [
  { type: 'farmhouse', i: 1, j: 8 }, { type: 'coop', i: 8, j: 9 },
  ...[[8, 3], [8, 4], [8, 5], [9, 3], [9, 4], [9, 5]].map(([i, j]) => ({ type: 'plot', i, j })),
  { type: 'scarecrow', i: 8, j: 2 }, { type: 'tree', i: 0, j: 0 }, { type: 'tree_pink', i: 2, j: 1 },
  { type: 'tree_pine', i: 0, j: 3 }, { type: 'tree', i: 14, j: 2 }, { type: 'tree_pink', i: 15, j: 6 },
  { type: 'bush', i: 5, j: 7 }, { type: 'tree', i: 4, j: 12 }, { type: 'bush', i: 12, j: 11 },
];
let uid = 1;
const S = { coins: 300, usdc: 100, lvl: 1, xp: 0, objects: STARTER.map(o => ({ ...o })) };
if (DEMO) Object.assign(S, { coins: 1500, lvl: 3 });
else try { Object.assign(S, JSON.parse(localStorage.getItem('stable-acres-2') || '{}')); } catch {}
S.lessons ||= []; S.studyStars ||= 0;
S.inventory ||= {}; S.boosts ||= {}; S.orders ||= []; S.orderSerial ||= 0; S.delivered ||= 0;
S.produce ||= { egg: 0, wool: 0 };
S.objects.forEach(o => { o.id ||= uid++; uid = Math.max(uid, o.id + 1); });
const save = () => { if (!DEMO) try { localStorage.setItem('stable-acres-2', JSON.stringify(S)); } catch {} };
function seedLock(key) {
  const required = REQUIRED_LESSON[key];
  if (!DEMO && required != null && !S.lessons.includes(required)) return `Learn: ${LESSONS[required].title} to unlock`;
  return S.lvl < CROPS[key].lvl ? `Unlocks at level ${CROPS[key].lvl}` : '';
}

function occupant(i, j) {
  return S.objects.find(o => { const c = CATALOG[o.type]; return i >= o.i && i < o.i + c.h && j >= o.j && j < o.j + c.w; });
}
function canPlace(type, i, j) {
  const c = CATALOG[type];
  for (let a = i; a < i + c.h; a++) for (let b = j; b < j + c.w; b++) {
    if (a >= N || b >= N || GROUND[a][b] !== 'g' || occupant(a, b)) return false;
  }
  return true;
}

// ---------- assets ----------
const img = {};
const load = (key, src) => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => r(); i.src = src; img[key] = i; });
const SPRITES = [...['wheat', 'carrot', 'pumpkin', 'strawberry', 'seed', 'sprout', 'young'].map(n => 'crop_' + n), 'coin', 'walk0', 'walk1', 'idle', 'basket', 'hen', 'hen_peck', 'sheep', 'sheep_graze', ...Object.keys(CATALOG).filter(k => k !== 'plot')];

// ---------- canvas + camera ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, fitZ = 1;
const cam = { x: MAP_W / 2, y: MAP_H / 2 + 20, z: 1, tx: null };
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  fitZ = Math.min(W / 1500, H / 860);
  if (!cam.init) { cam.z = fitZ; cam.init = 1; }
}
addEventListener('resize', resize);
const toScreen = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
const flyTo = (x, y, z) => { cam.tx = x; cam.ty = y; cam.tz = z ?? cam.z; };

// ---------- actors ----------
const HOME = tileXY(5, 10); // on the grass in front of the farmhouse
const farmer = { x: HOME[0], y: HOME[1], tx: HOME[0], ty: HOME[1], flip: false, cheer: 0 };
let animals = [];
const RADIUS = { hen: 18, sheep: 27 };
const SPEED = { hen: 32, sheep: 21 };
const isoDist = (ax, ay, bx, by) => Math.hypot(ax - bx, (ay - by) * 2); // ground distance on the iso plane
const walkable = (x, y) => { const t = tileAt(x, y); return t && GROUND[t[0]][t[1]] !== 'r' && !occupant(...t); };
function syncAnimals() { // hens live around each coop
  const want = S.objects.filter(o => ['coop', 'barn'].includes(o.type)).flatMap(o => [...Array(o.type === 'coop' ? CATALOG.coop.hens : 2)].map((_, k) => ({ key: `${o.id}:${k}`, home: o.id, kind: o.type === 'coop' ? 'hen' : 'sheep' })));
  animals = animals.filter(a => want.some(w => w.key === a.key));
  for (const { key, home, kind } of want) if (!animals.some(a => a.key === key)) {
    const coop = S.objects.find(o => o.id === home), [x, y] = fpFront(coop);
    coop.produceAt ||= Date.now() + (kind === 'hen' ? 45000 : 90000);
    const a = { key, home, kind, s: kind === 'hen' ? .23 : .36, x: x + (Math.random() - .5) * 40, y: y + 8 + Math.random() * 12, wait: Math.random() * 2, pose: 0, flip: Math.random() < .5 };
    a.tx = a.x; a.ty = a.y; animals.push(a);
  }
}
function freeSpot(a) {
  const coop = S.objects.find(o => o.id === a.home); if (!coop) return [a.x, a.y];
  const [cx, cy] = fpCenter(coop);
  for (let k = 0; k < 16; k++) {
    const ang = Math.random() * 6.28, r = 90 + Math.random() * 70, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * .5;
    if (!walkable(x, y)) continue;
    if (animals.some(o => o !== a && (isoDist(x, y, o.x, o.y) < RADIUS[a.kind] + RADIUS[o.kind] + 10 || isoDist(x, y, o.tx, o.ty) < RADIUS[a.kind] + RADIUS[o.kind] + 10))) continue;
    return [x, y];
  }
  return [a.x, a.y];
}
function stepAnimals(dt) {
  for (const a of animals) {
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    const want = d > 2 ? SPEED[a.kind] * Math.min(1, d / 18) : 0;
    a.v = (a.v || 0) + (want - (a.v || 0)) * Math.min(1, dt * 4); // ease into a walk, slow on arrival
    if (d > 2) {
      const s = Math.min(d, a.v * dt), nx = a.x + dx / d * s, ny = a.y + dy / d * s;
      if (walkable(nx, ny)) { a.x = nx; a.y = ny; } else [a.tx, a.ty] = freeSpot(a); // never walk into buildings
      if (Math.abs(dx) > 3) a.flip = dx < 0; a.pose = 0;
    }
    a.moving = a.v > 4;
    if (d <= 2 && a.v < 2) { a.wait -= dt; if (a.wait <= 0) { if (Math.random() < .5) [a.tx, a.ty] = freeSpot(a); else a.pose = a.pose ? 0 : 1; a.wait = 1.5 + Math.random() * 3; } }
  }
  for (let i = 0; i < animals.length; i++) for (let j = i + 1; j < animals.length; j++) { // personal space
    const a = animals[i], b = animals[j], min = RADIUS[a.kind] + RADIUS[b.kind];
    const dx = b.x - a.x, dy = (b.y - a.y) * 2, d = Math.hypot(dx, dy) || .01;
    if (d >= min) continue;
    const push = (min - d) / 2, nx = dx / d, ny = dy / d / 2;
    if (walkable(a.x - nx * push, a.y - ny * push)) { a.x -= nx * push; a.y -= ny * push; }
    if (walkable(b.x + nx * push, b.y + ny * push)) { b.x += nx * push; b.y += ny * push; }
    for (const m of [a, b]) if (m.moving) { m.blocked = (m.blocked || 0) + dt; if (m.blocked > .6) { m.blocked = 0; [m.tx, m.ty] = freeSpot(m); } }
  }
}

// ---------- a village that carries on around you ----------
const VISITOR_PATH = [[6,2],[6,3],[6,4],[6,5],[6,6],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[13,6],[13,5],[13,4],[13,3],[13,2],[13,1],[12,1],[11,1],[10,1],[9,1],[8,1],[7,1],[6,1]].map(q => tileXY(...q));
const PATH_LENGTHS = VISITOR_PATH.map((p, i) => Math.hypot(p[0] - VISITOR_PATH[(i + 1) % VISITOR_PATH.length][0], p[1] - VISITOR_PATH[(i + 1) % VISITOR_PATH.length][1]));
const PATH_TOTAL = PATH_LENGTHS.reduce((a, b) => a + b, 0);
const visitors = [{ name: 'Mara', hue: 35, offset: 0 }, { name: 'Ivo', hue: 175, offset: 66 }];
function pathPoint(distance) {
  let d = (distance % PATH_TOTAL + PATH_TOTAL) % PATH_TOTAL;
  for (let i = 0; i < PATH_LENGTHS.length; i++) {
    if (d > PATH_LENGTHS[i]) { d -= PATH_LENGTHS[i]; continue; }
    const a = VISITOR_PATH[i], b = VISITOR_PATH[(i + 1) % VISITOR_PATH.length], f = d / PATH_LENGTHS[i];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, flip: b[0] < a[0] };
  }
}
function stepVillage(t) {
  const cycle = PATH_TOTAL / 29 + 7, phase = (t / 1000) % cycle;
  visitors.forEach(v => { Object.assign(v, pathPoint(Math.max(0, phase - 7) * 29 + v.offset)); v.chat = phase < 7; });
}
function speech(x, y, text) {
  ctx.save(); ctx.font = '500 13px Fredoka, sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = '#fff8ec'; ctx.strokeStyle = '#d8c7a5'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 24, w, 25, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3, y + 1); ctx.lineTo(x, y + 6); ctx.lineTo(x + 4, y + 1); ctx.fill();
  ctx.fillStyle = '#5b4632'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 7); ctx.restore();
}
function drawCar(x, y, color, direction) {
  ctx.save(); ctx.translate(x, y); shadow(0, 6, 29); ctx.rotate(Math.atan2(A[1], A[0]) + (direction < 0 ? Math.PI : 0));
  ctx.fillStyle = '#5b625a';
  for (const a of [-17, 16]) for (const b of [-12, 12]) { ctx.beginPath(); ctx.ellipse(a, b, 6, 3, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = color; ctx.strokeStyle = '#786e55'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(-28, -13, 56, 26, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b9d8db'; ctx.beginPath(); ctx.roundRect(-9, -10, 22, 20, 5); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(-4, -10, 11, 20);
  ctx.fillStyle = '#fff0bd'; ctx.fillRect(22, -9, 3, 5); ctx.fillRect(22, 4, 3, 5); ctx.restore();
}
function drawButterflies(t) {
  for (let k = 0; k < 5; k++) {
    const [bx, by] = tileXY(3 + k * 2, k % 2 ? 10 : 3), a = t / 1500 + k * 2;
    const x = bx + Math.sin(a * .35) * 72, y = by - 40 + Math.cos(a * .53) * 30;
    const wing = .25 + Math.abs(Math.sin(t / 95 + k)) * .75;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(a) * .4); ctx.globalAlpha = .8;
    ctx.fillStyle = ['#e9c269', '#dd9fa8', '#f9e6b5'][k % 3];
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 3 * wing, 0, 4 * wing, 5, side * .3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#776953'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 4); ctx.stroke(); ctx.restore();
  }
}
function collectProduce(home) {
  if (!home || !home.produceAt || Date.now() < home.produceAt) return;
  const egg = home.type === 'coop', key = egg ? 'egg' : 'wool', amount = egg ? 2 : 1;
  S.produce[key] = (S.produce[key] || 0) + amount;
  home.produceAt = Date.now() + (egg ? 45000 : 90000);
  const [x, y] = fpFront(home); puff(x, y - 20, '#fff0ba', 8); sfx('pluck');
  floatText(x, y - 60, `+${amount} ${egg ? 'eggs' : 'wool'} · basket`, '#4f733b');
  gainXp(2); save(); hud(); toast(egg ? 'Fresh eggs! Sell them in Orders.' : 'Soft wool! Sell it in Orders.');
}

const fx = [];
const CLOUDS = [{ x: 200, y: 300, r: 260, v: 14 }, { x: 1100, y: 600, r: 320, v: 11 }, { x: -300, y: 760, r: 220, v: 17 }];

// ---------- weather (fixed 3-minute buckets, seeded and integrated across boundaries) ----------
const WEATHER_MS = 180000;
const WEATHER_OVERRIDE = new URLSearchParams(location.search).get('weather');
function weatherAt(time) {
  if (['rain', 'clear', 'cloudy'].includes(WEATHER_OVERRIDE)) return WEATHER_OVERRIDE;
  if (DEMO) return 'clear';
  let n = (Math.floor(time / WEATHER_MS) ^ 0x5a17c9) | 0;
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = (n ^ n >>> 16) >>> 0;
  return n % 10 < 5 ? 'clear' : n % 10 < 8 ? 'cloudy' : 'rain';
}
function growthElapsed(p, now = Date.now()) {
  const elapsed = Math.max(0, now - p.t0), max = growMs(p);
  if (elapsed >= max) return max; // mature; no need to scan long offline periods
  let total = 0, from = p.t0;
  while (from < now) {
    const to = Math.min(now, (Math.floor(from / WEATHER_MS) + 1) * WEATHER_MS);
    total += (to - from) * (weatherAt(from) === 'rain' ? 1.1 : 1); from = to;
  }
  return total;
}
function renderWeather() {
  const w = weatherAt(Date.now());
  $('weather').textContent = { clear: '☀ Clear', cloudy: '☁ Cloudy', rain: '🌧 Rain · +10% growth' }[w];
}
function drawWeather(t) {
  const w = weatherAt(Date.now());
  if (w === 'clear') return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = w === 'rain' ? 'rgba(42,64,85,.13)' : 'rgba(74,95,113,.06)'; ctx.fillRect(0, 0, W, H);
  if (w !== 'rain') return;
  ctx.save(); ctx.strokeStyle = 'rgba(225,244,255,.55)'; ctx.lineWidth = 1.25;
  for (let k = 0; k < 90; k++) {
    const x = ((k * 139.7 + t * .045) % (W + 50)) - 25, y = (k * 89.3 + t * .42) % (H + 40) - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const phase = (t / 1100 + k * .173) % 1, x = k * 173.3 % W, y = H * .36 + (k * 79.7 % (H * .55));
    ctx.strokeStyle = `rgba(225,244,255,${(1 - phase) * .28})`;
    ctx.beginPath(); ctx.ellipse(x, y, 2 + phase * 8, 1 + phase * 3, 0, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

// ---------- crops ----------
const growMs = p => CROPS[p.crop].grow * 1000 * GROW_SCALE;
const progress = p => Math.min(1, growthElapsed(p) / growMs(p));
const earned = p => STAKE * (p.rateApy ?? CROPS[p.crop].pool.apy) * (p.boost || 1) / 100 / 365 * (Math.max(0, Math.min(Date.now() - p.t0, growMs(p) * 3)) / DEMO_DAY_MS);
// ponytail: yield accrues up to 3x the grow time, then caps so idle tabs don't mint silly numbers.

function plant(p, key) {
  const c = CROPS[key];
  if (p.crop || seedLock(key)) return false;
  if (S.coins < c.cost) { toast('Not enough coins'); return false; }
  if (S.usdc < STAKE) { toast('Not enough demo USDC · harvest a crop first'); return false; }
  S.coins -= c.cost; S.usdc -= STAKE; p.crop = key; p.t0 = Date.now(); p.pop = 1;
  p.rateApy = c.pool.apy; p.boost = S.boosts[key] > 0 ? 1.25 : 1;
  if (p.boost > 1) S.boosts[key]--;
  const [x, y] = tileXY(p.i, p.j);
  puff(x, y, '#b98a5a', 6); sfx('plant'); walkTo(x + 20, y + 14);
  save(); hud(); return true;
}
function harvest(p) {
  if (!p.crop || progress(p) < 1) return;
  const c = CROPS[p.crop], [x, y] = tileXY(p.i, p.j), y_ = earned(p);
  S.inventory[p.crop] = (S.inventory[p.crop] || 0) + 1; S.usdc += STAKE + y_;
  floatText(x, y - 50, `+1 ${c.name} · Orders`, '#4f733b'); floatText(x, y - 80, `+${y_.toFixed(4)} demo USDC`, '#2f6fd0', 250);
  puff(x, y, '#f6d36b', 10); sfx('pluck'); setTimeout(() => sfx('coin'), 110);
  p.crop = null; farmer.cheer = 1.4; walkTo(x + 20, y + 14);
  gainXp(c.xp); save(); hud(); closeBubble();
}

// ---------- orders + basket ----------
const VILLAGERS = ['Mara the baker', 'Ivo next door', 'Nia at the market', 'Sol the gardener'];
function rollOrder() {
  const id = ++S.orderSerial, keys = Object.keys(CROPS).filter(k => !seedLock(k));
  const crop = keys[(id - 1) % keys.length], needs = { [crop]: 2 + (id % 3 === 0 ? 1 : 0) };
  if (keys.length > 1 && id % 2 === 0) needs[keys[id % keys.length]] = 1;
  const market = Object.entries(needs).reduce((sum, [k, n]) => sum + CROPS[k].sell * n, 0);
  return { id, villager: VILLAGERS[(id - 1) % VILLAGERS.length], needs, coins: Math.ceil(market * 1.3) + 2, xp: 5, boost: crop };
}
function ensureOrders() { while (S.orders.length < 3) S.orders.push(rollOrder()); }
const orderReady = o => Object.entries(o.needs).every(([k, n]) => (S.inventory[k] || 0) >= n);
function deliverOrder(id) {
  const i = S.orders.findIndex(o => o.id === id), o = S.orders[i];
  if (!o || !orderReady(o)) return;
  for (const [k, n] of Object.entries(o.needs)) S.inventory[k] -= n;
  S.coins += o.coins; S.delivered++; S.boosts[o.boost] = (S.boosts[o.boost] || 0) + 1;
  gainXp(o.xp); S.orders[i] = rollOrder();
  flyCoins(farmer.x, farmer.y - 30, 6); sfx('coin');
  toast(`Delivered! +${o.coins}¢ · next ${CROPS[o.boost].name} gets 1.25× demo yield`);
  save(); hud(); renderOrders(); renderSeeds();
}
function sellCrop(key, all = false) {
  const count = S.inventory[key] || 0; if (!count || !CROPS[key]) return;
  const n = all ? count : 1; S.inventory[key] -= n; S.coins += CROPS[key].sell * n;
  flyCoins(farmer.x, farmer.y - 30, 4); sfx('coin');
  save(); hud(); renderOrders();
}
function sellProduce(key) {
  const n = S.produce[key] || 0, price = { egg: 8, wool: 18 }[key]; if (!n || !price) return;
  S.coins += n * price; S.produce[key] = 0;
  flyCoins(farmer.x, farmer.y - 30, 4); sfx('coin'); save(); hud(); renderOrders();
}
function renderOrders() {
  ensureOrders();
  $('orderCount').textContent = `${S.delivered} delivered · 30%+ above market · no expiry`;
  $('orderCards').innerHTML = S.orders.map(o => `<article class="order-card"><h4>${o.villager}</h4>
    <p>${Object.entries(o.needs).map(([k, n]) => `${n} ${CROPS[k].name} <small>(${S.inventory[k] || 0}/${n})</small>`).join(' + ')}</p>
    <small>${o.coins}¢ + ${o.xp} XP · next ${CROPS[o.boost].name}: 1.25× demo yield for one cycle</small>
    <button class="btn" data-deliver="${o.id}" ${orderReady(o) ? '' : 'disabled'}>${orderReady(o) ? 'Deliver order' : 'Harvest to fill'}</button></article>`).join('');
  $('inventoryRows').innerHTML = Object.entries(CROPS).map(([k, c]) => `<div class="inventory-row"><img src="sprites/${k}.png" alt=""><span><b>${c.name} × ${S.inventory[k] || 0}</b><small>${c.sell}¢ each${S.boosts[k] ? ` · ${S.boosts[k]} queued boost` : ''}</small></span>
    <button class="textbtn" data-sell="${k}" ${(S.inventory[k] || 0) ? '' : 'disabled'}>Sell 1</button>
    <button class="textbtn" data-sell-all="${k}" ${(S.inventory[k] || 0) ? '' : 'disabled'}>Sell all</button></div>`).join('') +
    [['egg', 'Eggs', 8], ['wool', 'Wool', 18]].map(([k, name, price]) => `<div class="inventory-row"><span><b>${name} × ${S.produce[k] || 0}</b><small>${price}¢ each · tap a ready animal or its home</small></span><button class="textbtn" data-produce="${k}" ${S.produce[k] ? '' : 'disabled'}>Sell all</button></div>`).join('');
}
function gainXp(n) {
  S.xp += n;
  while (S.xp >= XP_FOR(S.lvl)) {
    S.xp -= XP_FOR(S.lvl); S.lvl++;
    const un = [...Object.values(CROPS), ...Object.values(CATALOG)].filter(c => c.lvl === S.lvl).map(c => c.name);
    toast(`Level ${S.lvl}!` + (un.length ? ` Unlocked: ${un.join(', ')}` : ''));
    sfx('chime'); renderSeeds(); renderShop(); burst($('lvl'));
  }
}
const walkTo = (x, y) => { farmer.tx = x; farmer.ty = y; };

// ---------- building ----------
let placing = null; // { type, i, j, ok }
function startPlacing(type) {
  placing = { type, i: -1, j: -1, ok: false };
  closeSheets(); closeBubble(); $('placebar').classList.add('show');
  $('placeName').textContent = `Place: ${CATALOG[type].name} · ${CATALOG[type].cost}¢`;
}
function stopPlacing() { placing = null; $('placebar').classList.remove('show'); }
function placeAt(i, j) {
  const c = CATALOG[placing.type];
  if (!canPlace(placing.type, i, j)) { toast('Can’t build there'); sfx('tap'); return; }
  if (S.coins < c.cost) { toast('Not enough coins'); stopPlacing(); return; }
  S.coins -= c.cost;
  const o = { id: uid++, type: placing.type, i, j, born: performance.now() };
  S.objects.push(o);
  const [x, y] = fpCenter(o);
  puff(x, y, '#d9c3a0', 14 + c.w * c.h * 3); sfx('build');
  cam.shake = c.w * c.h >= 4 ? .9 : .35; // big things land with a thump
  walkTo(...fpFront(o)); gainXp(Math.max(1, Math.round(c.cost / 50)));
  if (['coop', 'barn'].includes(placing.type)) syncAnimals();
  save(); hud();
  if (placing.type !== 'plot' || S.coins < c.cost) stopPlacing(); // plots: keep placing until you stop
}

// ---------- input ----------
let down = null, dragged = false, selSeed = null, sheetOpen = false, bubblePlot = null;
cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; dragged = false; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (placing) { const t = tileAt(...toWorld(e.clientX, e.clientY)); if (t) { placing.i = t[0]; placing.j = t[1]; placing.ok = canPlace(placing.type, ...t); } }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (sheetOpen && selSeed) { // swipe to plant a row
    const t = tileAt(...toWorld(e.clientX, e.clientY)), o = t && occupant(...t);
    if (o?.type === 'plot' && !o.crop) { plant(o, selSeed); dragged = true; }
    return;
  }
  if (!dragged && Math.hypot(dx, dy) > 6) { dragged = true; cv.classList.add('drag'); }
  if (dragged) { cam.x = down.cx - dx / cam.z; cam.y = down.cy - dy / cam.z; cam.tx = null; clampCam(); }
});
cv.addEventListener('pointerup', e => { cv.classList.remove('drag'); if (down && !dragged) tap(e.clientX, e.clientY); down = null; });
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [wx, wy] = toWorld(e.clientX, e.clientY), z = clampZ(cam.z * Math.exp(-e.deltaY * 0.0015));
  cam.x = wx - (e.clientX - W / 2) / z; cam.y = wy - (e.clientY - H / 2) / z; cam.z = z; cam.tx = null; clampCam();
}, { passive: false });
const clampZ = z => Math.max(fitZ * 0.9, Math.min(fitZ * 3, z));
function clampCam() { cam.x = Math.max(200, Math.min(MAP_W - 200, cam.x)); cam.y = Math.max(120, Math.min(MAP_H - 120, cam.y)); }

function tap(sx, sy) {
  const t = tileAt(...toWorld(sx, sy));
  if (placing) { if (t) placeAt(...t); return; }
  const o = t && occupant(...t);
  const [wx, wy] = toWorld(sx, sy);
  const animal = animals.find(a => isoDist(wx, wy + (a.kind === 'hen' ? 20 : 35), a.x, a.y) < (a.kind === 'hen' ? 35 : 45));
  if (animal && !sheetOpen) {
    const home = S.objects.find(o => o.id === animal.home);
    if (Date.now() >= home.produceAt) collectProduce(home);
    else toast(animal.kind === 'hen' ? 'A happy hen · eggs will be ready soon' : 'Grazing peacefully · wool will be ready soon');
    return;
  }
  if (o && ['coop', 'barn'].includes(o.type) && !sheetOpen) { collectProduce(o); return; }
  if (!o && t && expansionTiles().some(([a, b]) => a === t[0] && b === t[1])) { // buy the next plot
    if (S.coins < CATALOG.plot.cost) { toast('Not enough coins'); return; }
    placing = { type: 'plot' }; placeAt(...t); stopPlacing(); return;
  }
  if (!o || o.type !== 'plot') { closeBubble(); return; }
  if (!o.crop) {
    if (sheetOpen && selSeed) { plant(o, selSeed); return; }
    closeBubble(); openSheet('seedSheet'); return;
  }
  if (progress(o) >= 1) { harvest(o); return; }
  openBubble(o);
}

// ---------- DOM ui ----------
const $ = id => document.getElementById(id);
function hud() {
  $('coins').textContent = Math.floor(S.coins);
  $('usdc').textContent = S.usdc.toFixed(2);
  $('lvl').textContent = S.lvl;
  $('xp').style.transform = `scaleX(${Math.min(1, S.xp / XP_FOR(S.lvl))})`;
  renderShop();
  if ($('orders').classList.contains('open')) renderOrders();
}
function renderSeeds() {
  $('seeds').innerHTML = Object.entries(CROPS).map(([k, c]) => {
    const reason = seedLock(k), locked = !!reason;
    return `<button class="seed ${locked ? 'locked' : ''} ${selSeed === k ? 'sel' : ''}" data-k="${k}" aria-pressed="${selSeed === k}" aria-label="${c.name}${locked ? ': ' + reason : ''}">
      <img src="sprites/${k}.png" alt=""><b>${c.name}</b>
      <span class="meta">${locked ? `🔒 ${reason}` : `${Math.round(c.grow * GROW_SCALE)}s · ${c.cost}¢ → ${c.sell}¢${S.boosts[k] ? '<br>Next crop: 1.25× demo yield' : ''}`}</span></button>`;
  }).join('');
}
function renderShop() {
  const el = $('shopItems'); if (!el) return;
  el.innerHTML = Object.entries(CATALOG).filter(([, c]) => c.lvl < 99).map(([k, c]) => {
    const locked = S.lvl < c.lvl, poor = S.coins < c.cost;
    return `<button class="seed ${locked ? 'locked' : ''}" data-buy="${k}" ${locked ? 'disabled' : ''}>
      <img src="sprites/${k}.png" alt=""><b>${c.name}</b>
      <span class="meta">${locked ? `🔒 Unlocks at level ${c.lvl}` : `<span class="${poor ? 'poor' : ''}">${c.cost}¢</span> · ${c.w}×${c.h}`}</span></button>`;
  }).join('');
}
$('seeds').addEventListener('click', e => {
  const el = e.target.closest('.seed'); if (!el) return;
  if (el.classList.contains('locked')) { const id = REQUIRED_LESSON[el.dataset.k]; if (id != null && !S.lessons.includes(id)) openLesson(id); return; }
  selSeed = el.dataset.k; renderSeeds();
});
$('shopItems').addEventListener('click', e => {
  const el = e.target.closest('.seed'); if (!el || el.classList.contains('locked')) return;
  const k = el.dataset.buy; if (S.coins < CATALOG[k].cost) { toast('Not enough coins'); return; }
  startPlacing(k);
});
function openSheet(id) {
  stopPlacing();
  for (const s of document.querySelectorAll('.sheet')) { s.classList.toggle('open', s.id === id); s.inert = s.id !== id; }
  sheetOpen = id === 'seedSheet';
  if (sheetOpen && !selSeed) { selSeed = 'wheat'; renderSeeds(); }
  if (id === 'vault') renderVault();
  if (id === 'learn') renderLearn();
  if (id === 'orders') { renderOrders(); save(); }
  if (id === 'settings') renderAudioSettings();
}
function closeSheets() { for (const s of document.querySelectorAll('.sheet')) { s.classList.remove('open'); s.inert = true; } sheetOpen = false; }
addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheets(); closeBubble(); stopPlacing(); } });
document.addEventListener('click', e => { if (e.target.matches('[data-close]')) closeSheets(); });
$('bSeeds').onclick = () => { closeBubble(); openSheet('seedSheet'); };
$('bShop').onclick = () => { closeBubble(); openSheet('shop'); };
$('bVault').onclick = () => { closeBubble(); openSheet('vault'); };
$('bLearn').onclick = () => { closeBubble(); lessonId = null; openSheet('learn'); };
$('bOrders').onclick = () => { closeBubble(); openSheet('orders'); };
$('orders').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.deliver) deliverOrder(+b.dataset.deliver);
  if (b.dataset.sell) sellCrop(b.dataset.sell);
  if (b.dataset.sellAll) sellCrop(b.dataset.sellAll, true);
  if (b.dataset.produce) sellProduce(b.dataset.produce);
});
$('bHome').onclick = () => { closeSheets(); closeBubble(); stopPlacing(); flyTo(MAP_W / 2, MAP_H / 2 + 20, fitZ); };
$('placeCancel').onclick = stopPlacing;

function openBubble(p) { bubblePlot = p; $('bubble').style.display = 'block'; closeSheets(); const [x, y] = tileXY(p.i, p.j); flyTo(x, y - 40, Math.max(cam.z, fitZ * 1.6)); renderBubble(); }
function closeBubble() { bubblePlot = null; $('bubble').style.display = 'none'; }
function renderBubble() {
  const p = bubblePlot; if (!p || !p.crop) return closeBubble();
  const c = CROPS[p.crop], pr = progress(p), left = Math.ceil((1 - pr) * c.grow * GROW_SCALE / (weatherAt(Date.now()) === 'rain' ? 1.1 : 1));
  $('bubble').innerHTML = `
    <div class="hd"><img src="sprites/${p.crop}.png" alt="">${c.name}</div>
    <div class="pool">Farming <b>${c.pool.token}</b> · <b>${c.pool.apy.toFixed(2)}% APY</b><small>${rateSource(p.crop)}<br>${rateNote(p.crop)}</small></div>
    <div class="row"><span>Demo stake</span><span>${STAKE.toFixed(2)} USDC</span></div>
    <div class="row"><span>Demo earned</span><span>${earned(p).toFixed(5)} USDC</span></div>
    <small>Demo cycle: ${(p.rateApy ?? c.pool.apy).toFixed(2)}% × ${p.boost || 1}${p.boost > 1 ? ' order boost' : ''} · fast clock</small>
    <div class="row"><span>Ready in</span><span>${pr >= 1 ? 'now' : left + 's'}</span></div>
    <button class="textbtn" id="whatsThis">What's this?</button>
    <button class="btn" id="hv" ${pr >= 1 ? '' : 'disabled'}>${pr >= 1 ? 'Harvest' : 'Growing…'}</button>`;
  const b = $('hv'); if (b && pr >= 1) b.onclick = () => harvest(p);
  $('whatsThis').onclick = () => openLesson(CROP_LESSON[p.crop]);
}

// ---------- Learn ----------
let lessonId = null, lessonCard = 0, lessonFeedback = '';
function openLesson(id) { closeBubble(); lessonId = id; lessonCard = 0; lessonFeedback = ''; openSheet('learn'); }
function renderLearn() {
  $('studyStars').textContent = `${S.studyStars} Study Star${S.studyStars === 1 ? '' : 's'} · ${S.lessons.length}/${LESSONS.length} lessons`;
  if (lessonId == null) {
    $('lessonContent').innerHTML = LESSONS.map((l, i) => `<button class="lesson-row" data-lesson="${i}"><span><b>${i + 1}. ${l.title}</b><small>${l.unlock ? `Unlocks ${l.unlock} · ` : ''}3 cards + a quick question</small></span><span>${S.lessons.includes(i) ? '✓ Studied' : 'Start →'}</span></button>`).join('');
    return;
  }
  const l = LESSONS[lessonId], quiz = lessonCard === l.cards.length;
  $('lessonContent').innerHTML = `<button class="textbtn" data-lessons>← All lessons</button>
    <div class="lesson-progress">${l.title} · ${quiz ? 'Quick question' : `Card ${lessonCard + 1} of ${l.cards.length}`}</div>
    <div class="lesson-card"><h4>${quiz ? l.question : l.cards[lessonCard][0]}</h4>
    ${quiz ? l.options.map((a, i) => `<button class="answer" data-answer="${i}">${a}</button>`).join('') : `<p>${l.cards[lessonCard][1]}</p>`}
    <p class="feedback" role="status">${lessonFeedback}</p></div>
    <div class="lesson-actions">${lessonCard ? '<button class="textbtn" data-previous>← Back</button>' : '<span></span>'}${quiz ? `<small>${S.lessons.includes(lessonId) ? 'Reward already collected' : 'First correct answer: 20¢ + 4 XP + 1 Study Star'}</small>` : '<button class="btn" data-next>Continue →</button>'}</div>`;
}
$('lessonContent').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.lesson != null) return openLesson(+b.dataset.lesson);
  if (b.hasAttribute('data-lessons')) lessonId = null;
  if (b.hasAttribute('data-next')) { lessonCard++; lessonFeedback = ''; }
  if (b.hasAttribute('data-previous')) { lessonCard--; lessonFeedback = ''; }
  if (b.dataset.answer != null) {
    const l = LESSONS[lessonId], correct = +b.dataset.answer === l.answer;
    lessonFeedback = correct ? `That's right. ${l.why}` : `Try again. ${l.why}`;
    if (correct && !S.lessons.includes(lessonId)) {
      S.lessons.push(lessonId); S.studyStars++; S.coins += 20; gainXp(4); save(); hud(); renderSeeds();
      toast(l.unlock ? `${l.unlock} lesson complete! +1 Study Star` : '+1 Study Star · +20¢ · +4 XP');
      burst($('lvl'));
    }
  }
  renderLearn();
};
function renderVault() {
  const live = S.objects.filter(p => p.crop);
  const staked = live.length * STAKE, earnedSum = live.reduce((a, p) => a + earned(p), 0);
  const apy = live.length ? live.reduce((a, p) => a + CROPS[p.crop].pool.apy, 0) / live.length : 0;
  $('rateStatus').textContent = Object.keys(CROPS).map(k => `${CROPS[k].name}: ${rateNote(k)}`).join(' · ');
  $('vStaked').textContent = staked.toFixed(2) + ' USDC';
  $('vEarned').textContent = earnedSum.toFixed(4);
  $('vApy').textContent = live.length ? apy.toFixed(1) + '%' : '–';
  const by = {};
  for (const p of live) (by[p.crop] ||= []).push(p);
  $('vRows').innerHTML = Object.entries(by).map(([k, ps]) => {
    const c = CROPS[k];
    return `<div class="pos"><img src="sprites/${k}.png" alt=""><div class="grow"><b>${ps.length} × ${c.name}</b>
      <small>${c.pool.token} · ${rateSource(k)}<br>${rateNote(k)}</small></div><div><b>${c.pool.apy.toFixed(2)}% APY</b><small>${ps.reduce((a, p) => a + earned(p), 0).toFixed(4)} demo earned</small></div></div>`;
  }).join('') || '<p class="sub">Nothing growing yet. Plant something!</p>';
}

let toastT;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function floatText(wx, wy, text, color, delay = 0) {
  setTimeout(() => {
    const [sx, sy] = toScreen(wx, wy), el = document.createElement('div');
    el.className = 'float'; el.textContent = text; el.style.color = color;
    el.style.left = sx + 'px'; el.style.top = sy + 'px'; el.style.transform = 'translateX(-50%)';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
  }, delay);
}
function flyCoins(wx, wy, n) {
  const r = $('coinsPill').getBoundingClientRect(), [sx, sy] = toScreen(wx, wy);
  for (let k = 0; k < n; k++) {
    const el = document.createElement('img'); el.src = 'sprites/coin.png';
    Object.assign(el.style, { position: 'fixed', width: '26px', left: sx + 'px', top: sy + 'px', pointerEvents: 'none', zIndex: 5 });
    document.body.appendChild(el);
    const dx = r.left + 18 - sx, dy = r.top + 10 - sy, spread = (k - n / 2) * 18;
    el.animate([
      { transform: 'translate(0,0) scale(.6)' },
      { transform: `translate(${spread}px,-60px) scale(1)`, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) scale(.7)` },
    ], { duration: 800 + k * 70, easing: 'cubic-bezier(.5,0,.6,1)' }).onfinish = () => { el.remove(); bump($('coinsPill')); };
  }
}
function burst(el) { // little gold sparks flying out of a HUD element
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let k = 0; k < 12; k++) {
    const d = document.createElement('div'), a = k / 12 * 6.28, dist = 34 + Math.random() * 24;
    Object.assign(d.style, { position: 'fixed', left: cx - 4 + 'px', top: cy - 4 + 'px', width: '8px', height: '8px', borderRadius: '50%', background: k % 2 ? '#f2b736' : '#fff3c4', pointerEvents: 'none', zIndex: 6 });
    document.body.appendChild(d);
    d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) scale(.3)`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => d.remove();
  }
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
}
const bump = el => el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 200 });

// ---------- wallet (read-only; never requests a signature or moves funds) ----------
// https://solana.com/docs/rpc/http/gettokenaccountsbyowner — jsonParsed, mainnet USDC mint.
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Vibe Station returned jsonParsed accounts + CORS; the Foundation endpoint can rate-limit/block.
const WALLET_RPCS = ['https://public.rpc.solanavibestation.com', 'https://api.mainnet-beta.solana.com'];
let walletAddress = null, walletRead = 0, walletProvider = null;
async function readUSDC(address) {
  let lastError;
  for (const url of WALLET_RPCS) try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [address, { mint: USDC_MINT }, { encoding: 'jsonParsed', commitment: 'confirmed' }] }) });
    if (!r.ok) throw Error(`RPC HTTP ${r.status}`);
    const j = await r.json();
    if (j.error || !Array.isArray(j.result?.value)) throw Error(j.error?.message || 'Invalid RPC response');
    let raw = 0n;
    for (const a of j.result.value) {
      const info = a.account?.data?.parsed?.info, amount = info?.tokenAmount;
      if (info?.mint !== USDC_MINT || info.owner !== address || amount?.decimals !== 6 || !/^\d+$/.test(amount.amount)) throw Error('Unexpected token account');
      raw += BigInt(amount.amount);
    }
    return `${raw / 1000000n}.${(raw % 1000000n / 10000n).toString().padStart(2, '0')}`;
  } catch (e) { lastError = e; }
  throw lastError;
}
async function showWallet(address) {
  const request = ++walletRead; walletAddress = address;
  $('wallet').textContent = address ? address.slice(0, 4) + '…' + address.slice(-4) : 'Connect wallet';
  $('walletBalance').textContent = address ? 'Reading mainnet USDC…' : 'Read-only · Solana mainnet';
  if (!address) return;
  try {
    const balance = await readUSDC(address);
    if (request === walletRead) $('walletBalance').textContent = `Wallet: ${balance} USDC · mainnet`;
  } catch {
    if (request === walletRead) $('walletBalance').textContent = 'Wallet balance unavailable · tap to retry';
  }
}
$('walletBalance').onclick = () => { if (walletAddress) showWallet(walletAddress); };
$('wallet').onclick = async () => {
  if (DEMO) { toast('Recording mode · wallet reads disabled'); return; }
  if (walletAddress) { showWallet(walletAddress); return; }
  const sol = window.phantom?.solana || window.solana;
  if (!sol?.isPhantom) { $('walletBalance').textContent = 'Phantom not found · demo play available'; toast('Install Phantom to read a wallet balance'); return; }
  $('wallet').disabled = true;
  try {
    const r = await sol.connect();
    if (walletProvider !== sol) {
      walletProvider = sol;
      sol.on?.('accountChanged', a => showWallet(a?.toString() || null));
      sol.on?.('disconnect', () => showWallet(null));
    }
    await showWallet(r.publicKey.toString());
  }
  catch { toast('Wallet connection cancelled'); }
  finally { $('wallet').disabled = false; }
};

// ---------- local, licensed Web Audio (including iOS volume control) ----------
const audioPrefs = { music: true, effects: true, volume: 45 };
try { Object.assign(audioPrefs, JSON.parse(localStorage.getItem('stable-acres-audio') || '{}')); } catch {}
audioPrefs.volume = Math.max(0, Math.min(100, Number(audioPrefs.volume) || 0));
let ac, musicGain, effectsGain, musicSource, audioLoading, audioStarted = false;
const audioBuffers = {};
function saveAudio() { if (!DEMO) try { localStorage.setItem('stable-acres-audio', JSON.stringify(audioPrefs)); } catch {} }
function applyAudio() {
  if (ac) {
    musicGain.gain.setTargetAtTime(audioPrefs.music ? audioPrefs.volume / 100 * .45 : 0, ac.currentTime, .08);
    effectsGain.gain.setTargetAtTime(audioPrefs.effects ? .45 : 0, ac.currentTime, .03);
  }
  $('bSound').setAttribute('aria-label', `Sound settings · music ${audioPrefs.music ? 'on' : 'off'}`);
  $('bSound').classList.toggle('muted', !audioPrefs.music);
}
async function loadAudio(key, url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Error('Audio unavailable');
  audioBuffers[key] = await ac.decodeAudioData(await r.arrayBuffer());
}
async function startAudio() {
  if (DEMO) return; // recording is deterministic and silent
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    audioStarted = true;
    // Resume synchronously inside the trusted first pointer/key event for iOS.
    if (!document.hidden) await ac.resume();
    if (!musicGain) {
      musicGain = ac.createGain(); musicGain.gain.value = 0; musicGain.connect(ac.destination);
      effectsGain = ac.createGain(); effectsGain.gain.value = .45; effectsGain.connect(ac.destination);
    }
    applyAudio();
    if (!audioLoading) audioLoading = Promise.allSettled([
      loadAudio('music', 'music/carefree.mp3'),
      ...['plant', 'pluck', 'coin', 'build', 'chime', 'tap'].map(k => loadAudio(k, `sounds/${k}.mp3`)),
    ]).then(() => {
      if (audioBuffers.music && !musicSource) {
        musicSource = ac.createBufferSource(); musicSource.buffer = audioBuffers.music; musicSource.loop = true;
        musicSource.connect(musicGain); musicSource.start();
      }
      $('audioStatus').textContent = audioBuffers.music ? 'Carefree — Kevin MacLeod · CC BY 4.0' : 'Audio unavailable · reopen Sound to retry';
      if (!audioBuffers.music) audioLoading = null;
    });
    await audioLoading;
    if (document.hidden) await ac.suspend();
  } catch { $('audioStatus').textContent = 'Audio could not start · tap Sound to retry'; }
}
function sfx(key) {
  if (!ac || ac.state !== 'running' || !audioPrefs.effects || !audioBuffers[key]) return;
  const s = ac.createBufferSource(); s.buffer = audioBuffers[key]; s.connect(effectsGain); s.start();
}
document.addEventListener('pointerdown', () => { if (!audioStarted) startAudio(); }, { capture: true });
document.addEventListener('keydown', () => { if (!audioStarted) startAudio(); }, { capture: true });
document.addEventListener('click', e => { if (e.target.closest('button')) sfx('tap'); });
document.addEventListener('visibilitychange', () => { if (ac && audioStarted) (document.hidden ? ac.suspend() : ac.resume()).catch(() => {}); });
function renderAudioSettings() {
  $('musicOn').checked = !!audioPrefs.music; $('effectsOn').checked = !!audioPrefs.effects;
  $('musicVolume').value = audioPrefs.volume; $('volumeValue').textContent = audioPrefs.volume + '%';
}
$('bSound').onclick = () => { startAudio(); closeBubble(); openSheet('settings'); };
$('musicOn').onchange = e => { audioPrefs.music = e.target.checked; applyAudio(); saveAudio(); };
$('effectsOn').onchange = e => { audioPrefs.effects = e.target.checked; applyAudio(); saveAudio(); };
$('musicVolume').oninput = e => { audioPrefs.volume = +e.target.value; $('volumeValue').textContent = audioPrefs.volume + '%'; applyAudio(); saveAudio(); };
applyAudio();
function puff(x, y, color, n) { for (let k = 0; k < n; k++) fx.push({ x, y, vx: (Math.random() - .5) * 110, vy: -Math.random() * 80 - 20, life: 1, color, r: 4 + Math.random() * 5 }); }

// ---------- draw ----------
function sprite(name, x, y, scale, { flip = false, ax = .5, ay = 1, sx = 1, sy = 1, alpha = 1 } = {}) {
  const im = img[name]; if (!im?.width) return;
  const w = im.width * scale * sx, h = im.height * scale * sy;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w * ax, -h * ay, w, h); ctx.restore();
}
const TILE_W = Math.abs(A[0]) + Math.abs(B[0]), TILE_H = A[1] + B[1]; // one tile diamond on screen
const FIT = {}; // per-sprite ground base measured from pixels (art/…: see fit.json)
const CROPFIT = {}; // per-crop soil diamond centre + width in its cell (sprites/crops.json)
function drawObject(o, t, ghost) {
  const c = CATALOG[o.type], im = img[o.type], f = FIT[o.type];
  if (c.ground) return drawSoil(o.i, o.j, ghost);
  if (!im?.width || !f) return;
  const age = o.born ? (t - o.born) / 1000 : 9;
  const pop = age < .45 ? Math.sin(age / .45 * Math.PI) * .18 : 0; // landing bounce
  const fw = (c.w + c.h) * TILE_W / 2, [cx, cy] = fpCenter(o);
  let s, ax, ay = f.bot, x = cx, y;
  if (c.flat) { s = fw * .92 / f.w; ax = f.w / 2; ay = f.h / 2; y = cy; }
  else if (c.trunk) { s = fw * c.k / f.w; ax = c.cx === 'img' ? f.w / 2 : (f.bx0 + f.bx1) / 2; y = cy + TILE_H * .18; }
  else {
    ax = (f.bx0 + f.bx1) / 2;
    s = Math.min(fw * .9 / (f.bx1 - f.bx0), fw / 2 * 1.04 / Math.max(ax, f.w - ax)) * (c.k || 1); // base fills ~90%, whole image stays within the tiles
    const fill = (f.bx1 - f.bx0) * s / fw;
    y = fpFront(o)[1] - (1 - fill) * (c.w + c.h) * TILE_H / 4; // base diamond centred in the footprint
  }
  const sx = c.flat ? 1 + pop / 2 : 1 - pop / 3, sy = c.flat ? 1 + pop / 2 : 1 + pop;
  ctx.save(); ctx.globalAlpha = ghost ? .6 : 1;
  ctx.drawImage(im, x - ax * s * sx, y - ay * s * sy, f.w * s * sx, f.h * s * sy);
  ctx.restore();
}
// Plots are drawn in code so every square sits exactly on the grid (like Happy Farm's traced field).
function drawSoil(i, j, ghost) {
  const P = (a, b) => [T0[0] + a * A[0] + b * B[0], T0[1] + a * A[1] + b * B[1]], m = .07;
  const c = [P(i + m, j + m), P(i + m, j + 1 - m), P(i + 1 - m, j + 1 - m), P(i + 1 - m, j + m)];
  const path = () => { ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); };
  ctx.save(); ctx.globalAlpha = ghost ? .65 : 1;
  path(); const g = ctx.createLinearGradient(c[0][0], c[0][1], c[2][0], c[2][1]);
  g.addColorStop(0, '#a46a3d'); g.addColorStop(1, '#86532d'); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#6b3f20'; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,18,.35)'; ctx.lineWidth = 2; // furrows along one axis
  for (const k of [.32, .5, .68]) { ctx.beginPath(); ctx.moveTo(...P(i + .16, j + k)); ctx.lineTo(...P(i + .84, j + k)); ctx.stroke(); }
  ctx.restore();
}
// field expansion: dashed squares next to existing plots, tap one to buy it (Happy Farm style)
function expansionTiles() {
  const out = [];
  for (const o of S.objects) if (o.type === 'plot') for (const [a, b] of [[o.i + 1, o.j], [o.i - 1, o.j], [o.i, o.j + 1], [o.i, o.j - 1]])
    if (a >= 0 && b >= 0 && a < N && b < N && canPlace('plot', a, b) && !out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
  return out;
}
function dashedTile(i, j) {
  const P = (a, b) => [T0[0] + a * A[0] + b * B[0], T0[1] + a * A[1] + b * B[1]], m = .07;
  const c = [P(i + m, j + m), P(i + m, j + 1 - m), P(i + 1 - m, j + 1 - m), P(i + 1 - m, j + m)];
  ctx.save(); ctx.setLineDash([7, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(120,80,40,.55)'; ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function priceTag(x, y, text) {
  ctx.save(); ctx.font = '600 15px Fredoka, sans-serif'; const w = ctx.measureText(text).width + 30;
  ctx.fillStyle = '#fff8ec'; ctx.strokeStyle = '#efdcb8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 13, w, 26, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2b736'; ctx.beginPath(); ctx.arc(x - w / 2 + 13, y, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b4632'; ctx.textBaseline = 'middle'; ctx.fillText(text, x - w / 2 + 24, y + 1); ctx.restore();
}
function drawCrop(p, t) {
  const [x, y] = tileXY(p.i, p.j), pr = progress(p);
  const stage = pr < .25 ? 'seed' : pr < .55 ? 'sprout' : pr < 1 ? 'young' : p.crop;
  const im = img['crop_' + stage], m = CROPFIT[stage]; if (!im?.width || !m) return;
  p.pop = Math.max(0, (p.pop || 0) - .06);
  const squash = 1 + Math.sin(p.pop * Math.PI) * .25, ripe = pr >= 1, bob = ripe ? Math.sin(t / 300 + p.i + p.j) * .03 : 0;
  // crop art was painted on our own tile (art/src/cozy/plot-template.png): pin its soil diamond to this tile
  const s = TILE_W * .86 / m.wv, sx = 1 / squash + bob, sy = squash - bob;
  ctx.drawImage(im, x - m.cx * s * sx, y - m.cy * s * sy, m.w * s * sx, m.h * s * sy);
  if (ripe) { const a = (Math.sin(t / 250 + p.i * 2 + p.j) + 1) / 2; ctx.fillStyle = `rgba(255,236,150,${.5 + a * .5})`; star(x + 18 * Math.sin(t / 700 + p.j), y - 46 - a * 6, 4 + a * 3); }
}
function star(x, y, r) { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
function diamond(i, j, w, h, fill, stroke) {
  const c = [[i, j], [i, j + w], [i + h, j + w], [i + h, j]].map(([a, b]) => [T0[0] + a * A[0] + b * B[0], T0[1] + a * A[1] + b * B[1]]);
  ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(60,80,30,.18)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .4, 0, 0, 7); ctx.fill(); }

let last = performance.now();
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  if (cam.tx != null) { const k = 1 - Math.pow(.002, dt); cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k; if (Math.hypot(cam.tx - cam.x, cam.ty - cam.y) < .5 && Math.abs(cam.tz - cam.z) < .001) cam.tx = null; }

  const fdx = farmer.tx - farmer.x, fdy = farmer.ty - farmer.y, fd = Math.hypot(fdx, fdy), walking = fd > 2;
  if (walking) { const s = Math.min(fd, 170 * dt); farmer.x += fdx / fd * s; farmer.y += fdy / fd * s; if (Math.abs(fdx) > 1) farmer.flip = fdx < 0; }
  else if (!farmer.cheer && Math.hypot(HOME[0] - farmer.x, HOME[1] - farmer.y) > 2) { farmer.idleT = (farmer.idleT || 0) + dt; if (farmer.idleT > 4) { farmer.idleT = 0; walkTo(...HOME); } }
  farmer.cheer = Math.max(0, farmer.cheer - dt);
  stepAnimals(dt);
  stepVillage(t);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#cdebfd'; ctx.fillRect(0, 0, W, H);
  cam.shake = Math.max(0, (cam.shake || 0) - dt * 3);
  const shx = Math.sin(t / 23) * cam.shake * 5, shy = Math.cos(t / 31) * cam.shake * 4;
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z + shx), DPR * (H / 2 - cam.y * cam.z + shy));
  if (img.slab?.width) ctx.drawImage(img.slab, 0, 0, MAP_W, MAP_H);

  // build grid while placing
  if (placing) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (GROUND[i][j] === 'g' && !occupant(i, j)) diamond(i, j, 1, 1, null, 'rgba(255,255,255,.35)');

  // ground layer: plots and flat things, plus dashed squares where the field can grow
  for (const o of S.objects) if (CATALOG[o.type].ground || CATALOG[o.type].flat) drawObject(o, t);
  if (!placing) {
    const ex = expansionTiles(); ex.forEach(([a, b]) => dashedTile(a, b));
    if (ex.length) { // tag the front-most free square so crops never cover it
      const front = ex.reduce((m, q) => q[0] + q[1] > m[0] + m[1] ? q : m);
      const [x, y] = tileXY(...front); priceTag(x, y, `${CATALOG.plot.cost}`);
    }
  }
  if (sheetOpen && !bubblePlot) for (const o of S.objects) if (o.type === 'plot' && !o.crop) diamond(o.i, o.j, 1, 1, `rgba(255,255,255,${.15 + .1 * Math.sin(t / 300)})`);
  if (bubblePlot) diamond(bubblePlot.i, bubblePlot.j, 1, 1, 'rgba(255,255,255,.45)');

  // y-sorted: buildings, crops, hens, farmer
  const items = [];
  for (const o of S.objects) {
    const c = CATALOG[o.type];
    if (o.crop) items.push([tileXY(o.i, o.j)[1] + 1, () => drawCrop(o, t)]);
    if (!c.ground && !c.flat) items.push([tileXY(o.i + c.h - 1, o.j + c.w - 1)[1], () => drawObject(o, t)]); // depth = front-most tile centre
  }
  for (const a of animals) items.push([a.y, () => {
    const hop = a.moving ? Math.abs(Math.sin(t / 90)) * 3 : 0;
    shadow(a.x, a.y, a.kind === 'hen' ? 13 : 24); sprite(a.kind === 'hen' ? (a.pose ? 'hen_peck' : 'hen') : (a.pose ? 'sheep_graze' : 'sheep'), a.x, a.y - hop, a.s, { flip: a.flip });
  }]);
  for (const v of visitors) items.push([v.y, () => {
    ctx.save(); ctx.filter = `hue-rotate(${v.hue}deg)`;
    shadow(v.x, v.y, 13); sprite(v.chat ? 'idle' : Math.floor(t / 190) % 2 ? 'walk0' : 'walk1', v.x, v.y - (v.chat ? 0 : Math.abs(Math.sin(t / 190)) * 2), .27, { flip: v.flip }); ctx.restore();
  }]);
  for (let k = 0; k < 2; k++) {
    const direction = k ? -1 : 1, f = ((t / 1600 + k * 10) % 22) - 3;
    const [x, y] = tileXY(direction > 0 ? f : 16 - f, k ? 15.1 : 14.1);
    if (f >= -.5 && f <= 16) items.push([y, () => drawCar(x, y, k ? '#b5c4be' : '#d9bb7e', direction)]);
  }
  items.push([farmer.y, () => {
    const name = farmer.cheer ? 'basket' : walking ? (Math.floor(t / 160) % 2 ? 'walk0' : 'walk1') : 'idle';
    const bounce = farmer.cheer ? Math.abs(Math.sin(t / 110)) * 6 : walking ? Math.abs(Math.sin(t / 160)) * 2 : Math.sin(t / 500) * .8;
    shadow(farmer.x, farmer.y, 15); sprite(name, farmer.x, farmer.y - bounce, 0.3, { flip: farmer.flip });
  }]);
  items.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f());
  visitors.forEach((v, k) => { if (v.chat) speech(v.x, v.y - 90 - k * 16, k ? 'Two wheat, please!' : 'Fresh bread today?'); });
  for (const home of S.objects.filter(o => ['coop', 'barn'].includes(o.type) && Date.now() >= o.produceAt)) {
    const a = animals.find(a => a.home === home.id); if (a) speech(a.x, a.y - (a.kind === 'hen' ? 48 : 75), a.kind === 'hen' ? 'Eggs ready · tap!' : 'Wool ready · tap!');
  }
  drawButterflies(t);
  if (window.__dbg) for (const o of S.objects) { const c = CATALOG[o.type]; diamond(o.i, o.j, c.w, c.h, null, 'rgba(230,30,30,.9)'); } // ?debug: footprints

  // placement ghost on top
  if (placing && placing.i >= 0) {
    const c = CATALOG[placing.type], h = Math.min(c.h, N - placing.i), w = Math.min(c.w, N - placing.j);
    diamond(placing.i, placing.j, w, h, placing.ok ? 'rgba(120,220,120,.45)' : 'rgba(230,90,80,.45)', placing.ok ? '#3f8a3b' : '#c4473d');
    drawObject({ type: placing.type, i: placing.i, j: placing.j }, t, true);
  }

  // soft cloud shadows drifting across the farm
  for (const c of CLOUDS) {
    c.x += c.v * dt; if (c.x > MAP_W + 400) c.x = -400;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, 'rgba(40,70,90,.10)'); g.addColorStop(1, 'rgba(40,70,90,0)');
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, .45); ctx.translate(-c.x, -c.y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.restore();
    // Translucent high clouds: feathered edges, kept light enough to read the farm.
    for (let k = 0; k < 3; k++) {
      const x = c.x + k * 70, y = c.y - 180 + (k % 2) * 24;
      const haze = ctx.createRadialGradient(x, y, 0, x, y, c.r * .46);
      haze.addColorStop(0, 'rgba(255,253,240,.12)'); haze.addColorStop(1, 'rgba(255,253,240,0)');
      ctx.fillStyle = haze; ctx.beginPath(); ctx.ellipse(x, y, c.r * .46, c.r * .23, -.1, 0, 7); ctx.fill();
    }
  }

  for (let k = fx.length - 1; k >= 0; k--) {
    const f = fx[k]; f.life -= dt * 1.6; if (f.life <= 0) { fx.splice(k, 1); continue; }
    f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt;
    ctx.globalAlpha = f.life; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * f.life, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }

  const tint = dayTint(); // real clock; ?t=day|dusk|night overrides for recording
  if (tint) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  drawWeather(t);

  if (bubblePlot) {
    const [x, y] = tileXY(bubblePlot.i, bubblePlot.j), [sx, sy] = toScreen(x, y - 55);
    const b = $('bubble'); b.style.left = Math.max(126, Math.min(W - 126, sx)) + 'px'; b.style.top = Math.max(b.offsetHeight + 8, Math.min(H - 90, sy)) + 'px';
    if ((t | 0) % 6 === 0) renderBubble();
  }
  requestAnimationFrame(frame);
}
const TOD = new URLSearchParams(location.search).get('t');
function dayTint() {
  const h = TOD === 'day' ? 12 : TOD === 'dusk' ? 18.5 : TOD === 'night' ? 22 : new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 7 && h < 17) return null;
  if (h >= 17 && h < 19.5 || h >= 5 && h < 7) return 'rgb(255,214,180)';
  return 'rgb(150,160,215)';
}

// ---------- boot ----------
function renderNotifications() {
  ensureOrders();
  for (const [id, ready, label] of [
    ['bSeeds', S.objects.some(p => p.crop && progress(p) >= 1), 'Seeds · ripe crops ready'],
    ['bOrders', S.orders.some(orderReady), 'Orders · delivery ready'],
    ['bLearn', S.lessons.length < LESSONS.length, 'Learn · new lessons available'],
  ]) { const el = $(id); el.classList.toggle('notify', ready); el.setAttribute('aria-label', ready ? label : id.slice(1)); }
  if ($('vault').classList.contains('open')) renderVault();
}
resize(); renderSeeds(); hud(); syncAnimals(); renderWeather(); renderNotifications(); loadRates();
setInterval(() => { expireRates(); renderWeather(); renderNotifications(); }, 1000);
if (!DEMO) setInterval(loadRates, 300000);
Promise.all([load('slab', 'slab-empty.png'), ...SPRITES.map(n => load(n, `sprites/${n}.png`)),
  fetch('sprites/fit.json').then(r => r.json()).then(j => Object.assign(FIT, j)),
  fetch('sprites/crops.json').then(r => r.json()).then(j => Object.assign(CROPFIT, j))]).then(() => {
  requestAnimationFrame(frame);
  if (DEMO) document.body.appendChild(Object.assign(document.createElement('script'), { src: 'demo.js?v=2026.11.07.3' }));
});
