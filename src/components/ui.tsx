import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { MediaRef, Profile } from '../db/types';
import { mediaUrl } from '../lib/media';
import { Icon, type IconName } from './Icon';

export function TabBar() {
  const tabs: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: 'Spots', icon: 'pin' },
    { to: '/events', label: 'Events', icon: 'calendar' },
    { to: '/logs', label: 'Logs', icon: 'logs' },
    { to: '/me', label: 'Profile', icon: 'user' },
  ];
  return (
    <nav className="tabbar" aria-label="App">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={t.icon} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function BackButton({ to, label = 'Back', glass }: { to?: string; label?: string; glass?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`icon-btn${glass ? ' glass' : ''}`}
      aria-label={label}
      onClick={() => (to ? navigate(to) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
    >
      <Icon name="back" />
    </button>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string | true; right?: ReactNode }) {
  return (
    <div className="topbar">
      {back && <BackButton to={back === true ? undefined : back} />}
      <h1 className="grow">{title}</h1>
      {right}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  multiple,
  label,
  scroll,
}: {
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: (v: T | T[]) => void;
  multiple?: boolean;
  label: string;
  scroll?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div className={`chips${scroll ? ' scroll' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={on}
            onClick={() => {
              if (!multiple) onChange(o.value);
              else onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value]);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Media({ media, className, alt = '' }: { media?: MediaRef; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (media) void mediaUrl(media).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [media]);
  if (!media || !url) return <div className={className} />;
  if (media.kind === 'video') {
    return <video className={className} src={url} muted playsInline loop controls preload="metadata" />;
  }
  return <img className={className} src={url} alt={alt} loading="lazy" />;
}

export function Avatar({ profile, size }: { profile?: Profile | null; size?: 'lg' }) {
  const initial = (profile?.display_name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span className={`avatar${size === 'lg' ? ' lg' : ''}`} aria-hidden="true">
      {profile?.avatar_path ? <Media media={{ path: profile.avatar_path, kind: 'image' }} /> : initial}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function DateChip({ iso, hot }: { iso: string; hot?: boolean }) {
  const d = new Date(iso);
  return (
    <span className={`date-chip${hot ? ' hot' : ''}`} aria-hidden="true">
      <small>{d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</small>
      <b>{d.getDate()}</b>
    </span>
  );
}

export function Sparkline({ values, color = 'var(--accent)', label }: { values: number[]; color?: string; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * 350).toFixed(1)} ${(36 - ((v - min) / span) * 32).toFixed(1)}`)
    .join(' ');
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row between tiny mono faint">
        <span>{label.toUpperCase()}</span>
        <span>
          {min.toFixed(1)} to {max.toFixed(1)}
        </span>
      </div>
      <svg viewBox="0 0 350 40" preserveAspectRatio="none" style={{ width: '100%', height: 40 }} aria-hidden="true">
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  return (
    <div className="card stack">
      <p>Sign in to {what}. Everything you add is saved on your phone and syncs when you're online.</p>
      <Link to="/signin?mode=signup" className="btn primary">
        Create a free account
      </Link>
    </div>
  );
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(s?: number | null): string {
  if (!s && s !== 0) return '–';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
