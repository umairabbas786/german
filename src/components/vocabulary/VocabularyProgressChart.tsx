import { useEffect, useState } from 'react';

export interface VocabularyProgressData {
  done: number;
  learning: number;
  new: number;
}

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
    <div className="lv-pie-chart-container">
      <svg className="lv-pie-chart" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#ef4444" strokeWidth="8"
          strokeDasharray={`${redStroke} ${circumference}`} strokeDashoffset="0" transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="8"
          strokeDasharray={`${blueStroke} ${circumference}`} strokeDashoffset={`-${newStrokeTarget}`} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#22c55e" strokeWidth="8"
          strokeDasharray={`${greenStroke} ${circumference}`} strokeDashoffset={`-${newStrokeTarget + learningStrokeTarget}`} transform="rotate(-90 50 50)" />
      </svg>
    </div>
  );
}
