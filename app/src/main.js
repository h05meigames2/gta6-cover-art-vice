// Neon Coast Cover Studio — entry point. Boots the editor with the sample photos
// in place, waits for the display fonts, then either runs a ?shot= screenshot
// scene or hands the studio to the user.
import { CoverEditor } from './editor.js';
import { runShot } from './shots.js';

const editor = new CoverEditor();
window.__coverApp = editor;

async function boot() {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch { /* fonts fall back to system faces; the cover still renders */ }

  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, editor);
    return;
  }
  await editor.loadAllSamples();
  editor.redraw();
}

boot();
