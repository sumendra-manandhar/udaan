import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chips, SignInPrompt, TopBar } from '../components/ui';
import { db } from '../db/db';
import type { EventKind, UdaanEvent } from '../db/types';
import { useAuth } from '../hooks/auth';
import { newId, saveRow } from '../sync/mutate';
import { EVENT_KINDS } from './Events';

/** datetime-local value in the device's time zone. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const existing = useLiveQuery(() => (id ? db.events.get(id) : undefined), [id]);
  const spots = useLiveQuery(() => db.spots.where('status').equals('approved').sortBy('name'), []) ?? [];
  const loaded = useRef(false);
  const [f, setF] = useState({
    title: '', kind: 'group' as EventKind, starts: '', ends: '', venue: '', spot_id: '', description: '', bring: '', capacity: '', fee: '', approval: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true;
      setF({
        title: existing.title, kind: existing.kind, starts: toLocalInput(existing.starts_at), ends: toLocalInput(existing.ends_at),
        venue: existing.venue_name, spot_id: existing.spot_id ?? '', description: existing.description ?? '', bring: existing.bring ?? '',
        capacity: existing.capacity ? String(existing.capacity) : '', fee: existing.fee ?? '', approval: existing.approval_note ?? '',
      });
    }
  }, [existing]);

  if (!userId) return <main className="screen no-tabs"><TopBar title="Host an event" back /><SignInPrompt what="host events" /></main>;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const starts = new Date(f.starts);
    const ends = f.ends ? new Date(f.ends) : null;
    if (ends && ends <= starts) return setError('The end time must be after the start.');
    const spot = spots.find((s) => s.id === f.spot_id);
    const row: UdaanEvent = {
      id: existing?.id ?? newId(),
      host_id: userId,
      title: f.title.trim(),
      kind: f.kind,
      starts_at: starts.toISOString(),
      ends_at: ends?.toISOString() ?? null,
      venue_name: f.venue.trim() || spot?.name || 'To be announced',
      spot_id: spot?.id ?? null,
      lat: spot?.lat ?? null,
      lng: spot?.lng ?? null,
      description: f.description.trim() || null,
      bring: f.bring.trim() || null,
      capacity: f.capacity ? Number(f.capacity) : null,
      fee: f.fee.trim() || null,
      approval_note: f.approval.trim() || null,
    };
    await saveRow('events', row);
    navigate(`/events/${row.id}`, { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title={id ? 'Edit event' : 'Host an event'} back />
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field"><label htmlFor="et">Title</label><input id="et" className="input" required minLength={3} maxLength={100} value={f.title} onChange={set('title')} placeholder="Sunrise group flight" /></div>
        <div className="field"><span className="label">Type</span><Chips label="Event type" options={EVENT_KINDS} value={f.kind} onChange={(v) => setF({ ...f, kind: v as EventKind })} /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="es">Starts</label><input id="es" type="datetime-local" className="input" required value={f.starts} onChange={set('starts')} /></div>
          <div className="field"><label htmlFor="ee">Ends</label><input id="ee" type="datetime-local" className="input" value={f.ends} onChange={set('ends')} /></div>
        </div>
        <div className="field">
          <label htmlFor="esp">At a spot (optional)</label>
          <select id="esp" className="select" value={f.spot_id} onChange={set('spot_id')}>
            <option value="">Not on the map</option>
            {spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="ev">Venue name</label><input id="ev" className="input" value={f.venue} onChange={set('venue')} placeholder="Leave blank to use the spot name" /></div>
        <div className="field"><label htmlFor="ed">About</label><textarea id="ed" className="textarea" maxLength={4000} value={f.description} onChange={set('description')} placeholder="Format, skill level, schedule" /></div>
        <div className="field"><label htmlFor="eb">What to bring</label><textarea id="eb" className="textarea" value={f.bring} onChange={set('bring')} placeholder="Packs, spare props, video channel" /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="ec">Places</label><input id="ec" className="input" type="number" min={1} inputMode="numeric" value={f.capacity} onChange={set('capacity')} placeholder="No limit" /></div>
          <div className="field"><label htmlFor="ef">Entry fee</label><input id="ef" className="input" value={f.fee} onChange={set('fee')} placeholder="Free" /></div>
        </div>
        <div className="field"><label htmlFor="ea">Approvals</label><input id="ea" className="input" value={f.approval} onChange={set('approval')} placeholder="e.g. District approval received" /></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="action-bar"><button className="btn primary block">{id ? 'Save changes' : 'Publish event'}</button></div>
      </form>
    </main>
  );
}
