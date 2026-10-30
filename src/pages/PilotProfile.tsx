import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, BackButton, Empty, Media, TabBar, formatDuration } from '../components/ui';
import { db } from '../db/db';
import type { Profile } from '../db/types';
import { useAuth } from '../hooks/auth';
import { STYLE_OPTIONS } from './Onboarding';

export function ProfileView({ profile, own }: { profile: Profile; own: boolean }) {
  const [tab, setTab] = useState<'reels' | 'builds' | 'spots' | 'logs'>('reels');
  const spots = useLiveQuery(() => db.spots.where('created_by').equals(profile.id).toArray(), [profile.id]) ?? [];
  const flights = useLiveQuery(() => db.flights.where('pilot_id').equals(profile.id).reverse().sortBy('flown_at'), [profile.id]) ?? [];
  const media = spots.flatMap((s) => s.media.map((m) => ({ m, spot: s })));
  const shareUrl = `${location.origin}/pilots/${profile.username}`;

  return (
    <>
      <div className="cover" style={{ height: 180, background: 'linear-gradient(180deg, #2a3a44 0%, #1b2a30 55%, #14201e 100%)' }}>
        {media[0] && <Media media={media[0].m} />}
        <div style={{ position: 'absolute', left: 16, top: 'calc(16px + env(safe-area-inset-top, 0px))' }}><BackButton glass /></div>
        <button
          type="button"
          className="btn small glass"
          style={{ position: 'absolute', right: 16, top: 'calc(18px + env(safe-area-inset-top, 0px))' }}
          onClick={() => (navigator.share ? void navigator.share({ title: profile.display_name, url: shareUrl }).catch(() => undefined) : void navigator.clipboard.writeText(shareUrl))}
        >
          Share
        </button>
      </div>
      <div style={{ marginTop: -56, position: 'relative', zIndex: 2 }}>
        <Avatar profile={profile} size="lg" />
      </div>
      <div>
        <h1>{profile.display_name}</h1>
        <p className="small muted">@{profile.username}{profile.home_base && ` · ${profile.home_base}`}</p>
      </div>
      <div className="chips">
        {profile.for_hire && <span className="tag good"><span className="dot" style={{ marginRight: 6 }} />Available for hire</span>}
        {profile.styles.map((s) => <span key={s} className="tag">{STYLE_OPTIONS.find((o) => o.value === s)?.label ?? s}</span>)}
        {profile.uin_registered && <span className="tag">UIN registered</span>}
      </div>
      {profile.bio && <p style={{ color: 'var(--text-2)' }}>{profile.bio}</p>}
      <div className="row">
        {own ? (
          <Link to="/me/edit" className="btn grow">Edit profile</Link>
        ) : profile.for_hire ? (
          <Link to={`/pilots/${profile.username}/hire`} className="btn primary grow">Hire for a shoot</Link>
        ) : null}
      </div>
      <div className="grid-3">
        <div className="stat"><b>{flights.length}</b><span>Flights</span></div>
        <div className="stat"><b>{spots.filter((s) => s.status === 'approved').length}</b><span>Spots added</span></div>
        <div className="stat"><b>{formatDuration(flights.reduce((a, f) => a + (f.duration_s ?? 0), 0))}</b><span>Air time</span></div>
      </div>

      <div className="segmented" role="tablist" aria-label="Profile sections" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {(['reels', 'builds', 'spots', 'logs'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'reels' && (media.length ? (
        <div className="grid-3">
          {media.map(({ m, spot }) => (
            <Link key={m.path} to={`/spots/${spot.id}`} aria-label={spot.name} style={{ aspectRatio: '9 / 14', borderRadius: 10, overflow: 'hidden', background: 'var(--surface-3)' }}>
              <Media media={m} className="" />
            </Link>
          ))}
        </div>
      ) : <Empty>No photos or clips yet.</Empty>)}

      {tab === 'builds' && (profile.builds.length ? profile.builds.map((b) => (
        <div key={b.name} className="card stack" style={{ gap: 2 }}><b>{b.name}</b><span className="small muted">{b.specs}</span></div>
      )) : <Empty>No quad builds listed.</Empty>)}

      {tab === 'spots' && (spots.length ? spots.map((s) => (
        <Link key={s.id} to={`/spots/${s.id}`} className="list-card">
          <Media media={s.media[0]} className="thumb" />
          <span className="stack grow" style={{ gap: 0 }}>
            <b>{s.name}</b>
            <span className="small muted">{s.status === 'approved' ? 'Public' : s.status === 'pending' ? 'In review' : 'Not approved'}{s.is_private && ' · private'}</span>
          </span>
        </Link>
      )) : <Empty>No spots added yet.</Empty>)}

      {tab === 'logs' && (flights.length ? flights.map((f) => (
        <Link key={f.id} to={`/logs/${f.id}`} className="list-card between">
          <span className="stack" style={{ gap: 0 }}><b>{f.title}</b><span className="small muted">{formatDuration(f.duration_s)}</span></span>
          <span className="link small">Replay →</span>
        </Link>
      )) : <Empty>No public flights yet.</Empty>)}

      {profile.for_hire && profile.services.length > 0 && (
        <section className="stack">
          <h2>Hire me for</h2>
          {profile.services.map((s) => (
            <div key={s.title} className="card row between" style={{ padding: '12px 14px' }}><span>{s.title}</span><span className="muted">{s.price}</span></div>
          ))}
          <p className="tiny faint">Shoots need the right permits; the pilot arranges approvals for each job.</p>
        </section>
      )}
    </>
  );
}

export function PilotProfile() {
  const { username = '' } = useParams();
  const { userId } = useAuth();
  const profile = useLiveQuery(() => db.profiles.where('username').equals(username).first(), [username]);
  return (
    <main className="screen">
      {profile ? <ProfileView profile={profile} own={profile.id === userId} /> : <><BackButton /><Empty>Pilot not found on this device.</Empty></>}
      <TabBar />
    </main>
  );
}
