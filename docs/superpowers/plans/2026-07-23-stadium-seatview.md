# Stadium Seat-View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free static web app where a fan orbits a 3D model of Rajamangala Stadium, picks a concert zone, clicks a real-numbered seat, and enters a live first-person view from that seat.

**Architecture:** Static single-page app (no backend). three.js renders the stadium `.glb` shell plus ~50k seats as a single `InstancedMesh` generated from a JSON config. Raycast picking selects seats; the camera flies into first-person on click. Deployed to Vercel/Netlify.

**Tech Stack:** Vite, TypeScript (vanilla, no framework), three.js, vitest.

**Convention:** Every commit ends with the trailer:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
(Shown once here; append it to every `git commit -m` in this plan.)

---

## File Structure

```
stadium-seatview/
  package.json              # deps + scripts
  tsconfig.json             # TS config
  vite.config.ts            # Vite config
  index.html                # canvas + DOM overlay containers
  public/
    data/rajamangala.json   # venue: zones + seat-generation rules
    stadium.glb             # converted model (added in Task 11; placeholder until then)
    draco/                  # Draco decoder files (Task 11)
  src/
    types.ts                # VenueData, Zone, SeatRules, Seat, Vec3
    venue.ts                # load + validate rajamangala.json
    seats.ts                # generate seats from rules  (UNIT TESTED)
    seats.test.ts
    seat-info.ts            # distance/angle/neighbours/nearest  (UNIT TESTED)
    seat-info.test.ts
    scene.ts                # renderer, camera, lights, OrbitControls, loop
    model.ts                # load stadium.glb (+ placeholder fallback)
    seatmesh.ts             # InstancedMesh build + zone tint + highlight
    picking.ts              # raycast pointer -> instanceId
    pov.ts                  # first-person camera + optional gyro
    stage-crowd.ts          # low-poly stage + instanced crowd
    i18n.ts                 # TH/EN strings + toggle
    ui.ts                   # DOM overlay (zone list, seat card, buttons, footer)
    share.ts                # screenshot + copy share link
    analytics.ts            # cookieless analytics init
    state.ts                # state machine: overview|zone|seat|pov
    main.ts                 # bootstrap wiring
```

Each `src/*.ts` has one responsibility. `seats.ts` and `seat-info.ts` are pure and unit-tested (the automated safety net). 3D/DOM modules are verified by running the dev server and checking the browser.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "stadium-seatview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@types/three": "^0.169.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',        // relative paths so it works on any host / subpath
  build: { target: 'es2022' },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Rajamangala Seat View</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; font-family: system-ui, "Sarabun", sans-serif; }
    #app { position: fixed; inset: 0; }
    canvas { display: block; }
    #overlay { position: fixed; inset: 0; pointer-events: none; }
    #overlay > * { pointer-events: auto; }
  </style>
</head>
<body>
  <div id="app"><canvas id="scene"></canvas></div>
  <div id="overlay"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create `src/main.ts` (temporary stub)**

```ts
console.log('stadium-seatview boot');
```

- [ ] **Step 6: Install and run**

Run: `npm install`
Expected: dependencies install without error.

Run: `npm run dev`
Expected: Vite prints a `localhost:5173` URL; opening it shows a blank page and the console logs `stadium-seatview boot`. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + three.js + vitest project"
```

---

## Task 1: Types and venue loader

**Files:**
- Create: `src/types.ts`, `src/venue.ts`, `public/data/rajamangala.json`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface LocalizedName { th: string; en: string; }
export interface Vec3 { x: number; y: number; z: number; }

export interface SeatRules {
  rows: string[];        // row labels, e.g. ["A","B","C"]
  seatsPerRow: number;   // seats in each row
  curveRadius: number;   // radius (m) of the first row from stage centre
  rowDepth: number;      // radial gap (m) between successive rows
  rowRise: number;       // height gain (m) per row
  baseHeight: number;    // height (m) of the first row above stage plane
  arcStartDeg: number;   // start bearing of the zone (deg, 0 = +z toward stage front)
  arcEndDeg: number;     // end bearing of the zone (deg)
  eyeHeight: number;     // seated eye height (m) above the seat
  aisles: number[];      // seat numbers on an aisle
  stairs: number[];      // seat numbers nearest a stairway
  exits: number[];       // seat numbers nearest an exit
}

export interface Zone {
  id: string;
  name: LocalizedName;
  color: string;         // hex, e.g. "#0071e3"
  tier: string;          // "lower" | "upper" | ...
  ticketUrl: string;     // outbound link
  priceBand?: string;    // used in Tier B
  seatRules: SeatRules;
}

export interface VenueData {
  venue: { name: LocalizedName; model: string; capacityConcert: number; };
  stage: { position: [number, number, number]; facing: [number, number, number]; };
  zones: Zone[];
}

export interface Seat {
  id: string;            // `${zoneId}-${row}-${number}`
  zoneId: string;
  row: string;
  number: number;        // 1-based
  position: Vec3;        // seat base (world)
  eyeHeight: number;
}
```

