import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/SocialEmbed';
import { SignInPrompt, TopBar } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { parsePostUrl } from '../lib/social';
import { saveRow } from '../sync/mutate';

/** Receives links shared to Udaan from other apps (Android share sheet, when
 * Udaan is installed). Instagram etc. send the link in `text` or `url`. */
export function Share() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const shared = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ');
  const post = parsePostUrl(shared);

  if (!userId) return <main className="screen no-tabs"><TopBar title="Add to Udaan" back="/" /><SignInPrompt what="add posts" /></main>;
  if (!post) {
    return (
      <main className="screen no-tabs">
        <TopBar title="Add to Udaan" back="/" />
        <p className="muted">There was no link in what you shared. In Instagram, YouTube or TikTok, use Share and pick Udaan, or copy the link and paste it when logging a flight.</p>
        <Link className="btn primary" to="/logs/upload">Log a flight</Link>
      </main>
    );
  }
  const link = { url: post.url, platform: post.platform };
  const featured = profile?.featured_posts ?? [];
  const already = featured.some((p) => p.url === link.url);

  async function feature() {
    if (!profile) return;
    setBusy(true);
    await saveRow('profiles', { ...profile, featured_posts: [link, ...featured.filter((p) => p.url !== link.url)].slice(0, 12) });
    navigate('/me?tab=social', { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Add to Udaan" back="/" />
      <PostCard link={link} />
      <p className="small muted">Where should this go?</p>
      <Link className="btn primary block" to={`/logs/upload?link=${encodeURIComponent(link.url)}`}>Log it as a flight</Link>
      <button type="button" className="btn block" disabled={busy || !profile || already} onClick={() => void feature()}>
        {already ? 'Already on your profile' : 'Feature it on my profile'}
      </button>
      {featured.length >= 12 && !already && <p className="tiny faint">Your profile shows up to 12 posts; the oldest will be removed.</p>}
    </main>
  );
}
