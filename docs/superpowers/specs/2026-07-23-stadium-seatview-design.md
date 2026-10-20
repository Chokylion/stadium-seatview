# Stadium Seat-View — Design Spec

- **Date:** 2026-07-23
- **Status:** Approved design (pre-implementation)
- **Working repo name:** `stadium-seatview` (branding TBD — must stay neutral, see Legal)

## 1. Summary

A free, browser-based web app where a fan can rotate a real 3D model of
Rajamangala National Stadium (ราชมังคลากีฬาสถาน), pick a concert zone, click an
actual-numbered seat, and drop into a live first-person 3D view from that seat —
looking around to judge the view of the stage before buying a ticket.

MVP covers **Rajamangala only**. It is a **static site, no backend**. Revenue is
indirect (outbound ticket links → sponsored placement → ads → later B2B).

## 2. Goals & non-goals

**Goals (v1 / Tier A)**
- Orbit the stadium in 3D (from the user's existing SketchUp model).
- Tinted, selectable concert zones.
- Real-numbered, clickable seats generated to a representative full-house layout.
- Live first-person view from a chosen seat (drag + phone gyro), seeing stage,
  screens, and a low-poly crowd at the seat's real height/angle.
- Seat context: row + seat number, neighbouring seats, nearest stair/aisle/exit,
  distance & angle to stage.
- Outbound "Get tickets" link and "Share your seat view".
- Thai/English, mobile-smooth (target 60fps), deployed on a real URL.

**Non-goals (v1)** — deliberately cut to ship fast:
- No accounts/login, no payments, no ticket sales by us.
- No per-event official seat maps (we ship one representative concert layout).
- No other venues.
- No premium tier / ads dashboard.
- Tier B decision-helpers (below) are the **next sprint**, not v1.

## 3. Users & positioning

Fan-facing preview tool. Free to use. It is *not* B2B, *not* a ticketing
platform, *not* just a portfolio piece (decided during brainstorming).

## 4. Monetization (honest)

Most Thai ticketing sites (Thaiticketmajor, ALL Ticket, TicketMelon, Eventpop)
do **not** run open affiliate programs, so:

1. **Outbound "Get tickets" links** — no payout yet; build traffic & goodwill.
2. **Sponsored event placement** — a promoter pays to feature their concert
   (realistic first revenue, once traffic exists).
3. **Display ads** (e.g. AdSense) — only worthwhile after traffic.
4. **Later (Tier C):** embeddable widget sold to promoters = B2B recurring.

The **Share** feature is the growth engine; the strategy is ship free → ride
concert hype → monetize with sponsors/ads.

## 5. Architecture

Everything runs client-side. No backend in v1.

**Build-time (once):**
- `rajamangala_stadium.skp` (1.64 MB, SketchUp 2021) → convert → `stadium.glb`
  (Draco-compressed shell). Conversion via SketchUp export → Blender → glTF; may
  test a second tool to get a clean, light mesh. Decimate for web.
- Author `rajamangala.json` (zones + seat-generation rules).

**Runtime (static site, Vite + three.js, vanilla TS):**
- **Stadium shell** — the `.glb`, static mesh.
- **Instanced seats** — one seat geometry × ~50k `THREE.InstancedMesh`
  instances, positioned from config, tinted per zone. This is what keeps 50k
  seats fast on mobile.
- **Picking** — raycast against the instanced mesh → `instanceId` → seat.
  Fallback to GPU colour-picking if raycast is too slow.
- **POV camera** — moves to the seat instance's world position + eye height;
  look-around via OrbitControls (rotation only) + `DeviceOrientation` for gyro.
- **DOM overlay** — zone list, seat info card, TH/EN toggle, ticket/share buttons,
  disclaimer footer.
- **LOD** — distance view shows tinted zones on the shell; selecting a
  zone/zooming sharpens its seats. Stage + crowd kept low-poly.

**Deploy:** `git push` → Vercel/Netlify auto-build → global CDN, free tier.

## 6. Data model — `rajamangala.json`

One file drives content; seats are generated from rules (tiny file, no 50k rows).

```jsonc
{
  "venue": { "name": {"th":"ราชมังคลากีฬาสถาน","en":"Rajamangala"},
             "model": "stadium.glb", "capacityConcert": 65000 },
  "stage": { "position": [0, 0, -40], "facing": [0, 0, 1] },
  "zones": [
    {
      "id": "A",
      "name": { "th": "โซน A", "en": "Zone A" },
      "color": "#0071e3",
      "tier": "lower",
      "ticketUrl": "https://ticket-site/event?zone=A",
      "priceBand": "VIP",              // used in Tier B
      "seatRules": {
        "rows": ["A","B","…","Z"], "seatsPerRow": 42,
        "curveRadius": 78, "rowRise": 0.45, "rowDepth": 0.85,
        "originAngle": 12, "eyeHeight": 1.15,
        "aisles": [10, 32], "stairs": [/*…*/], "exits": [/*…*/]
      }
    }
    // … more zones …
  ]
}
```

- Each seat gets a stable id `zone-row-number`, e.g. `A-M-12` → real numbering
  and pattern.
- Rule numbers are **tuned** so generated seats sit on the model's real stands
  (a calibration step, not guessed once).
- Adding zones or a future venue = edit JSON, no code changes.

## 7. App flow — one page, four states

1. **Overview / Orbit** — whole stadium, zones tinted, gentle auto-spin. UI:
   venue+event title, "tap a zone", TH/EN. Drag to orbit, scroll to zoom.
2. **Zone selected** — camera eases toward the zone, seats sharpen. Panel: zone
   name, rows, seat count. Buttons: back · pick a seat.
3. **Seat selected** — seat + neighbours highlight. Card: row+number, seats
   around, nearest stair/aisle/exit, distance & angle to stage. Buttons: enter
   view · get tickets · share.
4. **First-person view** — camera at seat eye-height, look around (drag/gyro),
   stage + screens + low-poly crowd. Buttons: back · re-center · share view ·
   get tickets.

Global UI: header (venue + event, TH/EN), footer (disclaimers).

## 8. Tier B backlog (next sprint, not v1)

Seat "view score" (distance/angle/obstruction) · "can you see the big screen?"
indicator · open-air sun/shade & roof-coverage note (Rajamangala is uncovered) ·
price-band colour overlay · compare two seats · amenities near seat (restrooms,
entrance, parking gate, accessible seats).

## 9. Tech stack

- **Vite** + **three.js** + **vanilla TypeScript** (no heavy framework — one 3D
  canvas + thin DOM overlay).
- Draco loader/compression, `InstancedMesh`, `OrbitControls`,
  `DeviceOrientationControls` (or minimal custom gyro).
- Cookieless analytics (e.g. Plausible/GoatCounter/Vercel) → avoids PDPA consent
  banners.
- Static hosting: Vercel or Netlify.

## 10. Performance targets

- 60fps orbit on a mid-range phone; ~50k seats via instancing.
- `stadium.glb` kept to a few MB after Draco + decimation.
- Cap devicePixelRatio on mobile; frustum culling (three.js default); lazy seat
  detail via LOD.

## 11. Legal & trust (non-negotiable, small)

- Disclaimer: "Views are approximate; not affiliated with the stadium,
  promoters, or artists."
- State clearly we don't sell tickets — we link out.
- No official logos/marks or artist imagery. Neutral branding.
- Cookieless analytics; affiliate/outbound disclosure.

## 12. Testing / verification

- **Automated:** a small unit test on the seat-generation math — correct seat
  count per zone, stable unique IDs, all generated seats within the bowl bounds.
- **Manual:** click-through QA on desktop + phone; Lighthouse pass for
  mobile-data load speed.

## 13. Risks & mitigations

- **.skp → .glb conversion** may need 2 tool attempts → budget time; keep the
  shell simple.
- **Seat rules vs real bowl** — calibration required so seats align to the
  model's stands.
- **Raycast on 50k instances** — GPU colour-pick fallback if slow.
- **Model may lack detailed stands** — seats are procedural anyway; the model
  only needs to give shape, scale, and the bowl surface to sit seats on.

## 14. Open questions (resolve during planning)

- Exact number of zones and rough seats/zone for the representative layout.
- Which upcoming/real concert (if any) to seed as the demo event + ticket link.
- Product/brand name and domain.
- Repo location (default: `C:\Users\KWatamat\Desktop\stadium-seatview`).
