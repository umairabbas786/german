export type GermanLevel = 'A1' | 'A2' | 'B1';
export type LearnMode = 'LEARN' | 'STATS';
export type PracticeMode = 'PRACTICE' | 'STATS';

export interface BaseModuleProps {
  level: GermanLevel;
  onProgressUpdate?: () => void;
}

export interface FullscreenModuleProps extends BaseModuleProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export interface RoadmapModuleProps extends BaseModuleProps {
  openedFromRoadmap?: boolean;
  roadmapItemKey?: string;
  roadmapTopic?: string;
}

export interface TopicEntry {
  Title: string;
}

export type TopicsByLevel = Record<string, TopicEntry[]>;

export interface GrammarTopicEntry extends TopicEntry {
  slug: string;
}

export type GrammarTopicsByLevel = Record<GermanLevel, GrammarTopicEntry[]>;

export function getTopicsForLevel(topics: Partial<TopicsByLevel>, level: GermanLevel): TopicEntry[] {
  return topics[level] || [];
}
