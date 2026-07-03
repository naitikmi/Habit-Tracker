import React from 'react';
import { getChallenges } from '../../utils/helpers';
import { saveActiveChallenge } from '../../utils/api';

export default function ChallengeSelector({ defaultsData, setDefaultsData, userChallengesData, setUserChallengesData, onChange }) {
  const challenges = getChallenges(defaultsData, userChallengesData);

  const activeId = defaultsData?.activeChallengeId || userChallengesData?.activeChallengeId || null;
  const activeSource = defaultsData?.activeChallengeId ? 'default' : userChallengesData?.activeChallengeId ? 'user' : null;
  const selectValue = activeSource && activeId ? activeSource + ':' + activeId : '';

  const handleChange = async (e) => {
    const [source, idStr] = e.target.value.split(':');
    const id = Number(idStr);
    if (source === 'default') {
      const dd = { ...(defaultsData || { challenges: [], activeChallengeId: null, nextChallengeId: 1 }), activeChallengeId: id };
      if (!dd.challenges) dd.challenges = [];
      setDefaultsData(dd);
      if (userChallengesData) {
        setUserChallengesData({ ...userChallengesData, activeChallengeId: null });
      }
      await saveActiveChallenge(id, 'default');
    } else {
      const uc = { ...(userChallengesData || { challenges: [], activeChallengeId: null, nextChallengeId: 1 }), activeChallengeId: id };
      if (!uc.challenges) uc.challenges = [];
      setUserChallengesData(uc);
      if (defaultsData) {
        setDefaultsData({ ...defaultsData, activeChallengeId: null });
      }
      await saveActiveChallenge(id, 'user');
    }
    if (onChange) onChange();
  };

  if (!challenges.length) return null;

  return (
    <div className="challenge-selector">
      <span className="cs-label">Challenge:</span>
      <div className="select-wrap">
        <select value={selectValue} onChange={handleChange}>
          {challenges.map(c => {
            const val = c._source + ':' + c.id;
            const prefix = c._source === 'user' ? '👤 ' : '';
            return (
              <option key={val} value={val}>
                {prefix}{c.name}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
