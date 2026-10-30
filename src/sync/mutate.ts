import { db as defaultDb, type UdaanDB } from '../db/db';
import type { TableRows, WritableTable } from '../db/types';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called after every local write so the sync manager can push soon. */
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Save a row on the device and queue it for upload. Works offline. */
export async function saveRow<T extends WritableTable>(
  table: T,
  row: TableRows[T],
  database: UdaanDB = defaultDb,
): Promise<TableRows[T]> {
  const t = database.table(table);
  await database.transaction('rw', t, database.outbox, async () => {
    const existing = (await t.get(row.id)) as TableRows[T] | undefined;
    const merged = { ...existing, ...row, deleted_at: null } as TableRows[T];
    await t.put(merged);
    const queued = await database.outbox
      .where('row_id')
      .equals(row.id)
      .filter((o) => o.table === table && o.op === 'upsert' && o.status === 'pending')
      .first();
    if (!queued) {
      await database.outbox.add({
        table,
        row_id: row.id,
        op: 'upsert',
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      });
    }
  });
  notify();
  return row;
}

/** Delete a row everywhere. It disappears locally at once. */
export async function deleteRow(table: WritableTable, id: string, database: UdaanDB = defaultDb): Promise<void> {
  const t = database.table(table);
  await database.transaction('rw', t, database.outbox, async () => {
    const pending = await database.outbox.where('row_id').equals(id).filter((o) => o.table === table).toArray();
    const neverSent = pending.some((o) => o.op === 'upsert') && !(await wasSynced(t, id));
    await database.outbox.bulkDelete(pending.map((o) => o.seq!));
    await t.delete(id);
    if (!neverSent) {
      await database.outbox.add({
        table,
        row_id: id,
        op: 'delete',
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      });
    }
  });
  notify();
}

async function wasSynced(t: { get: (id: string) => Promise<unknown> }, id: string): Promise<boolean> {
  const row = (await t.get(id)) as { updated_at?: string | null } | undefined;
  return Boolean(row?.updated_at);
}

/** Keep a photo or clip on the device until it can be uploaded. */
export async function queueMedia(path: string, blob: Blob, database: UdaanDB = defaultDb): Promise<void> {
  await database.media.put({
    path,
    blob,
    content_type: blob.type || 'application/octet-stream',
    uploaded: 0,
    created_at: new Date().toISOString(),
  });
  notify();
}
