// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — editor wiring and export.
// Owns the page state (layout, grade, title, subtitle, two photos and a
// per-panel crop), redraws the preview canvas on every change, exports the
// cover as a PNG at the three sizes, and exposes window.__exportCheck for
// the screenshot/assertion driver (tools/shoot.mjs). A `?shot=` query loads
// a fixed scene for a screenshot instead (./shots.js).

import { drawCover, ensureFonts } from './cover.js';
import { runShot } from './shots.js';
import { LAYOUTS, GRADES, EXPORT_SIZES, DEFAULT_STATE } from './presets.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');

const state = {
  layout: DEFAULT_STATE.layout,
  grade: DEFAULT_STATE.grade,
  title: DEFAULT_STATE.title,
  subtitle: DEFAULT_STATE.subtitle,
  photos: { a: null, b: null },
  crops: {},
};
let selectedPanel = 0;
let fontsReady = false;

function defaultCrop() {
  return { zoom: 1, dx: 0, dy: 0 };
}

function cropFor(i) {
  if (!state.crops[i]) state.crops[i] = defaultCrop();
  return state.crops[i];
}

async function redraw() {
  if (!fontsReady) {
    await ensureFonts();
    fontsReady = true;
  }
  drawCover(canvas, state);
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

function setStatus(text) {
  if (status) status.textContent = text;
}

function buildButtons(container, items, current, onPick) {
  const box = document.getElementById(container);
  if (!box) return;
  box.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.name ?? item.label;
    b.dataset.id = item.id;
    b.setAttribute('aria-pressed', String(item.id === current));
    b.addEventListener('click', () => {
      onPick(item.id);
      for (const other of box.querySelectorAll('button')) {
        other.setAttribute('aria-pressed', String(other.dataset.id === item.id));
      }
      redraw();
    });
    box.appendChild(b);
  }
}

