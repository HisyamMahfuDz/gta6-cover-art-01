// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — wires the page: photos, layout, grade, caption,
// per-panel crop, live preview and PNG export in the three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover } from './cover.js';
import { EXPORT_SIZES, GRADES, LAYOUTS, defaultState } from './presets.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = defaultState();
let size = EXPORT_SIZES[0];
let selectedSlot = 0;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Sizes the preview canvas to the chosen export aspect and redraws. */
function redraw() {
  const scale = Math.min(640 / size.w, 640 / size.h);
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  drawCover(canvas, state);
}

/** Renders the cover at full export size and returns a PNG data URL. */
export function exportPNG(w, h) {
  return new Promise((resolve) => {
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    drawCover(off, state);
    resolve(off.toDataURL('image/png'));
  });
}

/** Loads the two bundled sample photos (made for make.fun, free to use). */
async function loadSamples() {
  state.photos[0] = await loadImage('samples/boulevard.jpg');
  state.photos[1] = await loadImage('samples/pier.jpg');
  redraw();
}

function buildButtons(container, entries, current, onPick) {
  container.innerHTML = '';
  for (const [id, def] of Object.entries(entries)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = def.name;
    b.className = 'pick' + (id === current ? ' active' : '');
    b.addEventListener('click', () => {
      onPick(id);
      buildButtons(container, entries, id, onPick);
      redraw();
    });
    container.appendChild(b);
  }
}

function buildSizeRadios() {
  const box = document.getElementById('sizes');
  box.innerHTML = '';
  for (const s of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.label;
    b.className = 'pick' + (s.id === size.id ? ' active' : '');
    b.addEventListener('click', () => {
      size = s;
      buildSizeRadios();
      redraw();
    });
    box.appendChild(b);
  }
}

function syncAdjust() {
  const zoom = document.getElementById('zoom');
  const ox = document.getElementById('ox');
  const oy = document.getElementById('oy');
  const a = state.adjust[selectedSlot];
  zoom.value = a.zoom;
  ox.value = a.ox;
  oy.value = a.oy;
  document.getElementById('zoomVal').textContent = `${Math.round(a.zoom * 100)}%`;
  document.getElementById('oxVal').textContent = `${Math.round(a.ox * 100)}`;
  document.getElementById('oyVal').textContent = `${Math.round(a.oy * 100)}`;
  document.getElementById('slotLabel').textContent = `Panel photo ${selectedSlot + 1}`;
}

/** Rebuilds every control from state (used by ?shot= scenes, which set state directly). */
function refreshControls() {
  buildButtons(document.getElementById('layouts'), LAYOUTS, state.layout, (id) => { state.layout = id; });
  buildButtons(document.getElementById('grades'), GRADES, state.grade, (id) => { state.grade = id; });
  buildSizeRadios();
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  syncAdjust();
}

function bindAdjust() {
  const zoom = document.getElementById('zoom');
  const ox = document.getElementById('ox');
  const oy = document.getElementById('oy');
  zoom.addEventListener('input', () => { state.adjust[selectedSlot].zoom = Number(zoom.value); syncAdjust(); redraw(); });
  ox.addEventListener('input', () => { state.adjust[selectedSlot].ox = Number(ox.value); syncAdjust(); redraw(); });
  oy.addEventListener('input', () => { state.adjust[selectedSlot].oy = Number(oy.value); syncAdjust(); redraw(); });
  document.getElementById('slotPrev').addEventListener('click', () => { selectedSlot = (selectedSlot + 1) % 2; syncAdjust(); });
  document.getElementById('slotNext').addEventListener('click', () => { selectedSlot = (selectedSlot + 1) % 2; syncAdjust(); });
  syncAdjust();
}

function bindPhotos() {
  for (const slot of [0, 1]) {
    document.getElementById(`photo${slot}`).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.photos[slot] = await loadImage(URL.createObjectURL(file));
      status.textContent = `Photo ${slot + 1} loaded: ${file.name}`;
      redraw();
    });
  }
  document.getElementById('samples').addEventListener('click', async () => {
    await loadSamples();
    status.textContent = 'Sample photos loaded.';
  });
  document.getElementById('swap').addEventListener('click', () => {
    [state.photos[0], state.photos[1]] = [state.photos[1], state.photos[0]];
    [state.adjust[0], state.adjust[1]] = [state.adjust[1], state.adjust[0]];
    redraw();
  });
}

function bindText() {
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  title.addEventListener('input', () => { state.title = title.value; redraw(); });
  subtitle.addEventListener('input', () => { state.subtitle = subtitle.value; redraw(); });
}

function bindExport() {
  document.getElementById('export').addEventListener('click', async () => {
    const url = await exportPNG(size.w, size.h);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-coast-cover-${size.w}x${size.h}.png`;
    a.click();
    status.textContent = `Saved neon-coast-cover-${size.w}x${size.h}.png`;
  });
  document.getElementById('exportAll').addEventListener('click', async () => {
    for (const s of EXPORT_SIZES) {
      const url = await exportPNG(s.w, s.h);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neon-coast-cover-${s.w}x${s.h}.png`;
      a.click();
    }
    status.textContent = 'Saved all three sizes.';
  });
}

// Test/automation hook: the screenshot scenes and the export assertions use it.
window.__coverAPI = {
  state,
  redraw,
  exportPNG,
  loadSamples,
  loadImage,
  refreshControls,
  setSize(id) {
    size = EXPORT_SIZES.find((s) => s.id === id) ?? size;
    buildSizeRadios();
    redraw();
  },
};

buildButtons(document.getElementById('layouts'), LAYOUTS, state.layout, (id) => { state.layout = id; });
buildButtons(document.getElementById('grades'), GRADES, state.grade, (id) => { state.grade = id; });
buildSizeRadios();
bindAdjust();
bindPhotos();
bindText();
bindExport();

// Fonts first, so the first paint already uses Anton + Pacifico.
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
Promise.all([
  document.fonts.load('16px Anton'),
  document.fonts.load('16px Pacifico'),
  document.fonts.ready,
]).catch(() => {}).finally(async () => {
  if (shot) {
    await runShot(shot, query, window.__coverAPI);
  } else {
    await loadSamples();
  }
  redraw();
});
