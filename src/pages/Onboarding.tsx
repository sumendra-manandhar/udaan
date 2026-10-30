import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Chips, TopBar } from '../components/ui';
import { db } from '../db/db';
import type { Profile } from '../db/types';
import { useAuth } from '../hooks/auth';
import { supabase } from '../lib/supabase';
import { syncNow } from '../sync/manager';

export const STYLE_OPTIONS = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'racing', label: 'Racing' },
  { value: 'whoops', label: 'Tiny whoops' },
  { value: 'long-range', label: 'Long range' },
  { value: 'beginner', label: 'Just starting' },
];

export const HOME_BASES = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan', 'Butwal', 'Biratnagar', 'Dharan', 'Other'];

export function Onboarding() {
  const { session, userId, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [home, setHome] = useState('Kathmandu');
  const [styles, setStyles] = useState<string[]>(['freestyle']);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Navigate to="/signin" replace />;
  if (profile) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    const row: Profile = {
      id: userId,
      username: username.trim().toLowerCase(),
      display_name: name.trim(),
      home_base: home,
      styles,
      for_hire: false,
      services: [],
      builds: [],
      uin_registered: false,
    };
    // Username uniqueness needs the server, so this one write is online.
    const { error } = await supabase.from('profiles').insert(row);
    setBusy(false);
    if (error) {
      setError(/duplicate|unique/i.test(error.message) ? 'That username is taken.' : error.message);
      return;
    }
    await db.profiles.put(row);
    void syncNow();
    navigate('/', { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Set up your pilot profile" />
      <form className="stack" onSubmit={submit} style={{ gap: 18 }}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            required
            pattern="[a-z0-9_]{3,24}"
            title="3 to 24 lowercase letters, numbers or _"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
          />
          <span className="tiny faint">Your profile link: udaan/@{username || 'username'}</span>
        </div>
        <div className="field">
          <label htmlFor="home">Home base</label>
          <select id="home" className="select" value={home} onChange={(e) => setHome(e.target.value)}>
            {HOME_BASES.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label">How do you fly? Pick any</span>
          <Chips label="Flying styles" options={STYLE_OPTIONS} value={styles} multiple onChange={(v) => setStyles(v as string[])} />
        </div>
        <label className="check">
          <input type="checkbox" required checked={rules} onChange={(e) => setRules(e.target.checked)} />
          <span>
            I'll check the rules before I fly. <Link className="link" to="/permits">See the permit checklist</Link>
          </span>
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Saving…' : 'Continue to the map'}
        </button>
      </form>
    </main>
  );
}
