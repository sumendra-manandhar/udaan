import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// The session is kept in localStorage, so a signed-in pilot stays signed in
// offline and their queued changes push as soon as the network returns.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function publicMediaUrl(path: string): string {
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
