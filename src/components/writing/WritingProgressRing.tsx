import { useEffect, useState } from 'react';

export interface WritingProgressRingProps {
  percent: number;
  wordCount: number;
  targetWords: number;
}

export function WritingProgressRing({ percent, wordCount, targetWords }: WritingProgressRingProps) {
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
    <div className="gg-writing-progress-ring">
      <svg className="gg-writing-progress-svg" viewBox="0 0 100 100">
        <circle className="gg-writing-progress-track" cx="50" cy="50" r={radius} strokeDasharray={circumference} />
        <circle className="gg-writing-progress-value" cx="50" cy="50" r={radius}
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="gg-writing-progress-center">
        <div className="gg-writing-progress-main">{wordCount} words</div>
        <div className="gg-writing-progress-sub">out of {targetWords}</div>
      </div>
    </div>
  );
}
