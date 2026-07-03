import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { THEMES } from '../../themes';

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [showPanel, setShowPanel] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <>
      <div className="header">
        <div>
          <h1>Habit Tracker</h1>
          <div className="sub">{today}</div>
        </div>
        <div className="header-right">
          <button className="theme-btn" onClick={() => setShowPanel(true)} title="Change theme">🎨</button>
        </div>
      </div>

      {showPanel && (
        <>
          <div className="theme-overlay open" onClick={() => setShowPanel(false)} />
          <div className="theme-panel open">
            <h3>Choose Theme</h3>
            <div className="theme-grid">
              {Object.keys(THEMES).map(key => {
                const t = THEMES[key];
                const isActive = key === theme;
                return (
                  <div
                    key={key}
                    className={`theme-opt ${isActive ? 'active' : ''}`}
                    onClick={() => { setTheme(key); setShowPanel(false); }}
                  >
                    <div className="swatch" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.card2})` }} />
                    <div className="tname">{t.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
