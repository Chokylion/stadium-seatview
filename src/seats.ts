import type { Zone, Seat, BowlRules, FloorRules } from './types';

const DEG = Math.PI / 180;

// ponytail: a vomitory aisle every AISLE_EVERY seats plus one at each block
// edge, so every stand reads with real vertical walkways/stairs and adjacent
// stands are visually separated. Aisle seats are flagged, not deleted (ids and
// counts stay stable); the mesh renders them as an empty gap. Tune AISLE_EVERY.
const AISLE_EVERY = 16;
function isAisle(number: number, seatsPerRow: number): boolean {
  return (
    number === 1 ||
    number === seatsPerRow ||
    (number - 1) % AISLE_EVERY === Math.floor(AISLE_EVERY / 2)
  );
}

// ponytail: seats spread by equal angle across the sector, so on the long
// ellipse axis they bunch slightly. Fine visually; switch to arc-length
// stepping only if a stand looks uneven.
function bowlSeats(zone: Zone, r: BowlRules): Seat[] {
  const seats: Seat[] = [];
  const start = r.angleStartDeg * DEG;
  const span = (r.angleEndDeg - r.angleStartDeg) * DEG;

  for (let ri = 0; ri < r.rowCount; ri++) {
    const row = String(ri + 1);
    const rx = r.innerRadiusX + ri * r.rowDepth;
    const rz = r.innerRadiusZ + ri * r.rowDepth;
    const y = r.baseHeight + ri * r.rowRise;
    for (let si = 0; si < r.seatsPerRow; si++) {
      const t = r.seatsPerRow === 1 ? 0.5 : si / (r.seatsPerRow - 1);
      const ang = start + t * span;
      const number = si + 1;
      seats.push({
        id: `${zone.id}-${row}-${number}`,
        zoneId: zone.id,
        row,
        number,
        position: { x: rx * Math.cos(ang), y, z: rz * Math.sin(ang) },
        eyeHeight: r.eyeHeight,
        aisle: isAisle(number, r.seatsPerRow),
      });
    }
  }
  return seats;
}

function floorSeats(zone: Zone, r: FloorRules): Seat[] {
  const seats: Seat[] = [];
  for (let ri = 0; ri < r.rowCount; ri++) {
    const row = String(ri + 1);
    const z = r.originZ + r.dirZ * ri * r.rowGap;
    const y = r.baseHeight + ri * r.rowRise;
    for (let si = 0; si < r.seatsPerRow; si++) {
      const t = r.seatsPerRow === 1 ? 0.5 : si / (r.seatsPerRow - 1);
      const number = si + 1;
      seats.push({
        id: `${zone.id}-${row}-${number}`,
        zoneId: zone.id,
        row,
        number,
        position: { x: (r.centerX ?? 0) - r.width / 2 + t * r.width, y, z },
        eyeHeight: r.eyeHeight,
        aisle: isAisle(number, r.seatsPerRow),
      });
    }
  }
  return seats;
}

export function generateZoneSeats(zone: Zone): Seat[] {
  return zone.seatRules.shape === 'bowl'
    ? bowlSeats(zone, zone.seatRules)
    : floorSeats(zone, zone.seatRules);
}

export function generateAllSeats(zones: Zone[]): Seat[] {
  return zones.flatMap(generateZoneSeats);
}
