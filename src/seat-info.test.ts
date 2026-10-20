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
