import React from 'react';
import { getChallenges, getChallengeEnd } from '../../utils/helpers';
import { saveActiveChallenge, saveFollowedChallenge } from '../../utils/api';
import { useData } from '../../contexts/DataContext';

export default function ChallengeSelector({ onChange }) {
  const { defaultsData, setDefaultsData, userChallengesData, setUserChallengesData, allChallengesData, setAllChallengesData } = useData();
  const allChallenges = getChallenges(defaultsData, userChallengesData, allChallengesData);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const challenges = allChallenges.filter(c => {
    const end = getChallengeEnd(c);
    return !end || today <= end;
  });

  let activeId = null;
  let activeSource = null;
  if (allChallengesData?.activeChallengeId && allChallengesData?.activeSource) {
    activeId = allChallengesData.activeChallengeId;
    activeSource = allChallengesData.activeSource;
  } else if (defaultsData?.activeChallengeId) {
    activeId = defaultsData.activeChallengeId;
    activeSource = 'default';
  } else if (userChallengesData?.activeChallengeId) {
    activeId = userChallengesData.activeChallengeId;
    activeSource = 'user';
  }
  const selectValue = activeSource && activeId ? activeSource + ':' + activeId : '';

  const selectChallenge = async (source, id) => {
    // Update all sources to track active challenge
    if (allChallengesData) {
      const updated = { ...allChallengesData, activeChallengeId: id, activeSource: source };
      setAllChallengesData(updated);
    }
    if (source === 'default') {
      const dd = { ...(defaultsData || { challenges: [], activeChallengeId: null }), activeChallengeId: id };
      setDefaultsData(dd);
      if (userChallengesData) setUserChallengesData({ ...userChallengesData, activeChallengeId: null });
    } else {
      const uc = { ...(userChallengesData || { challenges: [], activeChallengeId: null }), activeChallengeId: id };
      setUserChallengesData(uc);
      if (defaultsData) setDefaultsData({ ...defaultsData, activeChallengeId: null });
    }
    await saveActiveChallenge(id, source);
    // Selecting a challenge here also follows it, so it shows as "Following" in
    // Discover and appears on its leaderboard — matches the old behavior where
    // active and followed were the same thing. Discover's own Follow button can
    // still follow a different challenge afterward without changing what's active.
    await saveFollowedChallenge(id, source);
    if (onChange) onChange();
  };

  const handleChange = (e) => {
    const [source, id] = e.target.value.split(':');
    selectChallenge(source, id);
  };

  // Auto-switching away from an expired active challenge is handled centrally in
  // DataContext (applies on every page, not just here) — by the time this renders,
  // selectValue should already point at a valid, non-expired challenge.

  if (!challenges.length) return null;

  const getLabel = (c) => {
    if (c._source === 'default') return '';
    if (c._source === 'group') return '👥 ';
    if (c._source === 'user' && c.creatorName) return '👤 ' + c.creatorName;
    return '👤 ';
  };

  return (
    <div className="challenge-selector">
      <span className="cs-label">Challenge:</span>
      <div className="select-wrap">
        <select value={selectValue} onChange={handleChange}>
          {challenges.map(c => {
            const val = c._source + ':' + c.id;
            return (
              <option key={val} value={val}>
                {getLabel(c)}{c.name}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
