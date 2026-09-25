// =====================================================================
// MAIN — boots the app and runs the animation loop.
// Read ARCHITECTURE.md for a map of every file.
// =====================================================================
import './style.css';
import * as THREE from 'three';
import { settings } from './settings.js';
import { state, loadAthletes, shown } from './data.js';
import { renderer, scene, camera, controls, canvas, haloMat, haloGeo, dropGeo, drop, floorRing, constGeo, constLine,
  buildCube, buildBackground, applySceneSettings } from './scene.js';
import { build, step, pick, setHi, posOf, isAnimating, cur } from './galaxy.js';
import { updateLabels } from './labels.js';
import { select, togglePin } from './panel.js';
import { initUI, setAxes, refilter } from './ui.js';
import { flyHome, stepFlight, isFlying } from './flight.js';
import { initDesignPanel } from './designPanel.js';
import { SPORT_LABELS } from './settings.js';

// ---------- pointer: hover tooltip, click to select, shift-click to compare ----------
const tooltip = document.getElementById('tooltip');
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; canvas.classList.add('dragging'); });
addEventListener('pointerup', e => {
  canvas.classList.remove('dragging');
  if (!down || e.target !== canvas) { down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 5 || e.button !== 0) return;
  const i = pick(e.clientX, e.clientY);
  if (i < 0) return;
  if (e.shiftKey) togglePin(i); else select(i);
});
canvas.addEventListener('pointermove', e => {
  if (down) { tooltip.classList.remove('show'); return; }
  const i = pick(e.clientX, e.clientY);
  if (i !== state.hovered) {
    const h = state.hovered;
    if (h >= 0 && h !== state.selected) setHi(h, state.pinned.includes(h) ? .6 : 0);
    state.hovered = i;
    if (i >= 0 && i !== state.selected) setHi(i, .8);
  }
  canvas.classList.toggle('hovering', i >= 0);
  if (i < 0) { tooltip.classList.remove('show'); return; }
  const a = state.athletes[i];
  tooltip.innerHTML = `<b>${a.n}</b><span class="m">${SPORT_LABELS[a.s]} · ${a.y0}–${a.y1}${a.act ? ' · active' : ''}</span><br>` +
    `<span class="m">GOAT</span> <span class="mono">${shown(a.G).toFixed(1)}</span> <span class="m">· #${a.sr} in ${SPORT_LABELS[a.s]}</span>`;
  tooltip.style.left = e.clientX + 'px'; tooltip.style.top = e.clientY + 'px';
  tooltip.classList.add('show');
});
canvas.addEventListener('pointerleave', () => tooltip.classList.remove('show'));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.activeElement.tagName !== 'INPUT') { select(-1); flyHome(); }
});

// ---------- animation loop ----------
const clock = new THREE.Clock();
const p = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  haloMat.uniforms.uTime.value += dt;
  step(dt);
  if (isAnimating() && state.selected >= 0 && !isFlying()) controls.target.lerp(posOf(state.selected, p), 0.15);
  stepFlight(dt);
  controls.update();

  if (state.selected >= 0) {
    posOf(state.selected, p);
    const R = settings.scene.cubeSize;
    haloGeo.attributes.position.array.set([p.x, p.y, p.z]); haloGeo.attributes.position.needsUpdate = true;
    dropGeo.attributes.position.array.set([p.x, p.y, p.z, p.x, -R, p.z]); dropGeo.attributes.position.needsUpdate = true;
    drop.computeLineDistances();
    floorRing.position.set(p.x, -R + 0.05, p.z);
  }
  // comparison constellation
  if (state.pinned.length >= 2) {
    const arr = new Float32Array(state.pinned.length * 3);
    state.pinned.forEach((i, k) => arr.set([cur[i*3], cur[i*3+1], cur[i*3+2]], k * 3));
    constGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    constLine.visible = true;
  } else constLine.visible = false;

  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- boot ----------
applySceneSettings();
buildBackground();
buildCube();
loadAthletes().then(() => {
  build();
  initUI();
  setAxes(state.axes);
  refilter();
  initDesignPanel();
  document.getElementById('loader').classList.add('done');
  tick();
}).catch(err => {
  document.querySelector('#loader p').textContent = 'Could not load the galaxy data. Refresh to try again.';
  console.error(err);
});
