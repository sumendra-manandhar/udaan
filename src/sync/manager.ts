import { db } from '../db/db';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { SyncEngine, type SyncResult } from './engine';
import { onLocalChange } from './mutate';
import { supabaseRemote } from './remote';

export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  lastResult: SyncResult | null;
  error: string | null;
}

const engine = new SyncEngine(db, supabaseRemote(supabase));
let state: SyncState = {
  status: navigator.onLine ? 'idle' : 'offline',
  lastSyncedAt: localStorage.getItem('udaan:lastSyncedAt'),
  lastResult: null,
  error: null,
};
const subscribers = new Set<(s: SyncState) => void>();
let running: Promise<void> | null = null;
let again = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<SyncState>) {
  state = { ...state, ...next };
  for (const fn of subscribers) fn(state);
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Run one sync. Concurrent calls share a run; a call during a run schedules
 * exactly one more afterwards. */
export function syncNow(): Promise<void> {
  if (!supabaseConfigured) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  if (!navigator.onLine) {
    set({ status: 'offline' });
    return Promise.resolve();
  }
  set({ status: 'syncing', error: null });
  running = engine
    .run()
    .then((result) => {
      const at = new Date().toISOString();
      if (!result.offline) localStorage.setItem('udaan:lastSyncedAt', at);
      set({
        status: result.offline ? 'offline' : 'idle',
        lastSyncedAt: result.offline ? state.lastSyncedAt : at,
        lastResult: result,
      });
    })
    .catch((e: unknown) => set({ status: 'error', error: e instanceof Error ? e.message : String(e) }))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

export async function resetAndResync(): Promise<void> {
  await engine.resetCursors();
  await syncNow();
}

let started = false;
/** Sync on start, when the network returns, when the app comes back to the
 * foreground, shortly after any local change, and every 2 minutes. */
export function startSync(): void {
  if (started) return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => set({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  onLocalChange(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), 1500);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 120_000);
  void syncNow();
}

/** Remove everything personal from this device (used on sign-out). */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.spots, db.events, db.rsvps, db.flights, db.hire_requests, db.checkins, db.outbox, db.media, db.meta, db.profiles], async () => {
    await Promise.all([
      db.spots.clear(), db.events.clear(), db.rsvps.clear(), db.flights.clear(),
      db.hire_requests.clear(), db.checkins.clear(), db.outbox.clear(), db.media.clear(), db.profiles.clear(),
    ]);
    const keep = await db.meta.where('key').startsWith('area:').toArray();
    await db.meta.clear();
    await db.meta.bulkPut(keep);
  });
  localStorage.removeItem('udaan:lastSyncedAt');
}
