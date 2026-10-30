import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { Airport } from '../db/types';
import { BUNDLED_AIRPORTS } from '../lib/airports';
import { getSyncState, subscribeSync, type SyncState } from '../sync/manager';

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useSyncState(): SyncState & { pending: number; failed: number } {
  const [state, setState] = useState(getSyncState());
  useEffect(() => subscribeSync(setState), []);
  const pending = useLiveQuery(() => db.outbox.where('status').equals('pending').count(), []) ?? 0;
  const failed = useLiveQuery(() => db.outbox.where('status').equals('failed').count(), []) ?? 0;
  const media = useLiveQuery(() => db.media.where('uploaded').equals(0).count(), []) ?? 0;
  return { ...state, pending: pending + media, failed };
}

/** Airports from the synced table, falling back to the bundled list. */
export function useAirports(): Airport[] {
  const rows = useLiveQuery(() => db.airports.toArray(), []);
  return rows && rows.length ? rows : BUNDLED_AIRPORTS;
}

export function useGeolocation(): { pos: GeolocationPosition | null; error: string | null; request: () => void } {
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = () => {
    if (!('geolocation' in navigator)) {
      setError('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos(p);
        setError(null);
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  return { pos, error, request };
}
