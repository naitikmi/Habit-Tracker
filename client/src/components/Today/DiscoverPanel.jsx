import React, { useState, useEffect } from 'react';
import { tryFetchAPI, authHeaders, saveFollowedChallenge } from '../../utils/api';
import { useToast } from '../Layout/Toast';
import LeaderboardPanel from './LeaderboardPanel';

export default function DiscoverPanel({ onClose, onFollow }) {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewLeaderboard, setViewLeaderboard] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await tryFetchAPI('/api/challenges/community', { headers: authHeaders() });
      if (r && r.ok) setChallenges(r.data || []);
      setLoading(false);
    })();
  }, []);

  const handleFollow = async (ch) => {
    await saveFollowedChallenge(ch.id, ch.source);
    showToast('Following: ' + ch.name);
    setChallenges(prev => prev.map(c =>
      c.id === ch.id && c.source === ch.source ? { ...c, following: true } : { ...c, following: false }
    ));
    if (onFollow) onFollow(ch);
  };

  const followed = challenges.find(c => c.following);

  return (
    <>
      <div className="theme-overlay open" onClick={onClose} />
      <div className="discover-panel open">
        <div className="lb-header">
          <h3>Discover Challenges</h3>
          <button className="lb-close" onClick={onClose}>✕</button>
        </div>
        <div className="lb-meta">Follow a challenge to track it and appear on its leaderboard</div>

        {!loading && followed && (
          <div className="discover-card following" style={{ marginBottom: '10px' }}>
            <div className="discover-info">
              <div className="discover-name">You're following: {followed.name}</div>
              <div className="discover-meta">{followed.days} days &middot; {followed.habitsCount} habits</div>
            </div>
            <button
              className="discover-follow-btn"
              onClick={() => setViewLeaderboard(followed)}
            >
              View Leaderboard
            </button>
          </div>
        )}

        {loading ? (
          <div className="lb-loading">Loading...</div>
        ) : challenges.length === 0 ? (
          <div className="lb-empty">No challenges available</div>
        ) : (
          <div className="discover-list">
            {challenges.map(ch => {
              const key = ch.source + '-' + ch.id;
              return (
                <div key={key} className={`discover-card ${ch.following ? 'following' : ''}`}>
                  <div className="discover-info">
                    <div className="discover-name">{ch.name}</div>
                    <div className="discover-meta">
                      {ch.days} days · {ch.habitsCount} habits
                      {ch.source === 'default'
                        ? <span className="discover-tag default">Official</span>
                        : <span className="discover-tag user">by {ch.creator?.username || 'Unknown'}</span>
                      }
                    </div>
                  </div>
                  {ch.isOwn ? (
                    <span className="discover-own-badge">Yours</span>
                  ) : (
                    <button
                      className={`discover-follow-btn ${ch.following ? 'following' : ''}`}
                      onClick={() => !ch.following && handleFollow(ch)}
                    >
                      {ch.following ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {viewLeaderboard && (
        <LeaderboardPanel
          challengeId={viewLeaderboard.id}
          challengeName={viewLeaderboard.name}
          challengeSource={viewLeaderboard.source}
          onClose={() => setViewLeaderboard(null)}
        />
      )}
    </>
  );
}
