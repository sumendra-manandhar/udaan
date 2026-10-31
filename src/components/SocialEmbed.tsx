import { useState } from 'react';
import { useOnline } from '../hooks/useApp';
import { PLATFORM_LABEL, PLATFORM_SHORT, parsePostUrl, toParsed, type PostLink } from '../lib/social';
import { Icon } from './Icon';

/** A link card for a post: platform, address and an Open button. Used on its
 * own while editing, and under or instead of the embed. */
export function PostCard({ link, onRemove }: { link: PostLink; onRemove?: () => void }) {
  const host = (() => {
    try {
      const u = new URL(link.url);
      return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
    } catch {
      return link.url;
    }
  })();
  return (
    <div className="list-card">
      <span className={`platform-badge platform-${link.platform}`} aria-hidden="true">{PLATFORM_SHORT[link.platform]}</span>
      <span className="stack grow" style={{ gap: 0, minWidth: 0 }}>
        <b className="small">{PLATFORM_LABEL[link.platform]} post</b>
        <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host}</span>
      </span>
      {onRemove ? (
        <button type="button" className="icon-btn" aria-label="Remove link" onClick={onRemove}><Icon name="close" size={16} /></button>
      ) : (
        <a className="btn small" href={link.url} target="_blank" rel="noopener noreferrer">Open</a>
      )}
    </div>
  );
}

/** The post itself, embedded from the platform. Embeds load only when online
 * and only after a tap, so the page stays fast and nothing is fetched from
 * the platform until the viewer asks. */
export function SocialEmbed({ link }: { link: PostLink }) {
  const online = useOnline();
  const [show, setShow] = useState(false);
  const post = toParsed(link);
  if (!post.embed || !online) {
    return (
      <div className="stack" style={{ gap: 4 }}>
        <PostCard link={link} />
        {!online && post.embed && <span className="tiny faint">Connect to watch this post here.</span>}
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      {show ? (
        <div className={`embed embed-${post.shape} embed-${post.platform}`}>
          <iframe
            src={post.embed}
            title={`${PLATFORM_LABEL[post.platform]} post`}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          />
        </div>
      ) : (
        <button type="button" className={`embed-placeholder embed-${post.shape}`} onClick={() => setShow(true)}>
          <span className={`platform-badge platform-${post.platform}`} aria-hidden="true">{PLATFORM_SHORT[post.platform]}</span>
          <span className="stack" style={{ gap: 2, alignItems: 'center' }}>
            <b>Play {PLATFORM_LABEL[post.platform]} post</b>
            <span className="tiny muted">Loads from {PLATFORM_LABEL[post.platform]}</span>
          </span>
        </button>
      )}
      <a className="link tiny" href={post.url} target="_blank" rel="noopener noreferrer">Open on {PLATFORM_LABEL[post.platform]} →</a>
    </div>
  );
}

/** Paste box for adding post links, with the list of added ones. */
export function PostLinksInput({
  links,
  onChange,
  max,
  label = 'Add a post link',
}: {
  links: PostLink[];
  onChange: (links: PostLink[]) => void;
  max: number;
  label?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(raw = text) {
    setError(null);
    const post = parsePostUrl(raw);
    if (!post) return setError('Paste a link that starts with https://');
    if (links.some((l) => l.url === post.url)) return setError('Already added.');
    if (links.length >= max) return setError(`Up to ${max} links.`);
    onChange([...links, { url: post.url, platform: post.platform }]);
    setText('');
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) await add(t);
    } catch {
      setError('Couldn’t read the clipboard. Long-press the box and paste.');
    }
  }

  return (
    <div className="stack">
      {links.map((l) => (
        <PostCard key={l.url} link={l} onRemove={() => onChange(links.filter((x) => x.url !== l.url))} />
      ))}
      {links.length < max && (
        <div className="row" style={{ gap: 8 }}>
          <label className="sr-only" htmlFor="post-link">{label}</label>
          <input
            id="post-link"
            className="input grow"
            inputMode="url"
            placeholder="Paste an Instagram, YouTube or TikTok link"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              }
            }}
          />
          {text.trim() ? (
            <button type="button" className="btn small" style={{ minHeight: 48 }} onClick={() => void add()}>Add</button>
          ) : (
            'clipboard' in navigator && (
              <button type="button" className="btn small" style={{ minHeight: 48 }} onClick={() => void paste()}>Paste</button>
            )
          )}
        </div>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
