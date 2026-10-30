import type { UdaanDB } from '../db/db';
import {
  CLIENT_COLUMNS,
  CONFLICT_TARGET,
  PULL_TABLES,
  type OutboxItem,
  type TableName,
  type WritableTable,
} from '../db/types';
import { RemoteError, type PullCursor, type Remote, type Row } from './remote';

const PAGE = 500;
const MAX_ATTEMPTS = 5;

export interface SyncResult {
  pushed: number;
  pulled: number;
  failed: number;
  offline: boolean;
}

function pick(row: Record<string, unknown>, columns: string[]): Row {
  const out: Record<string, unknown> = {};
  for (const c of columns) if (c in row) out[c] = row[c];
  return out as Row;
}

/** Push local changes, then pull remote ones.
 *
 * Rules:
 * - Writes go to IndexedDB first and an outbox entry is queued; the app never
 *   waits for the network.
 * - Push sends the *current* local row, so several edits made offline become
 *   one request.
 * - Server rows overwrite local ones (last write wins on the server clock),
 *   except rows that still have unsent local changes: those wait until pushed.
 * - Deletes are soft (`deleted_at`) so they reach every device.
 */
export class SyncEngine {
  constructor(private db: UdaanDB, private remote: Remote) {}

  async run(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, failed: 0, offline: false };
    try {
      if (await this.remote.isSignedIn()) {
        await this.pushMedia();
        const push = await this.pushOutbox();
        result.pushed = push.pushed;
        result.failed = push.failed;
      }
      result.pulled = await this.pullAll();
    } catch (e) {
      if (e instanceof RemoteError && e.kind === 'network') {
        result.offline = true;
        return result;
      }
      throw e;
    }
    return result;
  }

  private async pushMedia(): Promise<void> {
    const pending = await this.db.media.where('uploaded').equals(0).toArray();
    for (const m of pending) {
      try {
        await this.remote.uploadMedia(m.path, m.blob, m.content_type);
        await this.db.media.update(m.path, { uploaded: 1 });
      } catch (e) {
        // A file the server refuses (too big, wrong type) must not block sync.
        if (!(e instanceof RemoteError) || e.kind !== 'rejected') throw e;
      }
    }
  }

  private async pushOutbox(): Promise<{ pushed: number; failed: number }> {
    let pushed = 0;
    let failed = 0;
    const items = await this.db.outbox.where('status').equals('pending').sortBy('seq');
    for (const item of items) {
      try {
        await this.pushOne(item);
        await this.db.outbox.delete(item.seq!);
        pushed++;
      } catch (e) {
        if (!(e instanceof RemoteError) || e.kind === 'network' || e.kind === 'auth') throw e;
        const attempts = item.attempts + 1;
        await this.db.outbox.update(item.seq!, {
          attempts,
          error: e.message,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        });
        failed++;
      }
    }
    return { pushed, failed };
  }

  private async pushOne(item: OutboxItem): Promise<void> {
    const table = this.db.table(item.table);
    if (item.op === 'delete') {
      await this.remote.softDelete(item.table, item.row_id);
      await table.delete(item.row_id);
      return;
    }
    const row = (await table.get(item.row_id)) as Record<string, unknown> | undefined;
    if (!row) return; // deleted locally before it was ever sent
    const payload = pick(row, CLIENT_COLUMNS[item.table as WritableTable]);
    await this.remote.upsert(item.table, payload, CONFLICT_TARGET[item.table]);
  }

  private async pullAll(): Promise<number> {
    let total = 0;
    for (const name of PULL_TABLES) total += await this.pullTable(name);
    return total;
  }

  private async pullTable(name: TableName): Promise<number> {
    const key = `cursor:${name}`;
    let cursor = ((await this.db.meta.get(key))?.value as PullCursor | undefined) ?? null;
    let count = 0;
    for (;;) {
      const rows = await this.remote.pull(name, cursor, PAGE);
      if (rows.length === 0) break;
      const pendingIds = new Set(
        (await this.db.outbox.where('table').equals(name).toArray()).map((o) => o.row_id),
      );
      const table = this.db.table(name);
      await this.db.transaction('rw', table, this.db.meta, async () => {
        for (const raw of rows) {
          if (pendingIds.has(raw.id)) continue;
          const { geom: _geom, ...row } = raw as Row & { geom?: unknown };
          void _geom;
          if (row.deleted_at) await table.delete(row.id);
          else await table.put(row);
        }
        const last = rows[rows.length - 1];
        cursor = { updated_at: String(last.updated_at), id: last.id };
        await this.db.meta.put({ key, value: cursor });
      });
      count += rows.length;
      if (rows.length < PAGE) break;
    }
    return count;
  }

  /** Forget pull positions so the next sync re-reads everything (used when
   * the signed-in user changes, because row visibility changes with them). */
  async resetCursors(): Promise<void> {
    await this.db.meta.bulkDelete(PULL_TABLES.map((t) => `cursor:${t}`));
  }
}
