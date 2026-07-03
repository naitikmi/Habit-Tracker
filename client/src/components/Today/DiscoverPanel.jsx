import React, { useState, useEffect } from 'react';
import { tryFetchAPI, authHeaders, saveActiveChallenge } from '../../utils/api';
import { useToast } from '../Layout/Toast';

export default function DiscoverPanel({ onClose, onFollow }) {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await tryFetchAPI('/api/challenges/community', { headers: authHeaders() });
      if (r && r.ok) setChallenges(r.data || []);
      setLoading(false);
    })();
  }, []);

  const handleFollow = async (ch) => {
    await saveActiveChallenge(ch.id, ch.source);
    showToast('Following: ' + ch.name);
    setChallenges(prev => prev.map(c =>
      c.id === ch.id && c.source === ch.source ? { ...c, following: true } : { ...c, following: false }
    ));
    if (onFollow) onFollow(ch);
  };

  return (
    <>
      <div className="theme-overlay open" onClick={onClose} />
      <div className="discover-panel open">
        <div className="lb-header">
          <h3>Discover Challenges</h3>
          <button className="lb-close" onClick={onClose}>✕</button>
        </div>
        <div className="lb-meta">Follow a challenge to track it and appear on its leaderboard</div>

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
    </>
  );
}
