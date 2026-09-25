// =====================================================================
// LABELS — HTML text placed over the 3D scene: athlete names and axis ticks.
// =====================================================================
import * as THREE from 'three';
import { settings } from './settings.js';
import { state, METRICS } from './data.js';
import { camera } from './scene.js';
import { ranges, posOf, visCur, visTarget } from './galaxy.js';

const labelsEl = document.getElementById('labels');
let starLabels = []; // { i, el }
let axisLabels = []; // { pos, el }
const tmp = new THREE.Vector3(), pv = new THREE.Vector3();

// Choose which stars get a name: the brightest overall, the best per sport,
// plus anything selected or in the comparison.
export function pickLabelSet() {
  labelsEl.querySelectorAll('.star-label').forEach(e => e.remove());
  starLabels = [];
  const set = new Set();
  if (state.showLabels) {
    const vis = state.athletes.map((a, i) => i).filter(i => visTarget[i] > 0).sort((a, b) => state.athletes[b].raw - state.athletes[a].raw);
    vis.slice(0, settings.labels.count).forEach(i => set.add(i));
    for (const s of state.activeSports) {
      const best = vis.find(i => state.athletes[i].s === s);
      if (best != null) set.add(best);
    }
  }
  state.pinned.forEach(i => set.add(i));
  if (state.selected >= 0) set.add(state.selected);
  for (const i of set) {
    const el = document.createElement('div');
    el.className = 'star-label' + (i === state.selected ? ' sel' : '');
    el.textContent = state.athletes[i].n;
    labelsEl.appendChild(el);
    starLabels.push({ i, el });
  }
}

function tickText(k, t) {
  const r = ranges[k];
  return Math.round(r.lo + (r.hi - r.lo) * t).toString();
}
export function buildAxisLabels() {
  axisLabels.forEach(l => l.el.remove()); axisLabels = [];
  const R = settings.scene.cubeSize, ax = state.axes;
  const add = (pos, text, cls = '') => {
    const el = document.createElement('div'); el.className = 'axis-label ' + cls; el.textContent = text;
    labelsEl.appendChild(el); axisLabels.push({ pos, el });
  };
  for (let s = 0; s <= 4; s++) {
    const t = s / 4, p = -R + t * 2 * R;
    add(new THREE.Vector3(p, -R - 3, R + 2), tickText(ax[0], t));
    if (s > 0) add(new THREE.Vector3(-R - 4, p, R + 1), tickText(ax[1], t));
    if (s > 0) add(new THREE.Vector3(-R - 3, -R - 3, -p), tickText(ax[2], t));
  }
  add(new THREE.Vector3(R + 16, -R, R), METRICS[ax[0]].short + ' →', 'title x');
  add(new THREE.Vector3(-R, R + 6, R), '↑ ' + METRICS[ax[1]].short, 'title y');
  add(new THREE.Vector3(-R, -R, -R - 7), METRICS[ax[2]].short + ' ↗', 'title z');
}

function toScreen(v) {
  tmp.copy(v).project(camera);
  return { x: (tmp.x * .5 + .5) * innerWidth, y: (-tmp.y * .5 + .5) * innerHeight, behind: tmp.z > 1 };
}

// Every frame: move labels with their stars and hide ones that overlap.
export function updateLabels() {
  const boxes = [];
  const prio = ({ i }) => (i === state.selected ? 1e6 : state.pinned.includes(i) ? 1e5 : 0) + state.athletes[i].G;
  starLabels.sort((a, b) => prio(b) - prio(a));
  const fs = settings.labels.fontSize;
  for (const { i, el } of starLabels) {
    posOf(i, pv);
    const dist = camera.position.distanceTo(pv);
    const p = toScreen(pv);
    const special = i === state.selected || state.pinned.includes(i);
    if (p.behind || (visCur[i] < 0.05 && !special) || dist < 3) { el.style.display = 'none'; continue; }
    const w = state.athletes[i].n.length * fs * (i === state.selected ? 0.69 : 0.57) + 4, h = fs + 3;
    const bx = p.x + 9, by = p.y - 7;
    if (boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + h > b[1])) { el.style.display = 'none'; continue; }
    boxes.push([bx, by, w, h]);
    el.style.display = 'block';
    el.style.opacity = i === state.selected ? 1 : Math.max(0.25, Math.min(1, 160 / dist));
    el.style.transform = `translate(${bx}px, ${by}px)`;
  }
  for (const { pos, el } of axisLabels) {
    const p = toScreen(pos);
    if (p.behind) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`;
  }
}
