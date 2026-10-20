import * as THREE from 'three';

export function createPicker(
  mesh: THREE.InstancedMesh,
  camera: THREE.Camera,
  dom: HTMLElement,
) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  return function pick(ev: PointerEvent): number | null {
    const rect = dom.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mesh)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : null;
  };
}