- [ ] **Step 2: Create `public/data/rajamangala.json`** (seed: 4 zones around the stage)

```json
{
  "venue": {
    "name": { "th": "ราชมังคลากีฬาสถาน", "en": "Rajamangala National Stadium" },
    "model": "stadium.glb",
    "capacityConcert": 65000
  },
  "stage": { "position": [0, 0, -70], "facing": [0, 0, 1] },
  "zones": [
    { "id": "A", "name": { "th": "โซน A", "en": "Zone A" }, "color": "#0071e3", "tier": "lower", "ticketUrl": "https://example.com/tickets?zone=A", "priceBand": "VIP",
      "seatRules": { "rows": ["A","B","C","D","E","F","G","H","J","K"], "seatsPerRow": 40, "curveRadius": 40, "rowDepth": 0.9, "rowRise": 0.45, "baseHeight": 1.0, "arcStartDeg": -25, "arcEndDeg": 25, "eyeHeight": 1.15, "aisles": [1,20,40], "stairs": [1,40], "exits": [20] } },
    { "id": "B", "name": { "th": "โซน B", "en": "Zone B" }, "color": "#34c759", "tier": "lower", "ticketUrl": "https://example.com/tickets?zone=B", "priceBand": "A",
      "seatRules": { "rows": ["A","B","C","D","E","F","G","H","J","K"], "seatsPerRow": 40, "curveRadius": 40, "rowDepth": 0.9, "rowRise": 0.45, "baseHeight": 1.0, "arcStartDeg": 25, "arcEndDeg": 75, "eyeHeight": 1.15, "aisles": [1,20,40], "stairs": [1,40], "exits": [20] } },
    { "id": "C", "name": { "th": "โซน C", "en": "Zone C" }, "color": "#ff9f0a", "tier": "upper", "ticketUrl": "https://example.com/tickets?zone=C", "priceBand": "B",
      "seatRules": { "rows": ["M","N","P","Q","R","S","T","U","V","W","X","Y"], "seatsPerRow": 48, "curveRadius": 58, "rowDepth": 0.95, "rowRise": 0.5, "baseHeight": 8.0, "arcStartDeg": -25, "arcEndDeg": 25, "eyeHeight": 1.15, "aisles": [1,24,48], "stairs": [1,48], "exits": [24] } },
    { "id": "D", "name": { "th": "โซน D", "en": "Zone D" }, "color": "#ff3b30", "tier": "upper", "ticketUrl": "https://example.com/tickets?zone=D", "priceBand": "B",
      "seatRules": { "rows": ["M","N","P","Q","R","S","T","U","V","W","X","Y"], "seatsPerRow": 48, "curveRadius": 58, "rowDepth": 0.95, "rowRise": 0.5, "baseHeight": 8.0, "arcStartDeg": 25, "arcEndDeg": 75, "eyeHeight": 1.15, "aisles": [1,24,48], "stairs": [1,48], "exits": [24] } }
  ]
}
```

- [ ] **Step 3: Create `src/venue.ts`**

```ts
import type { VenueData, Vec3 } from './types';

export async function loadVenue(url = 'data/rajamangala.json'): Promise<VenueData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load venue: ${res.status}`);
  const data = (await res.json()) as VenueData;
  if (!data.zones?.length) throw new Error('Venue has no zones');
  return data;
}

export function stageVec(data: VenueData): Vec3 {
  const [x, y, z] = data.stage.position;
  return { x, y, z };
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: venue types, seed data, and loader"
```

---

## Task 2: Seat generation (core logic, TDD)

**Files:**
- Create: `src/seats.ts`, `src/seats.test.ts`

- [ ] **Step 1: Write the failing test — `src/seats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateZoneSeats } from './seats';
import type { Zone, Vec3 } from './types';

const stage: Vec3 = { x: 0, y: 0, z: -70 };
const zone: Zone = {
  id: 'A', name: { th: 'โซน A', en: 'Zone A' }, color: '#0071e3',
  tier: 'lower', ticketUrl: 'https://x',
  seatRules: {
    rows: ['A', 'B', 'C'], seatsPerRow: 10,
    curveRadius: 40, rowDepth: 0.9, rowRise: 0.45, baseHeight: 1,
    arcStartDeg: -20, arcEndDeg: 20, eyeHeight: 1.15,
    aisles: [1, 10], stairs: [1], exits: [10],
  },
};