function refreshPanelSelect() {
  const sel = document.getElementById('panel');
  if (!sel) return;
  const layout = LAYOUTS.find((l) => l.id === state.layout) ?? LAYOUTS[0];
  sel.innerHTML = '';
  layout.panels.forEach((panel, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Panel ${i + 1} (${panel.photo === 'a' ? 'photo A' : 'photo B'})`;
    sel.appendChild(opt);
  });
  sel.value = String(Math.min(selectedPanel, layout.panels.length - 1));
}

/** Makes the controls show the current state (used after a shot loads a scene). */
function syncControls() {
  const titleInput = document.getElementById('title');
  if (titleInput) titleInput.value = state.title;
  const subtitleInput = document.getElementById('subtitle');
  if (subtitleInput) subtitleInput.value = state.subtitle;
  for (const [boxId, current] of [
    ['layout', state.layout],
    ['grade', state.grade],
  ]) {
    const box = document.getElementById(boxId);
    if (!box) continue;
    for (const btn of box.querySelectorAll('button')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.id === current));
    }
  }
  refreshPanelSelect();
}

function bindCropSlider(id, key, factor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    cropFor(selectedPanel)[key] = Number(el.value) * factor;
    redraw();
  });
}

async function loadSample(slot, name) {
  try {
    state.photos[slot] = await loadImage(`samples/${name}.jpg`);
    setStatus(`Photo ${slot.toUpperCase()} is the ${name} sample.`);
  } catch {
    setStatus(`Could not load the ${name} sample.`);
  }
  redraw();
}

function bindPhoto(slot, inputId, samplePrefix) {
  const input = document.getElementById(inputId);
  if (input) {
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        state.photos[slot] = await loadImage(URL.createObjectURL(file));
        setStatus(`Photo ${slot.toUpperCase()} loaded from your file.`);
      } catch {
        setStatus('That file could not be read as an image.');
      }
      redraw();
    });
  }
  for (const name of ['pier', 'boulevard']) {
    const btn = document.getElementById(`${samplePrefix}-${name}`);
    if (btn) btn.addEventListener('click', () => loadSample(slot, name));
  }
}

/** Renders the cover at (w, h) on a fresh canvas and returns the canvas. */
export function renderExport(w, h) {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCover(out, state);
  return out;
}

function download(canvas, name) {
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('The export failed.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setStatus(`Saved ${name}.`);
  }, 'image/png');
}

function exportOne(size) {
  download(renderExport(size.w, size.h), `neon-coast-${size.w}x${size.h}.png`);
}

function exportAll() {
  for (const size of EXPORT_SIZES) exportOne(size);
  setStatus('Saved all three PNG sizes.');
}

/** Reads the PNG width/height out of a data URL's IHDR chunk. */
function pngDims(dataUrl) {
  const b64 = dataUrl.split(',', 2)[1] ?? '';
  const bin = atob(b64);
  if (bin.length < 24 || bin.slice(1, 4) !== 'PNG') return null;
  const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
  const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
  return { w, h };
}

function regionStats(ctx, w, h, fx, fy, fw, fh) {
  const x0 = Math.floor(fx * w);
  const y0 = Math.floor(fy * h);
  const sw = Math.max(1, Math.floor(fw * w));
  const sh = Math.max(1, Math.floor(fh * h));
  const data = ctx.getImageData(x0, y0, sw, sh).data;
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let warmBright = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    n += 1;
    sum += lum;
    sum2 += lum * lum;
    rSum += r;
    gSum += g;
    bSum += b;
    if (lum > 150 && r > 150 && r > g + 20 && r > b + 20) warmBright += 1;
  }
  const mean = n ? sum / n : 0;
  const variance = n ? Math.max(0, sum2 / n - mean * mean) : 0;
  return {
    mean,
    std: Math.sqrt(variance),
    warmBright,
    warmBrightShare: n ? warmBright / n : 0,
    meanRGB: n ? [rSum / n, gSum / n, bSum / n] : [0, 0, 0],
  };
}

function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Runs the export assertions in the page and returns the verdicts, one per
 * export size. tools/shoot.mjs calls this and writes tools/assert-report.json.
 */
window.__exportCheck = async function __exportCheck() {
  await redraw();
  const out = [];
  for (const size of EXPORT_SIZES) {
    const c = renderExport(size.w, size.h);
    const ctx = c.getContext('2d');
    const dataUrl = c.toDataURL('image/png');
    const dims = pngDims(dataUrl);
    // The hero panel occupies the top of a hero-three cover; the title sits
    // in the foot band. The first two panels hold different photos.
    const photo = regionStats(ctx, size.w, size.h, 0.1, 0.05, 0.8, 0.3);
    const title = regionStats(ctx, size.w, size.h, 0.05, 0.8, 0.9, 0.18);
    const p0 = regionStats(ctx, size.w, size.h, 0.05, 0.05, 0.4, 0.4);
    const p1 = regionStats(ctx, size.w, size.h, 0.05, 0.68, 0.28, 0.28);
    out.push({
      size: `${size.w}x${size.h}`,
      dimsOk: dims !== null && dims.w === size.w && dims.h === size.h,
      photoOk: photo.std > 12,
      titleOk: title.warmBrightShare > 0.005,
      panelsDiffer: colorDistance(p0.meanRGB, p1.meanRGB) > 12,
      photoStd: Number(photo.std.toFixed(2)),
      titleWarmShare: Number(title.warmBrightShare.toFixed(4)),
      panelDistance: Number(colorDistance(p0.meanRGB, p1.meanRGB).toFixed(2)),
    });
  }
  return out;
};

buildButtons('layout', LAYOUTS, state.layout, (id) => {
  state.layout = id;
  selectedPanel = 0;
  refreshPanelSelect();
});
buildButtons('grade', GRADES, state.grade, (id) => {
  state.grade = id;
});
buildButtons('export', EXPORT_SIZES, null, (id) => {
  const size = EXPORT_SIZES.find((s) => s.id === id);
  if (size) exportOne(size);
});
const exportAllBtn = document.getElementById('export-all');
if (exportAllBtn) exportAllBtn.addEventListener('click', exportAll);

bindPhoto('a', 'photoA', 'sampleA');
bindPhoto('b', 'photoB', 'sampleB');

const titleInput = document.getElementById('title');
if (titleInput) {
  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    redraw();
  });
}
const subtitleInput = document.getElementById('subtitle');
if (subtitleInput) {
  subtitleInput.addEventListener('input', () => {
    state.subtitle = subtitleInput.value;
    redraw();
  });
}
const panelSel = document.getElementById('panel');
if (panelSel) {
  panelSel.addEventListener('change', () => {
    selectedPanel = Number(panelSel.value);
    const crop = cropFor(selectedPanel);
    const zoom = document.getElementById('zoom');
    const mx = document.getElementById('moveX');
    const my = document.getElementById('moveY');
    if (zoom) zoom.value = String(crop.zoom);
    if (mx) mx.value = String(crop.dx * 200);
    if (my) my.value = String(crop.dy * 200);
  });
}
bindCropSlider('zoom', 'zoom', 1);
bindCropSlider('moveX', 'dx', 1 / 200);
bindCropSlider('moveY', 'dy', 1 / 200);

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const fx = (e.clientX - rect.left) / rect.width;
  const fy = (e.clientY - rect.top) / rect.height;
  const layout = LAYOUTS.find((l) => l.id === state.layout) ?? LAYOUTS[0];
  const hit = layout.panels.findIndex((p) => fx >= p.x && fx < p.x + p.w && fy >= p.y && fy < p.y + p.h);
  if (hit >= 0) {
    selectedPanel = hit;
    refreshPanelSelect();
    const crop = cropFor(selectedPanel);
    const zoom = document.getElementById('zoom');
    const mx = document.getElementById('moveX');
    const my = document.getElementById('moveY');
    if (zoom) zoom.value = String(crop.zoom);
    if (mx) mx.value = String(crop.dx * 200);
    if (my) my.value = String(crop.dy * 200);
    setStatus(`Panel ${hit + 1} selected — the sliders crop it.`);
  }
});

refreshPanelSelect();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, {
    canvas,
    loadImage,
    ensureFonts,
    setState(patch) {
      Object.assign(state, patch);
      if (patch.photos) state.photos = patch.photos;
      syncControls();
    },
    redraw,
  }).catch((err) => {
    setStatus(`The shot scene failed: ${err.message}`);
  });
} else {
  Promise.all([loadSample('a', 'pier'), loadSample('b', 'boulevard')])
    .then(() => {
      window.__appReady = true;
    })
    .catch(() => {
      redraw();
      window.__appReady = true;
    });
}
