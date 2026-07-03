import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadDefaults, loadUserChallenges, loadProgress, loadActiveChallenge, tryFetchAPI, authHeaders } from '../utils/api';
import { getActiveChallenge, getActiveHabits } from '../utils/helpers';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [defaultsData, setDefaultsData] = useState(null);
  const [userChallengesData, setUserChallengesData] = useState(null);
  const [allChallengesData, setAllChallengesData] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    const [dd, uc, pr, ac, all] = await Promise.all([
      loadDefaults(),
      loadUserChallenges(),
      loadProgress(),
      loadActiveChallenge(),
      tryFetchAPI('/api/challenges/all', { headers: authHeaders() })
    ]);
    if (ac) {
      if (ac.source === 'default' && dd) dd.activeChallengeId = ac.challengeId;
      if (ac.source === 'user' && uc) uc.activeChallengeId = ac.challengeId;
      // Also set in allChallengesData
      if (all?.data) {
        all.data.activeChallengeId = ac.challengeId;
        all.data.activeSource = ac.source;
      }
    }
    setDefaultsData(dd);
    setUserChallengesData(uc);
    setAllChallengesData(all?.data || null);
    setProgressData(pr);
    setLoaded(true);
  }, []);

  const refreshData = useCallback(async () => {
    const [dd, uc, pr, ac, all] = await Promise.all([
      loadDefaults(),
      loadUserChallenges(),
      loadProgress(),
      loadActiveChallenge(),
      tryFetchAPI('/api/challenges/all', { headers: authHeaders() })
    ]);
    if (ac) {
      if (ac.source === 'default' && dd) dd.activeChallengeId = ac.challengeId;
      if (ac.source === 'user' && uc) uc.activeChallengeId = ac.challengeId;
      if (all?.data) {
        all.data.activeChallengeId = ac.challengeId;
        all.data.activeSource = ac.source;
      }
    }
    setDefaultsData(dd);
    setUserChallengesData(uc);
    setAllChallengesData(all?.data || null);
    setProgressData(pr);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAll();
    } else {
      setDefaultsData(null);
      setUserChallengesData(null);
      setAllChallengesData(null);
      setProgressData({});
      setLoaded(false);
    }
  }, [isAuthenticated, loadAll]);

  const activeChallenge = getActiveChallenge(defaultsData, userChallengesData, allChallengesData);
  const habits = activeChallenge ? activeChallenge.habits : [];

  return (
    <DataContext.Provider value={{
      defaultsData, setDefaultsData,
      userChallengesData, setUserChallengesData,
      allChallengesData, setAllChallengesData,
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
