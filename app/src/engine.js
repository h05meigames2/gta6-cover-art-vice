// Neon Coast Cover Studio — the cover engine. Draws a whole poster from a state
// object onto any 2D canvas: panels with crop/pan/zoom, the grade wash, the title
// block in Anton + Pacifico, grain and vignette. Pure function of (state, photos).
import { GRADES, LAYOUTS, SIZES } from './state.js';

const TITLE_FONT = 'Anton, "Arial Narrow", sans-serif';
const SCRIPT_FONT = 'Pacifico, cursive';
const TAG_FONT = '"Arial Narrow", Arial, sans-serif';

/** Pixel rectangles of a layout's panels on a W×H canvas (tilt kept for hit tests). */
export function layoutPanelRects(layoutId, W, H) {
  return LAYOUTS[layoutId].panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    tilt: p.tilt ?? 0,
    frame: !!p.frame,
    kind: p.kind ?? 'photo',
  }));
}

/** Pixel rectangles of only the photo panels, in the order state.panels fills them. */
export function photoPanelRects(layoutId, W, H) {
  return layoutPanelRects(layoutId, W, H).filter((r) => r.kind === 'photo');
}

/** Deterministic pseudo-random generator, so grain looks the same every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const rand = mulberry32(20261119);
  const tile = document.createElement('canvas');
  tile.width = 140; tile.height = 140;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

/** Draws one photo cover-fit inside a rectangle, honouring zoom and pan offsets. */
function drawPhotoCover(ctx, img, rx, ry, rw, rh, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rw / iw, rh / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const dx = rx + (rw - dw) / 2 + ox * rw;
  const dy = ry + (rh - dh) / 2 + oy * rh;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** A vertical colour wash laid over a rectangle with soft-light blending. */
function washRect(ctx, stops, x, y, w, h, mode = 'soft-light') {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** The empty-panel placeholder: a warm gradient, a sun disc and a prompt. */
function drawEmptyPanel(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#3b1d4e'); g.addColorStop(0.55, '#8a2f5e'); g.addColorStop(1, '#e85d3d');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h * 0.38;
  const r = Math.min(w, h) * 0.16;
  ctx.fillStyle = 'rgba(255, 214, 130, 0.9)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${Math.max(14, Math.min(w, h) * 0.09)}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ADD PHOTO', cx, y + h * 0.68);
  ctx.font = `${Math.max(11, Math.min(w, h) * 0.045)}px ${TAG_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('CLICK A PANEL, THEN PICK A PHOTO', cx, y + h * 0.68 + Math.min(w, h) * 0.09);
}

/** Splits a title into 1–2 lines that fit maxW, shrinking until it fits maxH too. */
function fitTitle(ctx, text, maxW, maxH) {
  const words = text.trim().toUpperCase().split(/\s+/);
  let size = maxH * 0.52;
  const lineHeight = () => size * 1.02;
  const measure = (t) => { ctx.font = `${size}px ${TITLE_FONT}`; return ctx.measureText(t).width; };
  let lines = [text.trim().toUpperCase()];
  while (size > 10) {
    if (measure(lines.join(' ')) <= maxW && lineHeight() * lines.length <= maxH) return { lines, size };
    if (lines.length === 1 && words.length > 1) {
      // Try a two-line break at the most even word boundary.
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        const w = Math.max(measure(a), measure(b));
        if (!best || w < best.w) best = { w, lines: [a, b] };
      }
      if (best && best.w <= maxW && lineHeight() * 2 <= maxH) return { lines: best.lines, size };
    }
    size -= 2;
  }
  return { lines, size };
}

/** The title block: big gradient Anton title, Pacifico neon subtitle, tag + stars. */
function drawTitleBlock(ctx, state, zone, W, H) {
  const grade = GRADES[state.grade];
  const zx = zone.x * W;
  const zy = zone.y * H;
  const zw = zone.w * W;
  const zh = zone.h * H;
  const center = zone.align === 'center';
  const tx = center ? zx + zw / 2 : zx;

  // Legibility band behind the words (skipped for the nine-grid title cell,
  // which gets a solid card instead).
  if (state.layout !== 'grid9') {
    const band = ctx.createLinearGradient(0, zy - zh * 0.25, 0, zy + zh);
    band.addColorStop(0, 'rgba(8,4,18,0)');
    band.addColorStop(0.35, 'rgba(8,4,18,0.55)');
    band.addColorStop(1, 'rgba(8,4,18,0.88)');
    ctx.fillStyle = band;
    ctx.fillRect(0, zy - zh * 0.25, W, zh * 1.25);
  } else {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(zx, zy, zw, zh);
    const edge = ctx.createLinearGradient(zx, zy, zx + zw, zy + zh);
    edge.addColorStop(0, 'rgba(255,94,58,0.5)');
    edge.addColorStop(1, 'rgba(123,47,247,0.5)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.strokeRect(zx, zy, zw, zh);
  }

  if (state.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#000';
    const step = Math.max(6, W * 0.012);
    for (let yy = zy; yy < zy + zh; yy += step) {
      for (let xx = 0; xx < W; xx += step) {
        ctx.beginPath();
        ctx.arc(xx + step / 2, yy + step / 2, step * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const title = state.title.trim();
  const sub = state.subtitle.trim();
  const tag = state.tag.trim();
  const pad = Math.min(zw * 0.04, 24);
  const availW = zw - pad * (center ? 2 : 1);
  const availH = zh * (sub ? 0.58 : 0.72);
  let cursorY = zy + zh * 0.08;

  if (title) {
    const { lines, size } = fitTitle(ctx, title, availW, availH);
    const grad = ctx.createLinearGradient(0, cursorY, 0, cursorY + size * lines.length);
    grad.addColorStop(0, grade.titleFrom);
    grad.addColorStop(1, grade.titleTo);
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'top';
    ctx.font = `${size}px ${TITLE_FONT}`;
    ctx.lineWidth = Math.max(2, size * 0.055);
    ctx.strokeStyle = 'rgba(10,4,20,0.9)';
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const y = cursorY + i * size * 1.02;
      ctx.strokeText(line, tx, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, tx, y);
    });
    cursorY += size * 1.02 * lines.length + size * 0.08;
  }

  if (sub) {
    const subSize = Math.min(zh * 0.17, Math.max(12, W * 0.028));
    ctx.font = `${subSize}px ${SCRIPT_FONT}`;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = grade.neon;
    ctx.shadowBlur = subSize * 0.9;
    ctx.fillStyle = grade.neon;
    ctx.fillText(sub, tx, cursorY);
    ctx.shadowBlur = 0;
    cursorY += subSize * 1.7;
  }

  if (tag || state.stars > 0) {
    let tagSize = Math.max(11, Math.min(zh * 0.1, W * 0.016));
    ctx.font = `700 ${tagSize}px ${TAG_FONT}`;
    try { ctx.letterSpacing = `${Math.max(2, tagSize * 0.22)}px`; } catch { /* older canvas */ }
    const tagText = tag.toUpperCase();
    const starsText = state.stars > 0 ? '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars) : '';
    const gap = starsText ? 8 : 0;
    // Shrink the tag line until it fits the zone. A centred zone (the nine-grid
    // title cell) puts the stars on their own line below the tag; a left-aligned
    // zone keeps them inline after the tag.
    const starsInline = !center;
    const fitWidth = () => starsInline
      ? ctx.measureText(tagText).width + (starsText ? ctx.measureText(`  ${starsText}`).width + gap : 0)
      : ctx.measureText(tagText).width;
    while (tagSize > 8 && fitWidth() > availW) {
      tagSize -= 1;
      ctx.font = `700 ${tagSize}px ${TAG_FONT}`;
    }
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (tagText) ctx.fillText(tagText, tx, cursorY);
    if (starsText) {
      const tw = tagText ? ctx.measureText(tagText).width : 0;
      ctx.fillStyle = '#ffd76a';
      try { ctx.letterSpacing = '2px'; } catch { /* older canvas */ }
      if (starsInline) {
        ctx.fillText(starsText, tx + tw + gap, cursorY);
      } else {
        ctx.fillText(starsText, tx, cursorY + tagSize * 1.7);
      }
    }
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/**
 * Draws the whole cover onto `canvas` from `state`.
 * `resolvePhoto(ref)` returns an HTMLImageElement (or null) for a panel's ref.
 */
export function drawCover(canvas, state, resolvePhoto) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layout = LAYOUTS[state.layout];
  const grade = GRADES[state.grade];

  // Backdrop: deep dusk purple, so gutters read as poster ink.
  ctx.fillStyle = '#150a24';
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'none';

  const rects = layoutPanelRects(state.layout, W, H);
  const gutter = Math.max(2, Math.round(W * 0.006));
  let photoIndex = 0;

  rects.forEach((rect) => {
    if (rect.kind === 'title') return;
    const panel = state.panels[photoIndex++] ?? { ref: null, zoom: 1, ox: 0, oy: 0 };
    const img = panel.ref ? resolvePhoto(panel.ref) : null;
    ctx.save();
    if (rect.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.tilt * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      ctx.translate(rect.x, rect.y);
    }
    const framePad = rect.frame ? Math.round(Math.min(rect.w, rect.h) * 0.035) : 0;
    const frameBottom = rect.frame ? Math.round(Math.min(rect.w, rect.h) * 0.09) : 0;
    if (rect.frame) {
      ctx.fillStyle = '#f8f4ec';
      ctx.fillRect(-framePad, -framePad, rect.w + framePad * 2, rect.h + framePad + frameBottom);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.008);
      ctx.fillRect(-framePad, -framePad, rect.w + framePad * 2, rect.h + framePad + frameBottom);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    const ix = 0; const iy = 0; const iw = rect.w; const ih = rect.h;
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    if (img) {
      ctx.filter = `saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`;
      drawPhotoCover(ctx, img, ix, iy, iw, ih, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
      ctx.filter = 'none';
      washRect(ctx, grade.photoWash, ix, iy, iw, ih);
    } else {
      drawEmptyPanel(ctx, ix, iy, iw, ih);
    }
    // Inked keyline around every panel.
    ctx.strokeStyle = 'rgba(10,4,20,0.85)';
    ctx.lineWidth = Math.max(2, gutter);
    ctx.strokeRect(ix, iy, iw, ih);
    ctx.restore();
  });

  // One wash over the whole poster, so the panels share a single mood.
  const coverGrad = ctx.createLinearGradient(0, 0, 0, H);
  coverGrad.addColorStop(0, grade.coverWash[0]);
  coverGrad.addColorStop(1, grade.coverWash[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = coverGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Title block on top.
  drawTitleBlock(ctx, state, layout.titleZone, W, H);

  if (state.grain) {
    const tile = getGrainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state.vignette) {
    const v = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(5,2,12,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Renders a state to a fresh canvas at one of the export sizes. */
export function renderExport(state, sizeId, resolvePhoto) {
  const size = SIZES[sizeId];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, resolvePhoto);
  return canvas;
}
