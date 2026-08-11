import type { ExerciseType } from './types';

export type ComprehensionKind = 'FILL_IN_THE_BLANK' | 'TRUE_FALSE' | 'MULTIPLE_CHOICE';
export type ReadingExerciseType = `${ComprehensionKind}_READING`;
export type ListeningExerciseType = `${ComprehensionKind}_LISTENING`;

export function toTemplateType(type: ReadingExerciseType | ListeningExerciseType): ExerciseType {
  if (type.startsWith('FILL_IN_THE_BLANK')) return 'FILL_IN_THE_BLANK_READING_WRITING';
  if (type.startsWith('TRUE_FALSE')) return 'TRUE_FALSE_READING';
  return 'MULTIPLE_CHOICE_READING';
}
