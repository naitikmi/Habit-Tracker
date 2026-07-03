import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { THEMES, THEME_KEY } from '../themes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && THEMES[saved] ? saved : 'sunset';
  });

  const applyTheme = useCallback((name) => {
    const t = THEMES[name] || THEMES.sunset;
    const root = document.documentElement;
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--card2', t.card2);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-glow', t.accentGlow);
    root.style.setProperty('--green', t.green);
    root.style.setProperty('--red', t.red);
    root.style.setProperty('--amber', t.amber);
    root.style.setProperty('--blue', t.blue);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text2', t.text2);
    root.style.setProperty('--text3', t.text3);
    localStorage.setItem(THEME_KEY, name);
  }, []);

  const setTheme = useCallback((name) => {
    setThemeState(name);
    applyTheme(name);
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;
