/** Social media links: recognise posts from Instagram, YouTube, TikTok,
 * Facebook and Vimeo, and work out how to embed them. Only the link is ever
 * stored; embed addresses are derived here, for known platforms only. */

export type Platform = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'vimeo' | 'x' | 'other';

export interface PostLink {
  url: string;
  platform: Platform;
}

export interface ParsedPost extends PostLink {
  /** iframe address, or null when the platform can't be embedded. */
  embed: string | null;
  /** Shape of the embed. */
  shape: 'wide' | 'tall';
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
  x: 'X',
  other: 'Link',
};

export const PLATFORM_SHORT: Record<Platform | 'website', string> = {
  instagram: 'IG',
  youtube: 'YT',
  tiktok: 'TT',
  facebook: 'FB',
  vimeo: 'V',
  x: 'X',
  other: '↗',
  website: 'WWW',
};

/** Pull the first https link out of shared text ("Check this out https://…"). */
export function extractUrl(input: string): string | null {
  const m = input.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  const raw = m[0].replace(/[),.;!?]+$/, '');
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return null;
  }
}

function host(u: URL): string {
  return u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');
}

/** Recognise a post link. Returns null if the text has no usable link. */
export function parsePostUrl(input: string): ParsedPost | null {
  const href = extractUrl(input);
  if (!href) return null;
  const u = new URL(href);
  const h = host(u);
  const parts = u.pathname.split('/').filter(Boolean);
  const clean = `https://${u.hostname}${u.pathname}`;

  if (h === 'instagram.com' || h === 'instagr.am') {
    const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p));
    const code = i >= 0 ? parts[i + 1] : undefined;
    if (code && /^[A-Za-z0-9_-]{5,40}$/.test(code)) {
      const kind = parts[i] === 'p' ? 'p' : 'reel';
      return {
        url: `https://www.instagram.com/${kind}/${code}/`,
        platform: 'instagram',
        embed: `https://www.instagram.com/${kind}/${code}/embed/`,
        shape: 'tall',
      };
    }
    return { url: clean, platform: 'instagram', embed: null, shape: 'tall' };
  }

  if (h === 'youtube.com' || h === 'youtu.be' || h === 'youtube-nocookie.com') {
    let id: string | null = null;
    let tall = false;
    if (h === 'youtu.be') id = parts[0] ?? null;
    else if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (['shorts', 'live', 'embed'].includes(parts[0])) {
      id = parts[1] ?? null;
      tall = parts[0] === 'shorts';
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return {
        url: tall ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
        platform: 'youtube',
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
        shape: tall ? 'tall' : 'wide',
      };
    }
    return { url: clean, platform: 'youtube', embed: null, shape: 'wide' };
  }

  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) {
    const i = parts.indexOf('video');
    const id = i >= 0 ? parts[i + 1] : undefined;
    if (id && /^\d{8,25}$/.test(id)) {
      return { url: clean, platform: 'tiktok', embed: `https://www.tiktok.com/embed/v2/${id}`, shape: 'tall' };
    }
    // Short share links (vm.tiktok.com/…) can't be embedded without the full address.
    return { url: href, platform: 'tiktok', embed: null, shape: 'tall' };
  }

  if (h === 'vimeo.com') {
    const id = parts.find((p) => /^\d{5,12}$/.test(p));
    if (id) return { url: `https://vimeo.com/${id}`, platform: 'vimeo', embed: `https://player.vimeo.com/video/${id}`, shape: 'wide' };
    return { url: clean, platform: 'vimeo', embed: null, shape: 'wide' };
  }

  if (h === 'facebook.com' || h === 'fb.watch') {
    const isVideo = h === 'fb.watch' || parts.includes('videos') || parts.includes('reel') || parts[0] === 'watch';
    if (isVideo) {
      const target = h === 'facebook.com' && parts[0] === 'watch' ? href : clean;
      return {
        url: target,
        platform: 'facebook',
        embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(target)}&show_text=false`,
        shape: 'wide',
      };
    }
    return { url: clean, platform: 'facebook', embed: null, shape: 'wide' };
  }

  if (h === 'x.com' || h === 'twitter.com') return { url: clean, platform: 'x', embed: null, shape: 'wide' };

  return { url: href, platform: 'other', embed: null, shape: 'wide' };
}

/** Rebuild the embed details from a stored link. */
export function toParsed(link: PostLink): ParsedPost {
  return parsePostUrl(link.url) ?? { ...link, embed: null, shape: 'wide' };
}

// ---------------------------------------------------------------------------
// Profile accounts
// ---------------------------------------------------------------------------

export interface Socials {
  instagram?: string; // username
  youtube?: string; // channel URL or @handle
  tiktok?: string; // username
  facebook?: string; // page URL
  website?: string; // URL
}

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

function handleFrom(input: string, domain: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const fromUrl = v.match(new RegExp(`${domain.replace('.', '\\.')}/@?([A-Za-z0-9._]{1,30})`, 'i'));
  const h = (fromUrl ? fromUrl[1] : v).replace(/^@/, '');
  return HANDLE.test(h) ? h : null;
}

/** Tidy what a pilot typed into the profile form. Returns an error message
 * per field that couldn't be understood. */
export function normaliseSocials(input: Socials): { value: Socials; errors: Partial<Record<keyof Socials, string>> } {
  const value: Socials = {};
  const errors: Partial<Record<keyof Socials, string>> = {};
  if (input.instagram?.trim()) {
    const h = handleFrom(input.instagram, 'instagram.com');
    if (h) value.instagram = h;
    else errors.instagram = 'Use your Instagram username, like fpv_sumendra';
  }
  if (input.tiktok?.trim()) {
    const h = handleFrom(input.tiktok, 'tiktok.com');
    if (h) value.tiktok = h;
    else errors.tiktok = 'Use your TikTok username';
  }
  if (input.youtube?.trim()) {
    const v = input.youtube.trim();
    if (/^@[A-Za-z0-9._-]{3,30}$/.test(v)) value.youtube = `https://www.youtube.com/${v}`;
    else {
      const url = extractUrl(v);
      if (url && /(^|\.)youtube\.com$/.test(new URL(url).hostname)) value.youtube = url;
      else errors.youtube = 'Paste your channel link, or your @handle';
    }
  }
  if (input.facebook?.trim()) {
    const url = extractUrl(input.facebook.trim());
    if (url && /(^|\.)facebook\.com$/.test(new URL(url).hostname)) value.facebook = url;
    else errors.facebook = 'Paste your Facebook page link';
  }
  if (input.website?.trim()) {
    const url = extractUrl(input.website.trim()) ?? extractUrl(`https://${input.website.trim()}`);
    if (url) value.website = url;
    else errors.website = 'Paste a full link, like https://example.com';
  }
  return { value, errors };
}

export function socialLinks(s: Socials | undefined | null): { platform: Platform | 'website'; label: string; href: string }[] {
  if (!s) return [];
  const out: { platform: Platform | 'website'; label: string; href: string }[] = [];
  if (s.instagram) out.push({ platform: 'instagram', label: `@${s.instagram}`, href: `https://www.instagram.com/${s.instagram}/` });
  if (s.youtube) out.push({ platform: 'youtube', label: 'YouTube', href: s.youtube });
  if (s.tiktok) out.push({ platform: 'tiktok', label: `@${s.tiktok}`, href: `https://www.tiktok.com/@${s.tiktok}` });
  if (s.facebook) out.push({ platform: 'facebook', label: 'Facebook', href: s.facebook });
  if (s.website) out.push({ platform: 'website', label: new URL(s.website).hostname.replace(/^www\./, ''), href: s.website });
  return out;
}
