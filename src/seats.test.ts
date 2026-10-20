import { describe, it, expect } from 'vitest';
import { generateZoneSeats } from './seats';
import type { Zone } from './types';

const bowlZone: Zone = {
  id: 'E1', name: { th: 'ทิศตะวันออก', en: 'East' }, color: '#0071e3',
  tier: 'lower', ticketUrl: 'https://x',
  seatRules: {
    shape: 'bowl',
    rowCount: 3, seatsPerRow: 10,
    angleStartDeg: -40, angleEndDeg: 40,
    innerRadiusX: 50, innerRadiusZ: 92, rowDepth: 0.8,
    rowRise: 0.5, baseHeight: 2, eyeHeight: 1.15,
    aisles: [1, 10], stairs: [1], exits: [10],
  },
};

const floorZone: Zone = {
  id: 'PIT', name: { th: 'สนามยืน', en: 'Pitch' }, color: '#ff375f',
  tier: 'floor', ticketUrl: 'https://x',
  seatRules: {
    shape: 'floor',
    rowCount: 3, seatsPerRow: 8,
    originZ: -55, dirZ: 1, width: 70, rowGap: 1.2,
    rowRise: 0, baseHeight: 0.2, eyeHeight: 1.15,
    aisles: [1, 8], stairs: [1], exits: [8],
  },
};

describe('bowl seat generation', () => {
  const seats = generateZoneSeats(bowlZone);

  it('produces rows * seatsPerRow seats with unique ids', () => {
    expect(seats.length).toBe(3 * 10);
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    expect(seats[0].id).toBe('E1-1-1');
    expect(seats.at(-1)!.id).toBe('E1-3-10');
  });

  it('lays seats on the ellipse (x/50, z/92 on the unit circle for row 1)', () => {
    for (const s of seats.filter((s) => s.row === '1')) {
      const u = Math.hypot(s.position.x / 50, s.position.z / 92);
      expect(u).toBeCloseTo(1, 6);
    }
  });

  it('raises and pushes out each successive row', () => {
    const a = seats.find((s) => s.row === '1')!;
    const c = seats.find((s) => s.row === '3')!;
    expect(c.position.y).toBeGreaterThan(a.position.y);
    expect(Math.hypot(c.position.x, c.position.z)).toBeGreaterThan(Math.hypot(a.position.x, a.position.z));
  });

  it('flags block-edge and interval seats as aisle gaps', () => {
    const row1 = seats.filter((s) => s.row === '1');
    expect(row1.find((s) => s.number === 1)!.aisle).toBe(true);
    expect(row1.find((s) => s.number === 10)!.aisle).toBe(true);
    expect(row1.some((s) => !s.aisle)).toBe(true); // not everything is an aisle
  });
});

describe('floor seat generation', () => {
  const seats = generateZoneSeats(floorZone);

  it('produces a flat grid within the width, advancing in Z', () => {
    expect(seats.length).toBe(3 * 8);
    for (const s of seats) {
      expect(Math.abs(s.position.x)).toBeLessThanOrEqual(35 + 1e-6);
      expect(s.position.y).toBeCloseTo(0.2, 6); // flat
    }
    const r1 = seats.find((s) => s.row === '1')!;
    const r3 = seats.find((s) => s.row === '3')!;
    expect(r3.position.z).toBeGreaterThan(r1.position.z);
  });
});
