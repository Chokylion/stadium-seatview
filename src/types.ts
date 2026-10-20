export interface LocalizedName { th: string; en: string; }
export interface Vec3 { x: number; y: number; z: number; }

// Angles are measured around the field centre (0,0,0), looking down the +Y axis:
// 0deg = +X (East side), 90deg = +Z (North end), 180deg = -X (West side),
// 270deg = -Z (South end). The whole bowl is one ellipse; each stand is an
// angular sector of it, and each tier is a band of rows.
export interface BowlRules {
  shape: 'bowl';
  rowCount: number;        // number of rows, inner (nearest pitch) -> outer
  seatsPerRow: number;
  angleStartDeg: number;   // sector start around field centre
  angleEndDeg: number;     // sector end
  innerRadiusX: number;    // ellipse semi-axis on X at the first row (m)
  innerRadiusZ: number;    // ellipse semi-axis on Z at the first row (m)
  rowDepth: number;        // radial growth per row (m)
  rowRise: number;         // height gain per row (m)
  baseHeight: number;      // height of the first row above the pitch (m)
  eyeHeight: number;       // seated eye height above the seat (m)
  aisles: number[];
  stairs: number[];
  exits: number[];
}

// Flat seated/standing block on the pitch, rows running away from the stage.
export interface FloorRules {
  shape: 'floor';
  rowCount: number;
  seatsPerRow: number;
  originZ: number;         // Z of the first (nearest-stage) row (m)
  dirZ: 1 | -1;            // direction rows advance (away from the stage)
  centerX?: number;        // X centre of the block (m); default 0
  width: number;           // total width across X (m)
  rowGap: number;          // Z gap between rows (m)
  rowRise: number;         // height gain per row (m); ~0 for a flat pitch
  baseHeight: number;
  eyeHeight: number;
  aisles: number[];
  stairs: number[];
  exits: number[];
}

export type SeatRules = BowlRules | FloorRules;

export interface Zone {
  id: string;
  name: LocalizedName;
  color: string;         // hex, e.g. "#0071e3"
  tier: string;          // "lower" | "upper" | "floor"
  ticketUrl: string;     // outbound link
  priceBand?: string;
  priceTHB?: number;     // ticket price in Thai baht
  seatRules: SeatRules;
}

export interface VenueData {
  venue: { name: LocalizedName; model: string; capacityConcert: number };
  stage: { position: [number, number, number]; facing: [number, number, number] };
  zones: Zone[];
}

export interface Seat {
  id: string;            // `${zoneId}-${row}-${number}`
  zoneId: string;
  row: string;
  number: number;        // 1-based
  position: Vec3;        // seat base (world)
  eyeHeight: number;
  aisle?: boolean;       // true = an aisle gap (rendered empty, not a real seat)
}
