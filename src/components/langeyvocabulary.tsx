// langeyvocabulary.tsx
import React, { useEffect, useRef, useState } from 'react';
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

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const CONTAINER_BASE =
  'mx-auto flex min-h-[calc(100dvh-150px)] max-w-[900px] flex-col items-center justify-center gap-6 p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] max-md:min-h-[calc(100dvh-50px)] max-md:gap-5 max-md:p-4 max-[480px]:gap-4 max-[480px]:p-3';

const CONTAINER_MOBILE =
  'max-lg:h-[calc(100dvh-54px)] max-lg:min-h-[calc(100dvh-54px)] max-lg:w-full max-lg:max-w-none max-lg:justify-center max-lg:gap-0 max-lg:overflow-hidden max-lg:px-5 max-lg:pt-[30px] max-lg:pb-[calc(150px+env(safe-area-inset-bottom,0px))]';

const CONTAINER_STATS_TABLET =
  'lg:max-[1366px]:h-[calc(100dvh-54px)] lg:max-[1366px]:min-h-[calc(100dvh-54px)] lg:max-[1366px]:w-full lg:max-[1366px]:max-w-none lg:max-[1366px]:justify-center lg:max-[1366px]:gap-0 lg:max-[1366px]:overflow-hidden lg:max-[1366px]:px-5 lg:max-[1366px]:pt-[30px] lg:max-[1366px]:pb-[calc(150px+env(safe-area-inset-bottom,0px))]';

const FLASHCARD_SECTION =
  'flex w-full max-w-[800px] flex-col items-center gap-6 max-md:gap-5 max-[480px]:gap-4 max-lg:flex-1 max-lg:justify-center max-lg:gap-0';

const FLASHCARD_BASE =
  'relative mx-auto flex h-[400px] w-full items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[#333] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl max-md:h-[300px] max-[480px]:h-[350px] max-[480px]:max-w-none max-lg:h-[min(108vw,480px)] max-lg:w-[min(90vw,400px)] max-lg:flex-col max-lg:cursor-pointer max-lg:rounded-[20px] max-lg:border-0 max-lg:bg-white max-lg:p-6 max-lg:shadow-[0_4px_10px_rgba(0,0,0,0.08)]';

const FLASHCARD_ACTIVE = 'max-lg:cursor-default max-lg:justify-start';

const FLASHCARD_BLOCKED =
  'cursor-default [&_.gg-credit-limit-block]:h-full [&_.gg-credit-limit-block]:min-h-0 [&_.gg-credit-limit-block]:p-6 max-lg:[&_.gg-credit-limit-block]:p-4';

const FLASHCARD_CONTENT =
  'flex h-full w-full flex-col items-center justify-center break-words p-5 text-center max-md:p-4 max-md:text-xl max-[480px]:p-3 max-[480px]:text-lg max-lg:relative max-lg:min-h-0 max-lg:flex-1 max-lg:p-0';

const FLASHCARD_CONTENT_ACTIVE = 'max-lg:justify-center max-lg:pt-10';

const CARD_STATUS_PILL =
  'pointer-events-none absolute top-4 right-4 z-[2] inline-flex min-w-[76px] items-center justify-center rounded-full border px-4 py-2 text-[13px] leading-none font-bold whitespace-nowrap max-lg:top-3.5 max-lg:right-3.5 max-lg:px-[18px] max-lg:py-[9px] max-lg:text-sm';

const CARD_STATUS_NEW = 'border-green-500/34 bg-green-500/12 text-green-700';
const CARD_STATUS_REVISE = 'border-blue-500/34 bg-blue-500/12 text-blue-700';

const GERMAN_CONTAINER =
  'relative inline-flex items-center justify-center max-lg:static max-lg:w-full max-lg:flex-1 max-lg:justify-center max-lg:pt-10';

const GERMAN_CONTAINER_ANSWER = 'max-lg:flex-none max-lg:pt-0';

const GERMAN_TEXT =
  'mb-0 text-[32px] font-semibold max-lg:mb-5 max-lg:text-center max-lg:text-[26px] max-lg:font-medium max-lg:text-black';

const GERMAN_TEXT_WITH_ANSWER = 'mb-5';

const PLAY_BTN =
  'absolute top-[-75px] left-1/2 h-[50px] w-[50px] -translate-x-1/2 cursor-pointer border-0 bg-transparent opacity-95 hover:opacity-100 max-md:top-[-55px] max-md:h-10 max-md:w-10 max-lg:top-[15%] max-lg:h-[50px] max-lg:w-[50px]';

const ENGLISH_TEXT =
  'text-[28px] font-medium text-[#666] max-lg:text-center max-lg:text-xl max-lg:font-normal';

const TAP_TO_REVEAL = 'mb-2.5 hidden text-center text-[15px] text-[#666] opacity-80 max-lg:block';

