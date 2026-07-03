import React from 'react';
import { formatDateNice, daysBetween, parseDate } from '../../utils/helpers';

export default function DateNav({ currentDate, setCurrentDate, activeChallenge }) {
  const goPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  let dayNum = null;
  if (activeChallenge) {
    dayNum = daysBetween(parseDate(activeChallenge.startDate), currentDate);
  }

  return (
    <div className="date-nav">
      <span className="date-label">{formatDateNice(currentDate)}</span>
      {dayNum !== null && <span className="challenge-tag">Day {dayNum}</span>}
      <div className="nav-arrows">
        <button className="btn-nav" onClick={goPrev}>&#9664;</button>
        <button className="btn-nav" onClick={goNext}>&#9654;</button>
      </div>
    </div>
  );
}
