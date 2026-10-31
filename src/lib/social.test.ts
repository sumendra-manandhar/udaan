import { describe, expect, it } from 'vitest';
import { extractUrl, normaliseSocials, parsePostUrl } from './social';

describe('post links', () => {
  it('finds the link inside shared text', () => {
    expect(extractUrl('Check my dive! https://www.instagram.com/reel/C9abcDEF123/?igsh=xyz.')).toBe('https://www.instagram.com/reel/C9abcDEF123/?igsh=xyz');
    expect(extractUrl('no link here')).toBeNull();
  });

  it('embeds Instagram posts and reels', () => {
    const reel = parsePostUrl('https://www.instagram.com/reel/C9abcDEF123/?igsh=xyz')!;
    expect(reel.platform).toBe('instagram');
    expect(reel.embed).toBe('https://www.instagram.com/reel/C9abcDEF123/embed/');
    expect(reel.url).toBe('https://www.instagram.com/reel/C9abcDEF123/');
    expect(parsePostUrl('https://instagram.com/p/Cxyz12345/')!.embed).toBe('https://www.instagram.com/p/Cxyz12345/embed/');
    expect(parsePostUrl('https://www.instagram.com/someone/')!.embed).toBeNull();
  });

  it('embeds YouTube videos and Shorts', () => {
    expect(parsePostUrl('https://youtu.be/dQw4w9WgXcQ?si=abc')!.embed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(parsePostUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')!.shape).toBe('wide');
    const short = parsePostUrl('https://youtube.com/shorts/dQw4w9WgXcQ')!;
    expect(short.shape).toBe('tall');
    expect(short.embed).toContain('dQw4w9WgXcQ');
  });

  it('embeds TikTok videos, but not short share links', () => {
    expect(parsePostUrl('https://www.tiktok.com/@pilot/video/7234567890123456789')!.embed).toBe('https://www.tiktok.com/embed/v2/7234567890123456789');
    expect(parsePostUrl('https://vm.tiktok.com/ZMabc123/')!.embed).toBeNull();
  });

  it('handles Facebook, Vimeo, X and other links', () => {
    expect(parsePostUrl('https://www.facebook.com/page/videos/123456789/')!.embed).toContain('facebook.com/plugins/video.php');
    expect(parsePostUrl('https://vimeo.com/123456789')!.embed).toBe('https://player.vimeo.com/video/123456789');
    expect(parsePostUrl('https://x.com/a/status/1')!.embed).toBeNull();
    expect(parsePostUrl('https://example.com/my-video')!.platform).toBe('other');
  });

  it('never embeds unknown sites', () => {
    expect(parsePostUrl('https://evil.example/instagram.com/reel/AAAAAAA/')!.embed).toBeNull();
  });
});

describe('profile accounts', () => {
  it('accepts usernames or profile links', () => {
    const { value, errors } = normaliseSocials({
      instagram: 'https://www.instagram.com/fpv_sumendra/',
      tiktok: '@sumendra.fpv',
      youtube: '@SumendraFPV',
      website: 'sumendramanandhar.com.np',
    });
    expect(errors).toEqual({});
    expect(value.instagram).toBe('fpv_sumendra');
    expect(value.tiktok).toBe('sumendra.fpv');
    expect(value.youtube).toBe('https://www.youtube.com/@SumendraFPV');
    expect(value.website).toBe('https://sumendramanandhar.com.np/');
  });

  it('flags things it cannot use', () => {
    const { errors } = normaliseSocials({ instagram: 'not a handle!', facebook: 'https://example.com' });
    expect(errors.instagram).toBeTruthy();
    expect(errors.facebook).toBeTruthy();
  });
});
