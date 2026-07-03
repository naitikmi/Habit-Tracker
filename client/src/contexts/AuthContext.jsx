import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, checkAuth } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().then(u => {
      if (u) setUser(u);
      setLoading(false);
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
