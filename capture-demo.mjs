// Frame-exact MP4 of the scripted demo (public/cozy/index.html?demo).
// The page runs on a virtual clock: Date, performance.now, timers, rAF and every CSS/WAAPI animation
// advance exactly 1/FPS per frame, then the whole page (canvas + HUD) is screenshotted into ffmpeg.
//   node capture-demo.mjs out/stable-acres-demo.mp4      (needs the "video" dev server on :8765)
import {spawn} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || path.resolve('../arc-studio-video/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const FFMPEG = process.env.FFMPEG_PATH || 'C:/Users/User/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const FPS = +process.env.CAPTURE_FPS || 60, PORT = +process.env.CAPTURE_PORT || 9344;
const URL_ = process.env.CAPTURE_URL || 'http://localhost:8765/Canvas%20Exp/stable-acres/public/cozy/index.html?demo&t=day';
const OUT = process.argv[2] || 'out/stable-acres-demo.mp4', MAX_S = +process.env.CAPTURE_MAX || 60, TAIL_S = 0.4;
const PROFILE = path.resolve('out/.chrome');
if (!PROFILE.startsWith(path.resolve('out') + path.sep)) throw Error('Unsafe capture profile path');
mkdirSync(path.dirname(OUT), {recursive: true}); rmSync(PROFILE, {recursive: true, force: true});

// Injected before any page script runs.
const SHIM = `(() => {
  const RD = Date, T0 = RD.parse('2026-11-07T12:00:00Z'), realTimeout = setTimeout.bind(window);
  let vnow = 0, tid = 1, timers = [], rafs = [];
  const tracked = new Map();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(T0 + vnow); } static now() { return T0 + vnow; } };
  performance.now = () => vnow;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = tid++; timers.push({ id, at: vnow + Math.max(0, +ms || 0), fn, args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = tid++; timers.push({ id, at: vnow + Math.max(1, +ms || 0), every: Math.max(1, +ms || 0), fn, args }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers = timers.filter(t => t.id !== id); };
  window.requestAnimationFrame = fn => { const id = tid++; rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(r => r.id !== id); };
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...a) { const an = animate.apply(this, a); an.pause(); tracked.set(an, vnow); return an; };
  const flush = () => new Promise(r => realTimeout(r, 0)); // let promise continuations run
  window.__advance = async ms => {
    const target = vnow + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0]; if (!t || t.at > target) break;
      timers.shift(); vnow = t.at;
      try { typeof t.fn === 'function' ? t.fn(...t.args) : (0, eval)(t.fn); } catch (e) { console.error(e); }
      if (t.every) { t.at = vnow + t.every; timers.push(t); }
      await flush();
    }
    vnow = target;
    for (const an of document.getAnimations()) { // CSS transitions/animations + WAAPI on the virtual clock
      if (!tracked.has(an)) { an.pause(); tracked.set(an, vnow); }
      const end = an.effect?.getComputedTiming().endTime ?? 0, el = vnow - tracked.get(an);
      if (el >= end && end !== Infinity) { an.finish(); tracked.delete(an); } else an.currentTime = el;
    }
    const cbs = rafs; rafs = [];
    for (const r of cbs) { try { r.fn(vnow); } catch (e) { console.error(e); } }
    await flush();
  };
})();`;

const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars', '--mute-audio', 'about:blank'], {windowsHide: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(), errors = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ': ' + (m.params.exceptionDetails.exception?.description || ''));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
const evaluate = async expression => { const m = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}); if (m.result?.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails)); return m.result?.result?.value; };

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false}); // 1920x1080 output, UI at a readable size
await send('Page.addScriptToEvaluateOnNewDocument', {source: SHIM});
await send('Page.navigate', {url: URL_});
for (let i = 0; i < 150 && !(await evaluate('typeof run === "function" && !!document.fonts').catch(() => false)); i++) await sleep(200);
await evaluate('document.fonts.ready.then(() => 1)');
console.log('page ready, capturing…');

const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], {stdio: ['pipe', 'inherit', 'inherit']});
let tail = -1;
for (let f = 0; f < MAX_S * FPS; f++) {
  await evaluate(`__advance(${1000 / FPS})`);
  const shot = await send('Page.captureScreenshot', {format: 'jpeg', quality: 92});
  const buf = Buffer.from(shot.result.data, 'base64');
  if (f === FPS * 12) writeFileSync('public/cozy/screenshot.jpg', buf);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 300 === 0) console.log(`frame ${f} (${(f / FPS).toFixed(1)}s)`);
  if (tail < 0 && await evaluate('!!window.__demoDone')) tail = Math.round(TAIL_S * FPS);
  if (tail >= 0 && tail-- === 0) { console.log(`done at ${(f / FPS).toFixed(1)}s`); break; }
}
ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
const completed = await evaluate('!!window.__demoDone');
ws.close(); chrome.kill();
if (code !== 0 || !completed || errors.length) throw Error(`Capture failed: ffmpeg=${code}, demoDone=${completed}, errors=${errors.join('; ')}`);
console.log(`wrote ${OUT} · demo completed · no console errors`);
