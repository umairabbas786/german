export type MainTab =
  | 'modules'
  | 'vocabulary'
  | 'grammar'
  | 'speaking'
  | 'writing'
  | 'reading'
  | 'listening'
  | 'settings';

export type LearningMode = 'LEARN' | 'PRACTICE' | 'STATS';
export type GermanLevel = 'A1' | 'A2' | 'B1';

export const GERMAN_LEVELS: GermanLevel[] = ['A1', 'A2', 'B1'];

export const ROADMAP_ENABLED_KEYS: Record<GermanLevel, string> = {
  A1: 'enable_roadmap_a1',
  A2: 'enable_roadmap_a2',
  B1: 'enable_roadmap_b1',
};

export const FEATURE_TABS: MainTab[] = [
  'vocabulary',
  'grammar',
  'speaking',
  'writing',
  'reading',
  'listening',
];

export const STATS_TABS: MainTab[] = [...FEATURE_TABS];

export function getTabFromPath(pathname: string): MainTab {
  const tab = pathname.slice(1) as MainTab;
  return FEATURE_TABS.includes(tab) || tab === 'settings' ? tab : 'modules';
}

export function getDefaultModeForTab(tab: MainTab): LearningMode {
  if (tab === 'speaking' || tab === 'writing' || tab === 'reading' || tab === 'listening') {
    return 'PRACTICE';
  }
  return 'LEARN';
}

const MODE_STORAGE_KEY = 'langey_feature_mode';

export function saveModeForTab(tab: MainTab, mode: LearningMode): void {
  try {
    sessionStorage.setItem(MODE_STORAGE_KEY, JSON.stringify({ tab, mode }));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function getReloadMode(pathname: string): LearningMode {
  const tab = getTabFromPath(pathname);
  const defaultMode = getDefaultModeForTab(tab);
  const entry = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
  if (entry?.type !== 'reload') return defaultMode;

  try {
    const stored = JSON.parse(sessionStorage.getItem(MODE_STORAGE_KEY) || '{}');
    return stored.tab === tab && stored.mode === 'STATS' ? 'STATS' : defaultMode;
  } catch {
    return defaultMode;
  }
}
