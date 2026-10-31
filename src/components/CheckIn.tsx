import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import type { Spot } from '../db/types';
import { useAuth } from '../hooks/auth';
import { distanceM, formatDistance } from '../lib/geo';
import { newId, saveRow } from '../sync/mutate';
import { Icon } from './Icon';
import { Avatar } from './ui';

/** How close the phone must be to the spot pin to check in. */
export const CHECKIN_RADIUS_M = 1500;
/** Check-ins this recent count as "here now". */
export const HERE_NOW_MS = 3 * 60 * 60 * 1000;
/** One check-in per pilot per spot in this window. */
const REPEAT_MS = 2 * 60 * 60 * 1000;

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
}

/** Check in at a spot. Uses the phone's GPS (works offline) to confirm the
 * pilot is actually there; only the check-in is saved, not the location. */
export function CheckInCard({ spot }: { spot: Spot }) {
  const { userId } = useAuth();
  const checkins = useLiveQuery(() => db.checkins.where('spot_id').equals(spot.id).reverse().sortBy('checked_in_at'), [spot.id]) ?? [];
  const people = useLiveQuery(async () => new Map((await db.profiles.bulkGet([...new Set(checkins.map((c) => c.user_id))])).filter(Boolean).map((p) => [p!.id, p!])), [checkins]);
  const [state, setState] = useState<'idle' | 'locating' | 'saving'>('idle');
  const [message, setMessage] = useState<{ kind: 'bad' | 'good'; text: string } | null>(null);

  const now = Date.now();
  const hereNow = checkins.filter((c) => now - Date.parse(c.checked_in_at) < HERE_NOW_MS);
  const hereNowPilots = [...new Set(hereNow.map((c) => c.user_id))];
  const mine = checkins.find((c) => c.user_id === userId && now - Date.parse(c.checked_in_at) < REPEAT_MS);

  async function checkIn() {
    if (!userId) return;
    setMessage(null);
    setState('locating');
    try {
      const pos = await currentPosition();
      const d = distanceM(pos.coords.latitude, pos.coords.longitude, spot.lat, spot.lng);
      if (d > CHECKIN_RADIUS_M) {
        setMessage({ kind: 'bad', text: `You're ${formatDistance(d)} away. Check in when you're at ${spot.name}.` });
        return;
      }
      setState('saving');
      await saveRow('checkins', { id: newId(), spot_id: spot.id, user_id: userId, checked_in_at: new Date().toISOString() });
      setMessage({ kind: 'good', text: navigator.onLine ? `Checked in at ${spot.name}.` : `Checked in at ${spot.name}. It will sync when you're online.` });
    } catch (e) {
      const err = e as GeolocationPositionError | Error;
      const denied = 'code' in err && err.code === 1;
      setMessage({ kind: 'bad', text: denied ? 'Allow location access to check in, so we can confirm you are at the spot.' : `Couldn't get your location. ${err.message}` });
    } finally {
      setState('idle');
    }
  }

  return (
    <section className="card stack" aria-label="Check-ins">
      <div className="row between">
        <b>{hereNowPilots.length ? `${hereNowPilots.length} pilot${hereNowPilots.length === 1 ? '' : 's'} here now` : 'Nobody checked in right now'}</b>
        <span className="small muted">{checkins.length} check-in{checkins.length === 1 ? '' : 's'}</span>
      </div>

      {!userId ? (
        <Link className="btn primary" to="/signin?mode=signup"><Icon name="checkin" size={18} /> Sign in to check in</Link>
      ) : mine ? (
        <p className="status-line good"><Icon name="check" size={16} strokeWidth={2.2} /> You checked in {timeAgo(mine.checked_in_at)}</p>
      ) : (
        <button type="button" className="btn primary" disabled={state !== 'idle'} onClick={() => void checkIn()}>
          <Icon name="checkin" size={18} />
          {state === 'locating' ? 'Finding your location…' : state === 'saving' ? 'Checking in…' : "I'm here: check in"}
        </button>
      )}
      {message && <p className={`small ${message.kind === 'bad' ? 'error-text' : ''}`} style={message.kind === 'good' ? { color: 'var(--good)' } : undefined} role="status">{message.text}</p>}

      {checkins.length > 0 && (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
          {checkins.slice(0, 6).map((c) => {
            const p = people?.get(c.user_id);
            return (
              <li key={c.id} className="row">
                <Avatar profile={p} />
                <span className="stack grow" style={{ gap: 0 }}>
                  {p ? <Link className="small" style={{ fontWeight: 600 }} to={`/pilots/${p.username}`}>{p.display_name}</Link> : <span className="small">A pilot</span>}
                  <span className="tiny muted">{timeAgo(c.checked_in_at)}{!c.updated_at && c.user_id === userId ? ' · waiting to sync' : ''}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="tiny faint">Check-in uses your location to confirm you're within {formatDistance(CHECKIN_RADIUS_M)} of the spot. Your location isn't saved.</p>
    </section>
  );
}
