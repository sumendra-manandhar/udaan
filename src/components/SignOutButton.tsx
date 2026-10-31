import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/auth';
import { useSyncState } from '../hooks/useApp';

/** Signs out, after warning if changes haven't uploaded yet (they would be
 * lost, because signing out clears this device's copy). */
export function SignOutButton({ className = 'btn danger', label = 'Sign out' }: { className?: string; label?: string }) {
  const { session, signOut } = useAuth();
  const sync = useSyncState();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!session) return null;

  async function run() {
    if (sync.pending && !confirm(`${sync.pending} change${sync.pending === 1 ? ' has' : 's have'} not uploaded yet and will be lost. Sign out anyway?`)) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      navigate('/', { replace: true });
    }
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={() => void run()}>
      {busy ? 'Signing out…' : label}
    </button>
  );
}
