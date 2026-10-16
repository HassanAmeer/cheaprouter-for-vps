'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem('cm-theme') as Theme | null;
    const initialTheme: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cm-theme', t);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cm-theme', next);
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
