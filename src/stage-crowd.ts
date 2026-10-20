import * as THREE from 'three';
import type { Seat, Vec3 } from './types';

// Bright concert IMAG content drawn to a canvas: glow, equaliser bars and a
// bilingual caption. ponytail: static texture, not per-frame animated — looks
// live enough; add a rAF redraw hook only if the user wants motion.
function screenTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x = cv.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12002a');
  bg.addColorStop(1, '#02000d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  const glow = x.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h * 0.42, w * 0.6);
  glow.addColorStop(0, 'rgba(255,60,150,0.55)');
  glow.addColorStop(0.5, 'rgba(90,40,200,0.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, w, h);
  const bars = 40;
  for (let i = 0; i < bars; i++) {
    const bh = (Math.sin(i * 1.7) * 0.5 + 0.5) * h * 0.5 + 8;
    const g = x.createLinearGradient(0, h, 0, h - bh);
    g.addColorStop(0, '#22d3ee');
    g.addColorStop(1, '#ff2d8e');
    x.fillStyle = g;
    x.fillRect((i / bars) * w + 2, h - bh, w / bars - 4, bh);
  }
  x.fillStyle = '#ffffff';
  x.font = 'bold 54px system-ui, sans-serif';
  x.textAlign = 'center';
  x.shadowColor = '#ff2d8e';
  x.shadowBlur = 24;
  x.fillText('LIVE', w / 2, h * 0.42);
  x.shadowBlur = 0;
  x.font = '600 22px system-ui, sans-serif';
  x.fillText('RAJAMANGALA · ราชมังคลากีฬาสถาน', w / 2, h * 0.6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A recognisable stadium-concert rig at the stage end: main deck, big centre
// LED wall, two angled side IMAG screens, an overhead truss with PAR specks,
// PA/delay towers, a thrust runway with a B-stage, and beam cones + wash lights.
export function buildStage(stage: Vec3): THREE.Object3D {
  const g = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: '#0a0a0f' });
  const steel = new THREE.MeshLambertMaterial({ color: '#1b1e26' });
  const led = new THREE.MeshBasicMaterial({ map: screenTexture() });
  const frame = new THREE.MeshBasicMaterial({ color: '#04010a' });
  const toCrowd = 1; // stage faces +Z (crowd), screens sit behind performers

  // Main deck + a raised drum riser.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 26), black);
  deck.position.set(stage.x, stage.y + 1.5, stage.z);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 8), steel);
  riser.position.set(stage.x, stage.y + 3.8, stage.z - 7 * toCrowd);
  g.add(deck, riser);

  // Big centre LED wall at the back of the deck, facing the crowd.
  const screenZ = stage.z - 12 * toCrowd;
  const back = new THREE.Mesh(new THREE.BoxGeometry(48, 24, 1), frame);
  back.position.set(stage.x, stage.y + 15, screenZ - 0.6);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 20), led);
  wall.position.set(stage.x, stage.y + 15, screenZ);
  g.add(back, wall);

  // Two angled side IMAG screens.
  [-1, 1].forEach((s) => {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(15, 11), led);
    side.position.set(stage.x + s * 27, stage.y + 12, stage.z - 8 * toCrowd);
    side.rotation.y = -s * 0.6;
    g.add(side);
  });

  // Overhead truss header + vertical legs, studded with PAR-can specks.
  const par = new THREE.MeshBasicMaterial({ color: '#fff3cf' });
  const header = new THREE.Mesh(new THREE.BoxGeometry(58, 1.4, 2), steel);
  header.position.set(stage.x, stage.y + 26, screenZ + 1);
  g.add(header);
  [-1, 1].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), steel);
    leg.position.set(stage.x + s * 28, stage.y + 13, screenZ + 1);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 4), steel); // PA/delay tower
    tower.position.set(stage.x + s * 38, stage.y + 14, stage.z - 2 * toCrowd);
    g.add(leg, tower);
  });
  for (let i = 0; i <= 14; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.8), par);
    p.position.set(stage.x - 28 + (56 * i) / 14, stage.y + 25, screenZ + 2.2);
    g.add(p);
  }

  // Volumetric beam cones fanning from the truss into the crowd.
  const beamColors = ['#ff2d8e', '#22d3ee', '#c9a6ff', '#ffd9a0'];
  beamColors.forEach((c, i) => {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(5, 46, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const off = (i - 1.5) * 14;
    beam.position.set(stage.x + off, stage.y + 16, stage.z + 12 * toCrowd);
    beam.rotation.x = toCrowd * 0.9; // tip up-stage, mouth out over the crowd
    beam.rotation.z = off * 0.006;
    g.add(beam);
  });

  // Coloured wash spilling from the rig onto the deck and front rows.
  // ponytail: decay 0 = flat colour wash, predictable without candela tuning.
  const magenta = new THREE.PointLight('#ff2d8e', 2.6, 260, 0);
  magenta.position.set(stage.x - 22, stage.y + 24, stage.z + 16 * toCrowd);
  const cyan = new THREE.PointLight('#22d3ee', 2.6, 260, 0);
  cyan.position.set(stage.x + 22, stage.y + 24, stage.z + 16 * toCrowd);
  const warmKey = new THREE.PointLight('#ffd9a0', 1.7, 140, 0);
  warmKey.position.set(stage.x, stage.y + 12, stage.z + 6 * toCrowd);
  const screenSpill = new THREE.PointLight('#7a4bff', 1.4, 120, 0);
  screenSpill.position.set(stage.x, stage.y + 14, screenZ + 4);
  g.add(magenta, cyan, warmKey, screenSpill);
  return g;
}

// Flat elliptical concourse bands = the horizontal walkways: one at field edge
// (in front of row 1) and one at the lower/upper tier break.
export function buildWalkways(): THREE.Object3D {
  const mat = new THREE.MeshLambertMaterial({ color: '#4a4f5a' });
  const g = new THREE.Group();
  const ring = (rxIn: number, rzIn: number, rxOut: number, rzOut: number, y: number) => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, rxOut, rzOut, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, rxIn, rzIn, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 128), mat);
    m.rotation.x = -Math.PI / 2; // shape XY -> world XZ
    m.position.y = y;
    return m;
  };
  g.add(ring(45, 87, 50, 92, 1.4));             // trackside walkway (field edge)
  g.add(ring(67.6, 109.6, 70.4, 112.4, 13.2));  // mid-tier concourse
  return g;
}

// Cheap crowd: one instanced low-poly figure per seat sample.
export function buildCrowd(seats: Seat[]): THREE.InstancedMesh {
  const sample = seats.filter((s, i) => !s.aisle && i % 3 === 0); // 1/3 density, aisles empty
  const geo = new THREE.CapsuleGeometry(0.18, 0.6, 3, 6);
  const mat = new THREE.MeshLambertMaterial({ color: '#c9c2b8' });
  const mesh = new THREE.InstancedMesh(geo, mat, sample.length);
  const d = new THREE.Object3D();
  sample.forEach((s, i) => {
    d.position.set(s.position.x, s.position.y + 0.6, s.position.z);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
