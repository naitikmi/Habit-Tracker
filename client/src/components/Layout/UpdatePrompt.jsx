import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt">
      <span>A new version is available</span>
      <button onClick={() => updateServiceWorker(true)}>Reload</button>
    </div>
  );
}
