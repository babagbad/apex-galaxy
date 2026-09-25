import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------- config ----------
const R = 50; // half-size of the data cube
const SPORTS = {
  MLB:    { label: 'MLB',            color: '#ff5a4e' },
  F1:     { label: 'Formula 1',      color: '#ff3da8' },
  TENNIS: { label: 'Tennis',         color: '#9be564' },
  NBA:    { label: 'NBA',            color: '#ff9f1c' },
  NHL:    { label: 'NHL',            color: '#5ac8fa' },
  NFL:    { label: 'NFL',            color: '#2ee6a8' },
  LALIGA: { label: 'La Liga',        color: '#ffe45e' },
  PL:     { label: 'Premier League', color: '#a77bff' },
};
const METRICS = {
  pk: { label: 'Peak ceiling',     short: 'Peak',      get: a => a.pk },
  su: { label: 'Sustained floor',  short: 'Sustained', get: a => a.su },
  cl: { label: 'Clutch elevation', short: 'Clutch',    get: a => a.cl },
  g:  { label: 'GOAT score',       short: 'GOAT',      get: a => a.g },
  py: { label: 'Era (peak year)',  short: 'Era',       get: a => a.py, year: true },
  y0: { label: 'Debut year',       short: 'Debut',     get: a => a.y0, year: true },
  nS: { label: 'Longevity (seasons)', short: 'Seasons', get: a => a.nS },
  by: { label: 'Birth year',       short: 'Born',      get: a => a.by, year: true },
};
const PRESETS = [
  { name: 'APEX core',   axes: ['pk', 'su', 'cl'] },
  { name: 'Time tunnel', axes: ['g', 'pk', 'py'] },
  { name: 'Iron men',    axes: ['nS', 'su', 'g'] },
  { name: 'Clutch gene', axes: ['g', 'cl', 'py'] },
];

// ---------- state ----------
let athletes = [];
let axes = ['pk', 'su', 'cl'];
const activeSports = new Set(Object.keys(SPORTS));
let minGoat = 0;
let hovered = -1, selected = -1;
const pinned = [];
let showLabels = true;

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x04060c, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04060c, 0.0022);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 3000);
const HOME_POS = new THREE.Vector3(128, 66, 146);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.1;
controls.minDistance = 4;
controls.maxDistance = 520;
controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0, 0);

// ---------- background stars ----------
{
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 700 + Math.random() * 900, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x5b6480, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.6 })));
}

// ---------- axis cube ----------
const cube = new THREE.Group();
scene.add(cube);
{
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * R, 2 * R, 2 * R)),
    new THREE.LineBasicMaterial({ color: 0x8ea0d0, transparent: true, opacity: 0.12 })
  );
  cube.add(edges);
  const grid = new THREE.GridHelper(2 * R, 10, 0x8ea0d0, 0x8ea0d0);
  grid.material.transparent = true; grid.material.opacity = 0.07; grid.position.y = -R;
  cube.add(grid);
  const back = grid.clone(); back.rotation.x = Math.PI / 2; back.position.set(0, 0, -R); cube.add(back);
  const side = grid.clone(); side.rotation.z = Math.PI / 2; side.position.set(-R, 0, 0); cube.add(side);
  const axisLine = (a, b, c) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    cube.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })));
  };
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(R, -R, R), 0xff7a6b);
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(-R, R, R), 0x6be3ff);
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(-R, -R, -R), 0xb99bff);
}

// ---------- star shader ----------
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uPx: { value: renderer.getPixelRatio() }, uScale: { value: innerHeight / 2 } },
  vertexShader: /* glsl */`
    attribute float aSize; attribute float aVis; attribute float aHi; attribute vec3 aColor;
    uniform float uPx; uniform float uScale;
    varying vec3 vColor; varying float vAlpha; varying float vHi;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float s = aSize * (1.0 + aHi*1.6);
      gl_PointSize = clamp(s * uScale / -mv.z, 1.5, 90.0) * uPx;
      gl_Position = projectionMatrix * mv;
      vColor = aColor; vAlpha = aVis; vHi = aHi;
      float d = -mv.z; vAlpha *= smoothstep(2.0, 10.0, d);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor; varying float vAlpha; varying float vHi;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float r = length(c)*2.0;
      if(r>1.0) discard;
      float core = smoothstep(0.35, 0.0, r);
      float halo = pow(1.0 - r, 2.6) * 0.55;
      vec3 col = mix(vColor, vec3(1.0), core*0.7 + vHi*0.35);
      gl_FragColor = vec4(col, (core + halo) * vAlpha);
    }`,
});

