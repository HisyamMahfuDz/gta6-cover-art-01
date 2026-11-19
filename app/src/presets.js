// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — layout and grade presets (original designs).
// Layouts are panel rects in pixels for a cover of size w x h, plus which
// photo slot each panel shows and where the title block sits.

/** Every layout: panels(w, h) rects, slots (photo index per panel), titleZone. */
export const LAYOUTS = {
  'hero-three': {
    name: 'Hero + Three',
    slots: [0, 1, 1, 0],
    panels(w, h) {
      const band = h * 0.78;
      const rw = w * 0.38;
      return [
        { x: 0, y: 0, w: w * 0.62, h: band },
        { x: w * 0.62, y: 0, w: rw, h: band / 3 },
        { x: w * 0.62, y: band / 3, w: rw, h: band / 3 },
        { x: w * 0.62, y: (band / 3) * 2, w: rw, h: band / 3 },
      ];
    },
    titleZone: (w, h) => ({ x: 0, y: h * 0.78, w, h: h * 0.22 }),
  },
  four: {
    name: 'Four Panel',
    slots: [0, 1, 1, 0],
    panels(w, h) {
      const band = h * 0.78;
      return [
        { x: 0, y: 0, w: w / 2, h: band / 2 },
        { x: w / 2, y: 0, w: w / 2, h: band / 2 },
        { x: 0, y: band / 2, w: w / 2, h: band / 2 },
        { x: w / 2, y: band / 2, w: w / 2, h: band / 2 },
      ];
    },
    titleZone: (w, h) => ({ x: 0, y: h * 0.78, w, h: h * 0.22 }),
  },
  fullbleed: {
    name: 'Full Bleed',
    slots: [0],
    panels: (w, h) => [{ x: 0, y: 0, w, h: h * 0.78 }],
    titleZone: (w, h) => ({ x: 0, y: h * 0.78, w, h: h * 0.22 }),
  },
  tilted: {
    name: 'Tilted Snapshots',
    slots: [0, 1, 0],
    snapshot: true,
    tilts: [-0.06, 0.05, -0.03],
    panels(w, h) {
      // Three overlapping snapshot frames; the renderer tilts each around
      // its own centre (see cover.js) for the scattered-polaroid look.
      const band = h * 0.76;
      return [
        { x: w * 0.04, y: h * 0.05, w: w * 0.52, h: band * 0.62 },
        { x: w * 0.5, y: h * 0.02, w: w * 0.46, h: band * 0.52 },
        { x: w * 0.3, y: band * 0.48, w: w * 0.6, h: band * 0.52 },
      ];
    },
    titleZone: (w, h) => ({ x: 0, y: h * 0.78, w, h: h * 0.22 }),
  },
};

/** Colour grades: a canvas filter for the photo, a wash gradient, the sky. */
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.06) sepia(0.18)',
    wash: [[0, 'rgba(255, 120, 60, 0.10)'], [1, 'rgba(255, 41, 117, 0.28)']],
    sky: [[0, '#2b1055'], [0.55, '#ff7a3d'], [1, '#ffd319']],
    badge: 'SUNSET EDITION',
  },
  neon: {
    name: 'Neon Night',
    filter: 'saturate(1.7) contrast(1.12) hue-rotate(-12deg)',
    wash: [[0, 'rgba(0, 229, 255, 0.14)'], [1, 'rgba(255, 41, 117, 0.30)']],
    sky: [[0, '#0b0620'], [0.6, '#3b0f66'], [1, '#ff2975']],
    badge: 'NEON NIGHTS',
  },
  teal: {
    name: 'Teal Dawn',
    filter: 'saturate(1.25) contrast(1.05) hue-rotate(18deg)',
    wash: [[0, 'rgba(0, 229, 255, 0.18)'], [1, 'rgba(0, 120, 140, 0.22)']],
    sky: [[0, '#06222e'], [0.55, '#0e7c86'], [1, '#ffd319']],
    badge: 'TEAL DAWN',
  },
  noir: {
    name: 'Mono Noir',
    filter: 'grayscale(1) contrast(1.25) brightness(1.05)',
    wash: [[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.25)']],
    sky: [[0, '#111111'], [0.6, '#3a3a3a'], [1, '#e8e8e8']],
    badge: 'MONO NOIR',
  },
  gold: {
    name: 'Palm Gold',
    filter: 'saturate(1.2) contrast(1.05) sepia(0.55)',
    wash: [[0, 'rgba(255, 211, 25, 0.12)'], [1, 'rgba(180, 110, 20, 0.25)']],
    sky: [[0, '#3d1e05'], [0.55, '#c47b1e'], [1, '#ffe9a8']],
    badge: 'PALM GOLD',
  },
};

/** The three post sizes the app exports, in pixels. */
export const EXPORT_SIZES = [
  { id: '1080x1080', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
];

/** Default state for a fresh load (sample photos + the launch-week title). */
export function defaultState() {
  return {
    layout: 'hero-three',
    grade: 'sunset',
    title: 'Neon Shore',
    subtitle: 'golden days, neon nights',
    photos: [null, null],
    adjust: [{ zoom: 1, ox: 0, oy: 0 }, { zoom: 1, ox: 0, oy: 0 }],
  };
}
