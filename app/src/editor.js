// Neon Coast Cover Studio — the editor: photo registry, panel picking, drag-to-pan,
// wheel zoom, undo/redo, and PNG export. Wires the controls in index.html to the
// engine in engine.js. Nothing here touches the network; photos stay on the machine.
import { GRADES, LAYOUTS, SAMPLE_PHOTOS, SIZES, defaultState, deserializeState, photoPanels, serializeState } from './state.js';
import { drawCover, photoPanelRects, renderExport } from './engine.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const statusEl = $('status');

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export class CoverEditor {
  constructor() {
    this.state = defaultState();
    this.photos = new Map(); // ref -> HTMLImageElement
    this.uploadCount = 0;
    this.selected = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.drag = null;
    this.buildControls();
    this.bindStage();
    this.bindInputs();
  }

  resolvePhoto(ref) {
    return this.photos.get(ref) ?? null;
  }

  async loadSample(name) {
    if (!this.photos.has(name)) {
      this.photos.set(name, await loadImage(`samples/${name}.jpg`));
    }
    return this.photos.get(name);
  }

  async loadAllSamples() {
    await Promise.all(SAMPLE_PHOTOS.map((n) => this.loadSample(n)));
  }

  // -- rendering -------------------------------------------------------------
  redraw() {
    const size = SIZES[this.state.size];
    if (stage.width !== size.w || stage.height !== size.h) {
      stage.width = size.w;
      stage.height = size.h;
    }
    drawCover(stage, this.state, (ref) => this.resolvePhoto(ref));
    this.paintSelection();
    this.syncControls();
  }

  /** Outlines the selected panel on the preview canvas. */
  paintSelection() {
    const rects = photoPanelRects(this.state.layout, stage.width, stage.height);
    const rect = rects[this.selected];
    if (!rect) return;
    const ctx = stage.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = Math.max(4, stage.width * 0.006);
    ctx.setLineDash([Math.max(14, stage.width * 0.02), Math.max(10, stage.width * 0.012)]);
    if (rect.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.tilt * Math.PI) / 180);
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    } else {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  // -- history ---------------------------------------------------------------
  commit(label) {
    this.undoStack.push(serializeState(this.state));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
    if (label) this.note(label);
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(serializeState(this.state));
    this.state = deserializeState(this.undoStack.pop());
    this.clampSelection();
    this.redraw();
    this.note('Undone');
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(serializeState(this.state));
    this.state = deserializeState(this.redoStack.pop());
    this.clampSelection();
    this.redraw();
    this.note('Redone');
  }

  clampSelection() {
    const count = photoPanels(this.state.layout).length;
    if (this.selected >= count) this.selected = count - 1;
  }

  note(text) {
    statusEl.textContent = text;
  }

  // -- panels ------------------------------------------------------------------
  panelCount() {
    return photoPanels(this.state.layout).length;
  }

  setPanelPhoto(index, ref) {
    this.commit();
    this.state.panels[index] = { ref, zoom: 1, ox: 0, oy: 0 };
    this.selected = index;
    this.redraw();
    this.note(ref ? `Panel ${index + 1} filled` : `Panel ${index + 1} cleared`);
  }

  fillAllPanels(ref) {
    this.commit();
    for (let i = 0; i < this.panelCount(); i++) {
      this.state.panels[i] = { ref, zoom: 1, ox: 0, oy: 0 };
    }
    this.redraw();
    this.note('One photo across every panel');
  }

  async addUploads(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const ref = `up${++this.uploadCount}`;
      const url = URL.createObjectURL(file);
      try {
        this.photos.set(ref, await loadImage(url));
      } catch {
        URL.revokeObjectURL(url);
        continue;
      }
      // Put the new photo on the selected panel, else the first empty one.
      let target = this.selected;
      const empty = this.state.panels.findIndex((p, i) => i < this.panelCount() && !p.ref);
      if (empty !== -1 && !this.state.panels[this.selected]?.ref) target = empty;
      this.setPanelPhoto(target, ref);
      this.addUploadChip(ref, file.name);
    }
  }

  addUploadChip(ref, name) {
    const strip = $('uploadStrip');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip upload-chip';
    chip.textContent = name.length > 18 ? `${name.slice(0, 16)}…` : name;
    chip.title = `Use ${name}`;
    chip.addEventListener('click', () => this.setPanelPhoto(this.selected, ref));
    strip.appendChild(chip);
  }

  // -- controls --------------------------------------------------------------
  buildControls() {
    const layoutRow = $('layoutRow');
    Object.entries(LAYOUTS).forEach(([id, def]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.layout = id;
      b.innerHTML = `<span class="opt-name">${def.label}</span><span class="opt-hint">${def.hint}</span>`;
      b.addEventListener('click', () => {
        if (this.state.layout === id) return;
        this.commit();
        this.state.layout = id;
        // A layout with more photo panels grows empty slots; extras are kept.
        while (this.state.panels.length < this.panelCount()) {
          this.state.panels.push({ ref: null, zoom: 1, ox: 0, oy: 0 });
        }
        this.clampSelection();
        this.redraw();
        this.note(`${def.label} layout`);
      });
      layoutRow.appendChild(b);
    });

    const gradeRow = $('gradeRow');
    Object.entries(GRADES).forEach(([id, def]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt grade-opt';
      b.dataset.grade = id;
      b.innerHTML = `<span class="swatch" style="background:${def.swatch}"></span><span class="opt-name">${def.label}</span>`;
      b.addEventListener('click', () => {
        if (this.state.grade === id) return;
        this.commit();
        this.state.grade = id;
        this.redraw();
        this.note(`${def.label} grade`);
      });
      gradeRow.appendChild(b);
    });

    const sizeRow = $('sizeRow');
    Object.entries(SIZES).forEach(([id, def]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.size = id;
      b.innerHTML = `<span class="opt-name">${def.label}</span>`;
      b.addEventListener('click', () => {
        if (this.state.size === id) return;
        this.commit();
        this.state.size = id;
        this.redraw();
        this.note(def.label);
      });
      sizeRow.appendChild(b);
    });

    const sampleRow = $('sampleRow');
    SAMPLE_PHOTOS.forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip sample-chip';
      b.style.backgroundImage = `url(samples/${name}.jpg)`;
      b.title = `Fill the selected panel with the ${name} sample photo`;
      b.setAttribute('aria-label', `Sample photo ${name}`);
      b.addEventListener('click', async () => {
        await this.loadSample(name);
        this.setPanelPhoto(this.selected, name);
      });
      sampleRow.appendChild(b);
    });

    const starRow = $('starRow');
    for (let n = 0; n <= 5; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn';
      b.dataset.stars = n;
      b.textContent = n === 0 ? 'No stars' : '★'.repeat(n);
      b.addEventListener('click', () => {
        if (this.state.stars === n) return;
        this.commit();
        this.state.stars = n;
        this.redraw();
      });
      starRow.appendChild(b);
    }
  }

  syncControls() {
    document.querySelectorAll('[data-layout]').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === this.state.layout);
    });
    document.querySelectorAll('[data-grade]').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === this.state.grade);
    });
    document.querySelectorAll('[data-size]').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === this.state.size);
    });
    document.querySelectorAll('[data-stars]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.stars) === this.state.stars);
    });
    const panel = this.state.panels[this.selected];
    $('zoomRange').value = panel ? Math.round((panel.zoom || 1) * 100) : 100;
    $('zoomLabel').textContent = panel ? `${Math.round((panel.zoom || 1) * 100)}%` : '—';
    $('panelLabel').textContent = `Panel ${this.selected + 1} of ${this.panelCount()}`;
  }

  bindInputs() {
    $('fileInput').addEventListener('change', (e) => {
      this.addUploads([...e.target.files]);
      e.target.value = '';
    });
    $('fillAllBtn').addEventListener('click', async () => {
      const ref = this.state.panels[this.selected]?.ref;
      if (!ref) { this.note('Pick a photo for the selected panel first'); return; }
      this.fillAllPanels(ref);
    });
    $('clearBtn').addEventListener('click', () => this.setPanelPhoto(this.selected, null));
    $('zoomRange').addEventListener('input', (e) => {
      const panel = this.state.panels[this.selected];
      if (!panel?.ref) return;
      panel.zoom = Number(e.target.value) / 100;
      this.redraw();
    });
    $('zoomRange').addEventListener('change', () => this.commit());
    $('zoomOutBtn').addEventListener('click', () => this.bumpZoom(0.85));
    $('zoomInBtn').addEventListener('click', () => this.bumpZoom(1.18));
    $('resetPanBtn').addEventListener('click', () => {
      const panel = this.state.panels[this.selected];
      if (!panel) return;
      this.commit();
      panel.zoom = 1; panel.ox = 0; panel.oy = 0;
      this.redraw();
      this.note('Panel framing reset');
    });
    $('titleInput').addEventListener('input', (e) => { this.state.title = e.target.value; this.redraw(); });
    $('titleInput').addEventListener('change', () => this.commit());
    $('subtitleInput').addEventListener('input', (e) => { this.state.subtitle = e.target.value; this.redraw(); });
    $('subtitleInput').addEventListener('change', () => this.commit());
    $('tagInput').addEventListener('input', (e) => { this.state.tag = e.target.value; this.redraw(); });
    $('tagInput').addEventListener('change', () => this.commit());
    $('grainToggle').addEventListener('change', (e) => { this.commit(); this.state.grain = e.target.checked; this.redraw(); });
    $('vignetteToggle').addEventListener('change', (e) => { this.commit(); this.state.vignette = e.target.checked; this.redraw(); });
    $('halftoneToggle').addEventListener('change', (e) => { this.commit(); this.state.halftone = e.target.checked; this.redraw(); });
    $('undoBtn').addEventListener('click', () => this.undo());
    $('redoBtn').addEventListener('click', () => this.redo());
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
    });
    document.querySelectorAll('[data-export]').forEach((b) => {
      b.addEventListener('click', () => this.exportPng(b.dataset.export));
    });
  }

  bumpZoom(factor) {
    const panel = this.state.panels[this.selected];
    if (!panel?.ref) return;
    this.commit();
    panel.zoom = Math.min(4, Math.max(1, (panel.zoom || 1) * factor));
    this.redraw();
  }

  bindStage() {
    const toStagePoint = (e) => {
      const r = stage.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * stage.width,
        y: ((e.clientY - r.top) / r.height) * stage.height,
      };
    };
    const pickPanel = (pt) => {
      const rects = photoPanelRects(this.state.layout, stage.width, stage.height);
      for (let i = rects.length - 1; i >= 0; i--) {
        const r = rects[i];
        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return i;
      }
      return -1;
    };
    stage.addEventListener('pointerdown', (e) => {
      const pt = toStagePoint(e);
      const hit = pickPanel(pt);
      if (hit === -1) return;
      this.selected = hit;
      const panel = this.state.panels[hit];
      this.drag = { startX: pt.x, startY: pt.y, ox: panel?.ox || 0, oy: panel?.oy || 0, moved: false, ref: panel?.ref };
      stage.setPointerCapture(e.pointerId);
      this.redraw();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!this.drag || !this.drag.ref) return;
      const pt = toStagePoint(e);
      const rects = photoPanelRects(this.state.layout, stage.width, stage.height);
      const r = rects[this.selected];
      const dx = (pt.x - this.drag.startX) / r.w;
      const dy = (pt.y - this.drag.startY) / r.h;
      if (Math.abs(dx) + Math.abs(dy) > 0.002) this.drag.moved = true;
      const panel = this.state.panels[this.selected];
      panel.ox = Math.min(0.5, Math.max(-0.5, this.drag.ox + dx));
      panel.oy = Math.min(0.5, Math.max(-0.5, this.drag.oy + dy));
      this.redraw();
    });
    const endDrag = () => {
      if (this.drag?.moved) this.commit();
      this.drag = null;
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('wheel', (e) => {
      const panel = this.state.panels[this.selected];
      if (!panel?.ref) return;
      e.preventDefault();
      panel.zoom = Math.min(4, Math.max(1, (panel.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.93)));
      this.redraw();
    }, { passive: false });
  }

  // -- export ------------------------------------------------------------------
  downloadCanvas(canvas, filename) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        resolve();
      }, 'image/png');
    });
  }

  async exportPng(which) {
    const sizes = which === 'all' ? Object.keys(SIZES) : [which];
    for (const sizeId of sizes) {
      const canvas = renderExport(this.state, sizeId, (ref) => this.resolvePhoto(ref));
      await this.downloadCanvas(canvas, `neon-coast-${sizeId}-${SIZES[sizeId].w}x${SIZES[sizeId].h}.png`);
    }
    this.note(sizes.length > 1
      ? `Exported ${sizes.length} PNGs — check your downloads`
      : `Exported ${SIZES[which].label} PNG`);
  }
}
