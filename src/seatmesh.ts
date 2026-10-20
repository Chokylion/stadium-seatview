import * as THREE from 'three';
import type { Seat } from './types';

export interface SeatMesh {
  mesh: THREE.InstancedMesh;
  seats: Seat[];
  setHighlight(index: number | null): void;
}

export function buildSeatMesh(seats: Seat[], zoneColor: Map<string, string>): SeatMesh {
  const geo = new THREE.BoxGeometry(0.7, 0.5, 0.6);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, seats.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(seats.length * 3), 3);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const base = new Float32Array(seats.length * 3);

  seats.forEach((s, i) => {
    dummy.position.set(s.position.x, s.position.y, s.position.z);
    dummy.scale.setScalar(s.aisle ? 0 : 1); // aisle seats render as an empty gap
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.set(zoneColor.get(s.zoneId) ?? '#888888');
    mesh.setColorAt(i, color);
    base.set([color.r, color.g, color.b], i * 3);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;

  let hi: number | null = null;
  function setHighlight(index: number | null) {
    if (hi !== null) {
      color.fromArray(base, hi * 3);
      mesh.setColorAt(hi, color);
    }
    if (index !== null) mesh.setColorAt(index, color.set('#ffffff'));
    hi = index;
    mesh.instanceColor!.needsUpdate = true;
  }

  return { mesh, seats, setHighlight };
}
