import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { Empty, TopBar } from '../components/ui';
import { db } from '../db/db';
import { useAuth } from '../hooks/auth';
import { useOnline, useSyncState } from '../hooks/useApp';
import { MAX_TILES, bestMaxZoom, countTiles, listAreas, removeArea, saveArea, type SavedArea } from '../lib/offlineMaps';
import { syncNow } from '../sync/manager';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as InstallEvent;
});

function bytes(n?: number) {
  if (!n) return '0 MB';
  return `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function Settings() {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const online = useOnline();
  const sync = useSyncState();
  const failed = useLiveQuery(() => db.outbox.where('status').equals('failed').toArray(), []) ?? [];
  const [areas, setAreas] = useState<SavedArea[]>([]);
  const [usage, setUsage] = useState<StorageEstimate | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [zoom, setZoom] = useState(11);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void listAreas().then(setAreas);
    void navigator.storage?.estimate?.().then(setUsage);
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [progress]);

  const minZoom = Math.max(6, Math.floor(zoom) - 1);
  const maxZoom = bounds ? bestMaxZoom(bounds, minZoom) : minZoom;
  const tiles = bounds ? countTiles(bounds, minZoom, maxZoom) : 0;

  async function download() {
    if (!bounds) return;
    setAreaError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: tiles });
    try {
      const name = prompt('Name this area', 'Saved area') ?? 'Saved area';
      await saveArea(name, bounds, minZoom, maxZoom, (done, total) => setProgress({ done, total }), abort.current.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAreaError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Settings and sync" back="/me" />

      <section className="card stack">
        <div className="row between">
          <b>Sync</b>
          <span className={`status-line ${online ? 'good' : 'warn'}`}><span className="dot" />{online ? 'Online' : 'Offline'}</span>
        </div>
        <p className="small muted">
          {sync.status === 'syncing' ? 'Syncing now…' : sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}
        </p>
        <p className="small">{sync.pending ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to upload` : 'Everything is uploaded'}</p>
        {sync.error && <p className="error-text">{sync.error}</p>}
        <button type="button" className="btn small" disabled={!online || sync.status === 'syncing'} onClick={() => void syncNow()}>
          <Icon name="sync" size={16} /> Sync now
        </button>
      </section>

      {failed.length > 0 && (
        <section className="card stack" style={{ borderColor: 'rgba(255,107,94,0.45)' }}>
          <b>Changes the server refused</b>
          {failed.map((f) => (
            <div key={f.seq} className="stack" style={{ gap: 4 }}>
              <span className="small">{f.table.replace('_', ' ')} · <span className="faint">{f.error}</span></span>
              <div className="row">
                <button type="button" className="btn small grow" onClick={async () => { await db.outbox.update(f.seq!, { status: 'pending', attempts: 0 }); void syncNow(); }}>Retry</button>
                <button type="button" className="btn small danger grow" onClick={() => void db.outbox.delete(f.seq!)}>Discard</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="stack">
        <h2>Offline maps</h2>
        <p className="small muted">Maps you browse are kept automatically. Save an area before heading somewhere without signal.</p>
        <div className="map-box" style={{ height: 220 }}>
          <MapView className="map-fill" zoom={11} onMove={(_, b, z) => { setBounds(b); setZoom(z); }} />
        </div>
        <p className="small">
          This view: about {tiles.toLocaleString()} tiles (limit {MAX_TILES.toLocaleString()}), detail up to zoom {maxZoom}.
        </p>
        {progress ? (
          <div className="stack">
            <div className="progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            <div className="row between small"><span>{progress.done} / {progress.total}</span><button type="button" className="btn small" onClick={() => abort.current?.abort()}>Cancel</button></div>
          </div>
        ) : (
          <button type="button" className="btn" disabled={!online || !bounds || tiles > MAX_TILES} onClick={() => void download()}>
            <Icon name="download" size={18} /> Save this area offline
          </button>
        )}
        {areaError && <p className="error-text">{areaError}</p>}
        {areas.length === 0 ? <Empty>No saved areas yet.</Empty> : areas.map((a) => (
          <div key={a.id} className="list-card between">
            <span className="stack" style={{ gap: 0 }}><b>{a.name}</b><span className="small muted">{a.tiles} tiles · zoom {a.minZoom}–{a.maxZoom} · {new Date(a.saved_at).toLocaleDateString()}</span></span>
            <button type="button" className="icon-btn" aria-label={`Forget ${a.name}`} onClick={() => void removeArea(a.id).then(() => listAreas().then(setAreas))}><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </section>

      <section className="card stack">
        <b>Storage on this phone</b>
        <p className="small muted">Using {bytes(usage?.usage)}{usage?.quota ? ` of ${bytes(usage.quota)} available` : ''}.</p>
        <p className="small">{persisted ? 'Offline data is protected from automatic clean-up.' : 'Your browser may clear offline data when space runs low.'}</p>
        {!persisted && navigator.storage?.persist && (
          <button type="button" className="btn small" onClick={() => void navigator.storage.persist().then(setPersisted)}>Keep offline data</button>
        )}
      </section>

      {deferredInstall && (
        <button type="button" className="btn primary" onClick={() => void deferredInstall?.prompt()}>Install Udaan on this phone</button>
      )}

      <section className="stack">
        <Link to="/permits" className="card row between"><span>Permit checklist</span><span className="muted">›</span></Link>
        {session ? (
          <>
            <p className="small muted">Signed in as {session.user.email}{profile && ` (@${profile.username})`}</p>
            <button type="button" className="btn danger" onClick={async () => {
              if (sync.pending && !confirm(`${sync.pending} changes have not uploaded yet and will be lost. Sign out anyway?`)) return;
              await signOut();
              navigate('/', { replace: true });
            }}>
              Sign out
            </button>
          </>
        ) : (
          <Link className="btn primary" to="/signin">Sign in</Link>
        )}
        <p className="tiny faint center">Map data © OpenStreetMap contributors, OpenMapTiles, OpenFreeMap.</p>
      </section>
    </main>
  );
}
