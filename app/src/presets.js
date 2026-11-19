// SPDX-License-Identifier: MIT
// Neon Coast Cover Studio — layouts, colour grades and export sizes.
// A layout is a list of panels; each panel names the photo slot it shows
// ('a' or 'b') and its rectangle as fractions of the canvas (x, y, w, h),
// plus an optional tilt in degrees. A grade is a tint drawn over the
// finished panels plus an optional canvas filter for the photos.

export const LAYOUTS = [
  {
    id: 'hero-three',
    name: 'Hero + Three',
    panels: [
      { photo: 'a', x: 0.0, y: 0.0, w: 1.0, h: 0.62 },
      { photo: 'b', x: 0.0, y: 0.62, w: 1 / 3, h: 0.38 },
      { photo: 'a', x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
      { photo: 'b', x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
    ],
  },
  {
    id: 'four',
    name: 'Four Panel',
    panels: [
      { photo: 'a', x: 0.0, y: 0.0, w: 0.5, h: 0.5 },
      { photo: 'b', x: 0.5, y: 0.0, w: 0.5, h: 0.5 },
      { photo: 'b', x: 0.0, y: 0.5, w: 0.5, h: 0.5 },
      { photo: 'a', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'bleed',
    name: 'Full Bleed',
    panels: [{ photo: 'a', x: 0.0, y: 0.0, w: 1.0, h: 1.0 }],
  },
  {
    id: 'tilted',
    name: 'Tilted Snapshots',
    panels: [
      { photo: 'a', x: 0.08, y: 0.08, w: 0.62, h: 0.56, tilt: -6 },
      { photo: 'b', x: 0.34, y: 0.38, w: 0.62, h: 0.56, tilt: 5 },
    ],
  },
];

export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    // Warm orange-to-pink wash, stronger at the bottom.
    stops: [
      [0.0, 'rgba(255, 170, 60, 0.10)'],
      [0.55, 'rgba(255, 110, 80, 0.16)'],
      [1.0, 'rgba(214, 48, 140, 0.34)'],
    ],
    filter: 'saturate(1.25) contrast(1.05)',
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    stops: [
      [0.0, 'rgba(90, 60, 255, 0.16)'],
      [0.6, 'rgba(140, 50, 220, 0.20)'],
      [1.0, 'rgba(20, 10, 70, 0.42)'],
    ],
    filter: 'saturate(1.3) contrast(1.08)',
  },
  {
    id: 'teal-dawn',
    name: 'Teal Dawn',
    stops: [
      [0.0, 'rgba(60, 220, 200, 0.12)'],
      [0.55, 'rgba(30, 160, 190, 0.18)'],
      [1.0, 'rgba(10, 60, 90, 0.38)'],
    ],
    filter: 'saturate(1.2) contrast(1.04)',
  },
  {
    id: 'mono-noir',
    name: 'Mono Noir',
    stops: [
      [0.0, 'rgba(255, 255, 255, 0.05)'],
      [1.0, 'rgba(0, 0, 0, 0.30)'],
    ],
    filter: 'grayscale(1) contrast(1.15) brightness(1.02)',
  },
  {
    id: 'palm-gold',
    name: 'Palm Gold',
    stops: [
      [0.0, 'rgba(255, 215, 120, 0.14)'],
      [0.55, 'rgba(230, 170, 60, 0.18)'],
      [1.0, 'rgba(140, 80, 20, 0.34)'],
    ],
    filter: 'saturate(1.2) contrast(1.05)',
  },
];

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

export const DEFAULT_STATE = {
  layout: 'hero-three',
  grade: 'vice-sunset',
  title: 'NEON COAST',
  subtitle: 'Sunset Heist',
};
