import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { saveDefaultsToServer, saveUserChallenges } from '../../utils/api';
import { THEMES } from '../../themes';
import ChallengeWizard from './ChallengeWizard';
import ProfilePage from './ProfilePage';
import { useToast } from '../Layout/Toast';

export default function SettingsPage() {
  const { user, logoutUser } = useAuth();
  const {
    defaultsData, setDefaultsData,
    userChallengesData, setUserChallengesData,
    activeChallenge, refreshData
  } = useData();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [showWizard, setShowWizard] = useState(null);
  const [editChallenge, setEditChallenge] = useState(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleEdit = (challenge, source) => {
    setEditChallenge(challenge);
    setShowWizard(source);
  };

  const handleCreate = (source) => {
    setEditChallenge(null);
    setShowWizard(source);
  };

  const handleDeleteDefault = async () => {
    const ch = activeChallenge;
    if (!ch || ch._source !== 'default') { showToast('No default challenge selected'); return; }
    if (!confirm(`Delete "${ch.name}"? Users will lose access.`)) return;
    const dd = { ...defaultsData };
    dd.challenges = dd.challenges.filter(c => c.id !== ch.id);
    if (dd.activeChallengeId === ch.id) {
      dd.activeChallengeId = dd.challenges.length ? dd.challenges[0].id : null;
    }
    setDefaultsData(dd);
    await saveDefaultsToServer(dd);
    await refreshData();
    showToast('Challenge deleted');
  };

  const handleDeleteUser = async () => {
    const ch = activeChallenge;
    if (!ch || ch._source !== 'user') { showToast('No personal challenge selected'); return; }
    if (!confirm(`Delete "${ch.name}"?`)) return;
    const uc = { ...userChallengesData };
    uc.challenges = uc.challenges.filter(c => c.id !== ch.id);
    if (uc.activeChallengeId === ch.id) {
      uc.activeChallengeId = uc.challenges.length ? uc.challenges[0].id : null;
    }
    setUserChallengesData(uc);
    await saveUserChallenges(uc);
    await refreshData();
    showToast('Challenge deleted');
  };

  if (showWizard) {
    return (
      <ChallengeWizard
        editChallenge={editChallenge}
        source={showWizard}
        onCancel={() => { setShowWizard(null); setEditChallenge(null); refreshData(); }}
      />
    );
  }

  if (showProfile) {
    return (
      <>
        <button className="btn-back" onClick={() => setShowProfile(false)}>← Back to Settings</button>
        <ProfilePage />
      </>
    );
  }

  const defaults = (defaultsData && defaultsData.challenges) || [];
  const myChallenges = (userChallengesData && userChallengesData.challenges) || [];

  return (
    <div>
      <div className="setting-row clickable" onClick={() => setShowProfile(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="profile-mini-avatar">
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt="" className="profile-mini-img" />
            ) : (
              <span>{(user?.username || '?')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="label">{user?.username}</div>
            <div className="desc">{user?.email || 'No email'} · {user?.role}</div>
          </div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: '14px' }}>→</span>
      </div>

      {user?.role === 'admin' && (
        <>
          {defaults.length > 0 && (
            <>
              <div className="setting-row" style={{ marginTop: '10px' }}>
                <div>
                  <div className="label">Default Challenges</div>
                  <div className="desc">Tap to edit, visible to all users</div>
                </div>
              </div>
              <div className="challenge-list">
                {defaults.map(c => {
                  const isActive = c.id === defaultsData?.activeChallengeId;
                  return (
                    <div
                      key={'def-' + c.id}
                      className={`challenge-card ${isActive ? 'active' : ''}`}
                      onClick={() => handleEdit(c, 'default')}
                    >
                      <div className="cc-info">
                        <div className="cc-name">{c.name}</div>
                        <div className="cc-sub">{c.days} days · {c.habits.length} habits</div>
                      </div>
                      <div className="cc-check">{isActive ? '✓' : ''}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => {
                  const ch = activeChallenge;
                  if (ch && ch._source === 'default') handleEdit(defaultsData.challenges.find(c => c.id === ch.id), 'default');
                  else showToast('No default challenge selected');
                }}>Edit</button>
                <button className="btn-danger" onClick={handleDeleteDefault}>Delete</button>
              </div>
            </>
          )}
          <button className="btn-secondary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => handleCreate('default')}>
            + Create Default Challenge
          </button>
        </>
      )}

      {myChallenges.length > 0 && (
        <>
          <div className="setting-row" style={{ marginTop: '10px' }}>
            <div>
              <div className="label">My Challenges</div>
              <div className="desc">Your personal challenges</div>
            </div>
          </div>
          <div className="challenge-list">
            {myChallenges.map(c => {
              const isActive = c.id === userChallengesData?.activeChallengeId;
              return (
                <div
                  key={'user-' + c.id}
                  className={`challenge-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleEdit(c, 'user')}
                >
                  <div className="cc-info">
                    <div className="cc-name">{c.name}</div>
                    <div className="cc-sub">{c.days} days · {c.habits.length} habits</div>
                  </div>
                  <div className="cc-check">{isActive ? '✓' : ''}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => {
              const ch = activeChallenge;
              if (ch && ch._source === 'user') handleEdit(userChallengesData.challenges.find(c => c.id === ch.id), 'user');
              else showToast('No personal challenge selected');
            }}>Edit</button>
            <button className="btn-danger" onClick={handleDeleteUser}>Delete</button>
          </div>
        </>
      )}
      <button className="btn-secondary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => handleCreate('user')}>
        + Create My Challenge
      </button>

      <div className="section-header">Theme</div>
      <div
        className="setting-row"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setShowThemePanel(true)}
      >
        <div>
          <div className="label">Color Theme</div>
          <div className="desc">Change the app appearance</div>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{THEMES[theme]?.name || 'Sunset'}</span>
          <span style={{ fontSize: '16px' }}>🎨</span>
        </div>
      </div>

      <button className="btn-danger" style={{ width: '100%', marginTop: '10px' }} onClick={logoutUser}>
        Sign Out
      </button>

      {showThemePanel && (
        <>
          <div className="theme-overlay open" onClick={() => setShowThemePanel(false)} />
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
                    onClick={() => { setTheme(key); setShowThemePanel(false); }}
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
    </div>
  );
}
