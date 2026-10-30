import { Link } from 'react-router-dom';
import type { Airport } from '../db/types';
import { checkAirportRings, formatDistance } from '../lib/geo';
import { Icon } from './Icon';

/** The "before you fly" box. Honest about how complete the airport list is. */
export function RingStatus({ lat, lng, airports, title = 'Before you fly' }: { lat: number; lng: number; airports: Airport[]; title?: string }) {
  const ring = checkAirportRings(lat, lng, airports);
  const unverified = airports.some((a) => !a.verified);
  return (
    <div className="card stack" role="status">
      <p className="small" style={{ fontWeight: 600 }}>{title}</p>
      {ring.inside ? (
        <p className="status-line bad">
          <Icon name="alert" size={16} strokeWidth={2.2} /> Inside the {formatDistance(ring.inside.radius_m)} ring of {ring.inside.name}. Do not fly here.
        </p>
      ) : (
        <p className="status-line good">
          <Icon name="check" size={16} strokeWidth={2.2} /> Outside known airport rings
          {ring.nearest && ` (${formatDistance(ring.nearest.distanceM)} from ${ring.nearest.airport.icao ?? ring.nearest.airport.name})`}
        </p>
      )}
      <p className="status-line warn">
        <Icon name="alert" size={16} strokeWidth={2.2} /> District approval may be needed for drones up to 2 kg.
      </p>
      {unverified && (
        <p className="tiny faint">
          Udaan knows {ring.airportsKnown} airport{ring.airportsKnown === 1 ? '' : 's'} so far; this list is not complete. Check official notices too.
        </p>
      )}
      <Link className="link small" to="/permits">Open permit checklist →</Link>
    </div>
  );
}