const DIFFICULTY_GROUP =
  'flex w-full max-w-[800px] flex-wrap justify-center gap-3 max-md:gap-2 max-[480px]:gap-1.5';

const DIFFICULTY_GROUP_DESKTOP = 'max-lg:hidden';

const DIFFICULTY_GROUP_CARD =
  'hidden max-lg:mt-5 max-lg:flex max-lg:flex-none max-lg:w-full max-lg:justify-between max-lg:gap-4 max-lg:pt-5';

const DIFFICULTY_BTN =
  'min-w-[90px] flex-1 cursor-pointer rounded-[10px] border border-black/15 bg-transparent px-[18px] py-2.5 text-sm font-medium text-black/80 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-xl hover:bg-[rgba(248,248,248,.95)] max-md:min-w-20 max-md:px-3.5 max-md:py-2 max-md:text-[13px] max-[480px]:min-w-[60px] max-[480px]:px-3 max-[480px]:py-2 max-[480px]:text-xs max-lg:min-w-0 max-lg:flex-1 max-lg:rounded-2xl max-lg:border max-lg:border-current max-lg:bg-transparent max-lg:p-3.5 max-lg:text-base max-lg:font-semibold max-lg:shadow-none';

const DIFFICULTY_AGAIN = 'text-red-500 max-lg:text-red-500';
const DIFFICULTY_EASY = 'text-green-500 max-lg:text-green-500';

const SHOW_ANSWER_CONTAINER = 'flex w-full max-w-[800px] justify-center max-lg:hidden';

const SHOW_ANSWER_BTN =
  'w-full cursor-pointer rounded-[10px] border border-black/15 bg-transparent px-[18px] py-2.5 text-sm font-medium text-black/80 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-xl hover:bg-[rgba(248,248,248,.95)] disabled:cursor-not-allowed disabled:opacity-50 max-md:px-3.5 max-md:py-2 max-md:text-[13px] max-[480px]:px-3 max-[480px]:py-2 max-[480px]:text-xs';

const LLM_BOX_BASE =
  'relative mx-auto flex min-h-[80px] w-full items-center justify-center rounded-2xl border border-black/15 bg-[rgba(248,248,248,.9)] px-5 py-4 shadow-[0_8px_20px_-5px_rgba(0,0,0,0.1),0_6px_8px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl max-md:mb-[calc(15px+env(safe-area-inset-bottom,10px))] max-md:px-4 max-md:py-3 max-[480px]:p-3';

const LLM_BOX_LEARN = 'max-w-[800px]';

const LLM_BOX_STATS = 'max-w-[600px] max-lg:box-border max-lg:max-w-none';

const LLM_BOX_FIXED =
  'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[420] max-lg:m-0 max-lg:max-w-none max-lg:min-h-[calc(100px+env(safe-area-inset-bottom,0px))] max-lg:w-full max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none lg:max-[1366px]:fixed lg:max-[1366px]:inset-x-0 lg:max-[1366px]:bottom-0 lg:max-[1366px]:z-[420] lg:max-[1366px]:m-0 lg:max-[1366px]:max-w-none lg:max-[1366px]:min-h-[calc(100px+env(safe-area-inset-bottom,0px))] lg:max-[1366px]:w-full lg:max-[1366px]:overflow-hidden lg:max-[1366px]:rounded-none lg:max-[1366px]:border-0 lg:max-[1366px]:bg-white lg:max-[1366px]:px-8 lg:max-[1366px]:py-6 lg:max-[1366px]:pb-[calc(24px+env(safe-area-inset-bottom,0px))] lg:max-[1366px]:shadow-none lg:max-[1366px]:backdrop-blur-none';

const LLM_GLOW =
  'pointer-events-none absolute inset-[-1px] -z-10 animate-settings-glow rounded-2xl bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] bg-size-[400%_400%] opacity-80 max-lg:inset-0 max-lg:z-0 max-lg:rounded-none max-lg:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)] max-lg:opacity-80 lg:max-[1366px]:inset-0 lg:max-[1366px]:z-0 lg:max-[1366px]:rounded-none lg:max-[1366px]:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)] lg:max-[1366px]:opacity-80';

const LLM_CONTENT =
  'relative z-[1] flex max-w-[90%] items-center break-words text-center text-sm leading-normal font-bold text-[#333] max-md:min-h-[50px] max-md:text-[13px] max-[480px]:min-h-10 max-lg:w-full max-lg:max-w-none max-lg:justify-center max-lg:text-base max-lg:leading-6 max-lg:font-normal max-lg:text-[#1a1a1a] lg:max-[1366px]:w-full lg:max-[1366px]:max-w-none lg:max-[1366px]:justify-center lg:max-[1366px]:text-base lg:max-[1366px]:leading-6 lg:max-[1366px]:font-normal lg:max-[1366px]:text-[#1a1a1a]';

