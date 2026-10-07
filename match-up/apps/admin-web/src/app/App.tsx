// App entry point.
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AppRouter } from './router';

export default function App() {
  // Providers are nested so routing and pages can access auth, toast, and theme state.
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
