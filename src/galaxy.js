// =====================================================================
// GALAXY — turns athletes into stars: positions, colors, sizes,
// visibility, sport nebulae, and smooth transitions between layouts.
// =====================================================================
import * as THREE from 'three';
import { settings } from './settings.js';
import { state, METRICS, inView } from './data.js';
import { scene, starMat, nebulaTexture, camera } from './scene.js';

let geo, points;
export let N = 0;
export let cur, from, to;        // Float32Array positions: current, animation start, animation end
export let visCur, visTarget;    // brightness now / brightness we are fading toward
let tAnim = 1;
const nebulae = {};
export const ranges = {};

// ---------- axis ranges ----------
// Computed over the athletes in view (curated, or everyone), so the cube
// always fits what you can see. Low end = 1st percentile to ignore outliers.
export function computeRanges() {
  const list = state.athletes.filter(inView);
  for (const k in METRICS) {
    const vals = list.map(METRICS[k].get).filter(v => v != null).sort((a, b) => a - b);
    let lo = vals[Math.floor(vals.length * 0.01)], hi = vals[vals.length - 1];
    if (METRICS[k].year) { lo = Math.floor(lo / 10) * 10; hi = Math.ceil(hi / 10) * 10; }
    else if (METRICS[k].integer) { lo = 0; }
    else if (METRICS[k].centered) {
      // symmetric around 0 so "as expected" sits in the middle of the cube
      const abs = vals.map(Math.abs).sort((a, b) => a - b);
      const m = abs[Math.floor(abs.length * 0.98)] || 1;
      const step = [1, 2, 2.5, 4, 5, 10, 15, 20, 25, 50].find(x => x * 2 >= m) || 50;
      lo = -2 * step; hi = 2 * step;
    }
    else {
      // scores: top at 100, four evenly spaced round ticks below it
      hi = Math.max(100, Math.ceil(hi));
      const stepSize = [10, 20, 25, 50, 75, 100].find(x => x * 4 >= (hi - lo) * 0.9) || 100;
      lo = hi - 4 * stepSize;
    }
    ranges[k] = { lo, hi, median: vals[vals.length >> 1] };
  }
}

function norm(k, a) {
  const R = settings.scene.cubeSize, r = ranges[k];
  let v = METRICS[k].get(a);
  if (v == null) v = r.median;
  v = Math.max(r.lo, Math.min(r.hi, v));
  return (v - r.lo) / (r.hi - r.lo || 1) * 2 * R - R;
}

// Where each star sits for the current axes.
function layout(arr) {
  const R = settings.scene.cubeSize, jit = settings.stars.jitter;
  for (let i = 0; i < N; i++) {
    const a = state.athletes[i];
    for (let d = 0; d < 3; d++) {
      const k = state.axes[d];
      let p = norm(k, a);
      // integer metrics (seasons) form shelves; spread them within one step
      const step = METRICS[k].integer ? (2 * R) / (ranges[k].hi - ranges[k].lo || 1) : 0;
      p += a._j[d] * (jit + step * 0.7);
      arr[i * 3 + d] = d === 2 ? -p : p;   // +Z recedes away from the viewer
    }
  }
}

// ---------- brightness & size ----------
// 0..1 brightness input: GOAT score mapped from scoreFloor..100
const t01 = a => Math.max(0, Math.min(1, (a.G - settings.stars.scoreFloor) / (100 - settings.stars.scoreFloor)));
export function baseAlpha(a) {
  const s = settings.stars;
  const v = s.minAlpha + (1 - s.minAlpha) * Math.pow(t01(a), s.alphaCurve);
  return a.cur ? v : v * s.everyoneDim;
}
export function refreshAppearance() {
  const s = settings.stars, c = new THREE.Color();
  const col = geo.attributes.aColor.array, size = geo.attributes.aSize.array;
  state.athletes.forEach((a, i) => {
    c.set(settings.colors.sports[a.s] || '#ffffff'); col.set([c.r, c.g, c.b], i * 3);
    size[i] = s.minSize + Math.pow(t01(a), s.sizeCurve) * (s.maxSize - s.minSize);
    a._px = size[i];
  });
  geo.attributes.aColor.needsUpdate = true;
  geo.attributes.aSize.needsUpdate = true;
  for (const sp in nebulae) nebulae[sp].material.color.set(settings.colors.sports[sp]);
  applyFilters();
}

