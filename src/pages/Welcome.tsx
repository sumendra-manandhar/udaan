import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Icon';
import { useAuth } from '../hooks/auth';

export function Welcome() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const enter = (to: string) => {
    localStorage.setItem('udaan:welcomed', '1');
    navigate(to);
  };
  return (
    <main className="welcome">
      <div style={{ position: 'absolute', top: 'calc(24px + env(safe-area-inset-top, 0px))', left: 24 }}>
        <Logo />
      </div>
      <h1 style={{ fontSize: 40, letterSpacing: '-0.02em' }}>Find where to fly in Nepal.</h1>
      <p style={{ fontSize: 17, color: 'var(--text-2)' }}>
        Spots, events and pilots near you, with airport rings checked before you take off. Works offline in the hills.
      </p>
      {session ? (
        <button type="button" className="btn primary block" onClick={() => enter('/')}>
          Open the map
        </button>
      ) : (
        <>
          <button type="button" className="btn primary block" onClick={() => enter('/signin?mode=signup')}>
            Create pilot account
          </button>
          <button type="button" className="btn block" onClick={() => enter('/')}>
            Explore the map first
          </button>
          <p className="center small muted">
            Already flying with us?{' '}
            <Link className="link" to="/signin?mode=signin" onClick={() => localStorage.setItem('udaan:welcomed', '1')}>
              Sign in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
