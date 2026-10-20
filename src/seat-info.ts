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
