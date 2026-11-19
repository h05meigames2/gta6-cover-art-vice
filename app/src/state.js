// Neon Coast Cover Studio — shared state: sizes, layouts, grades, defaults.
// Every layout is a list of panel rectangles in fractions of the cover (x, y, w, h,
// plus an optional tilt in degrees). The title block is drawn in the layout's
// `titleZone` (also fractions). Panels are filled from `state.panels` in order;
// a panel whose `kind` is "title" holds the title block instead of a photo.
export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

export const LAYOUTS = {
  hero3: {
    label: 'Hero + Three',
    hint: 'One big hero shot, three stacked beside it',
    panels: [
      { x: 0, y: 0, w: 0.615, h: 1 },
      { x: 0.63, y: 0, w: 0.37, h: 0.32 },
      { x: 0.63, y: 0.34, w: 0.37, h: 0.32 },
      { x: 0.63, y: 0.68, w: 0.37, h: 0.32 },
    ],
    titleZone: { x: 0.03, y: 0.66, w: 0.6, h: 0.31, align: 'left' },
  },
  grid4: {
    label: 'Four Grid',
    hint: 'Two by two, equal panels',
    panels: [
      { x: 0, y: 0, w: 0.4925, h: 0.4925 },
      { x: 0.5075, y: 0, w: 0.4925, h: 0.4925 },
      { x: 0, y: 0.5075, w: 0.4925, h: 0.4925 },
      { x: 0.5075, y: 0.5075, w: 0.4925, h: 0.4925 },
    ],
    titleZone: { x: 0.03, y: 0.68, w: 0.94, h: 0.29, align: 'left' },
  },
  bleed: {
    label: 'Full Bleed',
    hint: 'One photo edge to edge',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
    titleZone: { x: 0.04, y: 0.6, w: 0.92, h: 0.36, align: 'left' },
  },
  grid9: {
    label: 'Nine Grid',
    hint: 'Three by three, title in the middle',
    panels: [
      { x: 0, y: 0, w: 0.325, h: 0.325 },
      { x: 0.3375, y: 0, w: 0.325, h: 0.325 },
      { x: 0.675, y: 0, w: 0.325, h: 0.325 },
      { x: 0, y: 0.3375, w: 0.325, h: 0.325 },
      { x: 0.3375, y: 0.3375, w: 0.325, h: 0.325, kind: 'title' },
      { x: 0.675, y: 0.3375, w: 0.325, h: 0.325 },
      { x: 0, y: 0.675, w: 0.325, h: 0.325 },
      { x: 0.3375, y: 0.675, w: 0.325, h: 0.325 },
      { x: 0.675, y: 0.675, w: 0.325, h: 0.325 },
    ],
    titleZone: { x: 0.345, y: 0.345, w: 0.31, h: 0.31, align: 'center' },
  },
  tilted: {
    label: 'Tilted Snapshots',
    hint: 'Overlapping tilted prints on a sunset wash',
    panels: [
      { x: 0.04, y: 0.02, w: 0.52, h: 0.46, tilt: -6, frame: true },
      { x: 0.44, y: 0.02, w: 0.52, h: 0.46, tilt: 5, frame: true },
      { x: 0.25, y: 0.4, w: 0.5, h: 0.42, tilt: -3, frame: true },
    ],
    titleZone: { x: 0.04, y: 0.83, w: 0.92, h: 0.15, align: 'center' },
  },
  story: {
    label: 'Story Stack',
    hint: 'Big photo on top, title band, two below',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.74, w: 0.4925, h: 0.26 },
      { x: 0.5075, y: 0.74, w: 0.4925, h: 0.26 },
    ],
    titleZone: { x: 0.04, y: 0.585, w: 0.92, h: 0.15, align: 'left' },
  },
};

