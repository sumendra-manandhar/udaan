import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName, WritableTable } from '../db/types';

export type Row = Record<string, unknown> & { id: string; updated_at?: string | null };

/** Why a remote call failed: `network` means try again later; `rejected` means
 * the server refused this change (validation, permissions) and retrying the
 * same data will not help. */
export class RemoteError extends Error {
  constructor(public kind: 'network' | 'rejected' | 'auth', message: string) {
    super(message);
  }
}

export interface PullCursor {
  updated_at: string;
  id: string;
}

export interface Remote {
  isSignedIn(): Promise<boolean>;
  upsert(table: WritableTable, row: Row, onConflict?: string): Promise<void>;
  softDelete(table: WritableTable, id: string): Promise<void>;
  /** Rows changed after the cursor, ordered by (updated_at, id). */
  pull(table: TableName, after: PullCursor | null, limit: number): Promise<Row[]>;
  uploadMedia(path: string, blob: Blob, contentType: string): Promise<void>;
}

function classify(error: { message?: string; code?: string; status?: number } | null, fallback: string): RemoteError {
  const message = error?.message ?? fallback;
  const status = error?.status;
  if (!navigator.onLine || /fetch|network|Failed to fetch|timeout/i.test(message)) {
    return new RemoteError('network', message);
  }
  if (status === 401 || error?.code === 'PGRST301' || /JWT/i.test(message)) {
    return new RemoteError('auth', message);
  }
  if (status !== undefined && status >= 500) return new RemoteError('network', message);
  return new RemoteError('rejected', message);
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async isSignedIn() {
      const { data } = await client.auth.getSession();
      return Boolean(data.session);
    },

    async upsert(table, row, onConflict) {
      const { error, status } = await client.from(table).upsert(row, onConflict ? { onConflict } : undefined);
      if (error) throw classify({ ...error, status }, `upsert ${table} failed`);
    },

    async softDelete(table, id) {
      const { error, status } = await client.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw classify({ ...error, status }, `delete ${table} failed`);
    },

    async pull(table, after, limit) {
      let query = client.from(table).select('*').order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
      if (after) {
        query = query.or(`updated_at.gt.${after.updated_at},and(updated_at.eq.${after.updated_at},id.gt.${after.id})`);
      }
      const { data, error, status } = await query;
      if (error) throw classify({ ...error, status }, `pull ${table} failed`);
      return (data ?? []) as Row[];
    },

    async uploadMedia(path, blob, contentType) {
      const { error } = await client.storage.from('media').upload(path, blob, { contentType, upsert: true });
      if (error) {
        // An object that already exists means an earlier attempt succeeded.
        if (/exists/i.test(error.message)) return;
        throw classify({ message: error.message }, 'upload failed');
      }
    },
  };
}
