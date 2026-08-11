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
    <div className="relative h-[420px] w-[420px] max-sm:h-[320px] max-sm:max-w-full max-sm:w-[320px]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          className="fill-none stroke-[rgba(0,0,0,0.08)] [stroke-width:8]"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
        />
        <circle
          className="fill-none stroke-[#22c55e] [stroke-linecap:round] [stroke-width:8] transition-[stroke-dashoffset] duration-1000 ease-in-out"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 flex h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center max-sm:h-[200px] max-sm:w-[200px]">
        <div className="text-[30px] leading-[1.1] font-extrabold text-[#111] max-sm:text-2xl">{timeLabel}</div>
        <div className="mt-1.5 text-sm font-bold text-black/55">out of {targetLabel}</div>
      </div>
    </div>
  );
}
