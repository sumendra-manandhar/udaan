import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SignOutButton } from '../components/SignOutButton';
import { SignInPrompt, TabBar } from '../components/ui';
import { db } from '../db/db';
import { useAuth } from '../hooks/auth';
import { useSyncState } from '../hooks/useApp';
import { ProfileView } from './PilotProfile';

export function Me() {
  const { userId, profile, session } = useAuth();
  const sync = useSyncState();
  const inbox = useLiveQuery(
    () => (userId ? db.hire_requests.where('pilot_id').equals(userId).filter((r) => r.status === 'sent').count() : 0),
    [userId],
  );

  return (
    <main className="screen">
      <div className="topbar">
        <h1 className="grow">{profile ? '' : 'Profile'}</h1>
        <SignOutButton className="btn small" />
        <Link to="/settings" className="icon-btn" aria-label="Settings and sync">
          <Icon name={sync.status === 'offline' ? 'cloudOff' : 'settings'} />
        </Link>
      </div>
      {!userId && <SignInPrompt what="build your pilot profile" />}
      {userId && profile === null && (
        <div className="card stack">
          <p>Finish your profile to start adding spots and flights.</p>
          <Link className="btn primary" to="/onboarding">Set up profile</Link>
        </div>
      )}
      {profile && (
        <>
          <Link to="/me/requests" className="card row between">
            <span className="row"><Icon name="send" /> Hire requests</span>
            <span className={inbox ? 'tag solid' : 'muted small'}>{inbox ? `${inbox} new` : 'None new'}</span>
          </Link>
          {profile.role === 'moderator' && (
            <Link to="/moderate" className="card row between"><span className="row"><Icon name="shield" /> Review spots</span><span className="muted">›</span></Link>
          )}
          <ProfileView profile={profile} own />
        </>
      )}
      {session && (
        <section className="stack" style={{ marginTop: 8 }}>
          <p className="small muted center">Signed in as {session.user.email}</p>
          <SignOutButton />
        </section>
      )}
      <TabBar />
    </main>
  );
}
