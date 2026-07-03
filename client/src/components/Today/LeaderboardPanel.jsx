import React, { useState, useEffect } from 'react';
import { tryFetchAPI } from '../../utils/api';

export default function LeaderboardPanel({ challengeId, challengeName, challengeSource, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await tryFetchAPI('/api/leaderboard/' + challengeId + '?source=' + (challengeSource || 'default'));
      if (r && r.ok) setData(r.data);
      setLoading(false);
    })();
  }, [challengeId, challengeSource]);

  return (
    <>
      <div className="theme-overlay open" onClick={onClose} />
      <div className="leaderboard-panel open">
        <div className="lb-header">
          <h3>{challengeName}</h3>
          <button className="lb-close" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="lb-loading">Loading...</div>
        ) : !data ? (
          <div className="lb-loading">Failed to load</div>
        ) : (
          <>
            <div className="lb-meta">{data.count} follower{data.count !== 1 ? 's' : ''} · {data.challenge.habitsCount} habits</div>
            {data.entries.length === 0 ? (
              <div className="lb-empty">No followers yet. Be the first!</div>
            ) : (
              <div className="lb-list">
                {data.entries.map((e, i) => (
                  <div key={e.username} className="lb-row">
                    <div className="lb-rank">#{i + 1}</div>
                    <div className="lb-avatar">
                      {e.profilePicture ? (
                        <img src={e.profilePicture} alt="" />
                      ) : (
                        <span>{e.username[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="lb-info">
                      <div className="lb-name">{e.username}</div>
                      <div className="lb-sub">{e.totalEarned}/{e.totalPossible} pts · {e.daysTracked}d</div>
                    </div>
                    <div className="lb-pct">{e.percentage}%</div>
                    <div className="lb-bar-wrap">
                      <div className="lb-bar" style={{ width: e.percentage + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