const STATS_SECTION =
  'flex flex-col items-center gap-6 max-lg:flex-1 max-lg:justify-center max-lg:gap-0 lg:max-[1366px]:w-full lg:max-[1366px]:flex-1 lg:max-[1366px]:justify-center lg:max-[1366px]:gap-0';

const STATS_CHART = 'flex items-center justify-center max-lg:mb-10 lg:max-[1366px]:mb-10';

const STATS_LEGEND =
  'flex w-full flex-row flex-wrap items-center justify-center gap-4 max-md:gap-3 max-[480px]:gap-2 max-lg:gap-2.5 lg:max-[1366px]:gap-2.5';

const LEGEND_ITEM_BASE =
  'flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-sm max-md:px-2.5 max-md:py-1.5 max-md:text-[13px] max-lg:rounded-[10px] max-lg:bg-[#ebebeb] max-lg:px-4 max-lg:py-2.5 max-lg:text-sm max-lg:font-semibold max-lg:text-[#333] lg:max-[1366px]:rounded-[10px] lg:max-[1366px]:bg-[#ebebeb] lg:max-[1366px]:px-4 lg:max-[1366px]:py-2.5 lg:max-[1366px]:text-sm lg:max-[1366px]:font-semibold lg:max-[1366px]:text-[#333]';

const LEGEND_REMAINING = 'bg-red-500/10 max-lg:bg-[#ebebeb] lg:max-[1366px]:bg-[#ebebeb]';
const LEGEND_IN_PROGRESS = 'bg-blue-500/10 max-lg:bg-[#ebebeb] lg:max-[1366px]:bg-[#ebebeb]';
const LEGEND_DONE = 'bg-green-500/10 max-lg:bg-[#ebebeb] lg:max-[1366px]:bg-[#ebebeb]';

