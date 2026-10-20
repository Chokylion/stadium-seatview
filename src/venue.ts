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
