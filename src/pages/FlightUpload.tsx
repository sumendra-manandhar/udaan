import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SignInPrompt, TopBar, formatDuration } from '../components/ui';
import { db } from '../db/db';
import type { Flight } from '../db/types';
import { useAuth } from '../hooks/auth';
import { FlightParseError, parseFlightFile, type ParsedFlight } from '../lib/flightParse';
import { distanceM, formatDistance } from '../lib/geo';
import { newId, saveRow } from '../sync/mutate';

/** Logs are parsed on the phone, so uploading works offline: the flight is
 * saved locally and syncs later. */
export function FlightUpload() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const spots = useLiveQuery(() => db.spots.toArray(), []) ?? [];
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFlight | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [spotId, setSpotId] = useState(params.get('spot') ?? '');
  const [isPublic, setPublic] = useState(true);

  if (!userId) return <main className="screen no-tabs"><TopBar title="Upload a flight" back /><SignInPrompt what="log flights" /></main>;

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setError(null);
    setParsing(true);
    try {
      const p = await parseFlightFile(f);
      setParsed(p);
      setTitle((t) => t || f.name.replace(/\.[^.]+$/, ''));
      // Match the start of the track to the nearest spot within 3 km.
      if (!spotId) {
        const [lng, lat] = p.track[0];
        const near = spots
          .map((s) => ({ s, d: distanceM(lat, lng, s.lat, s.lng) }))
          .filter((x) => x.d < 3000)
          .sort((a, b) => a.d - b.d)[0];
        if (near) setSpotId(near.s.id);
      }
    } catch (e) {
      setError(e instanceof FlightParseError ? e.message : 'This file could not be read.');
    } finally {
      setParsing(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!parsed || !userId) return;
    const flight: Flight = {
      id: newId(),
      pilot_id: userId,
      spot_id: spotId || null,
      title: title.trim() || 'Flight',
      flown_at: parsed.flown_at ?? (file ? new Date(file.lastModified).toISOString() : null),
      duration_s: parsed.duration_s,
      max_alt_m: parsed.max_alt_m,
      distance_m: parsed.distance_m,
      source: parsed.source,
      track: parsed.track,
      series: parsed.series,
      is_public: isPublic,
    };
    await saveRow('flights', flight);
    navigate(`/logs/${flight.id}`, { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Upload a flight" back />
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <label className="card row" style={{ borderStyle: 'dashed', cursor: 'pointer' }}>
          <span className="icon-btn" style={{ borderRadius: 10 }}><Icon name="upload" /></span>
          <span className="stack grow" style={{ gap: 0 }}>
            <b>{file ? file.name : 'Choose a log file'}</b>
            <span className="small muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : '.gpx, or .csv exported from Blackbox Explorer'}</span>
          </span>
          <input type="file" accept=".gpx,.csv,.bbl,.bfl,application/gpx+xml,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>

        {parsing && <p className="status-line"><span className="spinner" /> Reading the log on your phone…</p>}
        {error && <p className="notice bad" role="alert">{error}</p>}

        {parsed && (
          <>
            <div className="grid-3">
              <div className="stat"><b>{formatDuration(parsed.duration_s)}</b><span>Duration</span></div>
              <div className="stat"><b>{formatDistance(parsed.distance_m)}</b><span>Distance</span></div>
              <div className="stat"><b>{Math.round(parsed.max_alt_m)} m</b><span>Climb</span></div>
            </div>
            <div className="field">
              <label htmlFor="ft">Title</label>
              <input id="ft" className="input" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fs">Where did you fly?</label>
              <select id="fs" className="select" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
                <option value="">Not at a spot on the map</option>
                {spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <label className="toggle-row">
              <span>Show on my profile</span>
              <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
            </label>
          </>
        )}
        <div className="action-bar">
          <button className="btn primary block" disabled={!parsed}>Save and view replay</button>
        </div>
      </form>
    </main>
  );
}
