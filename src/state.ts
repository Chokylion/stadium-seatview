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
