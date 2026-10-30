import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { RingStatus } from '../components/RingStatus';
import { Avatar, BackButton, Empty, Media, formatDuration } from '../components/ui';
import { db } from '../db/db';
import { useAuth } from '../hooks/auth';
import { useAirports } from '../hooks/useApp';
import { deleteRow } from '../sync/mutate';
import { SPOT_TYPES } from './MapHome';

export function SpotDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const airports = useAirports();
  const spot = useLiveQuery(() => db.spots.get(id), [id]);
  const author = useLiveQuery(() => (spot ? db.profiles.get(spot.created_by) : undefined), [spot?.created_by]);
  const flights = useLiveQuery(() => db.flights.where('spot_id').equals(id).reverse().sortBy('flown_at'), [id]) ?? [];
  const pilots = useLiveQuery(async () => {
    const ids = [...new Set(flights.map((f) => f.pilot_id))];
    return (await db.profiles.bulkGet(ids)).filter(Boolean);
  }, [flights]);

  if (spot === undefined) return <main className="screen"><BackButton /><Empty>Spot not found on this device. It may not have synced yet.</Empty></main>;
  const mine = spot.created_by === userId;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  return (
    <main className="screen no-tabs">
      <div className="cover">
        <Media media={spot.media[0]} alt={spot.name} />
        <div style={{ position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
          <BackButton glass />
        </div>
        {mine && (
          <Link to={`/spots/${spot.id}/edit`} className="btn small glass" style={{ position: 'absolute', right: 16, top: 'calc(18px + env(safe-area-inset-top, 0px))' }}>
            Edit
          </Link>
        )}
      </div>

      <div>
        <h1>{spot.name}</h1>
        <p className="small muted" style={{ marginTop: 4 }}>
          Added by {author ? <Link className="link" to={`/pilots/${author.username}`}>@{author.username}</Link> : 'a pilot'}
          {spot.status === 'pending' && ' · waiting for review'}
          {spot.status === 'rejected' && ' · not approved'}
          {spot.is_private && ' · private'}
        </p>
      </div>
      <div className="chips">
        <span className="tag">{SPOT_TYPES.find((t) => t.value === spot.type)?.label}</span>
        {spot.best_time && <span className="tag">{spot.best_time}</span>}
      </div>

      <RingStatus lat={spot.lat} lng={spot.lng} airports={airports} />

      {spot.notes && <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{spot.notes}</p>}

      {spot.media.length > 1 && (
        <div className="media-strip">
          {spot.media.slice(1).map((m) => (
            <Media key={m.path} media={m} />
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="stat"><b>{flights.length}</b><span>Flights logged</span></div>
        <div className="stat"><b>{pilots?.length ?? 0}</b><span>Pilots</span></div>
      </div>

      {pilots && pilots.length > 0 && (
        <section className="stack">
          <h2>Pilots who fly here</h2>
          <div className="row wrap">
            {pilots.map((p) => (
              <Link key={p!.id} to={`/pilots/${p!.username}`} className="stack center tiny" style={{ gap: 4, alignItems: 'center' }}>
                <Avatar profile={p} />@{p!.username}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Recent flights here</h2>
        {flights.length === 0 && <p className="small muted">No flights logged here yet.</p>}
        {flights.slice(0, 5).map((f) => (
          <Link key={f.id} to={`/logs/${f.id}`} className="list-card between">
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 600 }}>{f.title}</span>
              <span className="small muted">
                {f.flown_at ? new Date(f.flown_at).toLocaleDateString() : 'Date unknown'} · {formatDuration(f.duration_s)}
              </span>
            </span>
            <span className="link small">Replay →</span>
          </Link>
        ))}
      </section>

      {mine && (
        <button
          type="button"
          className="btn danger"
          onClick={async () => {
            if (!confirm('Delete this spot for everyone?')) return;
            await deleteRow('spots', spot.id);
            navigate('/', { replace: true });
          }}
        >
          <Icon name="trash" size={18} /> Delete spot
        </button>
      )}

      <div className="action-bar">
        <a className="btn grow" href={directions} target="_blank" rel="noreferrer">Directions</a>
        <Link className="btn primary grow" to={`/logs/upload?spot=${spot.id}`}>Log a flight</Link>
      </div>
    </main>
  );
}
