import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import { useData } from '../../contexts/DataContext';
import { getActiveChallenge, getActiveHabits, getChallengeEnd, parseDate, dateStr, getChallenges } from '../../utils/helpers';

Chart.register(...registerables);

export default function ChartsPage() {
  const { defaultsData, userChallengesData, progressData, activeChallenge, habits } = useData();
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [period, setPeriod] = useState('daily');
  const [calDate, setCalDate] = useState(new Date());

  const challenge = activeChallenge || getChallenges(defaultsData, userChallengesData)[0] || null;
  const chartHabits = challenge ? challenge.habits : [];

  const renderChart = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (!challenge || !chartHabits.length) {
      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['No data'], datasets: [{ label: '%', data: [0], backgroundColor: '#333' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      return;
    }

    const labels = [];
    let dataArr = [];
    const startDate = parseDate(challenge.startDate);
    const endDate = getChallengeEnd(challenge) || new Date();
    const today = new Date();
    const rangeEnd = endDate < today ? endDate : today;

    if (period === 'daily') {
      const d = new Date(startDate);
      while (d <= rangeEnd) {
        const ds = dateStr(d);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        let pts = 0, max = 0;
        chartHabits.forEach(h => { const m = h.maxPoints || 10; max += m; if (((progressData[h.id] || {})[ds] || 0) > 0) pts += m; });
        dataArr.push(max ? Math.round((pts / max) * 100) : 0);
        d.setDate(d.getDate() + 1);
      }
    } else if (period === 'weekly') {
      const d = new Date(startDate);
      while (d <= rangeEnd) {
        const weekStart = new Date(d);
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > rangeEnd) weekEnd.setTime(rangeEnd.getTime());
        labels.push(weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '-' + weekEnd.toLocaleDateString('en-US', { day: 'numeric' }));
        let pts = 0, max = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          if (day > rangeEnd) break;
          const ds = dateStr(day);
          chartHabits.forEach(h => { const m = h.maxPoints || 10; max += m; if (((progressData[h.id] || {})[ds] || 0) > 0) pts += m; });
        }
        dataArr.push(max ? Math.round((pts / max) * 100) : 0);
        d.setDate(d.getDate() + 7);
      }
    } else {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (d <= endMonth) {
        labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        let pts = 0, max = 0;
        for (let day = 1; day <= dim; day++) {
          const dayDate = new Date(d.getFullYear(), d.getMonth(), day);
          if (dayDate > rangeEnd) break;
          const ds = dateStr(dayDate);
          chartHabits.forEach(h => { const m = h.maxPoints || 10; max += m; if (((progressData[h.id] || {})[ds] || 0) > 0) pts += m; });
        }
        dataArr.push(max ? Math.round((pts / max) * 100) : 0);
        d.setMonth(d.getMonth() + 1);
      }
    }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '%',
          data: dataArr,
          backgroundColor: accent + '40',
          borderColor: accent,
          borderWidth: 2,
          borderRadius: 4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y + '%' } }
        },
        scales: {
          x: { ticks: { color: '#55557a', font: { size: 10 } }, grid: { color: '#1e1e38' } },
          y: { beginAtZero: true, max: 100, ticks: { color: '#55557a', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1e1e38' } }
        }
      }
    });
  }, [period, challenge, chartHabits, progressData]);

  useEffect(() => {
    renderChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [renderChart]);

  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const dim = new Date(calYear, calMonth + 1, 0).getDate();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const td = dateStr(new Date());

  const calPrev = () => {
    const d = new Date(calDate);
    d.setMonth(d.getMonth() - 1);
    setCalDate(d);
  };
  const calNext = () => {
    const d = new Date(calDate);
    d.setMonth(d.getMonth() + 1);
    setCalDate(d);
  };

  const calTitle = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = [];
  dayNames.forEach(d => cells.push(<div className="day-label" key={'lbl-' + d}>{d}</div>));
  for (let i = 0; i < firstDay; i++) cells.push(<div className="day-cell dim" key={'pad-' + i} />);
  for (let day = 1; day <= dim; day++) {
    const d = new Date(calYear, calMonth, day);
    const ds = dateStr(d);
    const isToday = ds === td;
    let pts = 0, max = 0;
    chartHabits.forEach(h => { const m = h.maxPoints || 10; max += m; if (((progressData[h.id] || {})[ds] || 0) > 0) pts += m; });
    const pct = max ? pts / max : 0;
    const r = Math.round(30 + (50 - 30) * pct);
    const g = Math.round(30 + (204 - 30) * pct);
    const bb = Math.round(40 + (113 - 40) * pct);
    const bg = pts > 0 ? `rgb(${r},${g},${bb})` : 'var(--card2)';
    cells.push(
      <div
        key={'day-' + day}
        className={`day-cell${isToday ? ' today' : ''}`}
        style={{ background: bg }}
        title={`${ds}: ${pts}/${max}`}
      >
        {day}
      </div>
    );
  }

  return (
    <div>
      <div className="chart-section">
        <h3>Points Earned</h3>
        <div className="chart-box">
          <div className="chart-period">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                className={`btn-period${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="chart-wrap">
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
      <div className="chart-section">
        <h3>Calendar</h3>
        <div className="chart-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <button className="btn-nav" onClick={calPrev} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: '13px', cursor: 'pointer', padding: '2px 6px' }}>&#9664;</button>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{calTitle}</span>
            <button className="btn-nav" onClick={calNext} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: '13px', cursor: 'pointer', padding: '2px 6px' }}>&#9654;</button>
          </div>
          <div className="calendar-grid">
            {cells}
          </div>
        </div>
      </div>
    </div>
  );
}
