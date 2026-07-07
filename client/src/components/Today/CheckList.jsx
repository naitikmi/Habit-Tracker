import React from 'react';

export default function CheckList({ habits, entryGetter, onToggle, isFuture }) {
  if (!habits || !habits.length) return null;

  return (
    <div className={`checklist${isFuture ? ' future' : ''}`}>
      {habits.map(h => {
        const checked = entryGetter(h.id) > 0;
        const pts = checked ? (h.maxPoints || 10) : 0;
        return (
          <div className="check-item" key={h.id} data-id={h.id} onClick={isFuture ? undefined : () => onToggle(h.id)}>
            <button
              type="button"
              className={`check-box${checked ? ' done' : ''}`}
              disabled={isFuture}
              onClick={(e) => { if (!isFuture) { e.stopPropagation(); onToggle(h.id); } }}
            >
              {checked ? '✓' : ''}
            </button>
            <div className="ci-info">
              <div className="ci-name" style={{ color: checked ? 'var(--text2)' : 'var(--text)' }}>
                {h.name}
              </div>
              <div className="ci-sub">{checked ? '✓ done' : isFuture ? '— upcoming' : '— pending'}</div>
            </div>
            <div className="ci-right">
              <div className={`ci-pts ${checked ? 'earned' : 'zero'}`}>+{pts}</div>
              <div className="ci-max">/ {h.maxPoints || 10}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
