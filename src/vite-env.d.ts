/// <reference types="vite/client" />

interface Window {
  __CURRENT_EXERCISE__?: import('./features/exercises/grammarPayload').GrammarExercise;
  __CURRENT_READING_EXERCISE__?: import('./features/exercises/comprehensionPayload').ComprehensionExercise;
  __CURRENT_LISTENING_EXERCISE__?: import('./features/exercises/comprehensionPayload').ComprehensionExercise;
  webkitAudioContext?: typeof AudioContext;
}
