import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { RingStatus } from '../components/RingStatus';
import { Chips, SignInPrompt, TopBar } from '../components/ui';
import { db } from '../db/db';
import type { MediaRef, Spot, SpotType } from '../db/types';
import { useAuth } from '../hooks/auth';
import { useAirports } from '../hooks/useApp';
import { checkAirportRings, inNepal } from '../lib/geo';
import { addMedia } from '../lib/media';
import { newId, saveRow } from '../sync/mutate';
import { SPOT_TYPES } from './MapHome';

const TIMES = ['Sunrise', 'Morning', 'Afternoon', 'Sunset', 'Any time'];

export function SpotForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const airports = useAirports();
  const existing = useLiveQuery(() => (id ? db.spots.get(id) : undefined), [id]);
  const loadedRef = useRef(false);

  const [center, setCenter] = useState<[number, number]>([85.324, 27.7172]);
  const [startCenter, setStartCenter] = useState<[number, number] | undefined>();
  const [name, setName] = useState('');
  const [type, setType] = useState<SpotType>('ridge');
  const [bestTime, setBestTime] = useState('Sunrise');
  const [notes, setNotes] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !loadedRef.current) {
      loadedRef.current = true;
      setName(existing.name);
      setType(existing.type);
      setBestTime(existing.best_time ?? 'Any time');
      setNotes(existing.notes ?? '');
      setPrivate(existing.is_private);
      setMedia(existing.media);
      setStartCenter([existing.lng, existing.lat]);
    } else if (!id && !loadedRef.current && 'geolocation' in navigator) {
      loadedRef.current = true;
      navigator.geolocation.getCurrentPosition((p) => setStartCenter([p.coords.longitude, p.coords.latitude]), () => undefined, { timeout: 8000 });
    }
  }, [existing, id]);

  if (!userId) return <main className="screen no-tabs"><TopBar title="Add a spot" back /><SignInPrompt what="add spots" /></main>;

  const [lng, lat] = center;
  const ring = checkAirportRings(lat, lng, airports);

  async function onFiles(files: FileList | null) {
    if (!files || !userId) return;
    setError(null);
    try {
      const added: MediaRef[] = [];
      for (const f of Array.from(files).slice(0, 6)) added.push(await addMedia(f, userId));
      setMedia((m) => [...m, ...added].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!inNepal(lat, lng)) return setError('Move the pin to a place in Nepal.');
    if (ring.inside) return setError(`This spot is inside the ${ring.inside.name} no-fly ring. Pick another place.`);
    setBusy(true);
    const row: Spot = {
      id: existing?.id ?? newId(),
      created_by: userId,
      name: name.trim(),
      type,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      best_time: bestTime,
      notes: notes.trim() || null,
      is_private: isPrivate,
      status: existing?.status ?? 'pending',
      media,
    };
    await saveRow('spots', row);
    setBusy(false);
    navigate(existing ? `/spots/${row.id}` : `/done/spot?id=${row.id}`, { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title={id ? 'Edit spot' : 'Add a spot'} back />
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="map-box" style={{ height: 220 }}>
          <MapView className="map-fill" center={startCenter} zoom={13} airports={airports} onMove={(c) => setCenter(c)} />
          <svg className="center-pin" width="30" height="38" viewBox="0 0 20 26" aria-hidden="true">
            <path d="M10 25s9-8.5 9-15A9 9 0 0 0 1 10c0 6.5 9 15 9 15z" fill="var(--accent)" />
            <circle cx="10" cy="10" r="3.5" fill="#111" />
          </svg>
          <span className="tiny glass" style={{ position: 'absolute', left: 10, bottom: 26, padding: '3px 8px', borderRadius: 6, zIndex: 4 }}>
            Move the map to place the pin
          </span>
        </div>
        <p className="tiny mono faint">{lat.toFixed(5)}, {lng.toFixed(5)}</p>

        <RingStatus lat={lat} lng={lng} airports={airports} title="Automatic rules check" />

        <div className="field">
          <label htmlFor="sname">Spot name</label>
          <input id="sname" className="input" required minLength={2} maxLength={80} placeholder="e.g. Nagarkot ridge" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">Type</span>
          <Chips label="Spot type" options={SPOT_TYPES} value={type} onChange={(v) => setType(v as SpotType)} />
        </div>
        <div className="field">
          <label htmlFor="btime">Best time to fly</label>
          <select id="btime" className="select" value={bestTime} onChange={(e) => setBestTime(e.target.value)}>
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="notes">Tips for other pilots</label>
          <textarea id="notes" className="textarea" maxLength={2000} placeholder="Where to launch, access, who to ask, what to avoid" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field">
          <span className="label">Photos and clips ({media.length}/8)</span>
          {media.length > 0 && <p className="small muted">{media.filter((m) => m.kind === 'image').length} photos, {media.filter((m) => m.kind === 'video').length} clips added</p>}
          <label className="btn block" style={{ borderStyle: 'dashed', minHeight: 72 }}>
            <Icon name="upload" /> Add photos or a short clip
            <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => void onFiles(e.target.files)} />
          </label>
        </div>

        <label className="toggle-row">
          <span className="stack" style={{ gap: 0 }}>
            <span style={{ fontWeight: 600 }}>Keep it private</span>
            <span className="small muted">Only you can see it</span>
          </span>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        </label>

        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="action-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <button className="btn primary block" disabled={busy || Boolean(ring.inside)}>
            {id ? 'Save changes' : 'Submit for review'}
          </button>
          <p className="center tiny faint">A moderator checks every new or moved spot before it goes public.</p>
        </div>
      </form>
    </main>
  );
}
