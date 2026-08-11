import { UserTracker } from '../../utils/userTracking';

export type GermanLevel = 'A1' | 'A2' | 'B1';
export type MonthsChoice = 1 | 2 | 3 | 4 | 5 | 6;
export type Intent = 'paid' | 'free';
export type Stage = 'welcome' | 'plan' | 'paywall' | 'auth';

export interface JourneyDraft {
  stage: Stage;
  level: GermanLevel | null;
  months: MonthsChoice;
  intent: Intent | null;
  roadmapCreated: boolean;
}

const DAYS_BY_LEVEL: Record<GermanLevel, [number, number, number]> = {
  A1: [22, 44, 66],
  A2: [19, 38, 57],
  B1: [20, 40, 60],
};

const MINUTES_PER_DAY: Record<GermanLevel, Record<MonthsChoice, number>> = {
  A1: { 1: 70, 2: 64, 3: 58, 4: 52, 5: 46, 6: 40 },
  A2: { 1: 110, 2: 100, 3: 90, 4: 80, 5: 70, 6: 60 },
  B1: { 1: 160, 2: 148, 3: 136, 4: 124, 5: 112, 6: 100 },
};

export const DEFAULT_SCENARIO = 'Living in Germany (Daily Life)';
export const STAGE_ORDER: Stage[] = ['welcome', 'plan', 'paywall', 'auth'];

const DEFAULT_DRAFT: JourneyDraft = {
  stage: 'welcome',
  level: null,
  months: 2,
  intent: null,
  roadmapCreated: false,
};

export function roadmapDaysForMonths(level: GermanLevel, months: MonthsChoice): number {
  const options = DAYS_BY_LEVEL[level];
  if (months <= 1) return options[0];
  if (months <= 3) return options[1];
  return options[2];
}

export function minutesPerDay(level: GermanLevel, months: MonthsChoice): number {
  return MINUTES_PER_DAY[level][months];
}

export function readJourneyDraft(): JourneyDraft {
  const draft = UserTracker.getNewUserOnboardingDraft<Partial<JourneyDraft>>();
  if (!draft) return DEFAULT_DRAFT;
  const months = draft.months;
  return {
    ...DEFAULT_DRAFT,
    ...draft,
    stage: draft.stage && STAGE_ORDER.includes(draft.stage) ? draft.stage : 'welcome',
    level: draft.level === 'A1' || draft.level === 'A2' || draft.level === 'B1' ? draft.level : null,
    months: months === 1 || months === 2 || months === 3 || months === 4 || months === 5 || months === 6 ? months : 2,
    intent: draft.intent === 'paid' || draft.intent === 'free' ? draft.intent : null,
  };
}