// A grade is a photo filter plus two colour washes: one laid over each photo
// (soft light) and one laid over the whole cover (screen, very faint), so the
// whole poster shares one sunset / neon mood.
export const GRADES = {
  sunset: {
    label: 'Sunset Vice',
    swatch: 'linear-gradient(135deg,#ff5e3a,#ff2e88 55%,#7b2ff7)',
    saturate: 1.18, contrast: 1.06, brightness: 1.0,
    photoWash: ['rgba(255,94,58,0.16)', 'rgba(255,46,136,0.10)', 'rgba(123,47,247,0.12)'],
    coverWash: ['rgba(255,120,60,0.05)', 'rgba(255,46,136,0.05)'],
    titleFrom: '#fff7d6', titleTo: '#ff9e5e', neon: '#ff5e8a',
  },
  neon: {
    label: 'Neon Nights',
    swatch: 'linear-gradient(135deg,#ff2e88,#22d3ee 55%,#0b1026)',
    saturate: 1.38, contrast: 1.1, brightness: 0.98,
    photoWash: ['rgba(255,46,136,0.20)', 'rgba(34,211,238,0.14)', 'rgba(20,10,60,0.16)'],
    coverWash: ['rgba(255,46,136,0.06)', 'rgba(34,211,238,0.06)'],
    titleFrom: '#ffffff', titleTo: '#7df3ff', neon: '#ff2e88',
  },
  golden: {
    label: 'Golden Hour',
    swatch: 'linear-gradient(135deg,#ffd76a,#ff9e3d 55%,#b3541e)',
    saturate: 1.22, contrast: 1.04, brightness: 1.03,
    photoWash: ['rgba(255,200,90,0.20)', 'rgba(255,140,40,0.10)', 'rgba(120,60,10,0.10)'],
    coverWash: ['rgba(255,190,80,0.07)', 'rgba(255,140,40,0.04)'],
    titleFrom: '#fffbe8', titleTo: '#ffc46b', neon: '#ffb347',
  },
  teal: {
    label: 'Teal Dusk',
    swatch: 'linear-gradient(135deg,#0ea5a4,#155e75 55%,#f97316)',
    saturate: 1.12, contrast: 1.08, brightness: 0.99,
    photoWash: ['rgba(14,165,164,0.18)', 'rgba(21,94,117,0.14)', 'rgba(249,115,22,0.08)'],
    coverWash: ['rgba(14,165,164,0.06)', 'rgba(249,115,22,0.04)'],
    titleFrom: '#eafffb', titleTo: '#5eead4', neon: '#2dd4bf',
  },
  noir: {
    label: 'Mono Noir',
    swatch: 'linear-gradient(135deg,#e5e5e5,#737373 55%,#111111)',
    saturate: 0, contrast: 1.14, brightness: 1.02,
    photoWash: ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.14)'],
    coverWash: ['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.05)'],
    titleFrom: '#ffffff', titleTo: '#c9c9c9', neon: '#ffffff',
  },
  palm: {
    label: 'Palm Pop',
    swatch: 'linear-gradient(135deg,#84cc16,#059669 55%,#f59e0b)',
    saturate: 1.3, contrast: 1.05, brightness: 1.01,
    photoWash: ['rgba(132,204,22,0.14)', 'rgba(5,150,105,0.12)', 'rgba(245,158,11,0.10)'],
    coverWash: ['rgba(132,204,22,0.05)', 'rgba(245,158,11,0.05)'],
    titleFrom: '#f7fee7', titleTo: '#fde68a', neon: '#a3e635',
  },
};

export const SAMPLE_PHOTOS = ['boulevard', 'rooftop', 'neon', 'pier'];

/** A fresh cover state: hero layout, sunset grade, sample photos in place. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: 'square',
    title: 'NEON COAST',
    subtitle: 'chasing the last light',
    tag: 'EST. 2026 · OCEAN DRIVE',
    stars: 4,
    grain: true,
    vignette: true,
    halftone: false,
    panels: [
      { ref: 'boulevard', zoom: 1, ox: 0, oy: 0 },
      { ref: 'neon', zoom: 1, ox: 0, oy: 0 },
      { ref: 'rooftop', zoom: 1, ox: 0, oy: 0 },
      { ref: 'pier', zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

/** Panels a layout actually shows (skips the title cell of the nine grid). */
export function photoPanels(layoutId) {
  return LAYOUTS[layoutId].panels.filter((p) => p.kind !== 'title');
}

/** Serialises a state for undo history (photo references only, never pixels). */
export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  const state = JSON.parse(json);
  return state;
}