let geo, points, N = 0;
let cur, from, to; // Float32Arrays of positions
let visCur, visTarget;
let tAnim = 1;

// selection halo
const haloMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color('#f5c451') } },
  vertexShader: `uniform float uPx; void main(){ gl_PointSize = 56.0*uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; void main(){ float r=length(gl_PointCoord-0.5)*2.0;
    float ring = smoothstep(0.08,0.0,abs(r-0.72-0.06*sin(uTime*3.0)));
    gl_FragColor=vec4(uColor, ring*0.9);} `,
});
const haloGeo = new THREE.BufferGeometry();
haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
const halo = new THREE.Points(haloGeo, haloMat); halo.visible = false; halo.renderOrder = 10; scene.add(halo);

// drop line to floor
const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const drop = new THREE.Line(dropGeo, new THREE.LineDashedMaterial({ color: 0xf5c451, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.6 }));
drop.visible = false; scene.add(drop);
const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 40), new THREE.MeshBasicMaterial({ color: 0xf5c451, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
floorRing.rotation.x = -Math.PI / 2; floorRing.visible = false; scene.add(floorRing);

// constellation lines for comparison
const constGeo = new THREE.BufferGeometry();
const constLine = new THREE.Line(constGeo, new THREE.LineBasicMaterial({ color: 0xf5c451, transparent: true, opacity: 0.55 }));
constLine.visible = false; scene.add(constLine);

// sport nebulae
const nebulae = {};
function nebulaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const nebTex = nebulaTexture();

// ---------- data ----------
const ranges = {};
function computeRanges() {
  for (const k in METRICS) {
    const vals = athletes.map(METRICS[k].get).filter(v => v != null);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (METRICS[k].year) { lo = Math.floor(lo / 10) * 10; hi = Math.ceil(hi / 10) * 10; }
    else if (hi <= 100 && lo >= 0 && hi > 60) { lo = 0; hi = 100; }
    else { lo = Math.floor(lo / 5) * 5; hi = Math.ceil(hi / 5) * 5; }
    const sorted = [...vals].sort((a, b) => a - b);
    ranges[k] = { lo, hi, median: sorted[sorted.length >> 1] };
  }
}
const norm = (k, a) => {
  const v = METRICS[k].get(a); const r = ranges[k];
  return ((v == null ? r.median : v) - r.lo) / (r.hi - r.lo || 1) * 2 * R - R;
};

function layout(arr) {
  for (let i = 0; i < N; i++) {
    const a = athletes[i];
    arr[i * 3] = norm(axes[0], a);
    arr[i * 3 + 1] = norm(axes[1], a);
    arr[i * 3 + 2] = -norm(axes[2], a); // +Z metric recedes away from viewer
    // tiny jitter so identical values don't stack
    arr[i * 3] += a._j[0]; arr[i * 3 + 1] += a._j[1]; arr[i * 3 + 2] += a._j[2];
  }
}

function build() {
  N = athletes.length;
  cur = new Float32Array(N * 3); from = new Float32Array(N * 3); to = new Float32Array(N * 3);
  const col = new Float32Array(N * 3), size = new Float32Array(N), hi = new Float32Array(N);
  visCur = new Float32Array(N); visTarget = new Float32Array(N);
  const c = new THREE.Color();
  athletes.forEach((a, i) => {
    a._j = [(Math.random() - .5) * .35, (Math.random() - .5) * .35, (Math.random() - .5) * .35];
    c.set(SPORTS[a.s]?.color || '#ffffff'); col.set([c.r, c.g, c.b], i * 3);
    const t = a.g / 100;
    size[i] = 0.45 + Math.pow(t, 4) * 5.2;
    visTarget[i] = visCur[i] = baseAlpha(a);
  });
  layout(cur); from.set(cur); to.set(cur);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aVis', new THREE.BufferAttribute(visCur, 1));
  geo.setAttribute('aHi', new THREE.BufferAttribute(hi, 1));
  points = new THREE.Points(geo, starMat);
  points.frustumCulled = false;
  scene.add(points);

  for (const s in SPORTS) {
    const m = new THREE.SpriteMaterial({ map: nebTex, color: SPORTS[s].color, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending });
    const sp = new THREE.Sprite(m); scene.add(sp); nebulae[s] = sp;
  }
  placeNebulae(cur);
}
const baseAlpha = a => 0.18 + 0.82 * Math.pow(a.g / 100, 2.2);

function placeNebulae(arr) {
  for (const s in SPORTS) {
    let x = 0, y = 0, z = 0, n = 0, spread = 0;
    athletes.forEach((a, i) => { if (a.s === s && visTarget[i] > 0) { x += arr[i*3]; y += arr[i*3+1]; z += arr[i*3+2]; n++; } });
    const sp = nebulae[s];
    if (!n) { sp.visible = false; continue; }
    x /= n; y /= n; z /= n;
    athletes.forEach((a, i) => { if (a.s === s && visTarget[i] > 0) spread += Math.hypot(arr[i*3]-x, arr[i*3+1]-y, arr[i*3+2]-z); });
    spread /= n;
    sp.visible = true; sp.position.set(x, y, z);
    const sc = Math.max(14, spread * 2.4); sp.scale.set(sc, sc, 1);
    sp.material.opacity = 0.06 + Math.min(0.12, Math.sqrt(n) / 400);
  }
}

function setAxes(next) {
  axes = next;
  from.set(cur); layout(to); tAnim = 0;
  placeNebulae(to);
  ['axX', 'axY', 'axZ'].forEach((id, i) => document.getElementById(id).value = axes[i]);
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', b.dataset.axes === axes.join(',')));
  buildAxisLabels();
}

function applyFilters() {
  let count = 0;
  athletes.forEach((a, i) => {
    const on = activeSports.has(a.s) && a.g >= minGoat;
    visTarget[i] = on ? baseAlpha(a) : 0;
    if (on) count++;
  });
  document.getElementById('visibleCount').textContent = count.toLocaleString();
  placeNebulae(tAnim < 1 ? to : cur);
  pickLabelSet();
}

// ---------- labels (HTML projected) ----------
const labelsEl = document.getElementById('labels');
let starLabels = []; // {i, el}
let axisLabels = []; // {pos: Vector3, el}
const tmpV = new THREE.Vector3();

function pickLabelSet() {
  labelsEl.querySelectorAll('.star-label').forEach(e => e.remove());
  starLabels = [];
  const set = new Set();
  if (showLabels) {
    const vis = athletes.map((a, i) => i).filter(i => visTarget[i] > 0);
    vis.sort((a, b) => athletes[b].g - athletes[a].g).slice(0, 22).forEach(i => set.add(i));
    // best in each visible sport
    for (const s of activeSports) {
      const best = vis.find(i => athletes[i].s === s);
      if (best != null) set.add(best);
    }
  }
  pinned.forEach(i => set.add(i));
  if (selected >= 0) set.add(selected);
  for (const i of set) {
    const el = document.createElement('div');
    el.className = 'star-label' + (i === selected ? ' sel' : '');
    el.textContent = athletes[i].n;
    labelsEl.appendChild(el); starLabels.push({ i, el });
  }
}

function fmtTick(k, t) {
  const r = ranges[k]; const v = r.lo + (r.hi - r.lo) * t;
  return METRICS[k].year || k === 'nS' ? Math.round(v).toString() : Math.round(v).toString();
}
function buildAxisLabels() {
  axisLabels.forEach(l => l.el.remove()); axisLabels = [];
  const add = (pos, text, cls) => { const el = document.createElement('div'); el.className = 'axis-label ' + (cls || ''); el.textContent = text; labelsEl.appendChild(el); axisLabels.push({ pos, el }); };
  for (let s = 0; s <= 4; s++) {
    const t = s / 4, p = -R + t * 2 * R;
    add(new THREE.Vector3(p, -R - 3, R + 2), fmtTick(axes[0], t));
    if (s > 0) add(new THREE.Vector3(-R - 4, p, R + 1), fmtTick(axes[1], t));
    if (s > 0) add(new THREE.Vector3(-R - 3, -R - 3, -p), fmtTick(axes[2], t));
  }
  add(new THREE.Vector3(R + 6, -R, R), METRICS[axes[0]].short + ' →', 'title x');
  add(new THREE.Vector3(-R, R + 6, R), '↑ ' + METRICS[axes[1]].short, 'title y');
  add(new THREE.Vector3(-R, -R, -R - 6), METRICS[axes[2]].short + ' ↗', 'title z');
}

function projectToScreen(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x * .5 + .5) * innerWidth, y: (-tmpV.y * .5 + .5) * innerHeight, behind: tmpV.z > 1 };
}
const posOf = (i, out = new THREE.Vector3()) => out.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
const pv = new THREE.Vector3();
function updateLabels() {
  const boxes = [];
  const prio = ({ i }) => (i === selected ? 1e6 : pinned.includes(i) ? 1e5 : 0) + athletes[i].g;
  starLabels.sort((a, b) => prio(b) - prio(a));
  for (const { i, el } of starLabels) {
    posOf(i, pv);
    const dist = camera.position.distanceTo(pv);
    const p = projectToScreen(pv);
    const vis = visCur[i] > 0.05 || i === selected || pinned.includes(i);
    if (p.behind || !vis || dist < 3) { el.style.display = 'none'; continue; }
    const w = athletes[i].n.length * (i === selected ? 7.6 : 6.3) + 4, h = 14;
    const bx = p.x + 9, by = p.y - 7;
    if (boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + h > b[1])) { el.style.display = 'none'; continue; }
    boxes.push([bx, by, w, h]);
    el.style.display = 'block';
    const op = i === selected ? 1 : Math.max(0.25, Math.min(1, 160 / dist));
    el.style.opacity = op;
    el.style.transform = `translate(${p.x + 9}px, ${p.y - 7}px)`;
  }
  for (const { pos, el } of axisLabels) {
    const p = projectToScreen(pos);
    if (p.behind) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`;
  }
}

// ---------- picking (screen space nearest) ----------
function pick(mx, my) {
  let best = -1, bestD = 14 * 14, bestZ = Infinity;
  const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = m.elements;
  for (let i = 0; i < N; i++) {
    if (visTarget[i] <= 0) continue;
    const x = cur[i*3], y = cur[i*3+1], z = cur[i*3+2];
    const w = e[3]*x + e[7]*y + e[11]*z + e[15];
    if (w <= 0.5) continue;
    const sx = ((e[0]*x + e[4]*y + e[8]*z + e[12]) / w * .5 + .5) * innerWidth;
    const sy = (-(e[1]*x + e[5]*y + e[9]*z + e[13]) / w * .5 + .5) * innerHeight;
    const d = (sx - mx) ** 2 + (sy - my) ** 2;
    const rad = Math.max(8, athletes[i]._px || 0);
    if (d < Math.max(bestD, rad * rad) && (d < bestD - 4 || w < bestZ)) { best = i; bestD = d; bestZ = w; }
  }
  return best;
}

function setHi(i, v) { if (i >= 0) { geo.attributes.aHi.array[i] = v; geo.attributes.aHi.needsUpdate = true; } }

// ---------- camera flight ----------
let flight = null;
function flyTo(targetV, dist = 26) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const endTarget = targetV.clone();
  const endPos = targetV.clone().add(dir.multiplyScalar(dist));
  flight = { t: 0, sT: controls.target.clone(), sP: camera.position.clone(), eT: endTarget, eP: endPos };
}
function flyHome() {
  flight = { t: 0, sT: controls.target.clone(), sP: camera.position.clone(), eT: new THREE.Vector3(), eP: HOME_POS.clone() };
}
const ease = t => 1 - Math.pow(1 - t, 3);

// ---------- selection & panel ----------
const panel = document.getElementById('panel');
function select(i, fly = true) {
  if (selected >= 0 && selected !== hovered) setHi(selected, pinned.includes(selected) ? .6 : 0);
  selected = i;
  if (i < 0) { panel.hidden = true; halo.visible = drop.visible = floorRing.visible = false; pickLabelSet(); return; }
  setHi(i, 1);
  const a = athletes[i];
  fillPanel(a);
  panel.hidden = false;
  halo.visible = drop.visible = floorRing.visible = true;
  haloMat.uniforms.uColor.value.set(SPORTS[a.s].color).lerp(new THREE.Color('#ffffff'), .35);
  pickLabelSet();
  if (fly) flyTo(new THREE.Vector3(to[i*3], to[i*3+1], to[i*3+2]));
}

function fillPanel(a) {
  const sp = SPORTS[a.s];
  document.getElementById('pSport').innerHTML = `<span class="dot" style="background:${sp.color};color:${sp.color}"></span><span style="color:${sp.color}">${sp.label}</span>`;
  document.getElementById('pName').textContent = a.n;
  const meta = [a.pos, a.nat, a.by ? `born ${a.by}` : null, a.psn ? `peak ${a.psn}` : null].filter(Boolean);
  document.getElementById('pMeta').textContent = meta.join(' · ');
  document.getElementById('pGoat').textContent = a.g.toFixed(1);
  document.getElementById('pRing').style.strokeDashoffset = 326.7 * (1 - a.g / 100);
  document.getElementById('pGR').textContent = '#' + a.gr.toLocaleString();
  document.getElementById('pSR').textContent = '#' + a.sr.toLocaleString();
  document.getElementById('pSpan').textContent = a.y0 === a.y1 ? `${a.y0}` : `${a.y0}–${String(a.y1).slice(2)}`;
  const bars = [
    ['Peak ceiling', a.pk, 'var(--x)'], ['Sustained floor', a.su, 'var(--y)'], ['Clutch elevation', a.cl, 'var(--z)'],
  ];
  document.getElementById('pBars').innerHTML = bars.map(([l, v, c]) => `
    <div class="bar"><div class="bar-top"><span>${l}</span><span class="mono">${v.toFixed(1)}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${c}"></div></div></div>`).join('') +
    `<div class="bar"><div class="bar-top"><span>Seasons tracked</span><span class="mono">${a.nS}</span></div></div>`;
  // sparkline
  const svg = document.getElementById('pSpark');
  const c = a.c; const W = 300, H = 90;
  if (!c.length) { svg.innerHTML = ''; return; }
  const y0 = c[0][0], y1 = c[c.length - 1][0] || y0 + 1;
  const X = y => c.length === 1 ? W / 2 : (y - y0) / ((y1 - y0) || 1) * W;
  const Y = s => H - (s / 100) * H;
  let peak = c[0]; c.forEach(p => { if (p[1] > peak[1]) peak = p; });
  const d = c.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const area = d + `L${X(c[c.length-1][0])},${H}L${X(c[0][0])},${H}Z`;
  svg.innerHTML = `
    <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${sp.color}" stop-opacity=".35"/><stop offset="1" stop-color="${sp.color}" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${Y(50)}" y2="${Y(50)}" stroke="rgba(255,255,255,.08)" stroke-dasharray="3 4"/>
    <path d="${area}" fill="url(#sg)"/>
    <path d="${d}" fill="none" stroke="${sp.color}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${X(peak[0])}" cy="${Y(peak[1])}" r="3.5" fill="#f5c451"/>`;
  document.getElementById('pY0').textContent = y0;
  document.getElementById('pY1').textContent = y1;
  document.getElementById('pPeak').textContent = `peak ${peak[1].toFixed(0)} in ${peak[0]}`;
  document.getElementById('pinBtn').textContent = pinned.includes(athletes.indexOf(a)) ? 'Remove from comparison' : 'Add to comparison';
}