const LEGEND_DOT = 'h-4 w-4 rounded-full max-[480px]:h-3.5 max-[480px]:w-3.5';

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
    if (mode === 'LEARN') {
      setShowAnswer(false);
      setLlmText('Evaluating');
      setCardQueue([]);
      setIsLoading(true);
      if (!isBlocked) {
        fetchBatch(true);
      } else {
        setIsLoading(false);
      }
    } else if (mode === 'STATS') {
      fetchStats();
      setLlmText("Great progress! Keep practicing to move cards to 'Done'.");
    }
  }, [mode, level, isBlocked]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  useEffect(() => {
    if (!isLoading && !isFetchingBatch && cardQueue.length > 0) {
      const timer = setTimeout(() => {
        cacheVocabularyList({
            consumer_id: userId,
            level: level,
            vocab_list: cardQueue
        }).catch(() => { });
      }, 500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardQueue, isLoading, isFetchingBatch]);

  const currentCard = cardQueue.length > 0 ? cardQueue[0] : null;

  const renderCardStatusPill = () => {
    if (!currentCard) return null;
    const isRevise = currentCard.is_new === false;
    return (
      <div className={cx(CARD_STATUS_PILL, isRevise ? CARD_STATUS_REVISE : CARD_STATUS_NEW)}>
        {isRevise ? 'REVISE' : 'NEW'}
      </div>
    );
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
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

    setCardQueue(prev => prev.slice(1));
    setShowAnswer(false);
    setLlmText('Evaluating');

    if (cardQueue.length <= 3) {
      fetchBatch();
    }

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

  const renderLlmBox = (variant: 'learn' | 'stats', children: React.ReactNode) => (
    <div className={cx(LLM_BOX_BASE, variant === 'learn' ? LLM_BOX_LEARN : LLM_BOX_STATS, LLM_BOX_FIXED)}>
      <div aria-hidden="true" className={LLM_GLOW} />
      <div className={LLM_CONTENT}>{children}</div>
    </div>
  );

  if (mode === 'LEARN') {
    return (
      <div className={cx(CONTAINER_BASE, CONTAINER_MOBILE)}>
        <div className={FLASHCARD_SECTION}>
          {isBlocked ? (
            <div className={cx(FLASHCARD_BASE, FLASHCARD_BLOCKED)}>
              <div className={cx(FLASHCARD_CONTENT, 'flex items-center justify-center')}>
                <CreditLimitBlock message={limitMessage} />
              </div>
            </div>
          ) : (isLoading || isFetchingBatch) && cardQueue.length === 0 ? (
            <div className={FLASHCARD_BASE}>
              <div className={cx(FLASHCARD_CONTENT, 'flex items-center justify-center')}>
                <div
                  className="size-10 animate-spin rounded-full border-4 border-[#333]/25 border-t-[#333]"
                  role="status"
                  aria-label="Loading flashcards"
                />
              </div>
            </div>
          ) : currentCard ? (
            <div
              className={cx(FLASHCARD_BASE, showAnswer && FLASHCARD_ACTIVE)}
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
              <div className={cx(FLASHCARD_CONTENT, showAnswer && FLASHCARD_CONTENT_ACTIVE)}>
                <div className={cx(GERMAN_CONTAINER, showAnswer && GERMAN_CONTAINER_ANSWER)}>
                  {showAnswer && currentCard && currentCard.german_sentence && currentCard.german_sentence.trim().length > 0 && (
                    <button className={PLAY_BTN} onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }} aria-label="Play pronunciation">
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="block size-full fill-[#474747]">
                        <polygon points="8,5 19,12 8,19" />
                      </svg>
                    </button>
                  )}
                  <div className={cx(GERMAN_TEXT, showAnswer && GERMAN_TEXT_WITH_ANSWER)}>
                    {currentCard.german_text}
                  </div>
                </div>
                {showAnswer && (
                  <div className={ENGLISH_TEXT}>
                    {currentCard.english_text}
                  </div>
                )}
                {!showAnswer && (
                  <div className={TAP_TO_REVEAL}>Tap to reveal</div>
                )}
              </div>
              {showAnswer && (
                <div className={cx(DIFFICULTY_GROUP, DIFFICULTY_GROUP_CARD)}>
                  <button
                    className={cx(DIFFICULTY_BTN, DIFFICULTY_AGAIN)}
                    onClick={(e) => { e.stopPropagation(); handleDifficultyClick('again'); }}
                  >
                    Bad
                  </button>
                  <button
                    className={cx(DIFFICULTY_BTN, DIFFICULTY_EASY)}
                    onClick={(e) => { e.stopPropagation(); handleDifficultyClick('easy'); }}
                  >
                    Good
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={FLASHCARD_BASE}>
              <div className={FLASHCARD_CONTENT}>
                <div className={GERMAN_TEXT}>No flashcards available</div>
              </div>
            </div>
          )}

          {!isMobileLayout && (isBlocked ? (
            <div className={SHOW_ANSWER_CONTAINER}>
              <button className={SHOW_ANSWER_BTN} disabled>
                Show Answer
              </button>
            </div>
          ) : !showAnswer ? (
            <div className={SHOW_ANSWER_CONTAINER}>
              <button
                className={SHOW_ANSWER_BTN}
                onClick={handleShowAnswer}
                disabled={!currentCard}
              >
                Show Answer
              </button>
            </div>
          ) : (
            <div className={cx(DIFFICULTY_GROUP, DIFFICULTY_GROUP_DESKTOP)}>
              <button
                className={cx(DIFFICULTY_BTN, DIFFICULTY_AGAIN)}
                onClick={() => handleDifficultyClick('again')}
              >
                Bad
              </button>
              <button
                className={cx(DIFFICULTY_BTN, DIFFICULTY_EASY)}
                onClick={() => handleDifficultyClick('easy')}
              >
                Good
              </button>
            </div>
          ))}
        </div>

        {renderLlmBox('learn', (
          <>
            {isBlocked ? (
              <span className="text-center text-sm text-[#333] opacity-60">Tap Upgrade to Pro above to continue</span>
            ) : llmText === 'Evaluating' ? (
              <span className="opacity-60">
                {isMobileLayout ? 'Press card to review' : 'Click Show Answer to review'}
              </span>
            ) : (
              <TypeWriter text={llmText} />
            )}
          </>
        ))}
      </div>
    );
  }

  return (
    <div className={cx(CONTAINER_BASE, CONTAINER_MOBILE, CONTAINER_STATS_TABLET)}>
      <div className={STATS_SECTION}>
        <div className={STATS_CHART}>
          <PieChart data={statsData} />
        </div>

        <div className={STATS_LEGEND}>
          <div className={cx(LEGEND_ITEM_BASE, LEGEND_REMAINING)}>
            <div className={cx(LEGEND_DOT, 'bg-red-500')} />
            <span>Remaining ({statsData.new})</span>
          </div>
          <div className={cx(LEGEND_ITEM_BASE, LEGEND_IN_PROGRESS)}>
            <div className={cx(LEGEND_DOT, 'bg-blue-500')} />
            <span>In Process ({statsData.learning})</span>
          </div>
          <div className={cx(LEGEND_ITEM_BASE, LEGEND_DONE)}>
            <div className={cx(LEGEND_DOT, 'bg-green-500')} />
            <span>Done ({statsData.done})</span>
          </div>
        </div>
      </div>

      {renderLlmBox('stats', (
        <>
          {!isStatsLoading && (() => {
            const total = statsData.done + statsData.learning + statsData.new;
            const pct = total > 0 ? Math.round((statsData.done / total) * 100) : 0;
            return <TypeWriter key={`${level}-${pct}`} text={`Total Progress: ${pct}%`} />;
          })()}
        </>
      ))}
    </div>
  );
};
