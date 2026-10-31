import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { MediaGrid } from '../components/MediaGrid';
import { BackButton, Empty, Media, Sparkline, formatDuration } from '../components/ui';
import { db } from '../db/db';
import type { Flight } from '../db/types';
import { useAuth } from '../hooks/auth';
import { formatDistance } from '../lib/geo';
import { deleteRow } from '../sync/mutate';

function toGpx(f: Flight): string {
  const start = f.flown_at ? Date.parse(f.flown_at) : Date.now();
  const pts = f.track
    .map(([lng, lat, alt, t]) => `<trkpt lat="${lat}" lon="${lng}"><ele>${alt}</ele><time>${new Date(start + t * 1000).toISOString()}</time></trkpt>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Udaan" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${f.title.replace(/[<&]/g, '')}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

export function FlightReplay() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const flight = useLiveQuery(() => db.flights.get(id), [id]);
  const spot = useLiveQuery(() => (flight?.spot_id ? db.spots.get(flight.spot_id) : undefined), [flight?.spot_id]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || !flight) return;
    const t = setInterval(() => {
      setCursor((c) => {
        if (c >= flight.track.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + Math.max(1, Math.round(flight.track.length / 300));
      });
    }, 50);
    return () => clearInterval(t);
  }, [playing, flight]);

  if (!flight) return <main className="screen"><BackButton /><Empty>Flight not found on this device.</Empty></main>;
  const hasTrack = flight.track.length >= 2;
  const media = flight.media ?? [];
  const p = hasTrack ? flight.track[Math.min(cursor, flight.track.length - 1)] : null;
  const alt0 = flight.track[0]?.[2] ?? 0;

  function download() {
    const url = URL.createObjectURL(new Blob([toGpx(flight!)], { type: 'application/gpx+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flight!.title.replace(/[^\w-]+/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    const stats = flight!.distance_m ? `: ${formatDistance(flight!.distance_m)} in ${formatDuration(flight!.duration_s)}` : '';
    const text = `${flight!.title}${stats}${spot ? ` at ${spot.name}` : ''} · logged on Udaan`;
    if (navigator.share) await navigator.share({ title: flight!.title, text, url: location.href }).catch(() => undefined);
    else await navigator.clipboard.writeText(`${text} ${location.href}`);
  }

  return (
    <main className="screen no-tabs" style={{ paddingTop: 0 }}>
      {hasTrack && p ? (
        <>
          <div className="map-box" style={{ height: 380, margin: '0 -20px', borderRadius: 0, border: 'none' }}>
            <MapView className="map-fill" track={flight.track} cursor={cursor} zoom={13} center={[flight.track[0][0], flight.track[0][1]]} />
            <div style={{ position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))', zIndex: 4 }}><BackButton glass to="/logs" /></div>
            <div className="row between mono tiny glass" style={{ position: 'absolute', left: 12, right: 12, bottom: 28, padding: '6px 10px', borderRadius: 8, zIndex: 4 }}>
              <span>ALT {Math.round(p[2] - alt0)} m</span>
              <span>T {formatDuration(p[3])}</span>
              {flight.series.vbat && <span>BAT {flight.series.vbat[Math.round((cursor / flight.track.length) * flight.series.vbat.length)]?.toFixed(1) ?? '–'} V</span>}
            </div>
          </div>

          <div className="row">
            <button type="button" className="icon-btn" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }} aria-label={playing ? 'Pause' : 'Play'} onClick={() => {
              if (cursor >= flight.track.length - 1) setCursor(0);
              setPlaying(!playing);
            }}>
              <Icon name={playing ? 'pause' : 'play'} />
            </button>
            <label htmlFor="scrub" className="sr-only">Replay position</label>
            <input id="scrub" type="range" className="grow" min={0} max={flight.track.length - 1} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
          </div>
        </>
      ) : (
        <>
          <div className="cover" style={{ height: 300 }}>
            {media[0] && <Media media={media[0]} />}
            <div style={{ position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))', zIndex: 4 }}><BackButton glass to="/logs" /></div>
          </div>
        </>
      )}

      <div>
        <h1 style={{ fontSize: 24 }}>{flight.title}</h1>
        <p className="small muted">
          {spot ? <Link className="link" to={`/spots/${spot.id}`}>{spot.name}</Link> : 'No spot'} · {flight.flown_at ? new Date(flight.flown_at).toLocaleString() : 'date unknown'}
          {!flight.updated_at && ' · waiting to sync'}
        </p>
      </div>
      {flight.notes && <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{flight.notes}</p>}
      {media.length > 0 && (
        <section className="stack">
          <h2>Photos and clips</h2>
          <MediaGrid media={media} />
        </section>
      )}
      {hasTrack && (
        <div className="grid-3">
          <div className="stat"><b>{formatDuration(flight.duration_s)}</b><span>Duration</span></div>
          <div className="stat"><b>{formatDistance(flight.distance_m ?? 0)}</b><span>Distance</span></div>
          <div className="stat"><b>{Math.round(flight.max_alt_m ?? 0)} m</b><span>Climb</span></div>
        </div>
      )}
      {flight.series.throttle && <Sparkline label="Throttle %" values={flight.series.throttle} />}
      {flight.series.vbat && <Sparkline label="Battery V" values={flight.series.vbat} color="var(--chart-blue)" />}
      {flight.series.alt && <Sparkline label="Altitude m" values={flight.series.alt} color="var(--text-2)" />}
      <div className="row">
        <button type="button" className="btn primary grow" onClick={() => void share()}><Icon name="share" size={18} /> Share</button>
        {hasTrack && <button type="button" className="btn grow" onClick={download}><Icon name="download" size={18} /> GPX</button>}
      </div>
      {flight.pilot_id === userId && (
        <button type="button" className="btn danger" onClick={async () => {
          if (!confirm('Delete this flight?')) return;
          await deleteRow('flights', flight.id);
          navigate('/logs', { replace: true });
        }}>
          <Icon name="trash" size={18} /> Delete flight
        </button>
      )}
    </main>
  );
}
