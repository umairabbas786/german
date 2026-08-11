import { apiFetch, apiUrl } from './api';
import type { ComprehensionExercise } from '../features/exercises/comprehensionPayload';
import type { ListeningExerciseType, ReadingExerciseType } from '../features/exercises/comprehension';
import type { GrammarExercise, LlmAssistResponse } from '../features/exercises/grammarPayload';

export interface LimitStatusData {
  is_blocked?: boolean;
  credits_left?: number;
  message?: string;
}

export interface GrammarExerciseResponse {
  exercise: GrammarExercise;
  credits_left?: number;
  error?: string;
  limit_status?: LimitStatusData;
}

interface ReadingExerciseResponse {
  success?: boolean;
  exercise: ComprehensionExercise & { type?: ReadingExerciseType };
  credits_left?: number;
  message?: string;
  error?: string;
  limit_status?: LimitStatusData;
}

interface ListeningExerciseResponse {
  success?: boolean;
  exercise: ComprehensionExercise & { type?: ListeningExerciseType };
  credits_left?: number;
  message?: string;
  error?: string;
  limit_status?: LimitStatusData;
}

export interface PerformanceResponse {
  success?: boolean;
  data?: Record<string, number>;
}

export interface SpeakingStatsResponse {
  success?: boolean;
  total_time_seconds?: number | string;
  target_seconds?: number | string;
  speaking_evaluation?: Record<string, {
    level: 'A1' | 'A2' | 'B1';
    correct_attempt_count: number;
    incorrect_attempt_count: number;
  }>;
}

export interface VocabularyCardData {
  id: number;
  german_text: string;
  english_text: string;
  german_sentence?: string;
  english_sentence?: string;
  is_new?: boolean;
}

export interface VocabularyStatsResponse {
  done?: number;
  learning?: number;
  remaining?: number;
}

export interface WritingPassageData {
  id: string;
  passage: string;
  level: string;
  created_at: string;
  roadmap_item_key?: string;
  [key: string]: unknown;
}

export interface WritingPassagesResponse {
  success?: boolean;
  data: WritingPassageData[];
}

export interface WritingCorrectionData {
  original: string;
  correction: string;
  topic_code?: string;
  result?: 'correct' | 'incorrect';
  [key: string]: unknown;
}

export interface WritingCheckResponse {
  passage_id?: string;
  corrections?: WritingCorrectionData[];
  limit_status?: LimitStatusData;
  [key: string]: unknown;
}

const jsonPost = <T>(path: string, payload: unknown) => apiFetch<T>(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const assistLearning = (payload: unknown) => jsonPost<LlmAssistResponse>('/llm_assist', payload);
export const generateExercise = (payload: unknown) => jsonPost<GrammarExerciseResponse>('/generate_exercise', payload);
export const retrieveLearningPerformance = (payload: unknown) => jsonPost<PerformanceResponse>('/retrieve_user_performance', payload);
export const recordLearningPerformance = (payload: unknown) => jsonPost<Record<string, unknown>>('/record_user_performance', payload);

export const generateReadingExercise = (payload: unknown) => jsonPost<ReadingExerciseResponse>('/generate_reading_exercise', payload);
export const retrieveReadingPerformance = (payload: unknown) => jsonPost<PerformanceResponse>('/retrieve_reading_performance', payload);
export const recordReadingPerformance = (payload: unknown) => jsonPost<Record<string, unknown>>('/record_reading_performance', payload);

export const generateListeningExercise = (payload: unknown) => jsonPost<ListeningExerciseResponse>('/generate_listening_exercise', payload);
export const retrieveListeningPerformance = (payload: unknown) => jsonPost<PerformanceResponse>('/retrieve_listening_performance', payload);
export const recordListeningPerformance = (payload: unknown) => jsonPost<Record<string, unknown>>('/record_listening_performance', payload);
export const getListeningAudioUrl = (level: string, filename: string) =>
  apiUrl(`/play_listening_audio/${level}/${encodeURIComponent(filename)}`);

export const getSpeakingStats = (consumerId: string, level: string) =>
  apiFetch<SpeakingStatsResponse>(`/api/speaking/stats?consumer_id=${encodeURIComponent(consumerId)}&level=${level}`);

export const getVocabularyCards = (userId: string, level: string, useCache: boolean) =>
  apiFetch<VocabularyCardData[]>(`/next_card?user_id=${encodeURIComponent(userId)}&level=${encodeURIComponent(level)}&limit=5&use_cache=${useCache}`);
export const getVocabularyStats = (userId: string, level: string) =>
  apiFetch<VocabularyStatsResponse>(`/vocab_stats?user_id=${encodeURIComponent(userId)}&level=${encodeURIComponent(level)}`);
export const cacheVocabularyList = (payload: unknown) => jsonPost<Record<string, unknown>>('/cache_vocab_list', payload);
export const updateVocabularyProgress = (payload: unknown) => jsonPost<{ limit_status?: LimitStatusData }>('/update_progress', payload);
export const getVocabularyAudioUrl = (flashcardId: number) => apiUrl(`/play_audio/${flashcardId}`);

export const getWritingPassages = (consumerId: string, level: string) =>
  apiFetch<WritingPassagesResponse>(`/api/writing/passages?consumer_id=${consumerId}&level=${level}`);
export const saveWritingPassage = (payload: unknown) => jsonPost<Record<string, unknown>>('/api/writing/save', payload);
export const deleteWritingPassage = (passageId: string | number, consumerId: string) =>
  apiFetch(`/api/writing/passage/${passageId}?consumer_id=${consumerId}`, { method: 'DELETE' });
export const checkWritingVocabulary = (payload: unknown) => jsonPost<WritingCheckResponse>('/api/writing/check-vocabulary', payload);
export const checkWritingGrammar = (payload: unknown) => jsonPost<WritingCheckResponse>('/api/writing/check-grammar', payload);
