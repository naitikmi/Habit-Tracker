import React from 'react';
import { useData } from '../../contexts/DataContext';
import { parseDate, daysBetween, dateStr } from '../../utils/helpers';

export default function DashboardPage() {
  const { activeChallenge, habits, progressData } = useData();

  if (!activeChallenge || !habits.length) {
    return (
      <div>
        <div className="dash-summary">
          <div className="dash-title">Overall Progress</div>
          <div className="dash-row">
            <span className="dash-val"><span className="accent">0</span> / 0</span>
            <span className="dash-label">points earned</span>
          </div>
          <div className="dash-bar"><div className="fill" style={{ width: '0%' }} /></div>
          <div className="dash-row" style={{ marginTop: '1px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800 }}>0%</span>
            <span className="dash-label">overall completion</span>
          </div>
        </div>
        <div className="empty-state"><p>No challenges available</p></div>
      </div>
    );
  }

  const startDate = activeChallenge.startDate;
  const challengeDays = activeChallenge.days;
  const today = dateStr(new Date());
  const daysSinceStart = Math.max(1, daysBetween(parseDate(startDate), new Date()));

  let grandEarned = 0, grandMax = 0;
  const habitStats = habits.map(h => {
    let earned = 0, doneDays = 0, totalDays = 0;
    const maxPts = h.maxPoints || 10;
    const d = new Date(parseDate(startDate));
    const end = new Date();
    const entries = progressData[h.id] || {};
    while (d <= end) {
      const ds = dateStr(d);
      const val = entries[ds] || 0;
      earned += val > 0 ? maxPts : 0;
      if (val > 0) doneDays++;
      totalDays++;
      d.setDate(d.getDate() + 1);
    }
    grandEarned += earned;
    grandMax += maxPts * totalDays;
    return { ...h, earned, doneDays, totalDays, maxPts, pct: totalDays ? Math.round((doneDays / totalDays) * 100) : 0 };
  });

  const overallPct = grandMax ? Math.round((grandEarned / grandMax) * 100) : 0;
  const challengeDay = Math.min(challengeDays, daysSinceStart);
  const challengePct = Math.min(100, Math.round((challengeDay / challengeDays) * 100));

  const sorted = [...habitStats].sort((a, b) => b.pct - a.pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const avgDays = habitStats.length ? Math.round(habitStats.reduce((s, h) => s + h.doneDays, 0) / habitStats.length) : 0;

  return (
    <div>
      <div className="dash-summary">
        <div className="dash-title">Overall Progress</div>
        <div className="dash-row">
          <span className="dash-val">
            <span className="accent">{grandEarned}</span> / {grandMax}
          </span>
          <span className="dash-label">points earned</span>
        </div>
        <div className="dash-bar"><div className="fill" style={{ width: Math.min(100, overallPct) + '%' }} /></div>
        <div className="dash-row" style={{ marginTop: '1px' }}>
          <span style={{ fontSize: '22px', fontWeight: 800 }}>{overallPct}%</span>
          <span className="dash-label">overall completion</span>
        </div>
      </div>

      <div className="dash-summary">
        <div className="dash-title">Challenge Progress</div>
        <div className="dash-row">
          <span className="dash-val">
            <span className="accent">{challengeDay}</span> / {challengeDays}
          </span>
          <span className="dash-label">days done</span>
        </div>
        <div className="dash-bar"><div className="fill" style={{ width: challengePct + '%' }} /></div>
        <div className="dash-row" style={{ marginTop: '1px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{challengePct}%</span>
          <span className="dash-label">of challenge</span>
        </div>
      </div>

      <div className="dash-highlight">
        {best && (
          <div className="hl-card">
            <div className="hl-icon">&#127942;</div>
            <div className="hl-name">Best</div>
            <div className="hl-val" style={{ color: 'var(--green)' }}>{best.name}</div>
            <div style={{ fontSize: '9px', color: 'var(--text3)' }}>{best.pct}%</div>
          </div>
        )}
        {worst && habitStats.length > 1 && (
          <div className="hl-card">
            <div className="hl-icon">&#128170;</div>
            <div className="hl-name">Keep going</div>
            <div className="hl-val" style={{ color: 'var(--amber)' }}>{worst.name}</div>
            <div style={{ fontSize: '9px', color: 'var(--text3)' }}>{worst.pct}%</div>
          </div>
        )}
        <div className="hl-card">
          <div className="hl-icon">&#128204;</div>
          <div className="hl-name">Avg days</div>
          <div className="hl-val" style={{ color: 'var(--accent)' }}>{avgDays}</div>
          <div style={{ fontSize: '9px', color: 'var(--text3)' }}>per habit</div>
        </div>
      </div>

      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        Habit Breakdown
      </div>
      <div className="dash-grid">
        {sorted.map(h => {
          const barColor = h.pct >= 66 ? 'var(--green)' : h.pct >= 33 ? 'var(--amber)' : 'var(--red)';
          return (
            <div className="dash-habit" key={h.id}>
              <div className="dash-habit-color" style={{ background: h.color }} />
              <div className="dash-habit-info">
                <div className="dh-name">{h.name}</div>
                <div className="dh-sub">{h.doneDays}/{h.totalDays} days &middot; {h.earned}/{h.maxPts * h.totalDays} pts</div>
                <div className="dash-habit-bar">
                  <div className="fill" style={{ width: h.pct + '%', background: barColor }} />
                </div>
              </div>
              <div className="dash-habit-right">
                <div className="dh-pct" style={{ color: barColor }}>{h.pct}%</div>
                <div className="dh-frac">{h.earned} pts</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