// ---------- compare ----------
function togglePin(i) {
  const k = pinned.indexOf(i);
  if (k >= 0) { pinned.splice(k, 1); if (i !== selected) setHi(i, 0); }
  else { if (pinned.length >= 5) { const old = pinned.shift(); if (old !== selected) setHi(old, 0); } pinned.push(i); if (i !== selected) setHi(i, .6); }
  renderCompare(); pickLabelSet();
  if (selected >= 0) fillPanel(athletes[selected]);
}
function renderCompare() {
  const box = document.getElementById('compare');
  box.hidden = pinned.length === 0;
  const best = k => Math.max(...pinned.map(i => athletes[i][k]));
  document.getElementById('compareList').innerHTML = pinned.map(i => {
    const a = athletes[i]; const col = SPORTS[a.s].color;
    const v = (k, l) => `<span>${l} <b class="${a[k] === best(k) && pinned.length > 1 ? 'best' : ''}">${a[k].toFixed(0)}</b></span>`;
    return `<div class="cmp" data-i="${i}"><div class="nm"><span class="dot" style="background:${col}"></span>${a.n}</div>
      <div class="vals">${v('g', 'GOAT')}${v('pk', 'Pk')}${v('su', 'Su')}${v('cl', 'Cl')}</div></div>`;
  }).join('');
  document.querySelectorAll('.cmp').forEach(el => el.onclick = () => select(+el.dataset.i));
}
function updateConstellation() {
  if (pinned.length < 2) { constLine.visible = false; return; }
  const arr = new Float32Array(pinned.length * 3);
  pinned.forEach((i, k) => arr.set([cur[i*3], cur[i*3+1], cur[i*3+2]], k * 3));
  constGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  constGeo.setDrawRange(0, pinned.length);
  constLine.visible = true;
}

