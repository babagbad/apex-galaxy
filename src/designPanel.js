// =====================================================================
// DESIGN PANEL — live sliders for everything in settings.js.
// Open with the D key or by adding ?design to the URL.
// "Copy settings" puts the current values on your clipboard so you can
// paste them into src/settings.js and make them permanent.
// =====================================================================
import GUI from 'lil-gui';
import { settings } from './settings.js';
import { applySceneSettings, buildCube, buildBackground } from './scene.js';
import { refreshAppearance, relayout } from './galaxy.js';
import { pickLabelSet, buildAxisLabels } from './labels.js';
import { refilter } from './ui.js';

let gui = null;

function create() {
  gui = new GUI({ title: 'Design settings' });
  gui.domElement.classList.add('design-gui');
  const scene = () => applySceneSettings();
  const stars = () => { refreshAppearance(); refilter(); };

  const c = gui.addFolder('Colors');
  c.addColor(settings.colors, 'background').onChange(scene);
  c.addColor(settings.colors, 'gold').onChange(scene);
  const sc = c.addFolder('Sports');
  for (const k in settings.colors.sports) sc.addColor(settings.colors.sports, k).onChange(stars);
  sc.close();

  const s = gui.addFolder('Stars');
  s.add(settings.stars, 'scoreFloor', 0, 80, 1).onChange(stars);
  s.add(settings.stars, 'minSize', 0.1, 3, 0.05).onChange(stars);
  s.add(settings.stars, 'maxSize', 1, 12, 0.1).onChange(stars);
  s.add(settings.stars, 'sizeCurve', 0.5, 8, 0.1).onChange(stars);
  s.add(settings.stars, 'minAlpha', 0, 1, 0.01).onChange(stars);
  s.add(settings.stars, 'alphaCurve', 0.5, 6, 0.1).onChange(stars);
  s.add(settings.stars, 'glow', 0, 1.5, 0.01).onChange(scene);
  s.add(settings.stars, 'coreWhite', 0, 1, 0.01).onChange(scene);
  s.add(settings.stars, 'everyoneDim', 0.05, 1, 0.01).onChange(stars);
  s.add(settings.stars, 'jitter', 0, 3, 0.05).onFinishChange(() => relayout());

  const sn = gui.addFolder('Scene');
  sn.add(settings.scene, 'fog', 0, 0.01, 0.0001).onChange(scene);
  sn.add(settings.scene, 'gridOpacity', 0, 0.5, 0.01).onChange(scene);
  sn.add(settings.scene, 'edgeOpacity', 0, 0.6, 0.01).onChange(scene);
  sn.add(settings.scene, 'nebulaOpacity', 0, 0.5, 0.01).onChange(() => refilter());
  sn.add(settings.scene, 'cubeSize', 20, 100, 1).onFinishChange(() => { buildCube(); relayout(); buildAxisLabels(); });
  sn.add(settings.scene, 'backgroundStars', 0, 8000, 100).onFinishChange(buildBackground);

  const cam = gui.addFolder('Camera & motion');
  cam.add(settings.camera, 'fov', 25, 90, 1).onChange(scene);
  cam.add(settings.camera, 'flyDistance', 5, 120, 1);
  cam.add(settings.camera, 'flyDuration', 0.2, 4, 0.1);
  cam.add(settings.camera, 'autoRotateSpeed', 0, 3, 0.05).onChange(scene);
  cam.add(settings.camera, 'sidePanelOffset', 0, 400, 5).onChange(scene);
  cam.add(settings.motion, 'axisTransition', 0.2, 4, 0.1);
  cam.add(settings.motion, 'fadeSpeed', 1, 20, 0.5);
  cam.close();

  const l = gui.addFolder('Labels');
  l.add(settings.labels, 'count', 0, 80, 1).onChange(pickLabelSet);
  l.add(settings.labels, 'fontSize', 8, 18, 1).onChange(scene);
  l.close();

  gui.add({
    copy: async () => {
      const text = 'export const settings = ' + JSON.stringify(settings, null, 2) + ';\n';
      try { await navigator.clipboard.writeText(text); flash('Copied. Paste over `settings` in src/settings.js'); }
      catch { console.log(text); flash('Clipboard blocked: settings printed to the browser console'); }
    },
  }, 'copy').name('Copy settings');
}

function flash(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function toggleDesignPanel() {
  if (!gui) { create(); return; }
  gui.domElement.style.display = gui.domElement.style.display === 'none' ? '' : 'none';
}

export function initDesignPanel() {
  if (new URLSearchParams(location.search).has('design')) create();
  addEventListener('keydown', e => {
    if ((e.key === 'd' || e.key === 'D') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) toggleDesignPanel();
  });
}
