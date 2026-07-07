import React from 'react';
import { getChallenges } from '../../utils/helpers';
import { saveActiveChallenge } from '../../utils/api';
import { useData } from '../../contexts/DataContext';

export default function ChallengeSelector({ onChange }) {
  const { defaultsData, setDefaultsData, userChallengesData, setUserChallengesData, allChallengesData, setAllChallengesData } = useData();
  const challenges = getChallenges(defaultsData, userChallengesData, allChallengesData);

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

  const handleChange = async (e) => {
    const [source, id] = e.target.value.split(':');

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
    if (onChange) onChange();
  };

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
