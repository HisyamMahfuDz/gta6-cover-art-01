// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — screenshot + assertion driver (Node 22,
// standard library only). Serves app/ on 127.0.0.1:8901, drives headless
// Chrome over the DevTools protocol, takes one screenshot per entry of
// shots.json, runs the export assertions the page exposes as
// window.__exportCheck, and writes tools/assert-report.json.
//
//   node tools/shoot.mjs
//
// Exits 0 only when every gate passes: each screenshot is a JPEG of at most
// 256 KiB whose long side is at most 1280 and whose short side is at least
// 480; every export size has the PNG dimensions the IHDR claims, photo
// regions with real variance, a bright warm title band, and panels that
// differ; and the page makes no request outside 127.0.0.1 (plus data:/blob:).

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, '..'));
const appDir = join(root, 'app');
const shotsPath = join(root, 'shots.json');
const shotsDir = join(root, 'screenshots');
const reportPath = join(here, 'assert-report.json');
const PORT = 8901;
const CDP_PORT = 9333;
const MAX_SCREENSHOT_BYTES = 262144;
const MAX_LONG_SIDE = 1280;
const MIN_SHORT_SIDE = 480;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serveApp() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(join(appDir, normalize(pathname)));
    if (file !== appDir && !file.startsWith(appDir + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    let size;
    try {
      const stats = statSync(file);
      if (!stats.isFile()) throw new Error('not a file');
      size = stats.size;
    } catch {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': size,
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolveListen) => {
    server.listen(PORT, '127.0.0.1', () => resolveListen(server));
  });
}

async function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** A minimal DevTools-protocol client over the built-in WebSocket. */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.onEvent = null;
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result ?? {});
      } else if (msg.method && this.onEvent) {
        this.onEvent(msg);
      }
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('the DevTools socket failed'));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const out = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (out.exceptionDetails) {
      throw new Error(`page threw: ${JSON.stringify(out.exceptionDetails).slice(0, 500)}`);
    }
    return out.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // Already closed.
    }
  }
}

async function newTarget(url) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(`could not open a tab for ${url}`);
  return res.json();
}

async function waitReady(cdp, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ready = await cdp.evaluate('window.__shotReady === true || window.__appReady === true').catch(() => false);
    if (ready) return;
    if (Date.now() > deadline) throw new Error('the page never signalled ready');
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function capture(cdp, file, w, h) {
  for (const quality of [88, 80, 72, 64, 55, 45]) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
    const buf = Buffer.from(shot.data, 'base64');
    if (buf.length <= MAX_SCREENSHOT_BYTES) {
      writeFileSync(file, buf);
      return { bytes: buf.length, quality };
    }
  }
  throw new Error(`${file} stays over ${MAX_SCREENSHOT_BYTES} bytes even at quality 45`);
}

async function main() {
  const shots = JSON.parse(readFileSync(shotsPath, 'utf8'));
  mkdirSync(shotsDir, { recursive: true });
  const server = await serveApp();
  const profile = mkdtempSync(join(tmpdir(), 'neon-coast-chrome-'));
  let chrome = null;
  const failures = [];
  const report = { screenshots: [], exports: [], network: { requests: 0, external: 0 }, failures };
  const seenUrls = new Set();
  try {
    chrome = spawn(
      'google-chrome',
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-proxy-server',
        '--hide-scrollbars',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profile}`,
        '--window-size=1280,1280',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
    await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);

    for (const shot of shots) {
      // Open a blank tab first so Network is enabled before the page loads
      // and every request is counted (a tab opened straight on the URL
      // would already have fetched its first files by then).
      const target = await newTarget('about:blank');
      const cdp = new Cdp(target.webSocketDebuggerUrl);
      await cdp.connect();
      cdp.onEvent = (msg) => {
        if (msg.method === 'Network.requestWillBeSent') {
          const url = msg.params?.request?.url ?? '';
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            report.network.requests += 1;
            if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:')) {
              report.network.external += 1;
            }
          }
        }
      };
      try {
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Network.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: shot.w,
          height: shot.h,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` });
        await waitReady(cdp);
        const file = join(shotsDir, shot.name);
        const took = await capture(cdp, file, shot.w, shot.h);
        const longSide = Math.max(shot.w, shot.h);
        const shortSide = Math.min(shot.w, shot.h);
        const gateOk =
          took.bytes <= MAX_SCREENSHOT_BYTES && longSide <= MAX_LONG_SIDE && shortSide >= MIN_SHORT_SIDE;
        report.screenshots.push({
          name: shot.name,
          w: shot.w,
          h: shot.h,
          bytes: took.bytes,
          quality: took.quality,
          gateOk,
        });
        if (!gateOk) failures.push(`${shot.name}: screenshot gate failed`);
        console.log(`${shot.name}: ${shot.w}x${shot.h}, ${took.bytes} bytes, quality ${took.quality}, gateOk=${gateOk}`);
      } finally {
        cdp.close();
      }
    }

    // The export assertions, on a plain page with the default scene.
    const target = await newTarget('about:blank');
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    cdp.onEvent = (msg) => {
      if (msg.method === 'Network.requestWillBeSent') {
        const url = msg.params?.request?.url ?? '';
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          report.network.requests += 1;
          if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:')) {
            report.network.external += 1;
          }
        }
      }
    };
    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Network.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1280, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
      await waitReady(cdp);
      const checks = await cdp.evaluate('window.__exportCheck()', true);
      for (const check of checks) {
        const ok = check.dimsOk && check.photoOk && check.titleOk && check.panelsDiffer;
        report.exports.push({ ...check, gateOk: ok });
        if (!ok) failures.push(`export ${check.size}: dimsOk=${check.dimsOk} photoOk=${check.photoOk} titleOk=${check.titleOk} panelsDiffer=${check.panelsDiffer}`);
        console.log(`export ${check.size}: dimsOk=${check.dimsOk} photoOk=${check.photoOk} titleOk=${check.titleOk} panelsDiffer=${check.panelsDiffer}`);
      }
    } finally {
      cdp.close();
    }

    if (report.network.external > 0) {
      failures.push(`${report.network.external} external request(s)`);
    }
    console.log(`network: ${report.network.requests} requests, ${report.network.external} external`);
  } finally {
    if (chrome) chrome.kill('SIGKILL');
    server.close();
    rmSync(profile, { recursive: true, force: true });
  }
  report.failures = failures;
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('ALL ASSERTIONS PASSED');
}

main().catch((err) => {
  console.error(`shoot failed: ${err.message}`);
  process.exit(1);
});
