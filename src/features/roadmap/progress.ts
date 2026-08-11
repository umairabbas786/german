import type { MainTab } from '../learning/navigation';

export interface RoadmapMetric {
  target_cards?: number;
  remaining?: number;
  target_score?: number;
  current_score?: number;
  target_words?: number;
  current_words?: number;
  target_minutes?: number;
  current_seconds?: number;
}

export interface RoadmapDayPlan {
  day: number;
  vocabulary?: RoadmapMetric;
  grammar?: RoadmapMetric;
  reading?: RoadmapMetric;
  listening?: RoadmapMetric;
  writing?: RoadmapMetric;
  speaking?: RoadmapMetric;
}

export interface RoadmapByLevel {
  current_day?: number;
  plan?: RoadmapDayPlan[];
}

export interface RoadmapProgress {
  progress: number;
  label: string;
}

const percentage = (current: number, target: number) =>
  Math.max(0, Math.min(100, Math.round((current / target) * 100)));

export function calculateRoadmapProgress(
  tab: MainTab,
  dayPlan: RoadmapDayPlan,
): RoadmapProgress {
  let progress = 0;
  let label = '';

  if (tab === 'vocabulary') {
    const target = dayPlan.vocabulary?.target_cards || 31;
    const remaining = dayPlan.vocabulary?.remaining ?? target;
    const completed = Math.min(target, Math.max(0, target - remaining));
    progress = percentage(target - remaining, target);
    label = `${completed} / ${target} cards`;
  } else if (tab === 'grammar') {
    const target = dayPlan.grammar?.target_score || 70;
    const current = dayPlan.grammar?.current_score ?? 0;
    progress = percentage(current, target);
    label = `${current}% / ${target}% target`;
  } else if (tab === 'reading' || tab === 'listening') {
    const metric = dayPlan[tab];
    const target = metric?.target_score || 75;
    const current = metric?.current_score ?? 0;
    progress = percentage(current, target);
    label = `${current}% / ${target}% target`;
  } else if (tab === 'writing') {
    const target = dayPlan.writing?.target_words;
    const current = dayPlan.writing?.current_words ?? 0;
    progress = target ? percentage(current, target) : 0;
    label = target ? `${current} / ${target} words` : `Progress: ${progress}%`;
  } else if (tab === 'speaking') {
    const target = dayPlan.speaking?.target_minutes;
    const current = dayPlan.speaking?.current_seconds ?? 0;
    progress = target ? percentage(current, target * 60) : 0;
    label = target ? `${Math.floor(current / 60)} / ${target} min` : `Progress: ${progress}%`;
  }

  return { progress, label: label || `Progress: ${progress}%` };
}
