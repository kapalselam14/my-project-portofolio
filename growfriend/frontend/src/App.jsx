import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AppProvider } from './context/AppContext';
import { AcceptedTasksProvider } from './context/AcceptedTasksContext';
import { TasksProvider } from './context/TasksContext';

import LandingPage from './pages/LandingPage';
import Dashboard from './components/dashboard/Dashboard.jsx';
import AdminPage from './pages/AdminPage';
import NotFound from './components/404page/NotFound';

import './App.css';

const TOKEN_KEYS = ['token'];

function getAuthToken() {
  return localStorage.getItem('token');
}

function clearAuthStorage() {
  localStorage.removeItem('token');
  localStorage.removeItem('gf_current_user');
}

function isAdminUser(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const role = String(user.role || '').toLowerCase();
  return roles.some((r) => String(r).toLowerCase() === 'admin') || role === 'admin';
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('gf_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function LandingGate() {
  const [status, setStatus] = useState(() => {
    const token = getAuthToken();
    if (!token) return 'guest';
    return isAdminUser(getStoredUser()) ? 'admin' : 'authenticated';
  });

  useEffect(() => {
    function handleStorage(event) {
      const isLocalStorageEvent = !event || event.storageArea === localStorage;
      const isAuthEvent = !event || event.key === null || TOKEN_KEYS.includes(event.key) || event.key === 'gf_current_user';
      if (isLocalStorageEvent && isAuthEvent) {
        const token = getAuthToken();
        if (!token) {
          clearAuthStorage();
          setStatus('guest');
          return;
        }
        setStatus(isAdminUser(getStoredUser()) ? 'admin' : 'authenticated');
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (status === 'admin') return <Navigate to="/admin" replace />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function RequireAuth({ children }) {
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    function runLocalAuthCheck() {
      const token = getAuthToken();
      if (cancelled) return;
      setAuthState(token ? 'valid' : 'invalid');
    }

    function handleStorage(event) {
      const isLocalStorageEvent = !event || event.storageArea === localStorage;
      const isAuthEvent = !event || event.key === null || TOKEN_KEYS.includes(event.key) || event.key === 'gf_current_user';
      if (isLocalStorageEvent && isAuthEvent) {
        runLocalAuthCheck();
      }
    }

    window.addEventListener('storage', handleStorage);
    runLocalAuthCheck();

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (authState === 'checking') return null;
  if (authState !== 'valid') return <Navigate to="/landingpage" replace />;
  return children;
}

function AppRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<Navigate to="/landingpage" replace />} />
        <Route path="/landingpage" element={<LandingGate />} />
        <Route
          path="/dashboard"
          element={(
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin"
          element={(
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AcceptedTasksProvider>
          <TasksProvider>
            <AppRoutes />
          </TasksProvider>
        </AcceptedTasksProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
