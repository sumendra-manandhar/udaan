import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/auth';
import { applyTheme } from './lib/theme';
import { startSync } from './sync/manager';
import './styles.css';

// Ask the browser not to evict our offline data under storage pressure.
if (navigator.storage?.persist) void navigator.storage.persist();

applyTheme();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
