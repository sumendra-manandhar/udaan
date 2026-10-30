import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { db } from '../db/db';
import { useOnline } from '../hooks/useApp';

/** Confirmation screens for spot submissions, RSVPs and hire requests. */
export function Done() {
  const { kind = 'spot' } = useParams();
  const [params] = useSearchParams();
  const online = useOnline();
  const id = params.get('id') ?? '';
  const spot = useLiveQuery(() => (kind === 'spot' ? db.spots.get(id) : undefined), [kind, id]);
  const event = useLiveQuery(() => (kind === 'rsvp' ? db.events.get(id) : undefined), [kind, id]);
  const pilot = useLiveQuery(() => (kind === 'hire' ? db.profiles.get(id) : undefined), [kind, id]);

  const copy = {
    spot: {
      title: 'Spot sent for review',
      body: `A moderator checks the location, rules and photos before ${spot?.name ?? 'it'} goes public.`,
      primary: { to: '/', label: 'Back to the map' },
      secondary: { to: '/me', label: 'View my spots' },
    },
    rsvp: {
      title: "You're in",
      body: event ? `See you at ${event.title}, ${event.venue_name}.` : 'Your RSVP is saved.',
      primary: { to: '/events', label: 'Back to events' },
      secondary: { to: `/events/${id}`, label: 'View event' },
    },
    hire: {
      title: `Request sent${pilot ? ` to ${pilot.display_name}` : ''}`,
      body: 'Pilots usually reply within a couple of days, using the contact details you gave.',
      primary: { to: pilot ? `/pilots/${pilot.username}` : '/', label: 'Back to profile' },
      secondary: { to: '/me/requests', label: 'My requests' },
    },
  }[kind as 'spot' | 'rsvp' | 'hire'] ?? { title: 'Done', body: '', primary: { to: '/', label: 'Home' }, secondary: { to: '/me', label: 'Profile' } };

  return (
    <main className="screen no-tabs" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
      <div className="stack center" style={{ gap: 16, alignItems: 'center' }}>
        <div className="done-icon"><Icon name={kind === 'hire' ? 'send' : 'check'} size={36} /></div>
        <h1>{copy.title}</h1>
        <p className="muted" style={{ maxWidth: 320 }}>{copy.body}</p>
        {!online && <p className="notice warn">Saved on your phone. It will be sent when you're back online.</p>}
      </div>
      <Link className="btn primary block" to={copy.primary.to}>{copy.primary.label}</Link>
      <Link className="btn block" to={copy.secondary.to}>{copy.secondary.label}</Link>
    </main>
  );
}