// ---------- UI wiring ----------
function initUI() {
  ['axX', 'axY', 'axZ'].forEach((id, ai) => {
    const s = document.getElementById(id);
    s.innerHTML = Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');
    s.value = axes[ai];
    s.onchange = () => { const n = [...axes]; n[ai] = s.value; setAxes(n); };
  });
  document.getElementById('presets').innerHTML = PRESETS.map(p => `<button data-axes="${p.axes.join(',')}">${p.name}</button>`).join('');
  document.querySelectorAll('#presets button').forEach(b => b.onclick = () => setAxes(b.dataset.axes.split(',')));

  const counts = {}; athletes.forEach(a => counts[a.s] = (counts[a.s] || 0) + 1);
  const sEl = document.getElementById('sports');
  sEl.innerHTML = Object.entries(SPORTS).map(([k, s]) => `<button class="sport" data-s="${k}" aria-pressed="true"><span class="dot" style="background:${s.color};color:${s.color}"></span>${s.label}<span class="n">${counts[k] || 0}</span></button>`).join('');
  sEl.querySelectorAll('.sport').forEach(b => {
    b.onclick = (e) => {
      const s = b.dataset.s;
      if (e.altKey || e.metaKey) { activeSports.clear(); activeSports.add(s); }
      else if (activeSports.has(s)) activeSports.delete(s); else activeSports.add(s);
      sEl.querySelectorAll('.sport').forEach(x => { const on = activeSports.has(x.dataset.s); x.classList.toggle('off', !on); x.setAttribute('aria-pressed', on); });
      applyFilters();
    };
    b.ondblclick = () => { activeSports.clear(); activeSports.add(b.dataset.s); sEl.querySelectorAll('.sport').forEach(x => x.classList.toggle('off', x.dataset.s !== b.dataset.s)); applyFilters(); };
  });

  const mg = document.getElementById('minGoat');
  mg.oninput = () => { minGoat = +mg.value; document.getElementById('minGoatVal').textContent = minGoat; applyFilters(); };
  document.getElementById('toggleLabels').onchange = e => { showLabels = e.target.checked; pickLabelSet(); };
  document.getElementById('toggleSpin').onchange = e => { controls.autoRotate = e.target.checked; };
  document.getElementById('closePanel').onclick = () => select(-1);
  document.getElementById('pinBtn').onclick = () => selected >= 0 && togglePin(selected);
  document.getElementById('clearCompare').onclick = () => { [...pinned].forEach(i => togglePin(i)); };

  // search
  const input = document.getElementById('search'), list = document.getElementById('results');
  let matches = [], active = 0;
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  athletes.forEach(a => a._q = norm(a.n));
  const render = () => {
    list.innerHTML = matches.map((i, k) => { const a = athletes[i]; return `<li role="option" data-i="${i}" class="${k === active ? 'active' : ''}"><span class="dot" style="background:${SPORTS[a.s].color}"></span>${a.n}<span class="sub mono">${SPORTS[a.s].label} · ${a.g.toFixed(1)}</span></li>`; }).join('');
    list.classList.toggle('open', matches.length > 0);
    list.querySelectorAll('li').forEach(li => li.onmousedown = e => { e.preventDefault(); go(+li.dataset.i); });
  };
  const go = i => { list.classList.remove('open'); input.value = athletes[i].n; input.blur();
    if (!activeSports.has(athletes[i].s) || athletes[i].g < minGoat) { activeSports.add(athletes[i].s); minGoat = 0; mg.value = 0; document.getElementById('minGoatVal').textContent = 0; document.querySelector(`.sport[data-s="${athletes[i].s}"]`).classList.remove('off'); applyFilters(); }
    select(i); };
  input.oninput = () => {
    const q = norm(input.value.trim());
    matches = q.length < 2 ? [] : athletes.map((a, i) => i).filter(i => athletes[i]._q.includes(q)).sort((a, b) => athletes[b].g - athletes[a].g).slice(0, 8);
    active = 0; render();
  };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active] != null) go(matches[active]);
    else if (e.key === 'Escape') { list.classList.remove('open'); input.blur(); }
  };
  input.onblur = () => setTimeout(() => list.classList.remove('open'), 100);
}

