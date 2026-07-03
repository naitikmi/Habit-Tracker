import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { validatePassword } from '../../utils/helpers';

export default function AuthOverlay() {
  const { loginUser, registerUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pwValid = password ? validatePassword(password) : null;

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Enter username and password');
      return;
    }
    if (isRegister) {
      const v = validatePassword(password);
      if (!v.allMet) {
        setError('Password does not meet requirements');
        return;
      }
    }
    setLoading(true);
    setError('');
    const result = isRegister
      ? await registerUser(username.trim(), password)
      : await loginUser(username.trim(), password);
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
        <h2>Challenge Tracker</h2>
        <div className="sub">{isRegister ? 'Create your account' : 'Sign in to continue'}</div>
        <input
          type="text"
          placeholder="Username"
          maxLength="30"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') document.getElementById('authPassInput')?.focus(); }}
        />
        <input
          id="authPassInput"
          type="password"
          placeholder="Password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
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
        <button className="auth-btn primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
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
