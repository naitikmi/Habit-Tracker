import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getCachedUser, refreshProfile } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the session instantly from the stored token — don't block the app
    // on a network round trip. Then quietly refresh the full profile in the
    // background; only sign out if the server explicitly rejects the token.
    const cached = getCachedUser();
    if (!cached) {
      setLoading(false);
      return;
    }
    setUser(cached);
    setLoading(false);
    refreshProfile().then(result => {
      if (result === null) setUser(null); // token explicitly rejected by the server
      else if (result) setUser(result); // enriched with real email/avatar
      // undefined => couldn't reach the server this time, keep the existing session
    });
  }, []);

  const loginUser = useCallback(async (username, password) => {
    const result = await apiLogin(username, password);
    if (result.success) setUser(result.user);
    return result;
  }, []);

  const registerUser = useCallback(async (username, email, password) => {
    const result = await apiRegister(username, email, password);
    if (result.success) setUser(result.user);
    return result;
  }, []);

  const logoutUser = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, setUser, isAuthenticated, loginUser, registerUser, logoutUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
