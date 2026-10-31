import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { useOnline } from '../hooks/useApp';
import { supabase } from '../lib/supabase';

type Mode = 'signup' | 'signin' | 'forgot';

const USERNAME = /^[a-z0-9_]{3,24}$/;
const MIN_PASSWORD = 8;

/** Turn Supabase auth errors into plain language. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/password/i.test(message) && /(short|least|weak)/i.test(message)) return `Use a password of at least ${MIN_PASSWORD} characters.`;
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection.";
  return message;
}

/** Email + password accounts (Supabase Auth). Creating an account also
 * creates the pilot profile in the database, so there's no extra step. */
export function SignIn() {
  const navigate = useNavigate();
  const online = useOnline();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signin' ? 'signin' : 'signup');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in (for example after the account was created).
  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  // Suggest a username from the name until the pilot types their own.
  const [usernameTouched, setUsernameTouched] = useState(false);
  useEffect(() => {
    if (!usernameTouched) setUsername(name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24));
  }, [name, usernameTouched]);

  // Check the username is free shortly after typing stops.
  useEffect(() => {
    if (mode !== 'signup' || !USERNAME.test(username) || !online) {
      setUsernameState('idle');
      return;
    }
    setUsernameState('checking');
    const t = setTimeout(async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
      if (!error) setUsernameState(data ? 'taken' : 'free');
      else setUsernameState('idle');
    }, 450);
    return () => clearTimeout(t);
  }, [username, mode, online]);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'forgot') {
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password` });
      setBusy(false);
      if (error) setError(friendly(error.message));
      else setNotice(`If ${email.trim()} has an account, we've emailed a link to set a new password.`);
      return;
    }

    if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`);

    if (mode === 'signin') {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setError(friendly(error.message));
      localStorage.setItem('udaan:welcomed', '1');
      navigate('/', { replace: true });
      return;
    }

    // Sign up.
    if (!USERNAME.test(username)) return setError('Username: 3 to 24 lowercase letters, numbers or _.');
    if (usernameState === 'taken') return setError('That username is taken. Try another.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username, display_name: name.trim() },
        emailRedirectTo: location.origin,
      },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    // With email confirmation on, an existing email comes back with no identities.
    if (data.user && data.user.identities?.length === 0) {
      setMode('signin');
      return setError('An account with this email already exists. Sign in instead.');
    }
    localStorage.setItem('udaan:welcomed', '1');
    if (data.session) {
      navigate('/', { replace: true });
    } else {
      setMode('signin');
      setNotice(`Almost there: we've emailed ${email.trim()}. Open the link to confirm your account, then sign in.`);
    }
  }

  const title = mode === 'signup' ? 'Create your pilot account' : mode === 'signin' ? 'Welcome back' : 'Reset your password';

  return (
    <main className="screen no-tabs">
      <TopBar title={title} back />
      {!online && <p className="notice warn">This needs a connection. Browsing the map works offline.</p>}

      {mode !== 'forgot' && (
        <div className="segmented" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>Sign in</button>
        </div>
      )}

      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        {mode === 'signup' && (
          <>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" className="input" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                pattern="[a-z0-9_]{3,24}"
                title="3 to 24 lowercase letters, numbers or _"
                value={username}
                onChange={(e) => {
                  setUsernameTouched(true);
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24));
                }}
                aria-describedby="username-help"
              />
              <span id="username-help" className={`tiny ${usernameState === 'taken' ? 'error-text' : usernameState === 'free' ? '' : 'faint'}`} style={usernameState === 'free' ? { color: 'var(--good)' } : undefined}>
                {usernameState === 'checking' && 'Checking…'}
                {usernameState === 'free' && `@${username} is available`}
                {usernameState === 'taken' && `@${username} is taken`}
                {usernameState === 'idle' && 'Lowercase letters, numbers and _'}
              </span>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                id="password"
                className="input grow"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="btn small" style={{ minHeight: 48 }} onClick={() => setShowPassword((s) => !s)} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {mode === 'signup' && <span className="tiny faint">At least {MIN_PASSWORD} characters</span>}
          </div>
        )}

        {error && <p className="notice bad" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        <button className="btn primary block" disabled={busy || !online}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Email me a reset link'}
        </button>

        {mode === 'signin' && (
          <button type="button" className="btn block" onClick={() => switchTo('forgot')}>Forgot password?</button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="btn block" onClick={() => switchTo('signin')}>Back to sign in</button>
        )}
        {mode === 'signup' && (
          <p className="tiny faint center">
            By creating an account you agree to fly within Nepal's rules. <Link className="link" to="/permits">Permit checklist</Link>
          </p>
        )}
      </form>
    </main>
  );
}
