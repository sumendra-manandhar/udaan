import Dexie, { type EntityTable } from 'dexie';
import type {
  Airport,
  Checkin,
  Flight,
  HireRequest,
  MediaBlob,
  MetaRow,
  OutboxItem,
  Profile,
  Rsvp,
  Spot,
  UdaanEvent,
} from './types';

/** The on-device database. Everything the app shows is read from here, so
 * every screen works offline; the sync engine keeps it in step with Supabase. */
export class UdaanDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  airports!: EntityTable<Airport, 'id'>;
  spots!: EntityTable<Spot, 'id'>;
  events!: EntityTable<UdaanEvent, 'id'>;
  rsvps!: EntityTable<Rsvp, 'id'>;
  flights!: EntityTable<Flight, 'id'>;
  hire_requests!: EntityTable<HireRequest, 'id'>;
  checkins!: EntityTable<Checkin, 'id'>;
  outbox!: EntityTable<OutboxItem, 'seq'>;
  media!: EntityTable<MediaBlob, 'path'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'udaan') {
    super(name);
    this.version(1).stores({
      profiles: 'id, &username, updated_at',
      airports: 'id',
      spots: 'id, created_by, status, updated_at',
      events: 'id, starts_at, host_id, spot_id',
      rsvps: 'id, event_id, user_id, &[event_id+user_id]',
      flights: 'id, pilot_id, spot_id, flown_at',
      hire_requests: 'id, pilot_id, requester_id',
      outbox: '++seq, table, row_id, status',
      media: 'path, uploaded',
      meta: 'key',
    });
    // v2: check-ins at spots.
    this.version(2).stores({
      checkins: 'id, spot_id, user_id, checked_in_at',
    });
  }
}

export const db = new UdaanDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
