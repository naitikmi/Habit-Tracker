import React from 'react';

export default function ScoreCard({ habits, entryGetter }) {
  if (!habits || !habits.length) return null;

  const totalMax = habits.reduce((s, h) => s + (h.maxPoints || 10), 0);
  let ptsEarned = 0, doneCount = 0;
  habits.forEach(h => {
    if (entryGetter(h.id) > 0) {
      doneCount++;
      ptsEarned += (h.maxPoints || 10);
    }
  });
  const pct = totalMax ? Math.round((ptsEarned / totalMax) * 100) : 0;
  const circumference = 188.5;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="score-card">
      <div className="score-ring-wrap">
        <svg viewBox="0 0 72 72">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="#feb47b" />
            </linearGradient>
          </defs>
          <circle className="ring-bg" cx="36" cy="36" r="30" />
          <circle
            className="ring-fg"
            cx="36" cy="36" r="30"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="pct-text">{pct}%</div>
      </div>
      <div className="score-info">
        <div className="score-main">
          <span className="num">{doneCount}</span> / {habits.length} done
        </div>
        <div className="score-pts">
          Points: <span className="pts-val">{ptsEarned}</span> / {totalMax} &middot; {pct}%
        </div>
        <div className="score-bar">
          <div className="fill" style={{ width: pct + '%' }} />
        </div>
      </div>
    </div>
  );
}
