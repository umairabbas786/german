import { useEffect, useState } from 'react';

export interface VocabularyProgressData {
  done: number;
  learning: number;
  new: number;
}

const PIE_CHART_CONTAINER =
  'size-[420px] max-md:size-60 max-[480px]:size-[210px] max-lg:size-[min(90vw,280px)] lg:max-[1366px]:size-[min(90vw,280px)]';

export function VocabularyProgressChart({ data }: { data: VocabularyProgressData }) {
  const total = Math.max(data.done + data.learning + data.new, 1);
  const circumference = 2 * Math.PI * 45;
  const doneStrokeTarget = (data.done / total) * circumference;
  const learningStrokeTarget = (data.learning / total) * circumference;
  const newStrokeTarget = (data.new / total) * circumference;
  const [redStroke, setRedStroke] = useState(0);
  const [blueStroke, setBlueStroke] = useState(0);
  const [greenStroke, setGreenStroke] = useState(0);

  useEffect(() => {
    setRedStroke(0);
    setBlueStroke(0);
    setGreenStroke(0);
    const stepMs = 700;
    let delay = 50;
    const timers: number[] = [];
    if (newStrokeTarget > 0) {
      timers.push(window.setTimeout(() => setRedStroke(newStrokeTarget), delay));
      delay += stepMs;
    }
    if (learningStrokeTarget > 0) {
      timers.push(window.setTimeout(() => setBlueStroke(learningStrokeTarget), delay));
      delay += stepMs;
    }
    if (doneStrokeTarget > 0) {
      timers.push(window.setTimeout(() => setGreenStroke(doneStrokeTarget), delay));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [newStrokeTarget, learningStrokeTarget, doneStrokeTarget]);

  return (
    <div className={PIE_CHART_CONTAINER}>
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#ef4444"
          strokeWidth="8"
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-in-out"
          strokeDasharray={`${redStroke} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="8"
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-in-out"
          strokeDasharray={`${blueStroke} ${circumference}`}
          strokeDashoffset={`-${newStrokeTarget}`}
          transform="rotate(-90 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#22c55e"
          strokeWidth="8"
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-in-out"
          strokeDasharray={`${greenStroke} ${circumference}`}
          strokeDashoffset={`-${newStrokeTarget + learningStrokeTarget}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
}
