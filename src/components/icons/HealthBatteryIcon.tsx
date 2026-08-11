import React from 'react';

type HealthLevel = 'full' | 'medium' | 'low' | 'empty';

interface HealthBatteryIconProps {
  color: string;
  level: HealthLevel;
}

function getActiveBars(level: HealthLevel): number {
  if (level === 'full') return 3;
  if (level === 'medium') return 2;
  if (level === 'low') return 1;
  return 0;
}

export function HealthBatteryIcon({ color, level }: HealthBatteryIconProps) {
  const activeBars = getActiveBars(level);

  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="5.8" width="10.8" height="8.4" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="15.1" y="7.9" width="1.8" height="4.2" rx="0.8" fill="currentColor" />
      <rect x="5.4" y="7.3" width="2" height="5.4" rx="0.6" fill={activeBars >= 1 ? color : '#d1d5db'} />
      <rect x="7.9" y="7.3" width="2" height="5.4" rx="0.6" fill={activeBars >= 2 ? color : '#d1d5db'} />
      <rect x="10.4" y="7.3" width="2" height="5.4" rx="0.6" fill={activeBars >= 3 ? color : '#d1d5db'} />
    </svg>
  );
}
