// langeyvocabulary.tsx
import React, { useEffect, useRef, useState } from 'react';
import './langeyvocabulary.css';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { CreditLimitBlock } from './CreditLimitBlock';
import { stopHtmlAudio } from '../utils/audioLifecycle';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import type { FullscreenModuleProps, LearnMode } from '../features/learning/moduleTypes';
import { VocabularyProgressChart as PieChart } from './vocabulary/VocabularyProgressChart';
import { VocabularyTypewriter as TypeWriter } from './vocabulary/VocabularyTypewriter';
import { cacheVocabularyList, getVocabularyAudioUrl, getVocabularyCards, getVocabularyStats, updateVocabularyProgress } from '../services/learningApi';

type Mode = LearnMode;

export interface LangeyVocabularyProps extends FullscreenModuleProps {
  mode: Mode;
  roadmapProgress?: number | null;
  isActive?: boolean;
}

interface Flashcard {
  id: number;
  german_text: string;
  english_text: string;
  german_sentence?: string;
  english_sentence?: string;
  is_new?: boolean;
}

interface FlashcardApiItem {
  id: number;
  german_text: string;
  english_text: string;
  german_sentence?: string;
  english_sentence?: string;
  is_new?: boolean;
}

export const LangeyVocabulary: React.FC<LangeyVocabularyProps> = ({
  level,
  mode,
  onFullscreenChange,
  onProgressUpdate,
  isActive = true,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const [cardQueue, setCardQueue] = useState<Flashcard[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [llmText, setLlmText] = useState('');
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingBatch, setIsFetchingBatch] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [statsData, setStatsData] = useState({ done: 0, learning: 0, new: 0 });
  const isMobileLayout = useIsMobileLayout();

  const userId = UserTracker.getOrCreateConsumerId();

  void onFullscreenChange;

  const fetchBatch = async (useCache = false) => {
    if (isFetchingBatch) return;
    setIsFetchingBatch(true);
    try {
      const resp = await getVocabularyCards(userId, level, useCache);
      if (!resp.ok) {
        return;
      }
      const data = await resp.json();
      // data should be an array of cards
      if (Array.isArray(data)) {
        const newCards = (data as FlashcardApiItem[]).map((item) => ({
          id: item.id,
          german_text: item.german_text,
          english_text: item.english_text,
          german_sentence: item.german_sentence,
          english_sentence: item.english_sentence,
          is_new: item.is_new !== false,
        }));
        setCardQueue(prev => {
          // Filter out duplicates just in case
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewCards = newCards.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNewCards];
        });
      }
    } catch {
      // ignore
    } finally {
      setIsFetchingBatch(false);
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const resp = await getVocabularyStats(userId, level);
      if (!resp.ok) {
        setStatsData({ done: 0, learning: 0, new: 0 });
        return;
      }
      const data = await resp.json();
      setStatsData({ done: data.done || 0, learning: data.learning || 0, new: data.remaining || 0 });
    } catch {
      setStatsData({ done: 0, learning: 0, new: 0 });
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize LLM box state and fetch first batch
    if (mode === 'LEARN') {
      // Reset UI for new word when level changes
      setShowAnswer(false);
      setLlmText('Evaluating');
      setCardQueue([]); // Clear queue on level change
      setIsLoading(true); // Show loading initially
      if (!isBlocked) {
        fetchBatch(true);
      } else {
        setIsLoading(false);
      }
    } else if (mode === 'STATS') {
      fetchStats();
      setLlmText("Great progress! Keep practicing to move cards to 'Done'.");
    }
    // Re-fetch when level changes
  }, [mode, level, isBlocked]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  // Save cache whenever queue changes, debounced
  useEffect(() => {
    if (!isLoading && !isFetchingBatch && cardQueue.length > 0) {
      const timer = setTimeout(() => {
        cacheVocabularyList({
            consumer_id: userId,
            level: level,
            vocab_list: cardQueue
        }).catch(() => { });
      }, 500); // 2 second debounce

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardQueue, isLoading, isFetchingBatch]);

  const currentCard = cardQueue.length > 0 ? cardQueue[0] : null;

  const renderCardStatusPill = () => {
    if (!currentCard) return null;
    const isRevise = currentCard.is_new === false;
    return (
      <div className={`lv-card-status-pill ${isRevise ? 'revise' : 'new'}`}>
        {isRevise ? 'REVISE' : 'NEW'}
      </div>
    );
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    // Show example sentence from database in LLM box
    if (currentCard) {
      const germanExample = currentCard.german_sentence && currentCard.german_sentence.trim().length > 0
        ? currentCard.german_sentence
        : '';
      const englishExample = currentCard.english_sentence && currentCard.english_sentence.trim().length > 0
        ? currentCard.english_sentence
        : '';
      if (germanExample && englishExample) {
        setLlmText(`${germanExample} / ${englishExample}`);
      } else {
        setLlmText('No example available');
      }
    } else {
      setLlmText('No example available');
    }
  };

  const handleDifficultyClick = async (difficulty: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard || isBlocked) return;

    const cardId = currentCard.id;
    const correct = difficulty === 'good' || difficulty === 'easy';

    // Optimistic update: Remove current card immediately
    setCardQueue(prev => prev.slice(1));
    setShowAnswer(false);
    setLlmText('Evaluating');

    // Check if we need to fetch more
    if (cardQueue.length <= 3) { // If we have 2 or fewer left after this one (since we just removed one, length is now length-1)
      fetchBatch();
    }

    // Fire and forget update, but check for limit status
    updateVocabularyProgress({
        user_id: userId,
        flashcard_id: cardId,
        correct,
        difficulty,
    })
      .then(response => response.json())
      .then(data => {
        if (data.limit_status) {
          if (data.limit_status.is_blocked && !isPro) {
            setCreditsLeft(0, data.limit_status.message);
          } else if (data.limit_status.credits_left !== undefined) {
            setCreditsLeft(data.limit_status.credits_left);
          }
        }
        onProgressUpdate?.();
      })
      .catch(() => {
        // swallow errors
      });
  };

  const handlePlayAudio = async () => {
    if (!currentCard) return;
    try {
      stopHtmlAudio(audioRef.current, true);
      const audio = new Audio(getVocabularyAudioUrl(currentCard.id));
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
      await audio.play();
    } catch {
      // no-op if audio missing
    }
  };

  useEffect(() => {
    if (!isActive) {
      stopHtmlAudio(audioRef.current, true);
      audioRef.current = null;
    }
  }, [isActive]);

  useEffect(() => () => {
    stopHtmlAudio(audioRef.current, true);
    audioRef.current = null;
  }, []);

  if (mode === 'LEARN') {
    return (
      <div className="lv-container">
        <div className="lv-flashcard-section">
          {isBlocked ? (
            <div className="lv-flashcard lv-flashcard-blocked">
              <div className="lv-flashcard-content">
                <CreditLimitBlock message={limitMessage} />
              </div>
            </div>
          ) : (isLoading || isFetchingBatch) && cardQueue.length === 0 ? (
            <div className="lv-flashcard">
              <div className="lv-flashcard-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* Minimal loading icon */}
                <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="var(--text-primary)">
                  <style>{`
                        .spinner { animation: spin 1s linear infinite; transform-origin: center; }
                        @keyframes spin { 100% { transform: rotate(360deg); } }
                    `}</style>
                  <path className="spinner" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity="0.25" />
                  <path className="spinner" d="M12,4a8,8,0,0,1,7.89,6.7,1.5,1.5,0,0,0,1.48,1.3A1.5,1.5,0,0,0,22.89,10.7,11,11,0,0,0,12,1Z" />
                </svg>
              </div>
            </div>
          ) : currentCard ? (
            <div
              className={`lv-flashcard ${showAnswer ? 'active' : ''}`}
              onClick={isMobileLayout && !showAnswer ? handleShowAnswer : undefined}
              role={isMobileLayout && !showAnswer ? 'button' : undefined}
              tabIndex={isMobileLayout && !showAnswer ? 0 : undefined}
              onKeyDown={isMobileLayout && !showAnswer ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleShowAnswer();
                }
              } : undefined}
            >
              {renderCardStatusPill()}
              <div className="lv-flashcard-content">
                <div className={`lv-german-container ${showAnswer ? 'with-answer' : ''}`}>
                  {showAnswer && currentCard && currentCard.german_sentence && currentCard.german_sentence.trim().length > 0 && (
                    <button className="lv-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }} aria-label="Play pronunciation">
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="8,5 19,12 8,19" />
                      </svg>
                    </button>
                  )}
                  <div className="lv-german-text">
                    {currentCard.german_text}
                  </div>
                </div>
                {showAnswer && (
                  <div className="lv-english-text">
                    {currentCard.english_text}
                  </div>
                )}
                {!showAnswer && (
                  <div className="lv-tap-to-reveal-text">Tap to reveal</div>
                )}
              </div>
              {showAnswer && (
                <div className="lv-difficulty-buttons lv-card-actions">
                  <button
                    className="lv-difficulty-btn lv-again"
                    onClick={(e) => { e.stopPropagation(); handleDifficultyClick('again'); }}
                  >
                    Bad
                  </button>
                  <button
                    className="lv-difficulty-btn lv-easy"
                    onClick={(e) => { e.stopPropagation(); handleDifficultyClick('easy'); }}
                  >
                    Good
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="lv-flashcard">
              <div className="lv-flashcard-content">
                <div className="lv-german-text">No flashcards available</div>
              </div>
            </div>
          )}

          {!isMobileLayout && (isBlocked ? (
            <div className="lv-show-answer-container">
              <button className="lv-show-answer-btn" disabled>
                Show Answer
              </button>
            </div>
          ) : !showAnswer ? (
            <div className="lv-show-answer-container">
              <button
                className="lv-show-answer-btn"
                onClick={handleShowAnswer}
                disabled={!currentCard}
              >
                Show Answer
              </button>
            </div>
          ) : (
            <div className="lv-difficulty-buttons lv-desktop-actions">
              <button
                className="lv-difficulty-btn lv-again"
                onClick={() => handleDifficultyClick('again')}
              >
                Bad
              </button>
              <button
                className="lv-difficulty-btn lv-easy"
                onClick={() => handleDifficultyClick('easy')}
              >
                Good
              </button>
            </div>
          ))}
        </div>

        <div className="lv-llm-box">
          <div className="lv-llm-content">
            {isBlocked ? (
              <span className="gg-limit-hint">Tap Upgrade to Pro above to continue</span>
            ) : llmText === 'Evaluating' ? (
              <span style={{ opacity: 0.6 }}>
                {isMobileLayout ? 'Press card to review' : "Click Show Answer to review"}
              </span>
            ) : (
              <TypeWriter text={llmText} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // STATS mode
  return (
    <div className="lv-container">
      <div className="lv-stats-section">
        <div className="lv-stats-chart">
          <PieChart data={statsData} />
        </div>

        <div className="lv-stats-legend">
          <div className="lv-legend-item remaining">
            <div className="lv-legend-color lv-color-new"></div>
            <span>Remaining ({statsData.new})</span>
          </div>
          <div className="lv-legend-item in-progress">
            <div className="lv-legend-color lv-color-learning"></div>
            <span>In Process ({statsData.learning})</span>
          </div>
          <div className="lv-legend-item done">
            <div className="lv-legend-color lv-color-done"></div>
            <span>Done ({statsData.done})</span>
          </div>
        </div>
      </div>

      <div className="lv-llm-box">
        <div className="lv-llm-content">
          {!isStatsLoading && (() => {
            const total = statsData.done + statsData.learning + statsData.new;
            const pct = total > 0 ? Math.round((statsData.done / total) * 100) : 0;
            return <TypeWriter key={`${level}-${pct}`} text={`Total Progress: ${pct}%`} />;
          })()}
        </div>
      </div>
    </div>
  );
};