describe('generateZoneSeats', () => {
  const seats = generateZoneSeats(zone, stage);

  it('produces rows * seatsPerRow seats', () => {
    expect(seats.length).toBe(3 * 10);
  });

  it('gives each seat a unique, well-formed id', () => {
    const ids = new Set(seats.map((s) => s.id));
    expect(ids.size).toBe(seats.length);
    expect(seats[0].id).toBe('A-A-1');
    expect(seats.at(-1)!.id).toBe('A-C-10');
  });

  it('places every seat within the bowl radius bounds', () => {
    const rMin = 40;
    const rMax = 40 + 2 * 0.9;
    for (const s of seats) {
      const radius = Math.hypot(s.position.x - stage.x, s.position.z - stage.z);
      expect(radius).toBeGreaterThanOrEqual(rMin - 1e-6);
      expect(radius).toBeLessThanOrEqual(rMax + 1e-6);
    }
  });

  it('raises each successive row', () => {
    const a = seats.find((s) => s.row === 'A')!;
    const c = seats.find((s) => s.row === 'C')!;
    expect(c.position.y).toBeGreaterThan(a.position.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./seats` / `generateZoneSeats is not a function`.

- [ ] **Step 3: Write minimal implementation — `src/seats.ts`**

```ts
import type { Zone, Seat, Vec3 } from './types';

const DEG = Math.PI / 180;

export function generateZoneSeats(zone: Zone, stage: Vec3): Seat[] {
  const r = zone.seatRules;
  const seats: Seat[] = [];
  const start = r.arcStartDeg * DEG;
  const span = (r.arcEndDeg - r.arcStartDeg) * DEG;

  for (let ri = 0; ri < r.rows.length; ri++) {
    const radius = r.curveRadius + ri * r.rowDepth;
    const y = stage.y + r.baseHeight + ri * r.rowRise;
    for (let si = 0; si < r.seatsPerRow; si++) {
      const t = r.seatsPerRow === 1 ? 0.5 : si / (r.seatsPerRow - 1);
      const ang = start + t * span;
      const number = si + 1;
      seats.push({
        id: `${zone.id}-${r.rows[ri]}-${number}`,
        zoneId: zone.id,
        row: r.rows[ri],
        number,
        position: {
          x: stage.x + radius * Math.sin(ang),
          y,
          z: stage.z + radius * Math.cos(ang),
        },
        eyeHeight: r.eyeHeight,
      });
    }
  }
  return seats;
}

export function generateAllSeats(zones: Zone[], stage: Vec3): Seat[] {
  return zones.flatMap((z) => generateZoneSeats(z, stage));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: procedural seat generation from zone rules"
```

---

## Task 3: three.js scene + loop

**Files:**
- Create: `src/scene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/scene.ts`**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  onFrame(cb: () => void): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneCtx {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1020');

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
  camera.position.set(0, 140, 190);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.05;

  scene.add(new THREE.HemisphereLight('#ffffff', '#223', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2);
  sun.position.set(80, 160, 60);
  scene.add(sun);

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
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import { createScene } from './scene';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
createScene(canvas);
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Expected: dark blue scene, mouse-drag orbits an empty camera (no errors in console). Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: three.js scene, lights, orbit controls, render loop"
```

---

## Task 4: Load model (with placeholder fallback)

**Files:**
- Create: `src/model.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/model.ts`**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads stadium.glb if present; otherwise returns a placeholder bowl so
// development is not blocked before the model is converted (Task 11).
export async function loadStadium(url = 'stadium.glb'): Promise<THREE.Object3D> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  } catch {
    console.warn('stadium.glb not found — using placeholder bowl');
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(140, 100, 26, 64, 1, true),
      new THREE.MeshLambertMaterial({ color: '#2a2f45', side: THREE.DoubleSide }),
    );
    ring.position.y = 13;
    const field = new THREE.Mesh(
      new THREE.CircleGeometry(95, 64),
      new THREE.MeshLambertMaterial({ color: '#14331e' }),
    );
    field.rotation.x = -Math.PI / 2;
    g.add(ring, field);
    return g;
  }
}
```

- [ ] **Step 2: Modify `src/main.ts`**

```ts
import { createScene } from './scene';
import { loadStadium } from './model';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ctx = createScene(canvas);

const stadium = await loadStadium();
ctx.scene.add(stadium);
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Expected: a grey placeholder bowl with a green field; orbit works. Console warns about the missing model (expected). Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: stadium model loader with placeholder bowl fallback"
```

---

## Task 5: Instanced seats + zone tint

**Files:**
- Create: `src/seatmesh.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/seatmesh.ts`**

```ts
import * as THREE from 'three';
import type { Seat } from './types';

export interface SeatMesh {
  mesh: THREE.InstancedMesh;
  seats: Seat[];
  setHighlight(index: number | null): void;
}

export function buildSeatMesh(seats: Seat[], zoneColor: Map<string, string>): SeatMesh {
  const geo = new THREE.BoxGeometry(0.45, 0.4, 0.45);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, seats.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(seats.length * 3), 3);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const base = new Float32Array(seats.length * 3);

  seats.forEach((s, i) => {
    dummy.position.set(s.position.x, s.position.y, s.position.z);
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
```

- [ ] **Step 2: Modify `src/main.ts`**

```ts
import { createScene } from './scene';
import { loadStadium } from './model';
import { loadVenue, stageVec } from './venue';
import { generateAllSeats } from './seats';
import { buildSeatMesh } from './seatmesh';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ctx = createScene(canvas);

const stadium = await loadStadium();
ctx.scene.add(stadium);

const venue = await loadVenue();
const seats = generateAllSeats(venue.zones, stageVec(venue));
const zoneColor = new Map(venue.zones.map((z) => [z.id, z.color]));
const seatMesh = buildSeatMesh(seats, zoneColor);
ctx.scene.add(seatMesh.mesh);

console.log(`Generated ${seats.length} seats`);
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Expected: coloured seat blocks arranged in curved rows around the stage side; console logs the seat count (e.g. `Generated 1840 seats`). Orbit to inspect. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: instanced seats tinted per zone"
```

---

## Task 6: Seat-info computations (TDD)

**Files:**
- Create: `src/seat-info.ts`, `src/seat-info.test.ts`

- [ ] **Step 1: Write the failing test — `src/seat-info.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { distanceToStage, nearest, neighborIds } from './seat-info';
import type { Seat, Vec3 } from './types';

const stage: Vec3 = { x: 0, y: 0, z: 0 };
const seat: Seat = {
  id: 'A-B-5', zoneId: 'A', row: 'B', number: 5,
  position: { x: 3, y: 0, z: 4 }, eyeHeight: 1.15,
};

describe('seat-info', () => {
  it('computes straight-line distance to the stage', () => {
    expect(distanceToStage(seat, stage)).toBeCloseTo(5, 6);
  });

  it('finds the nearest target seat number', () => {
    expect(nearest(5, [1, 20, 40])).toBe(1);
    expect(nearest(30, [1, 20, 40])).toBe(20);
    expect(nearest(5, [])).toBeNull();
  });

  it('returns left and right neighbour ids, clamped at row ends', () => {
    expect(neighborIds(seat, 40)).toEqual(['A-B-4', 'A-B-6']);
    const first: Seat = { ...seat, id: 'A-B-1', number: 1 };
    expect(neighborIds(first, 40)).toEqual(['A-B-2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `./seat-info`.

- [ ] **Step 3: Write implementation — `src/seat-info.ts`**

```ts
import type { Seat, Vec3 } from './types';

export function distanceToStage(seat: Seat, stage: Vec3): number {
  return Math.hypot(
    seat.position.x - stage.x,
    seat.position.y - stage.y,
    seat.position.z - stage.z,
  );
}

// Horizontal bearing in degrees from stage-forward (+z) to the seat.
export function angleToStage(seat: Seat, stage: Vec3): number {
  const dx = seat.position.x - stage.x;
  const dz = seat.position.z - stage.z;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

export function nearest(seatNumber: number, targets: number[]): number | null {
  if (targets.length === 0) return null;
  return targets.reduce((best, t) =>
    Math.abs(t - seatNumber) < Math.abs(best - seatNumber) ? t : best,
  );
}

export function neighborIds(seat: Seat, seatsPerRow: number): string[] {
  const out: string[] = [];
  if (seat.number > 1) out.push(`${seat.zoneId}-${seat.row}-${seat.number - 1}`);
  if (seat.number < seatsPerRow) out.push(`${seat.zoneId}-${seat.row}-${seat.number + 1}`);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all seat-info + seat tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: seat-info math (distance, angle, nearest, neighbours)"
```

---

## Task 7: Pointer picking

**Files:**
- Create: `src/picking.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/picking.ts`**

```ts
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
```

- [ ] **Step 2: Modify `src/main.ts`** — append after `seatMesh` is added:

```ts
import { createPicker } from './picking';

const pick = createPicker(seatMesh.mesh, ctx.camera, ctx.renderer.domElement);
ctx.renderer.domElement.addEventListener('pointerdown', (ev) => {
  const i = pick(ev);
  seatMesh.setHighlight(i);
  if (i !== null) console.log('picked seat', seatMesh.seats[i].id);
});
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Expected: clicking a seat turns it white and logs its id (e.g. `picked seat A-C-12`). Clicking empty space clears the highlight. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: raycast seat picking with highlight"
```

---

## Task 8: i18n (TH/EN)

**Files:**
- Create: `src/i18n.ts`

- [ ] **Step 1: Create `src/i18n.ts`**

```ts
export type Lang = 'th' | 'en';

const S = {
  tapZone: { th: 'แตะเพื่อเลือกโซน', en: 'Tap a zone' },
  pickSeat: { th: 'เลือกที่นั่ง', en: 'Pick a seat' },
  back: { th: 'ย้อนกลับ', en: 'Back' },
  enterView: { th: 'เข้าสู่มุมมองที่นั่ง', en: 'Enter seat view' },
  getTickets: { th: 'ซื้อบัตร', en: 'Get tickets' },
  share: { th: 'แชร์', en: 'Share' },
  row: { th: 'แถว', en: 'Row' },
  seat: { th: 'ที่นั่ง', en: 'Seat' },
  toStage: { th: 'ระยะถึงเวที', en: 'To stage' },
  nearestStair: { th: 'บันไดใกล้สุด', en: 'Nearest stair' },
  nearestExit: { th: 'ทางออกใกล้สุด', en: 'Nearest exit' },
  recenter: { th: 'จัดกึ่งกลาง', en: 'Re-center' },
  disclaimer: {
    th: 'มุมมองเป็นค่าประมาณ ไม่ได้มีส่วนเกี่ยวข้องกับสนาม ผู้จัด หรือศิลปิน',
    en: 'Views are approximate. Not affiliated with the stadium, promoters, or artists.',
  },
} as const;

export type Key = keyof typeof S;

let lang: Lang = 'th';
export function setLang(l: Lang) { lang = l; }
export function getLang(): Lang { return lang; }
export function t(key: Key): string { return S[key][lang]; }
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: TH/EN i18n strings"
```

---

## Task 9: DOM overlay + state machine

**Files:**
- Create: `src/state.ts`, `src/ui.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/state.ts`**

```ts
import type { Seat, Zone } from './types';

export type View = 'overview' | 'zone' | 'seat' | 'pov';

export interface AppState {
  view: View;
  zone: Zone | null;
  seat: Seat | null;
}

type Listener = (s: AppState) => void;

export function createStore() {
  const state: AppState = { view: 'overview', zone: null, seat: null };
  const listeners: Listener[] = [];
  function emit() { for (const l of listeners) l(state); }
  return {
    get: () => state,
    subscribe: (l: Listener) => { listeners.push(l); l(state); },
    toOverview() { state.view = 'overview'; state.zone = null; state.seat = null; emit(); },
    toZone(z: Zone) { state.view = 'zone'; state.zone = z; state.seat = null; emit(); },
    toSeat(s: Seat, z: Zone) { state.view = 'seat'; state.seat = s; state.zone = z; emit(); },
    toPov() { if (state.seat) { state.view = 'pov'; emit(); } },
  };
}
export type Store = ReturnType<typeof createStore>;
```

- [ ] **Step 2: Create `src/ui.ts`**

```ts
import type { Store } from './state';
import type { VenueData, Zone, Seat, Vec3 } from './types';
import { t, setLang, getLang, type Lang } from './i18n';
import { distanceToStage, nearest } from './seat-info';

export interface UICallbacks {
  onZone(z: Zone): void;
  onEnterView(): void;
  onShare(): void;
  onLangChange(): void;
}

export function mountUI(root: HTMLElement, store: Store, venue: VenueData, stage: Vec3, cb: UICallbacks) {
  root.innerHTML = `
    <div id="top" style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;color:#fff;background:linear-gradient(#000a,#0000)">
      <div id="title" style="font-weight:600"></div>
      <button id="lang" style="pointer-events:auto;border:1px solid #fff6;background:#0006;color:#fff;border-radius:8px;padding:6px 10px">EN</button>
    </div>
    <div id="zones" style="position:absolute;left:16px;bottom:56px;display:flex;gap:8px;flex-wrap:wrap"></div>
    <div id="card" style="position:absolute;right:16px;bottom:56px;max-width:280px;background:#111d;color:#fff;border-radius:14px;padding:14px;display:none"></div>
    <button id="back" style="position:absolute;left:16px;top:56px;display:none;pointer-events:auto;border:1px solid #fff6;background:#0006;color:#fff;border-radius:8px;padding:8px 12px"></button>
    <div id="foot" style="position:absolute;left:0;right:0;bottom:0;padding:6px 16px;font-size:11px;color:#fff9;background:#0008;text-align:center"></div>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;

  $('lang').onclick = () => {
    setLang(getLang() === 'th' ? 'en' : 'th');
    $('lang').textContent = getLang() === 'th' ? 'EN' : 'TH';
    cb.onLangChange();
    render();
  };
  $('back').onclick = () => {
    const s = store.get();
    if (s.view === 'pov') store.toSeat(s.seat!, s.zone!);
    else if (s.view === 'seat') store.toZone(s.zone!);
    else store.toOverview();
  };

  function renderZones() {
    const box = $('zones');
    box.innerHTML = '';
    box.style.display = store.get().view === 'overview' ? 'flex' : 'none';
    for (const z of venue.zones) {
      const b = document.createElement('button');
      b.textContent = z.name[getLang()];
      b.style.cssText = `pointer-events:auto;border:none;border-radius:10px;padding:8px 12px;color:#fff;font-weight:600;background:${z.color}`;
      b.onclick = () => cb.onZone(z);
      box.appendChild(b);
    }
  }

  function renderCard() {
    const s = store.get();
    const card = $('card');
    if ((s.view === 'seat' || s.view === 'pov') && s.seat && s.zone) {
      const seat: Seat = s.seat;
      const d = distanceToStage(seat, stage).toFixed(0);
      const stair = nearest(seat.number, s.zone.seatRules.stairs);
      const exit = nearest(seat.number, s.zone.seatRules.exits);
      card.style.display = 'block';
      card.innerHTML = `
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">${s.zone.name[getLang()]}</div>
        <div>${t('row')} ${seat.row} · ${t('seat')} ${seat.number}</div>
        <div style="color:#bbb;font-size:13px;margin-top:4px">${t('toStage')}: ${d} m</div>
        <div style="color:#bbb;font-size:13px">${t('nearestStair')}: ${stair ?? '-'} · ${t('nearestExit')}: ${exit ?? '-'}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          ${s.view === 'seat' ? `<button id="enter" style="pointer-events:auto;flex:1;border:none;border-radius:10px;padding:10px;background:#0071e3;color:#fff;font-weight:600">${t('enterView')}</button>` : ''}
          <a href="${s.zone.ticketUrl}" target="_blank" rel="noopener" style="flex:1;text-align:center;border-radius:10px;padding:10px;background:#34c759;color:#fff;font-weight:600;text-decoration:none">${t('getTickets')}</a>
        </div>
        <button id="share" style="pointer-events:auto;width:100%;margin-top:8px;border:1px solid #fff4;background:#0000;color:#fff;border-radius:10px;padding:8px">${t('share')}</button>
      `;
      const enter = card.querySelector<HTMLButtonElement>('#enter');
      if (enter) enter.onclick = cb.onEnterView;
      card.querySelector<HTMLButtonElement>('#share')!.onclick = cb.onShare;
    } else {
      card.style.display = 'none';
    }
  }

  function render() {
    const s = store.get();
    $('title').textContent = venue.venue.name[getLang()];
    $('back').style.display = s.view === 'overview' ? 'none' : 'block';
    $('back').textContent = t('back');
    $('foot').textContent = t('disclaimer');
    renderZones();
    renderCard();
  }

  store.subscribe(render);
  return { render };
}
```

- [ ] **Step 3: Rewrite `src/main.ts` to wire scene + store + UI**

```ts
import { createScene } from './scene';
import { loadStadium } from './model';
import { loadVenue, stageVec } from './venue';
import { generateAllSeats } from './seats';
import { buildSeatMesh } from './seatmesh';
import { createPicker } from './picking';
import { createStore } from './state';
import { mountUI } from './ui';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const ctx = createScene(canvas);

ctx.scene.add(await loadStadium());

const venue = await loadVenue();
const stage = stageVec(venue);
const seats = generateAllSeats(venue.zones, stage);
const seatMesh = buildSeatMesh(seats, new Map(venue.zones.map((z) => [z.id, z.color])));
ctx.scene.add(seatMesh.mesh);

const seatById = new Map(seats.map((s) => [s.id, s]));
const store = createStore();

mountUI(overlay, store, venue, stage, {
  onZone: (z) => store.toZone(z),
  onEnterView: () => store.toPov(),
  onShare: () => {},        // implemented in Task 11
  onLangChange: () => {},
});

const pick = createPicker(seatMesh.mesh, ctx.camera, ctx.renderer.domElement);
ctx.renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (store.get().view === 'pov') return;
  const i = pick(ev);
  seatMesh.setHighlight(i);
  if (i === null) return;
  const seat = seatMesh.seats[i];
  const zone = venue.zones.find((z) => z.id === seat.zoneId)!;
  store.toSeat(seat, zone);
});

void seatById; // reserved for share deep-links (Task 11)
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Expected: zone buttons bottom-left, venue title top, disclaimer footer, EN/TH toggle flips all labels. Click a zone → Back button appears. Click a seat → info card shows row/seat/distance/stair/exit + Enter view + Get tickets. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: DOM overlay, state machine, TH/EN wiring"
```

---

## Task 10: First-person view + stage/crowd

**Files:**
- Create: `src/pov.ts`, `src/stage-crowd.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/stage-crowd.ts`**

```ts
import * as THREE from 'three';
import type { Seat, Vec3 } from './types';

export function buildStage(stage: Vec3): THREE.Object3D {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(40, 2, 16),
    new THREE.MeshLambertMaterial({ color: '#111' }),
  );
  deck.position.set(stage.x, stage.y + 1, stage.z);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshBasicMaterial({ color: '#1a3a6b' }),
  );
  screen.position.set(stage.x, stage.y + 10, stage.z - 8);
  g.add(deck, screen);
  return g;
}

// Cheap crowd: one instanced low-poly figure per seat sample.
export function buildCrowd(seats: Seat[]): THREE.InstancedMesh {
  const sample = seats.filter((_, i) => i % 3 === 0); // 1/3 density
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
```

- [ ] **Step 2: Create `src/pov.ts`**

```ts
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
```

- [ ] **Step 3: Modify `src/main.ts`** — add stage/crowd once after `seatMesh`:

```ts
import { buildStage, buildCrowd } from './stage-crowd';
ctx.scene.add(buildStage(stage));
ctx.scene.add(buildCrowd(seats));
```

Then add POV enter/exit driven by state. Replace the `mountUI` call's `onEnterView`/store handling by adding, after `mountUI`:

```ts
import { enterPov, type PovController } from './pov';

let pov: PovController | null = null;
store.subscribe((s) => {
  if (s.view === 'pov' && s.seat && !pov) {
    pov = enterPov(ctx.camera, ctx.controls, s.seat, stage);
  } else if (s.view !== 'pov' && pov) {
    pov.exit();
    pov = null;
  }
});
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Expected: a dark stage deck + blue screen near the stage; capsule "crowd" on the seats. Click a seat → Enter seat view → camera drops to that seat's height facing the stage; drag rotates the view. Back returns to the orbit view. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: first-person seat view with stage, crowd, and gyro"
```

---

## Task 11: Convert model, share, analytics, legal

**Files:**
- Create: `src/share.ts`, `src/analytics.ts`
- Add asset: `public/stadium.glb` (+ `public/draco/`)
- Modify: `src/main.ts`, `src/model.ts`

- [ ] **Step 1: Convert the SketchUp model to glb**

Manual, one-time (document the exact tool used in the commit message):
1. Copy `"C:\Users\KWatamat\OneDrive - Analog Devices, Inc\Desktop\rajamangala_stadium.skp"` into the repo working area (do NOT commit the `.skp`).
2. Convert to glTF/glb. Preferred path: open in SketchUp → export `.dae` (Collada) → import into Blender → export `.glb` with Draco compression. (Alternative: a SketchUp glTF exporter extension.)
3. In Blender before export: delete interior/detail geometry not visible from stands, decimate heavy meshes, keep the file to a few MB.
4. Save as `public/stadium.glb`. Note its up-axis and scale (metres).

Verify: `Get-Item public/stadium.glb` shows a file of a few MB.

- [ ] **Step 2: Enable Draco in `src/model.ts`**

Copy Draco decoder files: from `node_modules/three/examples/jsm/libs/draco/` into `public/draco/`. Then replace the loader in `src/model.ts`:

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export async function loadStadium(url = 'stadium.glb'): Promise<THREE.Object3D> {
  try {
    const draco = new DRACOLoader().setDecoderPath('draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
  } catch {
    console.warn('stadium.glb not found — using placeholder bowl');
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(140, 100, 26, 64, 1, true),
      new THREE.MeshLambertMaterial({ color: '#2a2f45', side: THREE.DoubleSide }),
    );
    ring.position.y = 13;
    const field = new THREE.Mesh(
      new THREE.CircleGeometry(95, 64),
      new THREE.MeshLambertMaterial({ color: '#14331e' }),
    );
    field.rotation.x = -Math.PI / 2;
    g.add(ring, field);
    return g;
  }
}
```

- [ ] **Step 3: Calibrate seat rules to the model**

With the real model loaded, adjust each zone's `curveRadius`, `rowDepth`, `rowRise`, `baseHeight`, `arcStartDeg`, `arcEndDeg`, and the venue `stage.position` in `public/data/rajamangala.json` until generated seats visibly sit on the model's stands. Iterate in the browser (Vite hot-reloads the JSON on save).

Verify: seats align to the stands on all four zones; no seats float or clip through the shell.

- [ ] **Step 4: Create `src/share.ts`**

```ts
import type { Seat } from './types';

// Capture the current canvas and offer share/download; copy a deep link.
export async function shareView(canvas: HTMLCanvasElement, seat: Seat | null) {
  const url = new URL(location.href);
  if (seat) url.searchParams.set('seat', seat.id);

  await new Promise<void>((resolve) =>
    canvas.toBlob(async (blob) => {
      if (blob && navigator.share && 'canShare' in navigator) {
        const file = new File([blob], 'seat-view.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], url: url.toString(), title: 'My seat view' }); } catch { /* cancelled */ }
          return resolve();
        }
      }
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'seat-view.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }
      try { await navigator.clipboard.writeText(url.toString()); } catch { /* ignore */ }
      resolve();
    }, 'image/png'),
  );
}
```

Note: `WebGLRenderer` must keep the drawing buffer to snapshot it. In `src/scene.ts`, set `new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })`.

- [ ] **Step 5: Create `src/analytics.ts`** (cookieless; no-op until a domain is set)

```ts
// Cookieless analytics. Replace DATA_DOMAIN and script src with your provider
// (e.g. Plausible/GoatCounter). No cookies => no PDPA consent banner needed.
export function initAnalytics() {
  const DATA_DOMAIN = ''; // set at deploy time
  if (!DATA_DOMAIN) return;
  const s = document.createElement('script');
  s.defer = true;
  s.setAttribute('data-domain', DATA_DOMAIN);
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
}
```

- [ ] **Step 6: Wire share + analytics + deep-link in `src/main.ts`**

Set `onShare` in the `mountUI` call:

```ts
  onShare: () => shareView(canvas, store.get().seat),
```

Add imports and, after the store is created, initialise analytics and handle a `?seat=` deep link:

```ts
import { shareView } from './share';
import { initAnalytics } from './analytics';

initAnalytics();

const wanted = new URL(location.href).searchParams.get('seat');
if (wanted && seatById.has(wanted)) {
  const seat = seatById.get(wanted)!;
  store.toSeat(seat, venue.zones.find((z) => z.id === seat.zoneId)!);
}
```

Remove the now-unused `void seatById;` line.

- [ ] **Step 7: Verify in browser**

Run: `npm run dev`
Expected: real stadium renders with seats aligned; Share downloads/shares a PNG and copies a `?seat=A-C-12` link; opening that link jumps straight to that seat. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: real glb model (draco), share, analytics, deep-links"
```

---

## Task 12: Performance pass + deploy

**Files:**
- Modify: `src/scene.ts` (if needed), `package.json` (already has build)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc` reports no type errors; Vite writes `dist/`. Fix any type errors surfaced.

Run: `npm run preview`
Expected: the built app serves and behaves like dev. Stop with Ctrl+C.

- [ ] **Step 2: Mobile performance check**

Open the preview URL in Chrome, run Lighthouse (mobile) or throttle CPU 4×.
Target: interactive orbit stays smooth; no long main-thread stalls on load.
If janky: confirm `devicePixelRatio` is capped at 2 (Task 3), lower crowd density in `stage-crowd.ts` (`i % 4`), and ensure the glb is decimated.

- [ ] **Step 3: Deploy**

Create the remote repo and push. Then on Vercel or Netlify: "New project" → import the repo → framework preset **Vite** (build `npm run build`, output `dist`). Deploy.

Verify: the public URL loads, orbit → zone → seat → first-person all work on a phone, and the ticket link opens.

- [ ] **Step 4: Commit any tuning**

```bash
git add -A
git commit -m "perf: cap DPR and crowd density; production build config"
```

---

## Self-Review Notes

**Spec coverage** — every spec section maps to a task:
- 3D shell from `.skp` → Tasks 4, 11. Instanced seats → Task 5. Picking → Task 7. POV + gyro → Task 10. Data model → Task 1. App flow (4 states) → Tasks 9, 10. Seat info (row/number, neighbours, nearest stair/aisle/exit, distance) → Tasks 6, 9. Tickets/share → Tasks 9, 11. TH/EN → Task 8. Monetization links → Task 1 (`ticketUrl`), 9. Legal/disclaimer → Tasks 8, 9. Cookieless analytics → Task 11. Performance → Tasks 3, 12. Testing → Tasks 2, 6. Deploy → Task 12.
- Tier B is intentionally out of scope (backlog in spec §8).

**Type consistency** — `Seat`, `Zone`, `SeatRules`, `Vec3`, `VenueData` defined once in Task 1 and used unchanged. `generateZoneSeats`/`generateAllSeats` (Task 2), `distanceToStage`/`angleToStage`/`nearest`/`neighborIds` (Task 6), `buildSeatMesh`→`setHighlight` (Task 5), `createPicker` (Task 7), `createStore` transitions (Task 9), `enterPov`/`exit` (Task 10) — names consistent across all references.

**Placeholder scan** — no TBD/TODO steps; the model fallback and empty `DATA_DOMAIN`/`onShare` stubs are deliberate, each resolved in a later task (11).
