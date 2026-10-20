import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function skyTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const x = cv.getContext('2d')!;
  const grd = x.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#070c1e');
  grd.addColorStop(0.55, '#13203c');
  grd.addColorStop(1, '#3a2f4d');
  x.fillStyle = grd;
  x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  onFrame(cb: () => void): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneCtx {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#13203c', 520, 1800);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4000);
  camera.position.set(0, 180, 250);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.05;

  // Sky/ground ambient + warm key + cool fill = softer, less flat than a
  // single lamp. Concert accent lights live on the stage (see buildStage).
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#1c2233', 0.95));
  const key = new THREE.DirectionalLight('#fff4e2', 1.4);
  key.position.set(120, 210, 90);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#93b6ff', 0.55);
  fill.position.set(-150, 90, -130);
  scene.add(fill);

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  const cbs: (() => void)[] = [];
  renderer.setAnimationLoop(() => {
    controls.update();
    for (const c of cbs) c();
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, controls, onFrame: (cb) => cbs.push(cb) };
}
