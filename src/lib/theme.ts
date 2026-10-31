import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'udaan:theme';
const listeners = new Set<() => void>();
const media = window.matchMedia('(prefers-color-scheme: light)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(pref = getThemePref()): Theme {
  if (pref !== 'system') return pref;
  return media.matches ? 'light' : 'dark';
}

/** Put the chosen theme on <html> (the CSS reads data-theme; with no
 * attribute it follows the phone's setting) and match the browser bar. */
export function applyTheme(): void {
  const pref = getThemePref();
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#0E1012');
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
  applyTheme();
  listeners.forEach((fn) => fn());
}

media.addEventListener('change', () => {
  applyTheme();
  listeners.forEach((fn) => fn());
});

export function useTheme(): { pref: ThemePref; theme: Theme; setPref: (p: ThemePref) => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { pref: getThemePref(), theme: resolveTheme(), setPref: setThemePref };
}
