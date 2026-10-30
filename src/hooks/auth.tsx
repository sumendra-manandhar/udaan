import type { Session } from '@supabase/supabase-js';
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import type { Profile } from '../db/types';
import { supabase } from '../lib/supabase';
import { clearLocalData, resetAndResync } from '../sync/manager';

interface AuthValue {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null | undefined; // undefined while loading
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Who can see which rows changed: re-read everything.
      if (event === 'SIGNED_IN') void resetAndResync();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  // Tag each result with the user it was read for. Right after the session
  // loads, the hook can still hold the result for "no user"; treating that as
  // "this user has no profile" sent pilots to onboarding by mistake.
  const lookup = useLiveQuery(
    async () => ({ for: userId, row: userId ? ((await db.profiles.get(userId)) ?? null) : null }),
    [userId],
  );
  const profile = !ready || !lookup || lookup.for !== userId ? undefined : lookup.row;

  async function signOut() {
    await supabase.auth.signOut();
    await clearLocalData();
    await resetAndResync();
  }

  return (
    <AuthContext.Provider value={{ ready, session, userId, profile, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
