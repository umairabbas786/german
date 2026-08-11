export type ExerciseType =
  | 'FILL_IN_THE_BLANK_READING_WRITING'
  | 'TRUE_FALSE_READING'
  | 'MULTIPLE_CHOICE_READING'
  | 'SENTENCE_BUILDING_WRITING'
  | 'WORD_ORDER_WRITING';

export type TextSolutionEntry = string | string[];

export interface FillInBlankExercise {
  type: 'FILL_IN_THE_BLANK_READING_WRITING';
  exercises: string[];
  solutions: TextSolutionEntry[];
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
}

export interface TrueFalseExercise {
  type: 'TRUE_FALSE_READING';
  text: string;
  statements: string[];
  solutions: boolean[];
  answers: boolean[];
  onAnswerChange: (index: number, value: boolean) => void;
}

export interface MultipleChoiceExercise {
  type: 'MULTIPLE_CHOICE_READING';
  exercises: { question: string; options: string[] }[];
  solutions: number[];
  answers: number[];
  onAnswerChange: (index: number, value: number) => void;
}

export interface SentenceBuildingExercise {
  type: 'SENTENCE_BUILDING_WRITING';
  prompts: string[];
  solutions: TextSolutionEntry[];
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
}

export interface WordOrderExercise {
  type: 'WORD_ORDER_WRITING';
  jumbledWords: string[][];
  solutions: TextSolutionEntry[];
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
}
