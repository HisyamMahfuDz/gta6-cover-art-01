// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — cover engine: layouts, grades, lettering, grain.
// Draws a multi-panel GTA-style poster cover (original art only, no Rockstar
// logo, artwork or fonts) from the user's own photos onto a 2D canvas.
import { GRADES, LAYOUTS } from './presets.js';

/** A small noise tile, reused for the film grain overlay. */
function makeGrainTile() {
  const tile = document.createElement('canvas');
  tile.width = 256;
  tile.height = 256;
  const ctx = tile.getContext('2d');
  const data = ctx.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 20);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return tile;
}

const grainTile = makeGrainTile();

/** Draws one photo into a panel rect, cover-fit, with per-panel zoom/offset. */
export function drawPhotoPanel(ctx, photo, rect, adjust, grade) {
  const { x, y, w, h } = rect;
  if (!photo) {
    ctx.fillStyle = '#241533';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = grade.filter;
  const zoom = adjust?.zoom ?? 1;
  const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * zoom;
  const pw = photo.naturalWidth * scale;
  const ph = photo.naturalHeight * scale;
  const dx = x + (w - pw) / 2 + (adjust?.ox ?? 0) * w;
  const dy = y + (h - ph) / 2 + (adjust?.oy ?? 0) * h;
  ctx.drawImage(photo, dx, dy, pw, ph);
  ctx.filter = 'none';
  // Grade wash: a translucent sunset/neon gradient laid over the photo.
  if (grade.wash) {
    const wash = ctx.createLinearGradient(x, y, x + w, y + h);
    for (const [stop, color] of grade.wash) wash.addColorStop(stop, color);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** Halftone dots across a band: dots shrink left to right, poster-print feel. */
function drawHalftone(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(6, h * 0.09);
  for (let row = 0, ry = y + step / 2; ry < y + h; row++, ry += step) {
    for (let rx = x + step / 2 + (row % 2 ? step / 2 : 0); rx < x + w; rx += step) {
      const t = 1 - (rx - x) / w;
      const r = Math.max(0.6, (step * 0.42 * t) | 0);
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The title block: ink band, halftone, sunset-gradient Anton title, neon script subtitle. */
export function drawTitleBlock(ctx, zone, title, subtitle) {
  const { x, y, w, h } = zone;
  ctx.fillStyle = '#150829';
  ctx.fillRect(x, y, w, h);
  drawHalftone(ctx, x, y, w, h * 0.32, 'rgba(255, 90, 160, 0.35)');
  // Thin neon rule above the band.
  const rule = ctx.createLinearGradient(x, 0, x + w, 0);
  rule.addColorStop(0, '#ff2975');
  rule.addColorStop(0.5, '#ffd319');
  rule.addColorStop(1, '#00e5ff');
  ctx.fillStyle = rule;
  ctx.fillRect(x, y, w, Math.max(2, h * 0.03));

  const text = (title || 'NEON COAST').trim().toUpperCase();
  let size = h * 0.48;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = () => { ctx.font = `${size}px Anton, "Arial Black", sans-serif`; };
  setFont();
  while (ctx.measureText(text).width > w * 0.76 && size > 10) {
    size -= 2;
    setFont();
  }
  const cx = x + w / 2;
  const baseline = y + h * 0.58;
  const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  grad.addColorStop(0, '#fff6c9');
  grad.addColorStop(0.45, '#ffd319');
  grad.addColorStop(0.8, '#ff7a3d');
  grad.addColorStop(1, '#ff2975');
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, cx, baseline);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baseline);

  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(12, h * 0.17);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2975';
    ctx.shadowBlur = subSize * 0.6;
    ctx.fillText(sub, cx, y + h * 0.86);
    ctx.shadowBlur = 0;
  }
}

/** Small badge ribbon at the right end of the title band (never over a face). */
function drawBadge(ctx, zone, w, label) {
  const bw = w * 0.17;
  const bh = Math.max(16, zone.h * 0.26);
  ctx.save();
  ctx.translate(zone.x + zone.w - bw / 2 - w * 0.02, zone.y + zone.h * 0.52);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#ffd319';
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#1a0b2e';
  ctx.font = `${bh * 0.5}px Anton, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Film grain + vignette over the whole cover. */
function finishCover(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(grainTile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(10,4,20,0)');
  vig.addColorStop(1, 'rgba(10,4,20,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover. `state` holds photos (array of images, one per panel
 * slot), layout id, grade id, title, subtitle and per-panel adjustments.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS['hero-three'];
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const photos = state.photos ?? [];

  // Backdrop: the grade's sky gradient fills every gap and gutter.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  for (const [stop, color] of grade.sky) sky.addColorStop(stop, color);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const panels = layout.panels(w, h);
  panels.forEach((rect, i) => {
    const slot = layout.slots[i];
    ctx.save();
    // Tilted layouts rotate each panel around its own centre.
    if (layout.tilts) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(layout.tilts[i] ?? 0);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (layout.snapshot) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.max(8, w * 0.012);
      ctx.shadowOffsetY = Math.max(4, h * 0.006);
    }
    drawPhotoPanel(ctx, photos[slot] ?? null, rect, state.adjust?.[slot], grade);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Gutter: ink for grids, a white snapshot frame for the tilted layout.
    ctx.strokeStyle = layout.snapshot ? '#ffffff' : '#150829';
    ctx.lineWidth = layout.snapshot ? Math.max(3, w * 0.008) : Math.max(2, w * 0.006);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  const zone = layout.titleZone(w, h);
  drawTitleBlock(ctx, zone, state.title, state.subtitle);
  drawBadge(ctx, zone, w, grade.badge);
  finishCover(ctx, w, h);
}
