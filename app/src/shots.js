// SPDX-License-Identifier: MIT
// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// scene loaded; ?shot=cover shows the cover alone. The query picks the
// samples and the cover settings:
//   photo, photo2 — sample names (samples/<name>.jpg), default pier/boulevard
//   title, subtitle — the lettering
//   layout, grade — the cover's layout and grade
//   cw, ch — the canvas pixel size (a portrait cover uses 1024x1280)
// window.__shotReady is set once the scene has painted.

export async function runShot(shot, query, hooks) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') ?? 'pier';
  const photo2 = query.get('photo2') ?? (photo === 'pier' ? 'boulevard' : 'pier');
  const title = query.get('title') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? '';
  const layout = query.get('layout') ?? 'hero-three';
  const grade = query.get('grade') ?? 'vice-sunset';
  const cw = Number(query.get('cw') ?? 0);
  const ch = Number(query.get('ch') ?? 0);
  if (cw > 0 && ch > 0) {
    hooks.canvas.width = cw;
    hooks.canvas.height = ch;
  }
  const [a, b] = await Promise.all([
    hooks.loadImage(`samples/${photo}.jpg`),
    hooks.loadImage(`samples/${photo2}.jpg`),
  ]);
  hooks.setState({ layout, grade, title, subtitle, photos: { a, b } });
  await hooks.ensureFonts();
  hooks.redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
