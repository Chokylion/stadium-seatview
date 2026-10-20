import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Store } from './state';
import { getLang } from './i18n';

type Preset = { pos: [number, number, number]; target: [number, number, number] };

let flying = false;

// Eased camera tween to a position/target. Reused by the cube and Home button.
export function flyTo(camera: THREE.PerspectiveCamera, controls: OrbitControls, p: Preset, ms = 750) {
  const fromPos = camera.position.clone();
  const fromTgt = controls.target.clone();
  const toPos = new THREE.Vector3(...p.pos);
  const toTgt = new THREE.Vector3(...p.target);
  const t0 = performance.now();
  const damp = controls.enableDamping;
  controls.enableDamping = false; // ponytail: no damping mid-flight so the tween lands cleanly
  flying = true;
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
    camera.position.lerpVectors(fromPos, toPos, e);
    controls.target.lerpVectors(fromTgt, toTgt, e);
    controls.update();
    if (k < 1) requestAnimationFrame(tick);
    else {
      controls.enableDamping = damp;
      flying = false;
    }
  };
  requestAnimationFrame(tick);
}

function faceTex(label: string): THREE.CanvasTexture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#eef1f7';
  x.fillRect(0, 0, s, s);
  x.strokeStyle = '#c3c9d6';
  x.lineWidth = 6;
  x.strokeRect(3, 3, s - 6, s - 6);
  x.fillStyle = '#26304a';
  x.font = 'bold 21px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(label, s / 2, s / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A Fusion360-style navigation cube. It mirrors the main camera orientation
// (rotates as you orbit), you can drag it to orbit, and clicking any
// face / edge / corner snaps the camera to look from that direction.
export function mountViewCube(
  root: HTMLElement,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  store: Store,
  onFrame: (cb: () => void) => void,
) {
  const size = 112;
  const wrap = document.createElement('div');
  wrap.id = 'viewcube';
  wrap.style.cssText =
    `position:absolute;right:14px;top:54px;width:${size}px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none`;

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    `width:${size}px;height:${size}px;pointer-events:auto;cursor:grab;touch-action:none;filter:drop-shadow(0 4px 10px #0008)`;
  wrap.appendChild(canvas);

  const home = document.createElement('button');
  home.style.cssText =
    'pointer-events:auto;border:1px solid #ffffff33;background:#0b1020cc;color:#fff;border-radius:9px;padding:5px 14px;font-size:12px;font-weight:600;backdrop-filter:blur(6px);cursor:pointer';
  wrap.appendChild(home);
  root.appendChild(wrap);

  // Gizmo scene (its own tiny renderer / transparent canvas).
  const gr = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  gr.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gr.setSize(size, size, false);
  const gscene = new THREE.Scene();
  const gcam = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.1, 100);

  // material order: +X, -X, +Y, -Y, +Z, -Z
  const labels = ['EAST', 'WEST', 'TOP', 'BOTTOM', 'NORTH', 'STAGE'];
  const mats = labels.map((l) => new THREE.MeshBasicMaterial({ map: faceTex(l) }));
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  gscene.add(cube);
  cube.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: 0x2b3350 }),
    ),
  );

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;

  function pick(ev: PointerEvent): THREE.Intersection | null {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, gcam);
    return ray.intersectObject(cube, false)[0] ?? null;
  }

  function setHover(i: number) {
    if (hovered === i) return;
    if (hovered >= 0) mats[hovered].color.set('#ffffff');
    if (i >= 0) mats[i].color.set('#9cc2ff');
    hovered = i;
  }

  function orbitMain(dx: number, dy: number) {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta -= dx * 0.01;
    sph.phi = THREE.MathUtils.clamp(sph.phi - dy * 0.01, 0.001, controls.maxPolarAngle - 0.001);
    off.setFromSpherical(sph);
    camera.position.copy(controls.target).add(off);
    controls.update();
  }

  // Snap: threshold the hit point per axis -> face (1 axis), edge (2) or
  // corner (3), exactly like a CAD cube. Clamp polar so top can't gimbal and
  // bottom can't drop under the pitch.
  function snapTo(point: THREE.Vector3) {
    const t = 0.3;
    const dir = new THREE.Vector3(
      Math.abs(point.x) > t ? Math.sign(point.x) : 0,
      Math.abs(point.y) > t ? Math.sign(point.y) : 0,
      Math.abs(point.z) > t ? Math.sign(point.z) : 0,
    );
    if (dir.lengthSq() === 0) return;
    dir.normalize();
    const sph = new THREE.Spherical().setFromVector3(dir);
    sph.phi = THREE.MathUtils.clamp(sph.phi, 0.001, controls.maxPolarAngle - 0.001);
    dir.setFromSpherical(sph).normalize();
    const dist = camera.position.distanceTo(controls.target);
    const c = controls.target;
    flyTo(camera, controls, {
      pos: [c.x + dir.x * dist, c.y + dir.y * dist, c.z + dir.z * dist],
      target: [c.x, c.y, c.z],
    });
  }

  let down: { x: number; y: number } | null = null;
  let moved = 0;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    down = { x: e.clientX, y: e.clientY };
    moved = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      orbitMain(e.clientX - down.x, e.clientY - down.y);
      moved += Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      down = { x: e.clientX, y: e.clientY };
    } else {
      const hit = pick(e);
      setHover(hit ? (hit.face!.materialIndex as number) : -1);
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = moved > 6;
    const hit = pick(e);
    down = null;
    canvas.style.cursor = 'grab';
    if (!wasDrag && hit && !flying) snapTo(hit.point);
  });
  canvas.addEventListener('pointerleave', () => setHover(-1));

  const dir = new THREE.Vector3();
  onFrame(() => {
    if (wrap.style.display === 'none') return;
    dir.copy(camera.position).sub(controls.target).normalize();
    gcam.position.copy(dir).multiplyScalar(4);
    gcam.up.copy(camera.up);
    gcam.lookAt(0, 0, 0);
    gr.render(gscene, gcam);
  });

  home.onclick = () => flyTo(camera, controls, { pos: [0, 190, 275], target: [0, 10, 0] });

  function render() {
    wrap.style.display = store.get().view === 'pov' ? 'none' : 'flex';
    home.textContent = getLang() === 'th' ? '⌂ มุมสูง' : '⌂ Home';
  }
  store.subscribe(render);
  render();
  return { render };
}
