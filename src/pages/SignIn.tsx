import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/ui';
import { useOnline } from '../hooks/useApp';
import { supabase } from '../lib/supabase';

/** Email one-time code. A code (not a magic link) keeps sign-in inside the
 * installed app instead of bouncing to the browser. */
export function SignIn() {
  const navigate = useNavigate();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
    else {
      localStorage.setItem('udaan:welcomed', '1');
      navigate('/', { replace: true });
    }
  }

  return (
    <main className="screen no-tabs">
      <TopBar title={sent ? 'Check your email' : 'Sign in'} back />
      {!online && <p className="notice warn">Signing in needs a connection. Browsing the map works offline.</p>}
      {!sent ? (
        <form className="stack" onSubmit={sendCode}>
          <p className="muted">We'll email you a 6-digit code. No password needed.</p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy || !online}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <p className="muted">Enter the code we sent to {email}.</p>
          <div className="field">
            <label htmlFor="code">Code</label>
            <input
              id="code"
              className="input mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ fontSize: 22, letterSpacing: 6 }}
            />
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy || !online}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="btn block" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}
    </main>
  );
}
