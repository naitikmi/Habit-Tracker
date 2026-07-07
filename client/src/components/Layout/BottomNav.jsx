import React from 'react';

const TABS = [
  { key: 'today', icon: '\u2630', label: 'Today' },
  { key: 'groups', icon: '\uD83D\uDC65', label: 'Groups' },
  { key: 'dashboard', icon: '\uD83D\uDCC8', label: 'Stats' },
  { key: 'charts', icon: '\uD83D\uDCCA', label: 'Charts' },
  { key: 'settings', icon: '\u2699', label: 'Settings' }
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <div className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`nav-item${activeTab === tab.key ? ' active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          <span className="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
