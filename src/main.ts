import { createScene } from './scene';
import { loadStadium } from './model';
import { loadVenue, stageVec } from './venue';
import { generateAllSeats } from './seats';
import { buildSeatMesh } from './seatmesh';
import { createPicker } from './picking';
import { createStore } from './state';
import { mountUI } from './ui';
import { buildStage, buildCrowd, buildWalkways } from './stage-crowd';
import { enterPov, type PovController } from './pov';
import { mountViewCube } from './views';
import { shareView } from './share';
import { initAnalytics } from './analytics';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const ctx = createScene(canvas);

ctx.scene.add(await loadStadium());

const venue = await loadVenue();
const stage = stageVec(venue);
const seats = generateAllSeats(venue.zones);
const seatMesh = buildSeatMesh(seats, new Map(venue.zones.map((z) => [z.id, z.color])));
ctx.scene.add(seatMesh.mesh);
ctx.scene.add(buildStage(stage));
ctx.scene.add(buildWalkways());
ctx.scene.add(buildCrowd(seats));

const seatById = new Map(seats.map((s) => [s.id, s]));
const store = createStore();

initAnalytics();

let viewbox: { render(): void } | undefined;

mountUI(overlay, store, venue, stage, {
  onZone: (z) => store.toZone(z),
  onEnterView: () => store.toPov(),
  onShare: () => shareView(canvas, store.get().seat),
  onLangChange: () => viewbox?.render(),
});

viewbox = mountViewCube(overlay, ctx.camera, ctx.controls, store, ctx.onFrame);

let pov: PovController | null = null;
store.subscribe((s) => {
  if (s.view === 'pov' && s.seat && !pov) {
    pov = enterPov(ctx.camera, ctx.controls, s.seat, stage);
  } else if (s.view !== 'pov' && pov) {
    pov.exit();
    pov = null;
  }
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

const wanted = new URL(location.href).searchParams.get('seat');
if (wanted && seatById.has(wanted)) {
  const seat = seatById.get(wanted)!;
  store.toSeat(seat, venue.zones.find((z) => z.id === seat.zoneId)!);
}