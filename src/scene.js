// =====================================================================
// SCENE — the three.js stage: renderer, camera, controls, the cube,
// background stars, and the shaders that draw each athlete as a star.
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { settings } from './settings.js';

const canvas = document.getElementById('scene');
export { canvas };

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, settings.scene.fog);

export const camera = new THREE.PerspectiveCamera(settings.camera.fov, innerWidth / innerHeight, 0.5, 3000);
camera.position.fromArray(settings.camera.home);

export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.1;
controls.minDistance = 4;
controls.maxDistance = 520;
controls.autoRotateSpeed = settings.camera.autoRotateSpeed;

// ---------- background stars (decoration, not data) ----------
let bgStars;
export function buildBackground() {
  if (bgStars) { scene.remove(bgStars); bgStars.geometry.dispose(); }
  const n = settings.scene.backgroundStars, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 700 + Math.random() * 900, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bgStars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x5b6480, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.6 }));
  scene.add(bgStars);
}

// ---------- the data cube ----------
let cube;
export const cubeMats = { edge: null, grid: [] };
export function buildCube() {
  if (cube) scene.remove(cube);
  const R = settings.scene.cubeSize;
  cube = new THREE.Group();
  cubeMats.grid = [];
  cubeMats.edge = new THREE.LineBasicMaterial({ color: 0x8ea0d0, transparent: true, opacity: settings.scene.edgeOpacity });
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * R, 2 * R, 2 * R)), cubeMats.edge));
  const mkGrid = () => {
    const g = new THREE.GridHelper(2 * R, 10, 0x8ea0d0, 0x8ea0d0);
    g.material.transparent = true; g.material.opacity = settings.scene.gridOpacity; cubeMats.grid.push(g.material);
    return g;
  };
  const floor = mkGrid(); floor.position.y = -R; cube.add(floor);
  const back = mkGrid(); back.rotation.x = Math.PI / 2; back.position.set(0, 0, -R); cube.add(back);
  const side = mkGrid(); side.rotation.z = Math.PI / 2; side.position.set(-R, 0, 0); cube.add(side);
  const axisLine = (a, b, c) => cube.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })));
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(R, -R, R), 0xff7a6b);   // X
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(-R, R, R), 0x6be3ff);   // Y
  axisLine(new THREE.Vector3(-R, -R, R), new THREE.Vector3(-R, -R, -R), 0xb99bff); // Z
  scene.add(cube);
}

// ---------- star shader: one glowing dot per athlete ----------
export const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {
    uPx: { value: renderer.getPixelRatio() }, uScale: { value: innerHeight / 2 },
    uGlow: { value: settings.stars.glow }, uCore: { value: settings.stars.coreWhite },
  },
  vertexShader: /* glsl */`
    attribute float aSize; attribute float aVis; attribute float aHi; attribute vec3 aColor;
    uniform float uPx; uniform float uScale;
    varying vec3 vColor; varying float vAlpha; varying float vHi;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float s = aSize * (1.0 + aHi*1.6);
      gl_PointSize = clamp(s * uScale / -mv.z, 1.5, 90.0) * uPx;
      gl_Position = projectionMatrix * mv;
      vColor = aColor; vAlpha = aVis * smoothstep(2.0, 10.0, -mv.z); vHi = aHi;
    }`,
  fragmentShader: /* glsl */`
    uniform float uGlow; uniform float uCore;
    varying vec3 vColor; varying float vAlpha; varying float vHi;
    void main(){
      float r = length(gl_PointCoord - 0.5) * 2.0;
      if (r > 1.0) discard;
      float core = smoothstep(0.35, 0.0, r);
      float halo = pow(1.0 - r, 2.6) * uGlow;
      vec3 col = mix(vColor, vec3(1.0), core*uCore + vHi*0.35);
      gl_FragColor = vec4(col, (core + halo) * vAlpha);
    }`,
});

// ---------- selection decorations ----------
export const haloMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(settings.colors.gold) } },
  vertexShader: `uniform float uPx; void main(){ gl_PointSize = 56.0*uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; void main(){ float r=length(gl_PointCoord-0.5)*2.0;
    float ring = smoothstep(0.08,0.0,abs(r-0.72-0.06*sin(uTime*3.0)));
    gl_FragColor=vec4(uColor, ring*0.9);} `,
});
export const haloGeo = new THREE.BufferGeometry();
haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
export const halo = new THREE.Points(haloGeo, haloMat);
halo.visible = false; halo.renderOrder = 10; scene.add(halo);

export const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
export const drop = new THREE.Line(dropGeo, new THREE.LineDashedMaterial({ color: settings.colors.gold, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.6 }));
drop.visible = false; scene.add(drop);
export const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 40),
  new THREE.MeshBasicMaterial({ color: settings.colors.gold, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
floorRing.rotation.x = -Math.PI / 2; floorRing.visible = false; scene.add(floorRing);

export const constGeo = new THREE.BufferGeometry();
export const constLine = new THREE.Line(constGeo, new THREE.LineBasicMaterial({ color: settings.colors.gold, transparent: true, opacity: 0.55 }));
constLine.visible = false; scene.add(constLine);

// soft radial texture for sport nebulae
export const nebulaTexture = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();

// Re-apply settings that don't need a rebuild (called by the design panel)
export function applySceneSettings() {
  renderer.setClearColor(settings.colors.background, 1);
  scene.fog.color.set(settings.colors.background);
  scene.fog.density = settings.scene.fog;
  starMat.uniforms.uGlow.value = settings.stars.glow;
  starMat.uniforms.uCore.value = settings.stars.coreWhite;
  if (cubeMats.edge) cubeMats.edge.opacity = settings.scene.edgeOpacity;
  cubeMats.grid.forEach(m => { m.opacity = settings.scene.gridOpacity; });
  controls.autoRotateSpeed = settings.camera.autoRotateSpeed;
  camera.fov = settings.camera.fov;
  applyViewOffset();
  document.documentElement.style.setProperty('--gold', settings.colors.gold);
  document.documentElement.style.setProperty('--bg', settings.colors.background);
  document.documentElement.style.setProperty('--label-size', settings.labels.fontSize + 'px');
}

export function applyViewOffset() {
  if (innerWidth > 820) camera.setViewOffset(innerWidth, innerHeight, -settings.camera.sidePanelOffset, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  applyViewOffset();
  renderer.setSize(innerWidth, innerHeight);
  starMat.uniforms.uScale.value = innerHeight / 2;
});
