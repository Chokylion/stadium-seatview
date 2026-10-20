# Rajamangala Seat View

Interactive 3D seat-view preview for **สนามกีฬาราชมังคลากีฬาสถาน (Rajamangala National Stadium)**.
Orbit the stadium → pick a zone → click a real-numbered seat → drop into a first-person
view from that seat (look around, see the stage/screens/crowd, nearest stair & exit).

Static single-page app: **Vite + TypeScript + three.js**, no backend. Bilingual **TH/EN**.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (seat generation + seat-info math)
npm run build      # tsc typecheck + production build to dist/
npm run preview    # serve the production build
```

## How it works

- **Stadium shell** — `public/stadium.glb` loaded with Draco. If the file is missing,
  a placeholder bowl is shown so development is never blocked (`src/model.ts`).
- **Seats** — generated procedurally from `public/data/rajamangala.json` onto concentric
  arcs around the stage, rendered as one `THREE.InstancedMesh` (handles tens of thousands
  of seats). Edit the JSON to change zones, seat counts, colours, ticket links, stairs/exits.
- **Flow** — a small state machine (`src/state.ts`): `overview → zone → seat → pov`.
- **Share** — snapshots the canvas and copies a deep link like `?seat=A-C-12` that reopens
  straight into that seat.

## Two manual steps before going live

These need desktop GUI tools / an account, so they are **not** automated here:

1. **Convert the model** `.skp → public/stadium.glb`
   - SketchUp: export the stadium as `.dae` (Collada).
   - Blender: import the `.dae`, delete interior geometry not visible from the stands,
     decimate heavy meshes, then export `.glb` **with Draco compression** to
     `public/stadium.glb` (aim for a few MB). Do **not** commit the source `.skp`.
   - **Calibrate** each zone in `public/data/rajamangala.json`
     (`curveRadius`, `rowDepth`, `rowRise`, `baseHeight`, `arcStartDeg`, `arcEndDeg`,
     and the venue `stage.position`) until seats sit on the model's stands.
     Vite hot-reloads the JSON on save.

2. **Deploy** — push to a Git remote, then import the repo on **Vercel** or **Netlify**
   (framework preset **Vite**, build `npm run build`, output `dist`).

## Monetization & legal

- `ticketUrl` per zone (in the JSON) drives the outbound **Get tickets** button.
- Analytics is cookieless (`src/analytics.ts`) — set `DATA_DOMAIN` at deploy time; no PDPA
  consent banner required. No cookies, no personal data collected.
- A disclaimer is always shown: views are approximate and the site is not affiliated with
  the stadium, promoters, or artists.

## Performance knobs

- Device pixel ratio is capped at 2 (`src/scene.ts`).
- Crowd density is 1/3 of seats (`src/stage-crowd.ts`, `i % 3`) — raise to `i % 4` if a
  low-end phone is janky. Make sure the exported `.glb` is decimated.
