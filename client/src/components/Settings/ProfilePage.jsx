import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile, changePassword, loadChallengeHistory } from '../../utils/api';
import { useToast } from '../Layout/Toast';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef();
  const isAdmin = user?.role === 'admin';

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadChallengeHistory().then(data => {
      setHistory(data);
      setHistoryLoading(false);
    });
  }, []);

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePic, setProfilePic] = useState(user?.profilePicture || '');
  const [picUrl, setPicUrl] = useState(user?.profilePicture || '');
  const [saving, setSaving] = useState(false);

  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpSaving, setCpSaving] = useState(false);
  const [cpError, setCpError] = useState('');
  const [showCp, setShowCp] = useState(false);

  const handleSaveProfile = async () => {
    if (!username.trim() || username.trim().length < 3) {
      showToast('Username must be at least 3 characters');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email');
      return;
    }
    setSaving(true);
    const result = await updateProfile({
      username: username.trim(),
      email: email.trim(),
      profilePicture: picUrl
    });
    setSaving(false);
    if (result) {
      setUser(result);
      setProfilePic(result.profilePicture || '');
      showToast('Profile updated');
    } else {
      showToast('Failed to update profile');
    }
  };

  const handlePicUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        setPicUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    setCpError('');
    if (!cpCurrent || !cpNew || !cpConfirm) {
      setCpError('Fill all fields');
      return;
    }
    if (cpNew !== cpConfirm) {
      setCpError('Passwords do not match');
      return;
    }
    if (cpNew.length < 8) {
      setCpError('Password must be at least 8 characters');
      return;
    }
    setCpSaving(true);
    const r = await changePassword(cpCurrent, cpNew);
    setCpSaving(false);
    if (r.success) {
      showToast('Password changed');
      setCpCurrent('');
      setCpNew('');
      setCpConfirm('');
      setShowCp(false);
    } else {
      setCpError(r.error || 'Failed to change password');
    }
  };

  const avatarSrc = picUrl || '';

  return (
    <div>
      <div className="profile-header">
        <div className="profile-avatar-wrap" onClick={() => fileRef.current?.click()}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">
              {(user?.username || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="profile-avatar-overlay">Change</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePicUpload} />
        <div className="profile-info">
          <div className="profile-name">{user?.username}</div>
          <div className="profile-role">{user?.role}</div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-field">
          <label>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} maxLength="30" />
        </div>
        <div className="profile-field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="profile-field">
          <label>Profile Picture URL</label>
          <input type="text" value={picUrl} onChange={e => setPicUrl(e.target.value)} placeholder="Paste image URL or upload above" />
        </div>
        <button className="btn-primary" onClick={handleSaveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="profile-section" style={{ marginTop: '10px' }}>
        <div className="profile-cp-toggle" onClick={() => setShowCp(!showCp)}>
          <span className="label">Change Password</span>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{showCp ? '▲' : '▼'}</span>
        </div>
        {showCp && (
          <div className="profile-cp-form">
            <div className="profile-field">
              <label>Current Password</label>
              <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} />
            </div>
            <div className="profile-field">
              <label>New Password</label>
              <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} />
            </div>
            <div className="profile-field">
              <label>Confirm New Password</label>
              <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} />
            </div>
            {cpError && <div className="profile-cp-error">{cpError}</div>}
            <button className="btn-primary" onClick={handleChangePassword} disabled={cpSaving}>
              {cpSaving ? 'Changing...' : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      <div className="profile-section" style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
          {isAdmin ? 'Ended Challenges (All Users)' : 'Completed Challenges'}
        </div>
        {historyLoading ? (
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
            {isAdmin
              ? 'No challenges have ended yet.'
              : "No completed challenges yet — they'll show up here once a challenge you've tracked progress on runs its full course."}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px' }}>
              {isAdmin ? (
                (() => {
                  const tracked = history.filter(h => h.tracked);
                  const untracked = history.length - tracked.length;
                  const avg = tracked.length ? Math.round(tracked.reduce((s, h) => s + h.percentage, 0) / tracked.length) : 0;
                  return `${history.length} ended challenge${history.length !== 1 ? 's' : ''} across all users` +
                    (tracked.length ? ` · avg ${avg}% on the ${tracked.length} completed` : '') +
                    (untracked ? ` · ${untracked} never attempted` : '');
                })()
              ) : (
                `${history.length} challenge${history.length !== 1 ? 's' : ''} completed · avg ${Math.round(history.reduce((s, h) => s + h.percentage, 0) / history.length)}% performance`
              )}
            </div>
            <div className="challenge-list">
              {history.map(h => {
                const color = !h.tracked ? 'var(--text3)' : h.percentage >= 66 ? 'var(--green)' : h.percentage >= 33 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div className="challenge-card" style={{ cursor: 'default' }} key={h.challengeId + '-' + (h.username || 'none')}>
                    <div className="cc-info">
                      <div className="cc-name">
                        {h.name}
                        {isAdmin && (
                          <span style={{ color: 'var(--text3)', fontWeight: 400 }}>
                            {' '}&middot; {h.tracked ? `by ${h.username}` : 'not attempted by anyone'}
                          </span>
                        )}
                      </div>
                      <div className="cc-sub">
                        {h.startDate} &rarr; {h.endDate} &middot; created by {h.creatorName || 'Unknown'}
                        {h.tracked ? <> &middot; {h.totalEarned}/{h.totalPossible} pts &middot; {h.daysTracked}/{h.days} days tracked</> : null}
                      </div>
                    </div>
                    <div className="cc-check" style={{ borderColor: color, background: color, color: '#fff', fontSize: '10px', fontWeight: 700, width: 'auto', minWidth: '34px', borderRadius: '10px', padding: '2px 6px' }}>
                      {h.tracked ? `${h.percentage}%` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