export function build() {
  N = state.athletes.length;
  cur = new Float32Array(N * 3); from = new Float32Array(N * 3); to = new Float32Array(N * 3);
  visCur = new Float32Array(N); visTarget = new Float32Array(N);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
  geo.setAttribute('aVis', new THREE.BufferAttribute(visCur, 1));
  geo.setAttribute('aHi', new THREE.BufferAttribute(new Float32Array(N), 1));
  points = new THREE.Points(geo, starMat);
  points.frustumCulled = false;
  scene.add(points);
  for (const s in settings.colors.sports) {
    const m = new THREE.SpriteMaterial({ map: nebulaTexture, color: settings.colors.sports[s], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    nebulae[s] = new THREE.Sprite(m); scene.add(nebulae[s]);
  }
  computeRanges();
  layout(cur); from.set(cur); to.set(cur);
  refreshAppearance();
  visCur.set(visTarget);
}

// Animate stars to a new layout (new axes, new ranges, or new GOAT scores).
export function relayout() {
  computeRanges();
  from.set(cur); layout(to); tAnim = 0;
  placeNebulae(to);
}

// Which stars are visible right now.
export function applyFilters() {
  let count = 0;
  state.athletes.forEach((a, i) => {
    const on = inView(a) && state.activeSports.has(a.s) && (state.minGoat <= 0 || a.G >= state.minGoat);
    visTarget[i] = on ? baseAlpha(a) : 0;
    if (on) count++;
  });
  placeNebulae(tAnim < 1 ? to : cur);
  return count;
}

function placeNebulae(arr) {
  for (const s in nebulae) {
    let x = 0, y = 0, z = 0, n = 0, spread = 0;
    const idx = [];
    state.athletes.forEach((a, i) => { if (a.s === s && visTarget[i] > 0 && a.cur) { idx.push(i); x += arr[i*3]; y += arr[i*3+1]; z += arr[i*3+2]; n++; } });
    const sp = nebulae[s];
    if (!n) { sp.visible = false; continue; }
    x /= n; y /= n; z /= n;
    for (const i of idx) spread += Math.hypot(arr[i*3]-x, arr[i*3+1]-y, arr[i*3+2]-z);
    spread /= n;
    sp.visible = true; sp.position.set(x, y, z);
    const sc = Math.max(14, spread * 2.4); sp.scale.set(sc, sc, 1);
    sp.material.opacity = settings.scene.nebulaOpacity * (0.5 + Math.min(1, Math.sqrt(n) / 10) * 0.5);
  }
}

export function setHi(i, v) {
  if (i < 0) return;
  geo.attributes.aHi.array[i] = v; geo.attributes.aHi.needsUpdate = true;
}

export const posOf = (i, out = new THREE.Vector3()) => out.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
export const targetOf = (i, out = new THREE.Vector3()) => out.set(to[i * 3], to[i * 3 + 1], to[i * 3 + 2]);
export const isAnimating = () => tAnim < 1;

const ease = t => 1 - Math.pow(1 - t, 3);
// Called every frame from main.js
export function step(dt) {
  if (tAnim < 1) {
    tAnim = Math.min(1, tAnim + dt / settings.motion.axisTransition);
    const k = ease(tAnim);
    for (let j = 0; j < N * 3; j++) cur[j] = from[j] + (to[j] - from[j]) * k;
    geo.attributes.position.needsUpdate = true;
  }
  let dirty = false;
  const f = Math.min(1, dt * settings.motion.fadeSpeed);
  for (let i = 0; i < N; i++) {
    const d = visTarget[i] - visCur[i];
    if (Math.abs(d) > 0.002) { visCur[i] += d * f; dirty = true; }
  }
  if (dirty) geo.attributes.aVis.needsUpdate = true;
}

// Screen-space picking: the star closest to the mouse (nearer stars win ties).
export function pick(mx, my) {
  let best = -1, bestD = 14 * 14, bestZ = Infinity;
  const e = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
  for (let i = 0; i < N; i++) {
    if (visTarget[i] <= 0) continue;
    const x = cur[i*3], y = cur[i*3+1], z = cur[i*3+2];
    const w = e[3]*x + e[7]*y + e[11]*z + e[15];
    if (w <= 0.5) continue;
    const sx = ((e[0]*x + e[4]*y + e[8]*z + e[12]) / w * .5 + .5) * innerWidth;
    const sy = (-(e[1]*x + e[5]*y + e[9]*z + e[13]) / w * .5 + .5) * innerHeight;
    const d = (sx - mx) ** 2 + (sy - my) ** 2;
    const rad = Math.max(8, state.athletes[i]._px || 0);
    if (d < Math.max(bestD, rad * rad) && (d < bestD - 4 || w < bestZ)) { best = i; bestD = d; bestZ = w; }
  }
  return best;
}
