import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DateChip, Empty, TabBar, formatWhen } from '../components/ui';
import { db } from '../db/db';
import type { EventKind } from '../db/types';

export const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: 'race', label: 'Race' },
  { value: 'group', label: 'Group flight' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'meetup', label: 'Meetup' },
];

export function Events() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const now = new Date().toISOString();
  const events =
    useLiveQuery(
      () =>
        tab === 'upcoming'
          ? db.events.where('starts_at').aboveOrEqual(now).sortBy('starts_at')
          : db.events.where('starts_at').below(now).reverse().sortBy('starts_at'),
      // `now` changes every render; the tab is what matters.
      [tab],
    ) ?? [];
  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    for (const r of await db.rsvps.toArray()) if (r.status === 'going') map.set(r.event_id, (map.get(r.event_id) ?? 0) + 1);
    return map;
  }, []);

  return (
    <main className="screen">
      <div className="topbar">
        <h1 className="grow">Events</h1>
        <Link to="/events/new" className="btn small"><Icon name="plus" size={14} /> Host</Link>
      </div>
      <div className="segmented" role="tablist" aria-label="Event time">
        <button type="button" role="tab" aria-selected={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button type="button" role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past</button>
      </div>
      {events.length === 0 && (
        <Empty>
          {tab === 'upcoming' ? 'No events planned yet. Host a group flight or race night.' : 'No past events on this device.'}
        </Empty>
      )}
      {events.map((e, i) => (
        <Link key={e.id} to={`/events/${e.id}`} className={`list-card${i === 0 && tab === 'upcoming' ? ' card accent' : ''}`}>
          <DateChip iso={e.starts_at} hot={i === 0 && tab === 'upcoming'} />
          <span className="stack grow" style={{ gap: 0 }}>
            <span style={{ fontWeight: 600 }}>{e.title}</span>
            <span className="small muted">
              {formatWhen(e.starts_at)} · {e.venue_name} · {counts?.get(e.id) ?? 0} going
            </span>
          </span>
          <span className="tag">{EVENT_KINDS.find((k) => k.value === e.kind)?.label}</span>
        </Link>
      ))}
      <TabBar />
    </main>
  );
}
