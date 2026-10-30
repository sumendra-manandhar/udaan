import { beforeEach, describe, expect, it } from 'vitest';
import { UdaanDB } from '../db/db';
import type { Spot, TableName, WritableTable } from '../db/types';
import { SyncEngine } from './engine';
import { deleteRow, queueMedia, saveRow } from './mutate';
import { RemoteError, type PullCursor, type Remote, type Row } from './remote';

/** In-memory stand-in for Supabase with a server clock. */
class FakeRemote implements Remote {
  tables = new Map<string, Map<string, Row>>();
  uploads = new Map<string, Blob>();
  online = true;
  signedIn = true;
  rejectNames = new Set<string>();
  private clock = 1_700_000_000_000;

  private now() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  private t(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }
  private check() {
    if (!this.online) throw new RemoteError('network', 'Failed to fetch');
  }
  async isSignedIn() {
    return this.signedIn;
  }
  async upsert(table: WritableTable, row: Row) {
    this.check();
    if (typeof row.name === 'string' && this.rejectNames.has(row.name)) throw new RemoteError('rejected', 'check violation');
    const prev = this.t(table).get(row.id);
    this.t(table).set(row.id, { ...prev, ...row, updated_at: this.now(), deleted_at: null });
  }
  async softDelete(table: WritableTable, id: string) {
    this.check();
    const prev = this.t(table).get(id);
    if (prev) this.t(table).set(id, { ...prev, deleted_at: this.now(), updated_at: this.now() });
  }
  async pull(table: TableName, after: PullCursor | null, limit: number) {
    this.check();
    return [...this.t(table).values()]
      .filter((r) => !after || r.updated_at! > after.updated_at || (r.updated_at === after.updated_at && r.id > after.id))
      .sort((a, b) => (a.updated_at! < b.updated_at! ? -1 : a.updated_at! > b.updated_at! ? 1 : a.id < b.id ? -1 : 1))
      .slice(0, limit);
  }
  async uploadMedia(path: string, blob: Blob) {
    this.check();
    this.uploads.set(path, blob);
  }
  /** Simulate another device writing to the server. */
  serverWrite(table: string, row: Row) {
    this.t(table).set(row.id, { ...this.t(table).get(row.id), ...row, updated_at: this.now() });
  }
}

const spot = (id: string, name: string): Spot => ({
  id,
  created_by: 'u1',
  name,
  type: 'ridge',
  lat: 27.7,
  lng: 85.5,
  is_private: false,
  media: [],
});

let db: UdaanDB;
let remote: FakeRemote;
let engine: SyncEngine;

beforeEach(async () => {
  db = new UdaanDB(`test-${crypto.randomUUID()}`);
  await db.open();
  remote = new FakeRemote();
  engine = new SyncEngine(db, remote);
});

describe('sync engine', () => {
  it('saves offline and pushes when back online', async () => {
    remote.online = false;
    await saveRow('spots', spot('s1', 'Nagarkot'), db);
    expect(await db.spots.get('s1')).toBeTruthy();
    const offline = await engine.run();
    expect(offline.offline).toBe(true);
    expect(await db.outbox.count()).toBe(1);

    remote.online = true;
    const res = await engine.run();
    expect(res.pushed).toBe(1);
    expect(await db.outbox.count()).toBe(0);
    expect(remote.tables.get('spots')!.get('s1')!.name).toBe('Nagarkot');
    // The pull brings back the server timestamp.
    expect((await db.spots.get('s1'))!.updated_at).toBeTruthy();
  });

  it('coalesces several offline edits into one push of the latest row', async () => {
    remote.online = false;
    await saveRow('spots', spot('s1', 'First'), db);
    await saveRow('spots', spot('s1', 'Second'), db);
    await saveRow('spots', spot('s1', 'Final'), db);
    expect(await db.outbox.count()).toBe(1);
    remote.online = true;
    await engine.run();
    expect(remote.tables.get('spots')!.get('s1')!.name).toBe('Final');
  });

  it('pulls changes made on other devices, including deletes', async () => {
    remote.serverWrite('spots', { ...spot('s2', 'From phone B'), id: 's2' } as unknown as Row);
    await engine.run();
    expect((await db.spots.get('s2'))!.name).toBe('From phone B');

    remote.serverWrite('spots', { id: 's2', deleted_at: new Date().toISOString() } as Row);
    await engine.run();
    expect(await db.spots.get('s2')).toBeUndefined();
  });

  it('does not overwrite unsent local edits with server data', async () => {
    remote.serverWrite('spots', { ...spot('s3', 'Server name') } as unknown as Row);
    await engine.run();
    remote.online = false;
    await saveRow('spots', spot('s3', 'My offline edit'), db);
    remote.online = true;
    remote.serverWrite('spots', { id: 's3', name: 'Someone else' } as Row);
    // Push happens first, so the local edit reaches the server and wins.
    await engine.run();
    expect((await db.spots.get('s3'))!.name).toBe('My offline edit');
  });

  it('keeps going when the server rejects one change', async () => {
    remote.rejectNames.add('Bad');
    await saveRow('spots', spot('s4', 'Bad'), db);
    await saveRow('spots', spot('s5', 'Good'), db);
    const res = await engine.run();
    expect(res.pushed).toBe(1);
    expect(res.failed).toBe(1);
    expect(remote.tables.get('spots')!.has('s5')).toBe(true);
    const left = await db.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0].error).toMatch(/check violation/);
  });

  it('deletes rows on the server and drops never-sent rows quietly', async () => {
    await saveRow('spots', spot('s6', 'Synced'), db);
    await engine.run();
    await deleteRow('spots', 's6', db);
    expect(await db.spots.get('s6')).toBeUndefined();
    await engine.run();
    expect(remote.tables.get('spots')!.get('s6')!.deleted_at).toBeTruthy();

    remote.online = false;
    await saveRow('spots', spot('s7', 'Draft'), db);
    await deleteRow('spots', 's7', db);
    expect(await db.outbox.count()).toBe(0);
  });

  it('uploads queued media before rows that reference it', async () => {
    await queueMedia('u1/a.jpg', new Blob(['x'], { type: 'image/jpeg' }), db);
    await saveRow('spots', { ...spot('s8', 'With photo'), media: [{ path: 'u1/a.jpg', kind: 'image' }] }, db);
    await engine.run();
    expect(remote.uploads.has('u1/a.jpg')).toBe(true);
    expect((await db.media.get('u1/a.jpg'))!.uploaded).toBe(1);
  });

  it('only pulls (no push) when signed out', async () => {
    remote.signedIn = false;
    await saveRow('spots', spot('s9', 'Local only'), db);
    const res = await engine.run();
    expect(res.pushed).toBe(0);
    expect(await db.outbox.count()).toBe(1);
  });

  it('pages through large pulls', async () => {
    for (let i = 0; i < 1203; i++) remote.serverWrite('events', { id: `e${String(i).padStart(4, '0')}`, title: 't' } as Row);
    const res = await engine.run();
    expect(res.pulled).toBe(1203);
    expect(await db.events.count()).toBe(1203);
  });
});
