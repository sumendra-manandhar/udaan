import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/ui';
import { getMeta, setMeta } from '../db/db';
import { PERMIT_STEPS, REVIEWED_ON } from '../lib/permits';

const KEY = 'permits:done';

/** Progress is kept on this device only; it's personal and works offline. */
export function Permits() {
  const done = useLiveQuery(() => getMeta<string[]>(KEY, []), []) ?? [];
  const count = PERMIT_STEPS.filter((s) => done.includes(s.id)).length;

  async function toggle(id: string) {
    const current = await getMeta<string[]>(KEY, []);
    await setMeta(KEY, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Permit checklist" back />
      <div className="card stack">
        <div className="row between small">
          <b>Your progress</b>
          <span className="muted">{count} of {PERMIT_STEPS.length} done</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={PERMIT_STEPS.length}>
          <div style={{ width: `${(count / PERMIT_STEPS.length) * 100}%` }} />
        </div>
      </div>
      <p className="notice warn">
        This is guidance, not legal advice. Rules change: confirm each step with CAAN and your District Administration Office. Last reviewed: {REVIEWED_ON}.
      </p>
      <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {PERMIT_STEPS.map((s) => (
          <li key={s.id} className={`card${done.includes(s.id) ? '' : ' accent'}`} style={done.includes(s.id) ? undefined : { borderColor: 'var(--line)' }}>
            <label className="check" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={done.includes(s.id)} onChange={() => void toggle(s.id)} />
              <span className="stack" style={{ gap: 2 }}>
                <b>{s.title}</b>
                <span className="small muted">{s.detail}</span>
                {s.link && <a className="link small" href={s.link.href} target="_blank" rel="noreferrer">{s.link.label}</a>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <a className="btn" href="https://caanepal.gov.np" target="_blank" rel="noreferrer">Civil Aviation Authority of Nepal</a>
    </main>
  );
}
