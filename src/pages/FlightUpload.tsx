import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MediaGrid } from '../components/MediaGrid';
import { SignInPrompt, TopBar, formatDuration } from '../components/ui';
import { db } from '../db/db';
import type { Flight, MediaRef } from '../db/types';
import { useAuth } from '../hooks/auth';
import { FlightParseError, parseFlightFile, type ParsedFlight } from '../lib/flightParse';
import { distanceM, formatDistance } from '../lib/geo';
import { addMedia } from '../lib/media';
import { newId, saveRow } from '../sync/mutate';

const MAX_MEDIA = 8;

/** datetime-local value for "now" in the phone's time zone. */
function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Log a flight with a GPS log, photos and clips, or both. Logs are parsed on
 * the phone and media is kept on the phone until it uploads, so this works
 * offline: the flight syncs later. */
export function FlightUpload() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const spots = useLiveQuery(() => db.spots.toArray(), []) ?? [];
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFlight | null>(null);
  const [parsing, setParsing] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [adding, setAdding] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [flownAt, setFlownAt] = useState(localNow());
  const [spotId, setSpotId] = useState(params.get('spot') ?? '');
  const [isPublic, setPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!userId) return <main className="screen no-tabs"><TopBar title="Log a flight" back /><SignInPrompt what="log flights" /></main>;

  async function pickLog(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setLogError(null);
    setParsing(true);
    try {
      const p = await parseFlightFile(f);
      setParsed(p);
      setTitle((t) => t || f.name.replace(/\.[^.]+$/, ''));
      if (p.flown_at) {
        const d = new Date(p.flown_at);
        setFlownAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      }
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
      setLogError(e instanceof FlightParseError ? e.message : 'This file could not be read.');
    } finally {
      setParsing(false);
    }
  }

  async function pickMedia(files: FileList | null) {
    if (!files || !userId) return;
    setMediaError(null);
    setAdding(true);
    try {
      const room = MAX_MEDIA - media.length;
      const added: MediaRef[] = [];
      for (const f of Array.from(files).slice(0, room)) added.push(await addMedia(f, userId));
      setMedia((m) => [...m, ...added]);
      if (files.length > room) setMediaError(`Up to ${MAX_MEDIA} photos and clips per flight.`);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!parsed && media.length === 0) return setError('Add a log file, a photo or a clip.');
    const flight: Flight = {
      id: newId(),
      pilot_id: userId,
      spot_id: spotId || null,
      title: title.trim() || 'Flight',
      flown_at: flownAt ? new Date(flownAt).toISOString() : new Date().toISOString(),
      duration_s: parsed?.duration_s ?? null,
      max_alt_m: parsed?.max_alt_m ?? null,
      distance_m: parsed?.distance_m ?? null,
      source: parsed?.source ?? 'media',
      track: parsed?.track ?? [],
      series: parsed?.series ?? { t: [] },
      media,
      notes: notes.trim() || null,
      is_public: isPublic,
    };
    await saveRow('flights', flight);
    navigate(`/logs/${flight.id}`, { replace: true });
  }

  const ready = Boolean(parsed) || media.length > 0;

  return (
    <main className="screen no-tabs">
      <TopBar title="Log a flight" back />
      <p className="small muted">Add photos or clips, a GPS log, or both. No GPS on your quad? Just add your clips.</p>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        <section className="stack">
          <h2>Photos and clips</h2>
          <MediaGrid media={media} onRemove={(path) => setMedia((m) => m.filter((x) => x.path !== path))} />
          {media.length < MAX_MEDIA && (
            <div className="grid-2">
              <label className="btn" style={{ borderStyle: 'dashed', cursor: 'pointer' }}>
                <Icon name="upload" size={18} /> {adding ? 'Adding…' : 'Choose files'}
                <input type="file" accept="image/*,video/*" multiple className="sr-only" disabled={adding} onChange={(e) => { void pickMedia(e.target.files); e.target.value = ''; }} />
              </label>
              <label className="btn" style={{ borderStyle: 'dashed', cursor: 'pointer' }}>
                <Icon name="camera" size={18} /> Camera
                <input type="file" accept="image/*,video/*" capture="environment" className="sr-only" disabled={adding} onChange={(e) => { void pickMedia(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          )}
          <span className="tiny faint">Photos are resized on your phone. Clips up to 50 MB each.</span>
          {mediaError && <p className="error-text" role="alert">{mediaError}</p>}
        </section>

        <section className="stack">
          <h2>Flight log <span className="small muted" style={{ fontFamily: 'var(--font)', fontWeight: 400 }}>(optional)</span></h2>
          <label className="card row" style={{ borderStyle: 'dashed', cursor: 'pointer' }}>
            <span className="icon-btn" style={{ borderRadius: 10 }}><Icon name="logs" /></span>
            <span className="stack grow" style={{ gap: 0 }}>
              <b>{file ? file.name : 'Add a GPS log'}</b>
              <span className="small muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : '.gpx, or .csv exported from Blackbox Explorer'}</span>
            </span>
            <input type="file" accept=".gpx,.csv,.bbl,.bfl,application/gpx+xml,text/csv" className="sr-only" onChange={(e) => void pickLog(e.target.files?.[0])} />
          </label>
          {parsing && <p className="status-line"><span className="spinner" /> Reading the log on your phone…</p>}
          {logError && <p className="notice bad" role="alert">{logError}</p>}
          {parsed && (
            <div className="grid-3">
              <div className="stat"><b>{formatDuration(parsed.duration_s)}</b><span>Duration</span></div>
              <div className="stat"><b>{formatDistance(parsed.distance_m)}</b><span>Distance</span></div>
              <div className="stat"><b>{Math.round(parsed.max_alt_m)} m</b><span>Climb</span></div>
            </div>
          )}
        </section>

        <div className="field">
          <label htmlFor="ft">Title</label>
          <input id="ft" className="input" maxLength={100} placeholder="e.g. Sunrise dives" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="fs">Where?</label>
            <select id="fs" className="select" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              <option value="">Not on the map</option>
              {spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fd">When?</label>
            <input id="fd" type="datetime-local" className="input" value={flownAt} max={localNow()} onChange={(e) => setFlownAt(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="fn">Notes</label>
          <textarea id="fn" className="textarea" maxLength={1000} placeholder="Conditions, setup, what worked" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 72 }} />
        </div>
        <label className="toggle-row">
          <span>Show on my profile</span>
          <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="action-bar">
          <button className="btn primary block" disabled={!ready || adding || parsing}>Save flight</button>
        </div>
      </form>
    </main>
  );
}
