// Row shapes shared by the local IndexedDB store and Supabase (snake_case to
// match the database). `updated_at` is always the server's clock.

export type SpotType = 'ridge' | 'lake' | 'field' | 'track' | 'indoor' | 'other';
export type EventKind = 'race' | 'group' | 'indoor' | 'workshop' | 'meetup';

export interface MediaRef {
  path: string; // storage path: <user_id>/<uuid>.<ext>
  kind: 'image' | 'video';
}

interface Synced {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
}

export interface Profile extends Synced {
  username: string;
  display_name: string;
  bio?: string | null;
  home_base?: string | null;
  styles: string[];
  for_hire: boolean;
  services: { title: string; price: string }[];
  builds: { name: string; specs: string }[];
  uin_registered: boolean;
  avatar_path?: string | null;
  role?: 'pilot' | 'moderator';
}

export interface Airport extends Synced {
  name: string;
  icao?: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  verified: boolean;
}

export interface Spot extends Synced {
  created_by: string;
  name: string;
  type: SpotType;
  lat: number;
  lng: number;
  best_time?: string | null;
  notes?: string | null;
  is_private: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  airport_warning?: boolean;
  media: MediaRef[];
}

export interface UdaanEvent extends Synced {
  host_id: string;
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at?: string | null;
  venue_name: string;
  spot_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  description?: string | null;
  bring?: string | null;
  capacity?: number | null;
  fee?: string | null;
  approval_note?: string | null;
}

export interface Rsvp extends Synced {
  event_id: string;
  user_id: string;
  status: 'going' | 'cancelled';
}

/** [lng, lat, alt_m, t_s] */
export type TrackPoint = [number, number, number, number];

export interface FlightSeries {
  t: number[];
  alt?: number[];
  throttle?: number[];
  vbat?: number[];
  speed?: number[];
}

export interface Flight extends Synced {
  pilot_id: string;
  spot_id?: string | null;
  title: string;
  flown_at?: string | null;
  duration_s?: number | null;
  max_alt_m?: number | null;
  distance_m?: number | null;
  /** 'media' = no log file, just photos or clips. */
  source: 'gpx' | 'csv' | 'media';
  track: TrackPoint[];
  series: FlightSeries;
  media?: MediaRef[];
  notes?: string | null;
  is_public: boolean;
}

export interface Checkin extends Synced {
  spot_id: string;
  user_id: string;
  /** When it happened on the phone (kept even if it synced later). */
  checked_in_at: string;
  note?: string | null;
}

export interface HireRequest extends Synced {
  pilot_id: string;
  requester_id: string;
  shoot_type: string;
  location: string;
  shoot_date?: string | null;
  budget?: string | null;
  contact: string;
  message: string;
  status: 'sent' | 'accepted' | 'declined' | 'cancelled';
}

export interface TableRows {
  profiles: Profile;
  airports: Airport;
  spots: Spot;
  events: UdaanEvent;
  rsvps: Rsvp;
  flights: Flight;
  hire_requests: HireRequest;
  checkins: Checkin;
}

export type TableName = keyof TableRows;

/** Tables pulled from the server, in dependency order. */
export const PULL_TABLES: TableName[] = [
  'profiles',
  'airports',
  'spots',
  'events',
  'rsvps',
  'flights',
  'hire_requests',
  'checkins',
];

/** Tables the client writes to. */
export type WritableTable = Exclude<TableName, 'airports'>;

/** Columns the client may send for each table. Server-owned columns
 * (updated_at, created_at, geom, role, status for spots…) are never sent. */
export const CLIENT_COLUMNS: Record<WritableTable, string[]> = {
  profiles: ['id', 'username', 'display_name', 'bio', 'home_base', 'styles', 'for_hire', 'services', 'builds', 'uin_registered', 'avatar_path'],
  spots: ['id', 'created_by', 'name', 'type', 'lat', 'lng', 'best_time', 'notes', 'is_private', 'media'],
  events: ['id', 'host_id', 'title', 'kind', 'starts_at', 'ends_at', 'venue_name', 'spot_id', 'lat', 'lng', 'description', 'bring', 'capacity', 'fee', 'approval_note'],
  rsvps: ['id', 'event_id', 'user_id', 'status'],
  flights: ['id', 'pilot_id', 'spot_id', 'title', 'flown_at', 'duration_s', 'max_alt_m', 'distance_m', 'source', 'track', 'series', 'media', 'notes', 'is_public'],
  hire_requests: ['id', 'pilot_id', 'requester_id', 'shoot_type', 'location', 'shoot_date', 'budget', 'contact', 'message', 'status'],
  checkins: ['id', 'spot_id', 'user_id', 'checked_in_at', 'note'],
};

/** Upsert conflict target per table (rsvps are unique per event and user). */
export const CONFLICT_TARGET: Partial<Record<WritableTable, string>> = {
  rsvps: 'event_id,user_id',
};

export interface OutboxItem {
  seq?: number;
  table: WritableTable;
  row_id: string;
  op: 'upsert' | 'delete';
  status: 'pending' | 'failed';
  attempts: number;
  error?: string | null;
  created_at: string;
}

export interface MediaBlob {
  path: string;
  blob: Blob;
  content_type: string;
  uploaded: 0 | 1;
  created_at: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
