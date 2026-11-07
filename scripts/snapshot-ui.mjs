// Local screenshot fixtures using the same headless Chrome as capture-demo.mjs.
// Isolated disposable profile; never connects a wallet or touches a user's browser save.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), port = 9345;
const chromePath = process.env.CHROME_PATH || path.resolve(root, '../arc-studio-video/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const folder = path.join(root, '.impeccable/review/screenshots'); mkdirSync(folder, { recursive: true });
const chrome = spawn(chromePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${path.join(root, 'out/.qa-chrome')}`, '--hide-scrollbars', '--mute-audio', 'about:blank'], { windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(100); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
  if (!target) throw Error('Chrome did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expression => {
    const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (m.result?.exceptionDetails) throw Error(JSON.stringify(m.result.exceptionDetails));
    return m.result?.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] }); // exercise cached/offline data path
  const base = process.env.SNAPSHOT_URL || 'http://127.0.0.1:8767/index.html?t=day';
  const report = [];
  for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844], ['user-647', 647, 764]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: base });
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) { await sleep(100); ready = await evaluate('typeof FIT !== "undefined" && img.slab?.width > 0 && Object.keys(CROPFIT).length > 0').catch(() => false); }
    if (!ready) throw Error('Game assets not ready');
    await evaluate('document.fonts.ready');
    await evaluate(`closeSheets(); closeBubble(); S.objects.filter(p=>p.type==='plot').slice(0,3).forEach(p=>plant(p,'wheat'))`);
    await sleep(400);
    const shot = async suffix => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(folder, `${name}${suffix}.png`), Buffer.from(r.result.data, 'base64')); };
    await shot('');
    await evaluate(`openSheet('orders')`); await sleep(400); await shot('-orders');
    await evaluate(`openLesson(2)`); await sleep(400); await shot('-learn');
    const bounds = await evaluate(`(()=>{const b=document.getElementById('bar-b').getBoundingClientRect(),h=document.getElementById('hud-r').getBoundingClientRect();return {barFits:b.left>=0&&b.right<=innerWidth,hudFits:h.left>=0&&h.right<=innerWidth,bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,rates:document.getElementById('rateStatus').textContent}})()`);
    if (!bounds.barFits || !bounds.hudFits || bounds.bodyWidth > width) throw Error(`${name}: viewport overflow`);
    report.push({ name, width, height, ...bounds });
    console.log(`${name}: screenshots saved, HUD and navigation fit`);
  }
  await send('Page.navigate', { url: base + '&weather=rain' }); await sleep(1000);
  if (!(await evaluate(`document.getElementById('weather').textContent.includes('Rain')`))) throw Error('Rain chip missing');
  const rain = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(folder, 'rain.png'), Buffer.from(rain.result.data, 'base64'));
  if (errors.length) throw Error(JSON.stringify(errors));
  writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ report, errors }, null, 2));
  console.log('Rain captured; no JavaScript exceptions');
} finally { ws?.close(); chrome.kill(); }
