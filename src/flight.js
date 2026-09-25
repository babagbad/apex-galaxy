// =====================================================================
// FLIGHT — smooth camera moves (fly to an athlete, fly home).
// =====================================================================
import * as THREE from 'three';
import { settings } from './settings.js';
import { camera, controls } from './scene.js';

let flight = null;
const ease = t => 1 - Math.pow(1 - t, 3);

export function flyTo(target, dist = settings.camera.flyDistance) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  flight = { t: 0, sT: controls.target.clone(), sP: camera.position.clone(), eT: target.clone(), eP: target.clone().add(dir.multiplyScalar(dist)) };
}
export function flyHome() {
  flight = { t: 0, sT: controls.target.clone(), sP: camera.position.clone(), eT: new THREE.Vector3(), eP: new THREE.Vector3().fromArray(settings.camera.home) };
}
export const isFlying = () => flight != null;

// Any mouse/touch on the canvas cancels the flight so the user stays in control.
controls.addEventListener('start', () => { flight = null; });

export function stepFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / settings.camera.flyDuration);
  const k = ease(flight.t);
  controls.target.lerpVectors(flight.sT, flight.eT, k);
  camera.position.lerpVectors(flight.sP, flight.eP, k);
  if (flight.t >= 1) flight = null;
}
