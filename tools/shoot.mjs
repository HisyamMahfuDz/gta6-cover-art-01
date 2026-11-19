// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — screenshot + export assertion driver (Node stdlib
// only). Serves app/, drives headless Chrome 157 over CDP, takes the 4
// screenshots from shots.json, exports all 3 PNG sizes via the app's own
// exportPNG, and asserts dimensions + that the cover really contains a photo
// and a caption. Writes tools/assert-report.json; exits non-zero on failure.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..');
const shots = JSON.parse(readFileSync(join(entry, 'shots.json'), 'utf8'));
const PORT = 8901;
const CDP_PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pngDims(buf) {
  if (buf.subarray(1, 4).toString() !== 'PNG') throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`never up: ${url}`);
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  ready() { return new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; }); }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page error: ${JSON.stringify(r.exceptionDetails).slice(0, 500)}`);
    return r.result.value;
  }
}

const report = { shots: [], exports: [], network: [], failures: [] };
const fail = (msg) => { report.failures.push(msg); console.error('FAIL:', msg); };

async function main() {
  mkdirSync(join(entry, 'screenshots'), { recursive: true });
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: entry, stdio: 'pipe' });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=/tmp/gta6-chrome-profile',
    '--window-size=1280,800', 'about:blank',
  ], { stdio: 'pipe' });
  try {
    await waitFor(`${BASE}/index.html`);
    const version = await (await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // --- Screenshots from shots.json ---
    for (const shot of shots) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: `${BASE}/${shot.query}` });
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        try { ready = await cdp.eval('window.__shotReady === true'); } catch { /* page reloading */ }
        if (ready) break;
      }
      if (!ready) { fail(`shot ${shot.name}: __shotReady never fired`); continue; }
      await sleep(400);
      let quality = 88;
      let buf;
      for (let attempt = 0; attempt < 3; attempt++) {
        const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
        buf = Buffer.from(shotRes.data, 'base64');
        if (buf.length <= 262144) break;
        quality -= 18;
      }
      const out = join(entry, 'screenshots', shot.name);
      writeFileSync(out, buf);
      const longSide = Math.max(shot.w, shot.h);
      const shortSide = Math.min(shot.w, shot.h);
      const ok = buf.length <= 262144 && longSide <= 1280 && shortSide >= 480;
      report.shots.push({ name: shot.name, w: shot.w, h: shot.h, bytes: buf.length, quality, gateOk: ok });
      console.log(`shot ${shot.name}: ${shot.w}x${shot.h} ${buf.length} bytes quality=${quality} gateOk=${ok}`);
      if (!ok) fail(`shot ${shot.name} breaks gate limits`);
    }

    // --- Export assertion: the app's own exportPNG for all three sizes ---
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${BASE}/?shot=editor&layout=hero-three&grade=sunset&title=Neon%20Shore` });
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      try { if (await cdp.eval('window.__shotReady === true')) break; } catch { /* reloading */ }
    }
    const sizes = [[1080, 1080], [1080, 1350], [1920, 1080]];
    for (const [w, h] of sizes) {
      const dataUrl = await cdp.eval(`window.__coverAPI.exportPNG(${w}, ${h})`, true);
      const b64 = dataUrl.split(',')[1];
      const png = Buffer.from(b64, 'base64');
      const dims = pngDims(png);
      const dimsOk = dims.w === w && dims.h === h;
      // Pixel proof: photo present (variance) + title present (bright warm pixels in band).
      const stats = await cdp.eval(`(async (dataUrl) => {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const region = (x0, y0, x1, y1) => {
          const d = x.getImageData(Math.floor(c.width * x0), Math.floor(c.height * y0), Math.floor(c.width * (x1 - x0)), Math.floor(c.height * (y1 - y0))).data;
          let n = 0, mr = 0, mg = 0, mb = 0, brightWarm = 0;
          for (let i = 0; i < d.length; i += 16) { n++; mr += d[i]; mg += d[i + 1]; mb += d[i + 2]; if (d[i] > 170 && d[i + 1] > 110 && d[i + 1] < 220) brightWarm++; }
          mr /= n; mg /= n; mb /= n;
          let v = 0;
          for (let i = 0; i < d.length; i += 16) { v += (d[i] - mr) ** 2 + (d[i + 1] - mg) ** 2 + (d[i + 2] - mb) ** 2; }
          return { mean: [mr, mg, mb].map((z) => Math.round(z)), stddev: Math.round(Math.sqrt(v / n)), brightWarmShare: +(brightWarm / n).toFixed(3) };
        };
        return {
          hero: region(0.05, 0.05, 0.55, 0.7),
          side: region(0.65, 0.05, 0.95, 0.7),
          titleBand: region(0.05, 0.8, 0.95, 0.98),
        };
      })(${JSON.stringify(dataUrl)})`, true);
      const photoOk = stats.hero.stddev > 12 && stats.side.stddev > 12;
      const titleOk = stats.titleBand.brightWarmShare > 0.005;
      const panelsDiffer = Math.abs(stats.hero.mean[0] - stats.side.mean[0]) + Math.abs(stats.hero.mean[1] - stats.side.mean[1]) > 8;
      report.exports.push({ size: `${w}x${h}`, dims, dimsOk, photoOk, titleOk, panelsDiffer, stats });
      console.log(`export ${w}x${h}: dimsOk=${dimsOk} photoOk=${photoOk} titleOk=${titleOk} panelsDiffer=${panelsDiffer}`, JSON.stringify(stats));
      if (!dimsOk) fail(`export ${w}x${h}: PNG dims ${dims.w}x${dims.h}`);
      if (!photoOk) fail(`export ${w}x${h}: photo region flat (stddev hero=${stats.hero.stddev} side=${stats.side.stddev})`);
      if (!titleOk) fail(`export ${w}x${h}: no bright title pixels in band`);
      if (!panelsDiffer) fail(`export ${w}x${h}: panels look identical`);
    }

    // --- Offline check: every request must be localhost ---
    const reqs = cdp.events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request.url);
    const external = [...new Set(reqs)].filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:'));
    report.network = [...new Set(reqs)];
    console.log(`network requests: ${report.network.length}, external: ${external.length}`);
    if (external.length) fail(`external requests: ${external.join(', ')}`);
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
  writeFileSync(join(here, 'assert-report.json'), JSON.stringify(report, null, 2));
  console.log(report.failures.length ? `\n${report.failures.length} FAILURES` : '\nALL ASSERTIONS PASSED');
  process.exit(report.failures.length ? 1 : 0);
}

main().catch((e) => { console.error('DRIVER ERROR:', e.message); process.exit(2); });
