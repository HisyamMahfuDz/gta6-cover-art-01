// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — the cover engine.
// Draws a multi-panel cover (see presets.js) onto any canvas: the photos
// fill their panels with a per-panel crop, the grade tints the whole
// picture, then the title (Anton, sunset gradient) and the subtitle
// (Pacifico, glowing script) are lettered over a dark foot scrim, and a
// light film grain finishes it. All coordinates are relative, so the same
// state renders at any export size.

import { LAYOUTS, GRADES } from './presets.js';

export const FONT_ANTON = 'Anton';
export const FONT_PACIFICO = 'Pacifico';

/** Loads the two cover fonts and waits until they can be drawn. */
export async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`40px "${FONT_ANTON}"`),
      document.fonts.load(`40px "${FONT_PACIFICO}"`),
    ]);
    await document.fonts.ready;
  } catch {
    // A missing font falls back to the canvas default; the cover still draws.
  }
}

function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** A tiny deterministic PRNG, so the grain is identical on every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPhoto(ctx, photo, rect, crop, filter) {
  const { x, y, w, h } = rect;
  const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * (crop?.zoom ?? 1);
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  const dx = x + (w - dw) / 2 + (crop?.dx ?? 0) * w;
  const dy = y + (h - dh) / 2 + (crop?.dy ?? 0) * h;
  ctx.save();
  if (filter) ctx.filter = filter;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

function drawPanel(ctx, photo, panel, rect, crop, filter) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (panel.tilt) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((panel.tilt * Math.PI) / 180);
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
  }
  if (photo) {
    drawPhoto(ctx, photo, rect, crop, filter);
  } else {
    ctx.fillStyle = '#3a2340';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
  // A hairline gap so panels read as separate frames.
  ctx.strokeStyle = 'rgba(10, 4, 18, 0.9)';
  ctx.lineWidth = Math.max(2, rect.w * 0.004);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawGrade(ctx, grade, w, h) {
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  for (const [at, color] of grade.stops) wash.addColorStop(at, color);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, family, weight, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
  }
  return size;
}

function drawLettering(ctx, state, w, h) {
  const title = (state.title ?? '').trim();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return;
  // Dark foot scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, h * 0.68, 0, h);
  scrim.addColorStop(0, 'rgba(12, 2, 24, 0)');
  scrim.addColorStop(1, 'rgba(12, 2, 24, 0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const titleY = h * 0.9;
  if (title) {
    const size = fitFont(ctx, title.toUpperCase(), FONT_ANTON, '400', w * 0.92, h * 0.13);
    const grad = ctx.createLinearGradient(w * 0.08, 0, w * 0.92, 0);
    grad.addColorStop(0, '#ffd23e');
    grad.addColorStop(0.35, '#ff7a3d');
    grad.addColorStop(0.7, '#ff2e88');
    grad.addColorStop(1, '#b04dff');
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(16, 2, 28, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(title.toUpperCase(), w / 2, titleY);
    ctx.fillStyle = grad;
    ctx.fillText(title.toUpperCase(), w / 2, titleY);
  }
  if (subtitle) {
    const size = fitFont(ctx, subtitle, FONT_PACIFICO, '400', w * 0.8, h * 0.055);
    const y = title ? titleY + size * 1.15 : h * 0.9;
    ctx.font = `400 ${size}px "${FONT_PACIFICO}", cursive`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff9de2';
    ctx.shadowBlur = size * 0.55;
    ctx.fillText(subtitle, w / 2, y);
    ctx.shadowBlur = 0;
  }
}

function drawGrain(ctx, w, h) {
  const rand = mulberry32(0x9e3779b9);
  const count = Math.floor((w * h) / 900);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(rand() * w, rand() * h, 1.4, 1.4);
  }
  ctx.restore();
}

/**
 * Draws the cover for `state` onto `canvas` at the canvas's own size.
 * state: { layout, grade, title, subtitle, photos: { a, b }, crops: { [panelIndex]: { zoom, dx, dy } } }
 * Photos are HTMLImageElements (or null). Missing photos leave a dark panel.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);

  ctx.fillStyle = '#160a20';
  ctx.fillRect(0, 0, w, h);

  layout.panels.forEach((panel, i) => {
    const rect = {
      x: panel.x * w,
      y: panel.y * h,
      w: panel.w * w,
      h: panel.h * h,
    };
    const photo = state.photos?.[panel.photo] ?? null;
    const crop = state.crops?.[i] ?? { zoom: 1, dx: 0, dy: 0 };
    drawPanel(ctx, photo, panel, rect, crop, grade.filter);
  });

  drawGrade(ctx, grade, w, h);
  drawLettering(ctx, state, w, h);
  drawGrain(ctx, w, h);
}
