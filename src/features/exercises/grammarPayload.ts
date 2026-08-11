import type { ExerciseType } from './types';
import type { ExerciseAnswer, ExerciseSolution, MultipleChoiceQuestion } from './comprehensionPayload';

export interface GrammarExercise {
  type?: ExerciseType;
  title?: string;
  text?: string;
  exercises?: Array<string | MultipleChoiceQuestion>;
  statements?: string[];
  prompts?: string[];
  jumbledWords?: string[][];
  solutions?: ExerciseSolution[];
  [key: string]: unknown;
}

export interface LlmAssistResponse {
  message?: string;
  lecture_markdown?: string;
  help?: string;
  reason?: string;
  feedback?: string[];
  [key: string]: unknown;
}

export type GrammarAnswer = ExerciseAnswer;
