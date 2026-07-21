import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { validatePassword } from '../../utils/helpers';

// Render's free tier spins the server down after ~15min idle; waking it back up
// can take up to a minute. Below this, the button just says "Signing in...".
const WAKING_HINT_DELAY_MS = 4000;

export default function AuthOverlay() {
  const { loginUser, registerUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waking, setWaking] = useState(false);
  const wakingTimer = useRef(null);

  const pwValid = password ? validatePassword(password) : null;

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Enter username and password');
      return;
    }
    if (isRegister) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address');
        return;
      }
      const v = validatePassword(password);
      if (!v.allMet) {
        setError('Password does not meet requirements');
        return;
      }
    }
    setLoading(true);
    setError('');
    setWaking(false);
    wakingTimer.current = setTimeout(() => setWaking(true), WAKING_HINT_DELAY_MS);
    const result = isRegister
      ? await registerUser(username.trim(), email.trim(), password, remember)
      : await loginUser(username.trim(), password, remember);
    clearTimeout(wakingTimer.current);
    setWaking(false);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Server error');
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="auth-overlay">
      <div className="auth-box">
        <h2>Habit Tracker</h2>
        <div className="sub">{isRegister ? 'Create your account' : 'Sign in to continue'}</div>
        <input
          type="text"
          placeholder="Username"
          maxLength="30"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') isRegister ? document.getElementById('authEmailInput')?.focus() : document.getElementById('authPassInput')?.focus(); }}
        />
        {isRegister && (
          <input
            id="authEmailInput"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') document.getElementById('authPassInput')?.focus(); }}
          />
        )}
        <div className="pw-input-wrap">
          <input
            id="authPassInput"
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
        {isRegister && (
          <div className="password-reqs">
            {pwValid && pwValid.rules.map(rule => (
              <div key={rule.key} className={`req ${rule.test ? 'met' : ''}`}>
                {rule.label}
              </div>
            ))}
            {!pwValid && (
              <>
                <div className="req">At least 8 characters</div>
                <div className="req">One uppercase letter</div>
                <div className="req">One lowercase letter</div>
                <div className="req">One number</div>
                <div className="req">One special character (e.g. !@#$%)</div>
              </>
            )}
          </div>
        )}
        <label className="auth-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
          />
          Keep me signed in on this device
        </label>
        <button className="auth-btn primary" onClick={handleSubmit} disabled={loading}>
          {loading
            ? <><span className="auth-spinner" />{waking ? 'Waking up server...' : 'Please wait...'}</>
            : isRegister ? 'Create Account' : 'Sign In'}
        </button>
        {waking && (
          <div className="auth-waking-hint">
            Free hosting spins down when idle — this can take up to a minute on the first try.
          </div>
        )}
        <div className="auth-error">{error}</div>
        <div className="auth-toggle" onClick={toggleMode}>
          {isRegister
            ? <>Already have an account? <strong>Sign in</strong></>
            : <>Don't have an account? <strong>Create one</strong></>}
        </div>
        {isRegister && <div className="admin-note">Admins can create default challenges</div>}
      </div>
    </div>
  );
}
