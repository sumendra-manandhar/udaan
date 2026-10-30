import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { Chips, DateChip, Media, TabBar } from '../components/ui';
import { db } from '../db/db';
import type { SpotType } from '../db/types';
import { useAirports } from '../hooks/useApp';
import { checkAirportRings, distanceM, formatDistance } from '../lib/geo';

export const SPOT_TYPES: { value: SpotType; label: string }[] = [
  { value: 'ridge', label: 'Ridge' },
  { value: 'lake', label: 'Lake' },
  { value: 'field', label: 'Field' },
  { value: 'track', label: 'Track' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'other', label: 'Other' },
];

type Filter = 'all' | SpotType;

export function MapHome() {
  const navigate = useNavigate();
  const airports = useAirports();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<[number, number]>([85.324, 27.7172]);
  const [selected, setSelected] = useState<string | null>(null);

  const loadedSpots = useLiveQuery(() => db.spots.toArray(), []);
  const spots = useMemo(() => loadedSpots ?? [], [loadedSpots]);
  const nextEvent = useLiveQuery(
    () => db.events.where('starts_at').aboveOrEqual(new Date().toISOString()).first(),
    [],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots
      .filter((s) => !s.deleted_at && (filter === 'all' || s.type === filter) && (!q || s.name.toLowerCase().includes(q)))
      .map((s) => ({ spot: s, d: distanceM(center[1], center[0], s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d);
  }, [spots, filter, query, center]);

  const onMove = useCallback((c: [number, number]) => setCenter(c), []);
  const onSelect = useCallback((id: string) => setSelected(id), []);

  return (
    <div className="map-screen">
      <MapView
        spots={visible.map((v) => v.spot)}
        selectedId={selected}
        onSelect={(id) => (id === selected ? navigate(`/spots/${id}`) : onSelect(id))}
        airports={airports}
        onMove={onMove}
        locate
      />

      <div className="map-overlay-top">
        <div className="row">
          <label htmlFor="search" className="sr-only">Search spots</label>
          <input
            id="search"
            type="search"
            className="input glass grow"
            placeholder="Search spots in Nepal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link to="/permits" className="icon-btn glass" aria-label="Permit checklist" style={{ borderRadius: 14, width: 48, height: 48 }}>
            <Icon name="shield" />
          </Link>
        </div>
        <Chips
          label="Filter spots"
          scroll
          options={[{ value: 'all' as Filter, label: 'All' }, ...SPOT_TYPES]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
        {nextEvent && (
          <Link to={`/events/${nextEvent.id}`} className="glass row" style={{ alignSelf: 'flex-start', padding: '6px 12px 6px 6px', borderRadius: 12 }}>
            <DateChip iso={nextEvent.starts_at} hot />
            <span className="stack" style={{ gap: 0 }}>
              <span className="tiny muted">Next event</span>
              <span className="small" style={{ fontWeight: 600 }}>{nextEvent.title}</span>
            </span>
          </Link>
        )}
      </div>

      <div className="sheet-wrap">
      <button type="button" className="fab" aria-label="Add a spot" onClick={() => navigate('/spots/new')}>
        <Icon name="plus" size={24} strokeWidth={2.2} />
      </button>
      <section className="sheet" aria-label="Spots near the map centre">
        <span className="handle" aria-hidden="true" />
        <div className="row between">
          <h2>Near here</h2>
          <span className="small muted">{visible.length} spots</span>
        </div>
        {visible.length === 0 && (
          <p className="small muted">
            No spots here yet. {spots.length === 0 ? 'Connect once to download spots, or add the first one.' : 'Try another filter, or add one.'}
          </p>
        )}
        {visible.slice(0, 20).map(({ spot, d }) => {
          const ring = checkAirportRings(spot.lat, spot.lng, airports);
          return (
            <Link key={spot.id} to={`/spots/${spot.id}`} className={`list-card${spot.id === selected ? ' card accent' : ''}`}>
              <Media media={spot.media[0]} className="thumb" />
              <span className="stack grow" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{spot.name}</span>
                <span className="small muted">
                  {SPOT_TYPES.find((t) => t.value === spot.type)?.label} · {formatDistance(d)}
                  {spot.status !== 'approved' && ' · in review'}
                </span>
                {ring.inside ? (
                  <span className="status-line bad tiny"><span className="dot" />Inside an airport ring</span>
                ) : (
                  <span className="status-line good tiny"><span className="dot" />Outside known airport rings</span>
                )}
              </span>
            </Link>
          );
        })}
      </section>
      </div>
      <TabBar />
    </div>
  );
}
