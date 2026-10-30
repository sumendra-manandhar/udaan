import type { Airport } from '../db/types';

/** Bundled so the airport check works on first launch, before any sync.
 * The database list (synced to the device) replaces this once available.
 * NOT a complete list of Nepal's aerodromes: complete it from AIP Nepal. */
export const BUNDLED_AIRPORTS: Airport[] = [
  {
    id: 'bundled-vnkt',
    name: 'Tribhuvan International Airport',
    icao: 'VNKT',
    lat: 27.6966,
    lng: 85.3591,
    radius_m: 5000,
    verified: false,
  },
];
