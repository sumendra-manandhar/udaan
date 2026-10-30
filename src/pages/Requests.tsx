import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Empty, TopBar } from '../components/ui';
import { db } from '../db/db';
import type { HireRequest } from '../db/types';
import { useAuth } from '../hooks/auth';
import { saveRow } from '../sync/mutate';

export function Requests() {
  const { userId } = useAuth();
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const rows =
    useLiveQuery(
      () => (userId ? db.hire_requests.where(tab === 'inbox' ? 'pilot_id' : 'requester_id').equals(userId).toArray() : []),
      [userId, tab],
    ) ?? [];
  const people = useLiveQuery(async () => new Map((await db.profiles.toArray()).map((p) => [p.id, p])), []);
  if (!userId) return <Navigate to="/signin" replace />;

  const setStatus = (r: HireRequest, status: HireRequest['status']) => saveRow('hire_requests', { ...r, status });

  return (
    <main className="screen no-tabs">
      <TopBar title="Hire requests" back="/me" />
      <div className="segmented" role="tablist" aria-label="Requests">
        <button type="button" role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}>Received</button>
        <button type="button" role="tab" aria-selected={tab === 'sent'} onClick={() => setTab('sent')}>Sent</button>
      </div>
      {rows.length === 0 && <Empty>{tab === 'inbox' ? 'No requests yet. Turn on "Available for hire" in your profile.' : "You haven't sent any requests."}</Empty>}
      {rows
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .map((r) => {
          const other = people?.get(tab === 'inbox' ? r.requester_id : r.pilot_id);
          return (
            <article key={r.id} className="card stack">
              <div className="row between">
                <b>{other?.display_name ?? 'Pilot'}</b>
                <span className={`tag${r.status === 'accepted' ? ' good' : r.status === 'declined' ? ' warn' : ''}`}>{r.status}</span>
              </div>
              <p className="small muted">{r.shoot_type} · {r.location}{r.shoot_date && ` · ${r.shoot_date}`}{r.budget && ` · NPR ${r.budget}`}</p>
              <p style={{ whiteSpace: 'pre-line' }}>{r.message}</p>
              {tab === 'inbox' && <p className="small">Contact: <span className="mono">{r.contact}</span></p>}
              {tab === 'inbox' && r.status === 'sent' && (
                <div className="row">
                  <button type="button" className="btn small primary grow" onClick={() => void setStatus(r, 'accepted')}>Accept</button>
                  <button type="button" className="btn small grow" onClick={() => void setStatus(r, 'declined')}>Decline</button>
                </div>
              )}
              {tab === 'sent' && r.status === 'sent' && (
                <button type="button" className="btn small" onClick={() => void setStatus(r, 'cancelled')}>Cancel request</button>
              )}
            </article>
          );
        })}
    </main>
  );
}
