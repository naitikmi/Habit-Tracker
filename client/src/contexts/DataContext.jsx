import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadDefaults, loadUserChallenges, loadProgress } from '../utils/api';
import { getActiveChallenge, getActiveHabits } from '../utils/helpers';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [defaultsData, setDefaultsData] = useState(null);
  const [userChallengesData, setUserChallengesData] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    const [dd, uc, pr] = await Promise.all([
      loadDefaults(),
      loadUserChallenges(),
      loadProgress()
    ]);
    setDefaultsData(dd);
    setUserChallengesData(uc);
    setProgressData(pr);
    setLoaded(true);
  }, []);

  const refreshData = useCallback(async () => {
    const [dd, uc, pr] = await Promise.all([
      loadDefaults(),
      loadUserChallenges(),
      loadProgress()
    ]);
    setDefaultsData(dd);
    setUserChallengesData(uc);
    setProgressData(pr);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAll();
    } else {
      setDefaultsData(null);
      setUserChallengesData(null);
      setProgressData({});
      setLoaded(false);
    }
  }, [isAuthenticated, loadAll]);

  const activeChallenge = getActiveChallenge(defaultsData, userChallengesData);
  const habits = activeChallenge ? activeChallenge.habits : [];

  return (
    <DataContext.Provider value={{
      defaultsData, setDefaultsData,
      userChallengesData, setUserChallengesData,
      progressData, setProgressData,
      refreshData, loadAll, loaded,
      activeChallenge, habits
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export default DataContext;
