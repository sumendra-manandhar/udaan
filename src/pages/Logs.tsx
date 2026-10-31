import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Media, SignInPrompt, TabBar, formatDuration } from '../components/ui';
import { db } from '../db/db';
import type { TrackPoint } from '../db/types';
import { PLATFORM_SHORT } from '../lib/social';
import { useAuth } from '../hooks/auth';

function MiniTrack({ track }: { track: TrackPoint[] }) {
  if (track.length < 2) return <span className="thumb" />;
  const xs = track.map((p) => p[0]);
  const ys = track.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = 48 / (maxX - minX || 1);
  const sy = 36 / (maxY - minY || 1);
  const s = Math.min(sx, sy);
  const d = track.map((p, i) => `${i ? 'L' : 'M'}${(4 + (p[0] - minX) * s).toFixed(1)} ${(40 - (p[1] - minY) * s).toFixed(1)}`).join(' ');
  return (
    <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true" style={{ flex: 'none', borderRadius: 8, background: 'var(--map-bg)' }}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logs() {
  const { userId } = useAuth();
  const flights = useLiveQuery(() => (userId ? db.flights.where('pilot_id').equals(userId).reverse().sortBy('flown_at') : []), [userId]) ?? [];
  const spots = useLiveQuery(async () => new Map((await db.spots.toArray()).map((s) => [s.id, s.name])), []);
  const airtime = flights.reduce((a, f) => a + (f.duration_s ?? 0), 0);
  const places = new Set(flights.map((f) => f.spot_id).filter(Boolean)).size;

  return (
    <main className="screen">
      <h1>Flight logs</h1>
      {!userId ? (
        <SignInPrompt what="keep your flight logs" />
      ) : (
        <>
          <Link to="/logs/upload" className="card row" style={{ borderStyle: 'dashed', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
            <span className="icon-btn" style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 12 }}><Icon name="upload" /></span>
            <span className="stack" style={{ gap: 0 }}>
              <b>Log a flight</b>
              <span className="small muted">Photos, clips, Instagram/YouTube links or a GPS log</span>
            </span>
          </Link>
          <div className="grid-3">
            <div className="stat"><b>{flights.length}</b><span>Flights</span></div>
            <div className="stat"><b>{(airtime / 3600).toFixed(1)} h</b><span>Air time</span></div>
            <div className="stat"><b>{places}</b><span>Spots</span></div>
          </div>
          <h2>Recent</h2>
          {flights.length === 0 && <Empty>No flights yet. Log one with your clips and photos, or a GPS log to replay it on the map.</Empty>}
          {flights.map((f) => (
            <Link key={f.id} to={`/logs/${f.id}`} className="list-card">
              {f.track.length < 2 && !f.media?.[0] && f.links?.[0] ? (
                <span className={`platform-badge platform-${f.links[0].platform}`} style={{ width: 56, height: 44, borderRadius: 8 }} aria-hidden="true">{PLATFORM_SHORT[f.links[0].platform]}</span>
              ) : f.track.length < 2 && f.media?.[0] ? (
                <span className="thumb" style={{ width: 56, height: 44, borderRadius: 8, position: 'relative' }}>
                  <Media media={f.media[0]} thumb className="thumb-fill" />
                </span>
              ) : (
                <MiniTrack track={f.track} />
              )}
              <span className="stack grow" style={{ gap: 0 }}>
                <b>{f.title}</b>
                <span className="small muted">
                  {(f.spot_id && spots?.get(f.spot_id)) || 'No spot'} · {f.flown_at ? new Date(f.flown_at).toLocaleDateString() : 'date unknown'}{f.duration_s ? ` · ${formatDuration(f.duration_s)}` : ''}{f.media?.length ? ` · ${f.media.length} ${f.media.length === 1 ? 'clip/photo' : 'clips/photos'}` : ''}{f.links?.length ? ` · ${f.links.length} post${f.links.length === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <span className="muted" aria-hidden="true">›</span>
            </Link>
          ))}
        </>
      )}
      <TabBar />
    </main>
  );
}
