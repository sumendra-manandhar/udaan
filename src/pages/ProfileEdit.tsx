import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PostLinksInput } from '../components/SocialEmbed';
import { Avatar, Chips, TopBar } from '../components/ui';
import type { Profile } from '../db/types';
import { useAuth } from '../hooks/auth';
import { addMedia } from '../lib/media';
import { normaliseSocials, type Socials } from '../lib/social';
import { saveRow } from '../sync/mutate';
import { HOME_BASES, STYLE_OPTIONS } from './Onboarding';

export function ProfileEdit() {
  const { userId, profile } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const loaded = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [socials, setSocials] = useState<Socials>({});
  const [socialErrors, setSocialErrors] = useState<Partial<Record<keyof Socials, string>>>({});

  useEffect(() => {
    if (profile && !loaded.current) {
      loaded.current = true;
      setP(structuredClone(profile));
      setSocials(profile.socials ?? {});
    }
  }, [profile]);

  if (!userId) return <Navigate to="/signin" replace />;
  if (!p) return <main className="screen"><TopBar title="Edit profile" back /></main>;
  const update = (patch: Partial<Profile>) => setP({ ...p, ...patch });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    const { value: cleanSocials, errors } = normaliseSocials(socials);
    setSocialErrors(errors);
    if (Object.keys(errors).length) return setError('Check your social media details.');
    await saveRow('profiles', {
      ...p,
      socials: cleanSocials,
      display_name: p.display_name.trim(),
      services: p.services.filter((s) => s.title.trim()),
      builds: p.builds.filter((b) => b.name.trim()),
    });
    navigate('/me', { replace: true });
  }

  async function avatar(file?: File) {
    if (!file || !userId) return;
    try {
      const ref = await addMedia(file, userId);
      if (ref.kind !== 'image') throw new Error('Pick a photo.');
      update({ avatar_path: ref.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Edit profile" back="/me" />
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <label className="row" style={{ cursor: 'pointer' }}>
          <Avatar profile={p} size="lg" />
          <span className="link small">Change photo</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void avatar(e.target.files?.[0])} />
        </label>
        <div className="field"><label htmlFor="pn">Name</label><input id="pn" className="input" required maxLength={60} value={p.display_name} onChange={(e) => update({ display_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="pb">Bio</label><textarea id="pb" className="textarea" maxLength={280} value={p.bio ?? ''} onChange={(e) => update({ bio: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="ph">Home base</label>
          <select id="ph" className="select" value={p.home_base ?? 'Kathmandu'} onChange={(e) => update({ home_base: e.target.value })}>
            {HOME_BASES.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
        <div className="field"><span className="label">Flying styles</span><Chips label="Flying styles" options={STYLE_OPTIONS} value={p.styles} multiple onChange={(v) => update({ styles: v as string[] })} /></div>
        <label className="toggle-row"><span>My drone has a UIN from CAAN</span><input type="checkbox" checked={p.uin_registered} onChange={(e) => update({ uin_registered: e.target.checked })} /></label>

        <section className="stack">
          <h2>Social media</h2>
          <p className="small muted">Shown on your profile so pilots and clients can find your work.</p>
          {([
            ['instagram', 'Instagram username', 'fpv_yourname'],
            ['youtube', 'YouTube channel', '@YourChannel or channel link'],
            ['tiktok', 'TikTok username', 'yourname'],
            ['facebook', 'Facebook page', 'https://facebook.com/yourpage'],
            ['website', 'Website or portfolio', 'yourname.com'],
          ] as const).map(([key, label, placeholder]) => (
            <div className="field" key={key}>
              <label htmlFor={`social-${key}`}>{label}</label>
              <input
                id={`social-${key}`}
                className="input"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={placeholder}
                value={socials[key] ?? ''}
                onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                aria-invalid={Boolean(socialErrors[key])}
              />
              {socialErrors[key] && <span className="error-text">{socialErrors[key]}</span>}
            </div>
          ))}
        </section>

        <section className="stack">
          <h2>Featured posts</h2>
          <p className="small muted">Pick up to 12 Instagram, YouTube or TikTok posts to show in the Social tab of your profile.</p>
          <PostLinksInput links={p.featured_posts ?? []} onChange={(featured_posts) => update({ featured_posts })} max={12} label="Add a featured post" />
        </section>

        <section className="stack">
          <h2>Quad builds</h2>
          {p.builds.map((b, i) => (
            <div key={i} className="card stack">
              <input className="input" placeholder="Build name" aria-label="Build name" value={b.name} onChange={(e) => update({ builds: p.builds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input className="input" placeholder="Frame · motors · FC · video" aria-label="Build specs" value={b.specs} onChange={(e) => update({ builds: p.builds.map((x, j) => (j === i ? { ...x, specs: e.target.value } : x)) })} />
              <button type="button" className="btn small danger" onClick={() => update({ builds: p.builds.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => update({ builds: [...p.builds, { name: '', specs: '' }] })}><Icon name="plus" size={14} /> Add a build</button>
        </section>

        <label className="toggle-row">
          <span className="stack" style={{ gap: 0 }}><b>Available for hire</b><span className="small muted">Shows a hire button on your profile</span></span>
          <input type="checkbox" checked={p.for_hire} onChange={(e) => update({ for_hire: e.target.checked })} />
        </label>
        {p.for_hire && (
          <section className="stack">
            <h2>Services</h2>
            {p.services.map((s, i) => (
              <div key={i} className="row">
                <input className="input grow" placeholder="e.g. Real estate one-take" aria-label="Service" value={s.title} onChange={(e) => update({ services: p.services.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <input className="input" style={{ width: 120 }} placeholder="NPR price" aria-label="Price" value={s.price} onChange={(e) => update({ services: p.services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" aria-label="Remove service" onClick={() => update({ services: p.services.filter((_, j) => j !== i) })}><Icon name="close" /></button>
              </div>
            ))}
            <button type="button" className="btn small" onClick={() => update({ services: [...p.services, { title: '', price: '' }] })}><Icon name="plus" size={14} /> Add a service</button>
          </section>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="action-bar"><button className="btn primary block">Save profile</button></div>
      </form>
    </main>
  );
}
