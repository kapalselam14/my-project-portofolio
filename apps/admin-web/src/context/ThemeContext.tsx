import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const KEY = 'matchup_admin_theme';

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Storage unavailable (e.g. private mode) — fall through to default.
  }
  return null;
}

// Applies the theme app-wide: the `dark` class on <html> drives Tailwind's `darkMode: 'class'` variants, the same.
function applyTheme(theme: Theme) {
  const dark = theme === 'dark';
  for (const el of [document.documentElement, document.body]) {
    el.classList.toggle('dark', dark);
    el.dataset.theme = theme;
  }
  document.documentElement.style.colorScheme = theme;
}

function initialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored != null) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage unavailable — theme still applies for this session.
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside <ThemeProvider>');
  return ctx;
}
