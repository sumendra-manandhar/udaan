import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, BackButton, Empty, formatWhen } from '../components/ui';
import { db } from '../db/db';
import type { Rsvp } from '../db/types';
import { useAuth } from '../hooks/auth';
import { deleteRow, newId, saveRow } from '../sync/mutate';
import { EVENT_KINDS } from './Events';

export function EventDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const event = useLiveQuery(() => db.events.get(id), [id]);
  const host = useLiveQuery(() => (event ? db.profiles.get(event.host_id) : undefined), [event?.host_id]);
  const rsvps = useLiveQuery(() => db.rsvps.where('event_id').equals(id).toArray(), [id]) ?? [];
  const going = rsvps.filter((r) => r.status === 'going');
  const goingProfiles = useLiveQuery(async () => (await db.profiles.bulkGet(going.map((r) => r.user_id))).filter(Boolean), [rsvps]) ?? [];
  const mine = rsvps.find((r) => r.user_id === userId);

  if (!event) return <main className="screen"><BackButton /><Empty>Event not found on this device.</Empty></main>;

  const past = new Date(event.ends_at ?? event.starts_at) < new Date();
  const full = event.capacity != null && going.length >= event.capacity;
  const isHost = event.host_id === userId;

  async function rsvp(status: Rsvp['status']) {
    if (!userId) return navigate('/signin');
    await saveRow('rsvps', { id: mine?.id ?? newId(), event_id: id, user_id: userId, status });
    if (status === 'going') navigate(`/done/rsvp?id=${id}`);
  }

  return (
    <main className="screen no-tabs">
      <div className="cover" style={{ height: 180, background: 'linear-gradient(135deg, #3a2a40 0%, #1e1a2a 100%)' }}>
        <div style={{ position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))' }}><BackButton glass to="/events" /></div>
        <span className="tag solid" style={{ position: 'absolute', left: 16, bottom: 14 }}>
          {EVENT_KINDS.find((k) => k.value === event.kind)?.label.toUpperCase()}
        </span>
        {isHost && (
          <Link to={`/events/${id}/edit`} className="btn small glass" style={{ position: 'absolute', right: 16, top: 'calc(18px + env(safe-area-inset-top, 0px))' }}>Edit</Link>
        )}
      </div>
      <h1>{event.title}</h1>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <li className="row"><Icon name="calendar" /> {formatWhen(event.starts_at)}{event.ends_at && ` to ${new Date(event.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</li>
        <li className="row">
          <Icon name="pin" />
          {event.spot_id ? <Link className="link" to={`/spots/${event.spot_id}`}>{event.venue_name}</Link> : event.venue_name}
        </li>
        <li className="row"><Icon name="user" /> Hosted by {host ? <Link className="link" to={`/pilots/${host.username}`}>{host.display_name}</Link> : 'a pilot'}</li>
      </ul>
      <div className="row">
        <span className="row" style={{ gap: 0 }}>
          {goingProfiles.slice(0, 5).map((p, i) => (
            <span key={p!.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar profile={p} /></span>
          ))}
        </span>
        <span className="small muted">
          {going.length} going{event.capacity ? ` · ${Math.max(0, event.capacity - going.length)} places left` : ''}
        </span>
      </div>
      {event.description && (
        <section className="stack"><h2>About</h2><p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{event.description}</p></section>
      )}
      {event.bring && (
        <section className="stack"><h2>Bring</h2><p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{event.bring}</p></section>
      )}
      <p className="notice">
        The host confirms venue permission and approvals.{event.approval_note ? ` ${event.approval_note}` : ''}
      </p>
      {isHost && (
        <button type="button" className="btn danger" onClick={async () => {
          if (!confirm('Cancel and delete this event?')) return;
          await deleteRow('events', id);
          navigate('/events', { replace: true });
        }}>
          Cancel event
        </button>
      )}

      {!past && (
        <div className="action-bar">
          <span className="stack small muted" style={{ gap: 0 }}>
            <b style={{ color: 'var(--text)', fontSize: 15 }}>{event.fee || 'Free'}</b>per pilot
          </span>
          {mine?.status === 'going' ? (
            <button type="button" className="btn grow" onClick={() => void rsvp('cancelled')}>Can't make it</button>
          ) : (
            <button type="button" className="btn primary grow" disabled={full} onClick={() => void rsvp('going')}>
              {full ? 'Event is full' : "I'm going"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
