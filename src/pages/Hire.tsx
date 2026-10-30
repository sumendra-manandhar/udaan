import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Chips, Empty, SignInPrompt, TopBar } from '../components/ui';
import { db } from '../db/db';
import { useAuth } from '../hooks/auth';
import { newId, saveRow } from '../sync/mutate';

const SHOOTS = [
  { value: 'tourism', label: 'Tourism / hotel' },
  { value: 'real-estate', label: 'Real estate' },
  { value: 'event', label: 'Event / wedding' },
  { value: 'brand', label: 'Brand / ad' },
  { value: 'other', label: 'Other' },
];

export function Hire() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { userId, session } = useAuth();
  const pilot = useLiveQuery(() => db.profiles.where('username').equals(username).first(), [username]);
  const [f, setF] = useState({ type: 'tourism', location: '', date: '', budget: '', contact: session?.user.email ?? '', message: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (!userId) return <main className="screen no-tabs"><TopBar title="Hire for a shoot" back /><SignInPrompt what="send hire requests" /></main>;
  if (!pilot) return <main className="screen no-tabs"><TopBar title="Hire for a shoot" back /><Empty>Pilot not found.</Empty></main>;
  if (!pilot.for_hire || pilot.id === userId) return <main className="screen no-tabs"><TopBar title="Hire for a shoot" back /><Empty>This pilot isn't taking requests right now.</Empty></main>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !pilot) return;
    await saveRow('hire_requests', {
      id: newId(),
      pilot_id: pilot.id,
      requester_id: userId,
      shoot_type: f.type,
      location: f.location.trim(),
      shoot_date: f.date || null,
      budget: f.budget.trim() || null,
      contact: f.contact.trim(),
      message: f.message.trim(),
      status: 'sent',
    });
    navigate(`/done/hire?id=${pilot.id}`, { replace: true });
  }

  return (
    <main className="screen no-tabs">
      <TopBar title="Hire for a shoot" back />
      <div className="card row">
        <Avatar profile={pilot} />
        <span className="stack" style={{ gap: 0 }}><b>{pilot.display_name}</b><span className="small muted">@{pilot.username}{pilot.home_base && ` · ${pilot.home_base}`}</span></span>
      </div>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field"><span className="label">Type of shoot</span><Chips label="Type of shoot" options={SHOOTS} value={f.type} onChange={(v) => setF({ ...f, type: v as string })} /></div>
        <div className="field"><label htmlFor="hl">Location</label><input id="hl" className="input" required value={f.location} onChange={set('location')} placeholder="Venue or area" /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="hd">Date</label><input id="hd" type="date" className="input" value={f.date} onChange={set('date')} /></div>
          <div className="field"><label htmlFor="hb">Budget (NPR)</label><input id="hb" className="input" value={f.budget} onChange={set('budget')} placeholder="Range" /></div>
        </div>
        <div className="field"><label htmlFor="hc">How should they reach you?</label><input id="hc" className="input" required value={f.contact} onChange={set('contact')} placeholder="Phone or email" /></div>
        <div className="field"><label htmlFor="hm">What do you need?</label><textarea id="hm" className="textarea" required maxLength={2000} value={f.message} onChange={set('message')} placeholder="The shot, video length, where it will be used" /></div>
        <p className="notice">The pilot arranges flight approvals for your location. Allow time for permits before the shoot date.</p>
        <div className="action-bar"><button className="btn primary block">Send request</button></div>
      </form>
    </main>
  );
}
