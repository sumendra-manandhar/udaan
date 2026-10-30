import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { RingStatus } from '../components/RingStatus';
import { Empty, Media, TopBar } from '../components/ui';
import { db } from '../db/db';
import type { Spot } from '../db/types';
import { useAuth } from '../hooks/auth';
import { useAirports, useOnline } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { syncNow } from '../sync/manager';

/** Moderators approve or reject new spots. Needs a connection. */
export function Moderate() {
  const { profile } = useAuth();
  const online = useOnline();
  const airports = useAirports();
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from('spots').select('*').eq('status', 'pending').is('deleted_at', null).order('created_at');
    if (error) setError(error.message);
    else setSpots(data as Spot[]);
  }

  useEffect(() => {
    if (online && profile?.role === 'moderator') void load();
  }, [online, profile?.role]);

  if (profile && profile.role !== 'moderator') return <Navigate to="/me" replace />;

  async function decide(s: Spot, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('spots').update({ status }).eq('id', s.id);
    if (error) return setError(error.message);
    await db.spots.update(s.id, { status });
    setSpots((list) => list?.filter((x) => x.id !== s.id) ?? null);
    void syncNow();
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Review spots" back="/me" />
      {!online && <p className="notice warn">Reviewing needs a connection.</p>}
      {error && <p className="notice bad">{error}</p>}
      {spots?.length === 0 && <Empty>Nothing waiting for review.</Empty>}
      {spots?.map((s) => (
        <article key={s.id} className="card stack">
          <div className="row between"><b>{s.name}</b><span className="tag">{s.type}</span></div>
          <p className="tiny mono faint">{s.lat}, {s.lng} · <a className="link" href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=15/${s.lat}/${s.lng}`} target="_blank" rel="noreferrer">open map</a></p>
          {s.media[0] && <Media media={s.media[0]} className="thumb" />}
          {s.notes && <p className="small">{s.notes}</p>}
          <RingStatus lat={s.lat} lng={s.lng} airports={airports} title="Rules check" />
          <div className="row">
            <button type="button" className="btn small primary grow" disabled={!online || s.airport_warning} onClick={() => void decide(s, 'approved')}>Approve</button>
            <button type="button" className="btn small grow" disabled={!online} onClick={() => void decide(s, 'rejected')}>Reject</button>
          </div>
          <Link className="link tiny" to={`/spots/${s.id}`}>Open spot</Link>
        </article>
      ))}
    </main>
  );
}
