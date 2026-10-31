import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { supabase } from '../lib/supabase';

/** Landing page for the password-reset email. Supabase signs the pilot in
 * from the link, then they choose a new password here. */
export function ResetPassword() {
  const navigate = useNavigate();
  const { ready, session } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // Give the link a moment to be read before deciding it's invalid.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    localStorage.setItem('udaan:welcomed', '1');
    navigate('/', { replace: true });
  }

  if (ready && !session && waited) {
    return (
      <main className="screen no-tabs">
        <TopBar title="Reset link expired" back="/signin?mode=signin" />
        <p className="muted">This link is no longer valid. Request a new one and use it within an hour.</p>
        <Link className="btn primary" to="/signin?mode=signin">Back to sign in</Link>
      </main>
    );
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Choose a new password" />
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="newpw">New password</label>
          <input id="newpw" className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="tiny faint">At least 8 characters</span>
        </div>
        {error && <p className="notice bad" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy || !session}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  );
}
