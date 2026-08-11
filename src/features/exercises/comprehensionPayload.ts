import type { ListeningExerciseType, ReadingExerciseType } from './comprehension';

export type ExerciseAnswer = string | boolean | number | undefined;
export type ExerciseAnswers = ExerciseAnswer[] | Record<number, never>;
export type ExerciseSolution = string | string[] | boolean | number;

export interface MultipleChoiceQuestion {
  question: string;
  options: string[];
}

export interface ComprehensionExercise {
  type?: ReadingExerciseType | ListeningExerciseType;
  instruction?: string;
  passage?: string;
  format?: string;
  exercises?: Array<string | MultipleChoiceQuestion>;
  statements?: string[];
  solutions?: ExerciseSolution[];
  _metadata?: { template_name?: string; index?: number };
  vocabulary?: Array<{ word: string; meaning: string }>;
  [key: string]: unknown;
}

export interface ComprehensionApiResponse {
  success?: boolean;
  exercise?: ComprehensionExercise;
  data?: ComprehensionExercise;
  credits_left?: number;
  message?: string;
  limit_status?: {
    is_blocked?: boolean;
    credits_left?: number;
    message?: string;
  };
  [key: string]: unknown;
}

export function solutionVariants(entry: unknown): string[] {
  if (Array.isArray(entry)) return entry.filter((value): value is string => typeof value === 'string');
  return typeof entry === 'string' ? [entry] : [String(entry ?? '')];
}

export function normalizeAnswer(value: unknown): string {
  return (value ?? '').toString().toLowerCase().replace(/[\p{P}]/gu, '').trim();
}
