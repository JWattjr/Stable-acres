// Scripted run for recording the jam clip. Open index.html?demo&t=day and screen-record.
// Shot list (~33s): title → plant a row → tap crop (yield reveal) → Vault → harvest + level up
// → build windmill → build barn → pull back wide → end card.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => 1 - Math.pow(1 - t, 3);

// ---------- fake cursor ----------
const cur = document.createElement('div');
cur.id = 'cursor';
Object.assign(cur.style, {
  position: 'fixed', left: '0', top: '0', width: '26px', height: '26px', marginLeft: '-13px', marginTop: '-13px',
  borderRadius: '50%', background: 'rgba(255,253,244,.92)', border: '3px solid #5b4632', zIndex: 20,
  boxShadow: '0 3px 8px rgba(60,40,20,.3)', pointerEvents: 'none', opacity: 0, transition: 'opacity .3s',
});
document.body.appendChild(cur);
let cx = innerWidth * .7, cy = innerHeight * .8;
const place = () => { cur.style.transform = `translate(${cx}px,${cy}px)`; };
place();

async function glide(x, y, ms = 650) {
  const x0 = cx, y0 = cy, t0 = performance.now();
  while (true) {
    const k = Math.min(1, (performance.now() - t0) / ms), e = ease(k);
    cx = x0 + (x - x0) * e; cy = y0 + (y - y0) * e - Math.sin(k * Math.PI) * 30; place(); // slight arc
    if (k >= 1) break;
    await new Promise(requestAnimationFrame);
  }
}
async function click(x, y, ms) {
  if (x != null) await glide(x, y, ms);
  cur.animate([{ scale: 1 }, { scale: .78 }, { scale: 1 }], { duration: 200 });
  const r = document.createElement('div');
  Object.assign(r.style, { position: 'fixed', left: cx - 20 + 'px', top: cy - 20 + 'px', width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #fffdf4', pointerEvents: 'none', zIndex: 19 });
  document.body.appendChild(r);
  r.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => r.remove();
  await sleep(220);
}
const tileScreen = (i, j) => toScreen(...tileXY(i, j));
const elScreen = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
async function camTo(x, y, z, settle = 900) { flyTo(x, y, z); await sleep(settle); }

// ---------- cards ----------
function card(html, ms) {
  const c = document.createElement('div');
  c.innerHTML = html;
  Object.assign(c.style, {
    position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 30, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at center, rgba(255,248,236,.92) 0%, rgba(255,248,236,.75) 45%, rgba(255,248,236,0) 75%)',
    opacity: 0, transition: 'opacity .6s',
  });
  document.body.appendChild(c);
  requestAnimationFrame(() => (c.style.opacity = 1));
  return sleep(ms).then(() => { c.style.opacity = 0; return sleep(600).then(() => c.remove()); });
}
const TITLE = `<div style="text-align:center">
  <div style="font:700 72px Fredoka;color:#5b4632;letter-spacing:-.01em">Stable Acres</div>
  <div style="font:600 24px Fredoka;color:#76634a;margin-top:6px">Grow crops. Discover how yield works.</div></div>`;
const END = `<div style="text-align:center">
  <div style="font:700 64px Fredoka;color:#5b4632">Stable Acres</div>
  <div style="font:600 22px Fredoka;color:#76634a;margin-top:8px">A cozy farm where every crop quietly farms stablecoin yield</div>
  <div style="font:600 16px Fredoka;color:#2f6fd0;margin-top:14px">Solana read-only prototype · simulated farm balances</div></div>`;

// ---------- the run ----------
async function run() {
  await sleep(400);
  S.xp = 34; hud(); // so the harvest triggers a level-up on camera
  cam.x = MAP_W / 2; cam.y = MAP_H / 2 + 20; cam.z = fitZ * .8; cam.tx = null;
  await card(TITLE, 2200);

  // 1. plant a row of wheat
  const plots = S.objects.filter(o => o.type === 'plot').sort((a, b) => a.i - b.i || a.j - b.j);
  const [px, py] = tileXY(8.5, 4);
  await camTo(px, py - 10, fitZ * 2, 1100);
  cur.style.opacity = 1;
  await click(...tileScreen(plots[0].i, plots[0].j));
  openSheet('seedSheet'); await sleep(450);
  await click(...elScreen(document.querySelector('.seed[data-k="wheat"]')));
  selSeed = 'wheat'; renderSeeds(); await sleep(150);
  for (const p of plots) { await glide(...tileScreen(p.i, p.j), 230); plant(p, 'wheat'); await sleep(90); }
  await sleep(300); closeSheets();

  // 2. tap a growing crop → what's farming under it
  await sleep(500);
  await click(...tileScreen(plots[1].i, plots[1].j), 500);
  openBubble(plots[1]); await sleep(2300);
  closeBubble();

  // 3. vault totals
  await click(...elScreen($('bVault')), 600);
  openSheet('vault'); await sleep(2000);
  closeSheets(); await camTo(px, py - 10, fitZ * 2, 500);

  // 4. harvest the row (wait until ripe)
  while (plots.some(p => progress(p) < 1)) await sleep(100);
  await sleep(250);
  for (const p of plots) { await click(...tileScreen(p.i, p.j), 260); harvest(p); await sleep(140); }
  await sleep(1200);

  // 5. build a windmill next to the farmhouse
  await build('windmill', [[4, 8], [3, 10], [2, 11], [1, 12]], 1300);
  // 6. and a barn in the back corner; the ghost crosses a path first (red), then settles (green)
  await build('barn', [[4, 4], [3, 2], [3, 1], [3, 0]], 1300);

  // 7. pull back wide, end card
  cur.style.opacity = 0;
  await camTo(MAP_W / 2, MAP_H / 2 + 20, fitZ * .8, 1800);
  await card(END, 3600);
  window.__demoDone = true; // the recorder stops here
}

async function build(type, path, hold) {
  await click(...elScreen($('bShop')), 600);
  openSheet('shop'); await sleep(350);
  const item = document.querySelector(`[data-buy="${type}"]`);
  item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); await sleep(600);
  await click(...elScreen(item), 450);
  startPlacing(type);
  const [i, j] = path[path.length - 1], c = CATALOG[type];
  const [fx, fy] = tileXY(i + (c.h - 1) / 2, j + (c.w - 1) / 2);
  await camTo(fx, fy - 30, fitZ * 1.7, 1000);
  for (const [a, b] of path) { // drag the ghost across the grass to its spot
    placing.i = a; placing.j = b; placing.ok = canPlace(type, a, b);
    await glide(...tileScreen(a + (c.h - 1) / 2, b + (c.w - 1) / 2), 260);
  }
  await sleep(300);
  await click(); placeAt(i, j); await sleep(hold);
}

run();
