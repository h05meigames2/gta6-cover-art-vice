// Fixed scenes for screenshots: ?shot=editor shows the studio with a photo loaded;
// ?shot=cover shows a cover the app itself exported, at the requested post size.
// `layout`, `grade`, `size`, `photo` and `caption` pick the scene. window.__shotReady
// is set once the scene has painted, so a headless browser can wait on it.
import { SIZES, photoPanels } from './state.js';
import { renderExport } from './engine.js';

function paintReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/**
 * Runs a shot scene on an already-booted editor.
 * `load` fills the editor's panels from the named sample photos.
 */
export async function runShot(shot, query, editor) {
  const caption = query.get('caption') ?? 'NEON COAST';
  const layout = query.get('layout') ?? 'hero3';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? 'square';
  const photos = (query.get('photos') ?? 'boulevard,neon,rooftop,pier').split(',');

  await editor.loadAllSamples();
  editor.state.title = caption;
  editor.state.subtitle = query.get('subtitle') ?? 'chasing the last light';
  editor.state.tag = query.get('tag') ?? 'EST. 2026 · OCEAN DRIVE';
  editor.state.layout = layout;
  editor.state.grade = grade;
  editor.state.size = SIZES[size] ? size : 'square';
  editor.state.stars = Number(query.get('stars') ?? 4);
  editor.state.halftone = query.get('halftone') === '1';
  while (editor.state.panels.length < photoPanels(layout).length) {
    editor.state.panels.push({ ref: null, zoom: 1, ox: 0, oy: 0 });
  }
  photos.forEach((ref, i) => {
    if (editor.state.panels[i]) editor.state.panels[i].ref = ref;
  });
  editor.selected = 0;

  if (shot === 'cover') {
    // The exported PNG itself, drawn by the app, shown full-screen.
    const canvas = renderExport(editor.state, editor.state.size, (ref) => editor.resolvePhoto(ref));
    const img = document.getElementById('shotImg');
    img.src = canvas.toDataURL('image/png');
    img.hidden = false;
    document.body.classList.add('shot-cover');
    img.onload = paintReady;
    setTimeout(paintReady, 1200);
    return;
  }

  // Editor scene: the studio with photos loaded.
  editor.redraw();
  paintReady();
}