// pointer interaction
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
  if (i !== hovered) {
    if (hovered >= 0 && hovered !== selected) setHi(hovered, pinned.includes(hovered) ? .6 : 0);
    hovered = i;
    if (i >= 0 && i !== selected) setHi(i, .8);
  }
  canvas.classList.toggle('hovering', i >= 0);
  if (i >= 0) {
    const a = athletes[i];
    tooltip.innerHTML = `<b>${a.n}</b><span class="m">${SPORTS[a.s].label}${a.psn ? ' · peak ' + a.psn : ''}</span><br><span class="m">GOAT</span> <span class="mono">${a.g.toFixed(1)}</span> <span class="m">· #${a.gr} overall</span>`;
    tooltip.style.left = e.clientX + 'px'; tooltip.style.top = e.clientY + 'px';
    tooltip.classList.add('show');
  } else tooltip.classList.remove('show');
});
canvas.addEventListener('pointerleave', () => tooltip.classList.remove('show'));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.activeElement.tagName !== 'INPUT') { select(-1); flyHome(); }
});
function applyViewOffset() {
  if (innerWidth > 820) camera.setViewOffset(innerWidth, innerHeight, -130, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
applyViewOffset();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; applyViewOffset();
  renderer.setSize(innerWidth, innerHeight); starMat.uniforms.uScale.value = innerHeight / 2;
});
// user input cancels camera flight
controls.addEventListener('start', () => { flight = null; });

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  haloMat.uniforms.uTime.value += dt;

  if (tAnim < 1) {
    tAnim = Math.min(1, tAnim + dt / 1.4);
    const k = ease(tAnim);
    for (let j = 0; j < N * 3; j++) cur[j] = from[j] + (to[j] - from[j]) * k;
    geo.attributes.position.needsUpdate = true;
    if (selected >= 0 && flight == null) controls.target.lerp(posOf(selected, new THREE.Vector3()), 0.15);
  }
  let visDirty = false;
  for (let i = 0; i < N; i++) {
    const d = visTarget[i] - visCur[i];
    if (Math.abs(d) > 0.002) { visCur[i] += d * Math.min(1, dt * 7); visDirty = true; }
  }
  if (visDirty) geo.attributes.aVis.needsUpdate = true;

  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 1.3);
    const k = ease(flight.t);
    controls.target.lerpVectors(flight.sT, flight.eT, k);
    camera.position.lerpVectors(flight.sP, flight.eP, k);
    if (flight.t >= 1) flight = null;
  }
  controls.update();

  if (selected >= 0) {
    const p = posOf(selected, new THREE.Vector3());
    haloGeo.attributes.position.array.set([p.x, p.y, p.z]); haloGeo.attributes.position.needsUpdate = true;
    dropGeo.attributes.position.array.set([p.x, p.y, p.z, p.x, -R, p.z]); dropGeo.attributes.position.needsUpdate = true;
    drop.computeLineDistances();
    floorRing.position.set(p.x, -R + 0.05, p.z);
  }
  updateConstellation();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- boot ----------
fetch('./athletes.json').then(r => r.json()).then(data => {
  athletes = data.sort((a, b) => a.gr - b.gr);
  computeRanges();
  build();
  initUI();
  setAxes(axes);
  tAnim = 1;
  applyFilters();
  document.getElementById('loader').classList.add('done');
  tick();
}).catch(err => {
  document.querySelector('#loader p').textContent = 'Could not load the galaxy data. Refresh to try again.';
  console.error(err);
});
