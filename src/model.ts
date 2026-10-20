import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const DEG = Math.PI / 180;

// A ruled band between two ellipse loops (inner -> outer, each at its own
// height). One primitive builds every curved surface here: raked decks
// (inner low / outer high), flat rings (equal height), cantilever roofs and
// the sloped outer facade.
function band(
  inner: { rx: number; rz: number; y: number },
  outer: { rx: number; rz: number; y: number },
  a0 = 0,
  a1 = Math.PI * 2,
  seg = 160,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(inner.rx * c, inner.y, inner.rz * s);
    pos.push(outer.rx * c, outer.y, outer.rz * s);
  }
  for (let i = 0; i < seg; i++) {
    const a = 2 * i;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Green pitch with real football markings, drawn to a canvas (portrait so the
// centre circle stays round when mapped to the 68 x 105 m plane).
function pitchTexture(): THREE.CanvasTexture {
  const w = 680;
  const h = 1050;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x = cv.getContext('2d')!;
  for (let i = 0; i < 20; i++) {
    x.fillStyle = i % 2 ? '#1f7d35' : '#1b6e2d';
    x.fillRect(0, (h / 20) * i, w, h / 20 + 1);
  }
  x.strokeStyle = 'rgba(255,255,255,0.85)';
  x.lineWidth = 4;
  const m = 34;
  x.strokeRect(m, m, w - 2 * m, h - 2 * m);
  x.beginPath();
  x.moveTo(m, h / 2);
  x.lineTo(w - m, h / 2);
  x.stroke();
  x.beginPath();
  x.arc(w / 2, h / 2, 92, 0, Math.PI * 2);
  x.stroke();
  x.beginPath();
  x.arc(w / 2, h / 2, 5, 0, Math.PI * 2);
  x.fillStyle = '#fff';
  x.fill();
  const pbW = 300;
  const pbH = 132;
  const gW = 140;
  const gH = 56;
  x.strokeRect(w / 2 - pbW / 2, m, pbW, pbH);
  x.strokeRect(w / 2 - pbW / 2, h - m - pbH, pbW, pbH);
  x.strokeRect(w / 2 - gW / 2, m, gW, gH);
  x.strokeRect(w / 2 - gW / 2, h - m - gH, gW, gH);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural Rajamangala: elliptical two-tier bowl, cantilever roofs over the
// East and West long sides only (ends open), floodlights, facade and a marked
// pitch + track. Matches the real aerial; shown until stadium.glb is supplied.
function buildStadium(): THREE.Object3D {
  const g = new THREE.Group();
  const deck = new THREE.MeshLambertMaterial({ color: '#2b2f3a', side: THREE.DoubleSide });
  const concrete = new THREE.MeshLambertMaterial({ color: '#3c4150', side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: '#d7dbe4', side: THREE.DoubleSide });

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(240, 64),
    new THREE.MeshLambertMaterial({ color: '#151821' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  g.add(ground);

  // Raked seating decks under the two seat tiers.
  g.add(new THREE.Mesh(band({ rx: 49, rz: 91, y: 1.2 }, { rx: 68, rz: 110, y: 12.8 }), deck));
  g.add(new THREE.Mesh(band({ rx: 69.5, rz: 111.5, y: 15 }, { rx: 95, rz: 137, y: 31.5 }), deck));

  // Sloped outer facade + a short field-edge wall down to the pitch.
  g.add(new THREE.Mesh(band({ rx: 95, rz: 137, y: 31.5 }, { rx: 101, rz: 143, y: 0 }), concrete));
  g.add(new THREE.Mesh(band({ rx: 49, rz: 91, y: 1.2 }, { rx: 47, rz: 89, y: 0 }), deck));

  // Cantilever roofs over East (-50..50) and West (130..230); ends stay open.
  const roof = (a0: number, a1: number) =>
    g.add(new THREE.Mesh(band({ rx: 64, rz: 110, y: 35 }, { rx: 99, rz: 145, y: 42 }, a0 * DEG, a1 * DEG, 90), roofMat));
  roof(-46, 46);
  roof(134, 226);

  // Floodlight fixtures along the roof front edges (also read as bright specks).
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fff7d6' });
  const floods = (a0: number, a1: number) => {
    for (let i = 0; i <= 12; i++) {
      const a = (a0 + (a1 - a0) * (i / 12)) * DEG;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1), lightMat);
      b.position.set(64 * Math.cos(a), 35.2, 110 * Math.sin(a));
      b.lookAt(0, 10, 0);
      g.add(b);
    }
  };
  floods(-44, 44);
  floods(136, 224);

  // Reddish running track ellipse + marked green pitch.
  const track = new THREE.Mesh(
    new THREE.CircleGeometry(48, 96),
    new THREE.MeshLambertMaterial({ color: '#8a3b2e' }),
  );
  track.rotation.x = -Math.PI / 2;
  track.scale.set(1, 90 / 48, 1);
  track.position.y = 0.02;
  g.add(track);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(68, 105),
    new THREE.MeshLambertMaterial({ map: pitchTexture() }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.05;
  g.add(pitch);

  return g;
}

// Loads stadium.glb if present; otherwise returns the procedural stadium so
// development is not blocked before the model is converted (Task 11).
export async function loadStadium(url = 'stadium.glb'): Promise<THREE.Object3D> {
  try {
    const draco = new DRACOLoader().setDecoderPath('draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
  } catch {
    console.warn('stadium.glb not found — using procedural stadium');
    return buildStadium();
  }
}
