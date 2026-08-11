import { useEffect, useState } from 'react';

export interface SpeakingProgressRingProps {
  percent: number;
  timeLabel: string;
  targetLabel: string;
}

export function SpeakingProgressRing({ percent, timeLabel, targetLabel }: SpeakingProgressRingProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    setAnimatedPercent(0);
    const timer = window.setTimeout(() => setAnimatedPercent(percent), 50);
    return () => window.clearTimeout(timer);
  }, [percent]);

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercent / 100) * circumference;

  return (
    <div className="gg-speaking-progress-ring">
      <svg className="gg-speaking-progress-svg" viewBox="0 0 100 100">
        <circle className="gg-speaking-progress-track" cx="50" cy="50" r={radius} strokeDasharray={circumference} />
        <circle className="gg-speaking-progress-value" cx="50" cy="50" r={radius}
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="gg-speaking-progress-center">
        <div className="gg-speaking-progress-main">{timeLabel}</div>
        <div className="gg-speaking-progress-sub">out of {targetLabel}</div>
      </div>
    </div>
  );
}
