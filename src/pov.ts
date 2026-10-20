import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Seat, Vec3 } from './types';

export interface PovController { exit(): void; }

export function enterPov(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  seat: Seat,
  stage: Vec3,
): PovController {
  const saved = { pos: camera.position.clone(), target: controls.target.clone() };

  const eye = new THREE.Vector3(seat.position.x, seat.position.y + seat.eyeHeight, seat.position.z);
  camera.position.copy(eye);

  // Look toward the stage; keep the orbit pivot just in front so dragging
  // rotates the view like turning your head.
  const dir = new THREE.Vector3(stage.x - eye.x, stage.y + 6 - eye.y, stage.z - eye.z).normalize();
  controls.target.copy(eye).addScaledVector(dir, 2);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = 1.9;
  controls.maxDistance = 2.1;
  controls.maxPolarAngle = Math.PI;
  controls.update();

  // Optional gyro (mobile). Progressive enhancement; ignored if unavailable.
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.alpha == null) return;
    const yaw = THREE.MathUtils.degToRad(e.alpha);
    const pitch = THREE.MathUtils.degToRad(e.beta - 90);
    const look = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    controls.target.copy(eye).add(look.multiplyScalar(2));
    controls.update();
  };
  window.addEventListener('deviceorientation', onOrient);

  return {
    exit() {
      window.removeEventListener('deviceorientation', onOrient);
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
      controls.maxPolarAngle = Math.PI / 2.05;
      camera.position.copy(saved.pos);
      controls.target.copy(saved.target);
      controls.update();
    },
  };
}
