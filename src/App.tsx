import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useAuth } from './hooks/auth';
import { useOnline } from './hooks/useApp';
import { supabaseConfigured } from './lib/supabase';
import { MapHome } from './pages/MapHome';
import { Welcome } from './pages/Welcome';

const Done = lazy(() => import('./pages/Done').then((m) => ({ default: m.Done })));
const EventDetail = lazy(() => import('./pages/EventDetail').then((m) => ({ default: m.EventDetail })));
const EventForm = lazy(() => import('./pages/EventForm').then((m) => ({ default: m.EventForm })));
const Events = lazy(() => import('./pages/Events').then((m) => ({ default: m.Events })));
const FlightReplay = lazy(() => import('./pages/FlightReplay').then((m) => ({ default: m.FlightReplay })));
const FlightUpload = lazy(() => import('./pages/FlightUpload').then((m) => ({ default: m.FlightUpload })));
const Hire = lazy(() => import('./pages/Hire').then((m) => ({ default: m.Hire })));
const Logs = lazy(() => import('./pages/Logs').then((m) => ({ default: m.Logs })));
const Me = lazy(() => import('./pages/Me').then((m) => ({ default: m.Me })));
const Moderate = lazy(() => import('./pages/Moderate').then((m) => ({ default: m.Moderate })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Permits = lazy(() => import('./pages/Permits').then((m) => ({ default: m.Permits })));
const PilotProfile = lazy(() => import('./pages/PilotProfile').then((m) => ({ default: m.PilotProfile })));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit').then((m) => ({ default: m.ProfileEdit })));
const Requests = lazy(() => import('./pages/Requests').then((m) => ({ default: m.Requests })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const SignIn = lazy(() => import('./pages/SignIn').then((m) => ({ default: m.SignIn })));
const SpotDetail = lazy(() => import('./pages/SpotDetail').then((m) => ({ default: m.SpotDetail })));
const SpotForm = lazy(() => import('./pages/SpotForm').then((m) => ({ default: m.SpotForm })));

/** Signed-in pilots without a profile finish onboarding first. */
function ProfileGate({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (session && profile === null && navigator.onLine && pathname !== '/onboarding') navigate('/onboarding');
  }, [session, profile, pathname, navigate]);
  return <>{children}</>;
}

/** First launch shows the welcome screen; read at render so it updates
 * as soon as the pilot leaves it. */
function Home() {
  return localStorage.getItem('udaan:welcomed') === '1' ? <MapHome /> : <Navigate to="/welcome" replace />;
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="banner row between" role="status">
      <span>A new version of Udaan is ready.</span>
      <span className="row">
        <button type="button" className="btn small" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button type="button" className="btn small primary" onClick={() => void updateServiceWorker(true)}>
          Update
        </button>
      </span>
    </div>
  );
}

export default function App() {
  const online = useOnline();
  return (
    <div className="app">
      <UpdatePrompt />
      {!supabaseConfigured && (
        <div className="banner">Supabase is not configured. Copy .env.example to .env and add your project keys.</div>
      )}
      {!online && (
        <div className="banner" role="status">
          You're offline. Everything you do is saved and will sync later.
        </div>
      )}
      <div className="app-body">
      <ProfileGate>
        <Suspense fallback={<div className="screen"><span className="spinner" aria-label="Loading" /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/spots/new" element={<SpotForm />} />
          <Route path="/spots/:id" element={<SpotDetail />} />
          <Route path="/spots/:id/edit" element={<SpotForm />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<EventForm />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/edit" element={<EventForm />} />
          <Route path="/permits" element={<Permits />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/logs/upload" element={<FlightUpload />} />
          <Route path="/logs/:id" element={<FlightReplay />} />
          <Route path="/me" element={<Me />} />
          <Route path="/me/edit" element={<ProfileEdit />} />
          <Route path="/me/requests" element={<Requests />} />
          <Route path="/pilots/:username" element={<PilotProfile />} />
          <Route path="/pilots/:username/hire" element={<Hire />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/moderate" element={<Moderate />} />
          <Route path="/done/:kind" element={<Done />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </ProfileGate>
      </div>
    </div>
  );
}
