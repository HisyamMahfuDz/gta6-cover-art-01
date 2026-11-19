// SPDX-License-Identifier: MIT
// Fixed scenes for screenshots: ?shot=editor shows the page with the sample
// photos loaded; ?shot=cover shows one exported cover alone, drawn by the app
// at the requested post size. window.__shotReady is set once painted.
import { drawCover } from './cover.js';

export async function runShot(shot, query, api) {
  const { state } = api;
  const canvas = document.getElementById('cover');
  await api.loadSamples();
  state.title = query.get('title') ?? 'Neon Shore';
  state.subtitle = query.get('subtitle') ?? 'golden days, neon nights';
  state.layout = query.get('layout') ?? 'hero-three';
  state.grade = query.get('grade') ?? 'sunset';
  if (query.get('zoom')) state.adjust[0].zoom = Number(query.get('zoom'));
  api.refreshControls();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const [w, h] = (query.get('size') ?? '1920x1080').split('x').map(Number);
    canvas.width = w;
    canvas.height = h;
    drawCover(canvas, state);
  } else {
    // Editor scenes keep the normal preview canvas.
    api.redraw();
  }
  await document.fonts.ready;
  if (shot === 'cover') {
    // Redraw after the font swap, so the title uses Anton, not a fallback.
    // (Do not call api.redraw() here: it would shrink the canvas to preview size.)
    drawCover(canvas, state);
  } else {
    api.redraw();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
