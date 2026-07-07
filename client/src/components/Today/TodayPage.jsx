import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { daysBetween, todayStr } from '../../utils/helpers';
import { saveProgress, loadProgress } from '../../utils/api';
import ChallengeSelector from './ChallengeSelector';
import DateNav from './DateNav';
import ScoreCard from './ScoreCard';
import CheckList from './CheckList';
import LeaderboardPanel from './LeaderboardPanel';
import DiscoverPanel from './DiscoverPanel';
import { useToast } from '../Layout/Toast';

export default function TodayPage() {
  const {
    progressData, setProgressData,
    activeChallenge, habits
  } = useData();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);

  const entryGetter = (habitId) => {
    return (progressData[habitId] || {})[dateStrKey(currentDate)] || 0;
  };

  const handleToggle = async (habitId) => {
    if (dateStrKey(currentDate) > todayStr()) {
      showToast('Cannot check future dates');
      return;
    }
    const cur = entryGetter(habitId);
    const newPd = { ...progressData };
    if (!newPd[habitId]) newPd[habitId] = {};
    newPd[habitId][dateStrKey(currentDate)] = cur > 0 ? 0 : 1;
    setProgressData(newPd);
    await saveProgress(newPd);
  };

  const handleChallengeChange = async () => {
    setCurrentDate(new Date());
    setProgressData({});
    const pr = await loadProgress();
    setProgressData(pr || {});
  };

  if (!activeChallenge || !habits.length) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: '14px', marginBottom: '6px' }}>No challenges yet</p>
        <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '16px' }}>
          Browse and follow a challenge to get started
        </p>
        <button className="btn-discover-empty" onClick={() => setShowDiscover(true)}>
          Browse Challenges
        </button>
        {showDiscover && <DiscoverPanel onClose={() => setShowDiscover(false)} onFollow={() => setShowDiscover(false)} />}
      </div>
    );
  }

  const start = parseDateStr(activeChallenge.startDate);
  const isBefore = currentDate < start && dateStrKey(currentDate) !== dateStrKey(start);
  const todayNum = Math.min(activeChallenge.days, Math.max(1, daysBetween(start, currentDate)));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ChallengeSelector onChange={handleChallengeChange} />
        <span className="day-badge">Day {todayNum} of {activeChallenge.days}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <DateNav
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            activeChallenge={activeChallenge}
          />
        </div>
        <button className="btn-leaderboard" onClick={() => setShowDiscover(true)} title="Discover">
          🔍
        </button>
        <button className="btn-leaderboard" onClick={() => setShowLeaderboard(true)} title="Leaderboard">
          🏆
        </button>
      </div>
      {showDiscover && <DiscoverPanel onClose={() => setShowDiscover(false)} onFollow={() => setShowDiscover(false)} />}
      {showLeaderboard && (
        <LeaderboardPanel
          challengeId={activeChallenge.id}
          challengeName={activeChallenge.name}
          challengeSource={activeChallenge._source}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {isBefore ? (
        <div className="empty-state">
          <p>Challenge starts {formatDateStr(start)}</p>
        </div>
      ) : (
        <>
          <ScoreCard habits={habits} entryGetter={entryGetter} />
          <CheckList habits={habits} entryGetter={entryGetter} onToggle={handleToggle} isFuture={dateStrKey(currentDate) > todayStr()} />
        </>
      )}
    </div>
  );
}

function dateStrKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateStr(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
