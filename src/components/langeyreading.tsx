// langeyreading.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import './langeyreading.animations.css';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { ExercisesTemplate, exerciseTitleClassName } from './ExercisesTemplate';
import { CreditLimitBlock } from './CreditLimitBlock';
import { translateGermanToEnglish } from '../utils/googleTranslate';
import { TypewriterText as TypeWriter } from './shared/TypewriterText';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import { toTemplateType, type ReadingExerciseType } from '../features/exercises/comprehension';
import type { FullscreenModuleProps, PracticeMode } from '../features/learning/moduleTypes';
import { generateReadingExercise as requestReadingExercise, recordReadingPerformance, retrieveReadingPerformance } from '../services/learningApi';
import { buildSpiderData } from '../features/stats/spiderChart';
import { TotalProgressText } from './stats/TotalProgressText';
import type { ComprehensionExercise, ExerciseAnswer, ExerciseAnswers, MultipleChoiceQuestion } from '../features/exercises/comprehensionPayload';
import { normalizeAnswer, solutionVariants } from '../features/exercises/comprehensionPayload';
import type { TopicsByLevel } from '../features/learning/moduleTypes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - allow JSON import
import levelTopicsData from '../../data/all_reading_topics.json';

const cx = (...classes: Array<string | false | undefined | null>) => classes.filter(Boolean).join(' ');

const ACTION_BTN = cx(
  'min-w-[90px] flex-1 cursor-pointer rounded-[10px] border border-black/20 px-[18px] py-2.5 text-sm font-medium text-white',
  'bg-[linear-gradient(135deg,#000_0%,#333_100%)] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-[4px]',
  'transition-all duration-300 hover:enabled:-translate-y-px hover:enabled:bg-[linear-gradient(135deg,#333_0%,#555_100%)] hover:enabled:shadow-[0_6px_10px_-1px_rgba(0,0,0,0.15),0_4px_6px_-1px_rgba(0,0,0,0.1)]',
  'active:enabled:translate-y-0 active:enabled:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.06)]',
  'disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-none disabled:bg-black/15 disabled:text-black/40 disabled:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)]',
  'max-lg:min-h-[46px] max-lg:h-auto max-lg:min-w-0 max-lg:w-0 max-lg:flex-[1_1_0] max-lg:rounded-xl max-lg:border-[#eee] max-lg:bg-none max-lg:bg-white max-lg:px-2.5 max-lg:py-3 max-lg:text-sm max-lg:font-medium max-lg:text-[#333] max-lg:shadow-none max-lg:transform-none',
  'max-lg:disabled:bg-none max-lg:disabled:bg-black/15 max-lg:disabled:border-black/10 max-lg:disabled:text-black/40',
  'max-sm:min-w-[80px] max-sm:px-3.5 max-sm:py-2 max-sm:text-[13px]'
);

const VOCAB_BTN = cx(
  ACTION_BTN,
  'relative flex items-center justify-center gap-1.5 border-black/15! bg-[rgba(248,248,248,0.9)]! text-black/80! backdrop-blur-xl',
  'before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:animate-settings-glow before:rounded-[10px] before:bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] before:bg-size-[400%_400%] before:opacity-80 before:content-[""]',
  'disabled:before:opacity-20 hover:enabled:bg-[rgba(248,248,248,0.95)]! max-lg:border-transparent! max-lg:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)]! max-lg:text-black! max-lg:before:hidden max-lg:hover:enabled:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)]! max-lg:hover:enabled:transform-none'
);

const FULLSCREEN_BTN = cx(
  ACTION_BTN,
  'flex w-10 min-w-10 flex-none items-center justify-center rounded-lg border-black/30! bg-transparent! p-2.5! text-black/30!',
  'hover:enabled:border-black/50! hover:enabled:bg-transparent! hover:enabled:text-black/50!',
  'disabled:border-black/15! disabled:bg-transparent! disabled:text-black/15!',
  'max-lg:hidden max-sm:min-w-[35px] max-sm:w-[35px] max-sm:p-2 max-sm:text-[13px] max-sm:border-black/40! max-sm:text-black/40!'
);

const EXERCISE_BOX = cx(
  'relative mb-5 flex h-[400px] w-full max-w-[800px] flex-col overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300',
  '[&>.gg-credit-limit-block]:min-h-full',
  'max-lg:mb-0 max-lg:h-auto max-lg:min-h-0 max-lg:max-w-none max-lg:flex-1 max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-0 max-lg:pt-2.5 max-lg:pb-5 max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-sm:mb-4 max-sm:h-[350px] max-sm:p-4'
);

const PASSAGE_BLOCK = cx(
  'mb-4 rounded-xl border border-black/8 bg-[rgba(248,248,250,0.85)] px-[18px] py-4 text-sm leading-[1.75] whitespace-pre-line text-[#222]',
  'max-lg:mx-5 max-lg:mb-5 max-lg:w-[calc(100%-40px)] max-lg:rounded-2xl max-lg:border-black/5 max-lg:bg-black/3 max-lg:p-4'
);

export interface LangeyReadingProps extends FullscreenModuleProps {
  mode: PracticeMode;
}

export const LangeyReading: React.FC<LangeyReadingProps> = ({
  level,
  mode,
  onFullscreenChange,
  onProgressUpdate,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('None');
  const [isLoading, setIsLoading] = useState(false);
  const [currentExerciseType, setCurrentExerciseType] = useState<ReadingExerciseType>('FILL_IN_THE_BLANK_READING');
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [exerciseAnswers, setExerciseAnswers] = useState<ExerciseAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [, setSubmissionResult] = useState<{ allCorrect: boolean; incorrectItems: string[] } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const isMobileView = useIsMobileLayout();
  const [isShowingExercise, setIsShowingExercise] = useState(false);
  const [llmBoxText, setLlmBoxText] = useState('');
  const [performanceData, setPerformanceData] = useState<Record<string, number>>({});
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const performanceRequestIdRef = useRef(0);

  const defaultMsg = 'Select a reading topic and click Practice to start an exercise.';

  // Topics per level from JSON
  const levelToTopics = levelTopicsData as TopicsByLevel;
  const getTopicsForLevel = (lvl: string) => (levelToTopics?.[lvl] || []);

  // Close selector on outside click
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (isSelectorOpen && selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isSelectorOpen]);

  // Fullscreen change notification
  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  // ESC to exit fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  // Read topic from URL params (from Roadmap navigation)
  useEffect(() => {
    if (location.pathname !== '/reading') return;
    const topicParam = searchParams.get('topic');
    if (topicParam) {
      const availableTopics = getTopicsForLevel(level).map(t => t.Title);
      if (availableTopics.includes(topicParam)) {
        setTopic(topicParam);
        setLlmBoxText(defaultMsg);
      }
    }
  }, [searchParams, level, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  // Track level changes (from parent): reset practice if level changes
  const prevLevel = useRef(level);
  useEffect(() => {
    if (prevLevel.current !== level) {
      prevLevel.current = level;
      setTopic('None');
      setIsSelectorOpen(false);
      resetExerciseState();
      if (mode === 'PRACTICE') {
        fetchPerformanceData(level);
        setLlmBoxText(defaultMsg);
      } else if (mode === 'STATS') {
        fetchPerformanceData(level);
      }
    }
  }, [level, mode]);

  // Fetch performance on mode change
  useEffect(() => {
    if (mode === 'STATS') {
      fetchPerformanceData(level);
    } else if (mode === 'PRACTICE') {
      fetchPerformanceData(level);
      if (!getCurrentExercise() || !isShowingExercise) {
        setLlmBoxText(defaultMsg);
      }
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  useEffect(() => {
    if (!isSelectorOpen || mode !== 'PRACTICE') return;
    setPerformanceData({});
    fetchPerformanceData(level);
  }, [isSelectorOpen, level, mode]);

  const fetchPerformanceData = async (lvl: string) => {
    const requestId = ++performanceRequestIdRef.current;
    try {
      const consumerId = UserTracker.getOrCreateConsumerId();
      const resp = await retrieveReadingPerformance({ consumer_id: consumerId, reading_level: lvl });
      const data = await resp.json();
      if (requestId === performanceRequestIdRef.current) {
        setPerformanceData(data.data || {});
      }
    } catch {
      if (requestId === performanceRequestIdRef.current) {
        setPerformanceData({});
      }
    }
  };

  const getCurrentExercise = () => window.__CURRENT_READING_EXERCISE__;

  const resetExerciseState = () => {
    setCurrentExerciseType('FILL_IN_THE_BLANK_READING');
    setCurrentInstruction('');
    setExerciseAnswers({});
    setSubmitted(false);
    setSubmissionResult(null);
    setIsShowingExercise(false);
    setLlmBoxText('');
    window.__CURRENT_READING_EXERCISE__ = undefined;
  };

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    resetExerciseState();
    setLlmBoxText(defaultMsg);
  };

  const initializeAnswers = (type: ReadingExerciseType, ex: ComprehensionExercise) => {
    switch (type) {
      case 'FILL_IN_THE_BLANK_READING':
        setExerciseAnswers(Array(ex.exercises?.length || 5).fill(''));
        break;
      case 'TRUE_FALSE_READING':
        setExerciseAnswers(Array(ex.statements?.length || 5).fill(undefined));
        break;
      case 'MULTIPLE_CHOICE_READING':
        setExerciseAnswers(Array(ex.exercises?.length || 5).fill(-1));
        break;
    }
  };

  const generateExercise = async () => {
    if (topic === 'None' || isBlocked) return;
    setIsLoading(true);
    setSubmitted(false);
    setSubmissionResult(null);
    setExerciseAnswers({});

    try {
      const consumerId = UserTracker.getOrCreateConsumerId();
      const resp = await requestReadingExercise({ level, topic_title: topic, consumer_id: consumerId, version: 'v2' });
      const data = await resp.json();

      if (data.limit_status?.is_blocked && !isPro) {
        setCreditsLeft(0, data.limit_status.message);
        return;
      }
      if (data.error) {
        return;
      }

      if (data.credits_left !== undefined) setCreditsLeft(data.credits_left);

      const ex = data.exercise;
      const exType: ReadingExerciseType = ex.type || 'FILL_IN_THE_BLANK_READING';
      setCurrentExerciseType(exType);
      setCurrentInstruction(ex.instruction || 'Read the passage and answer the questions.');
      window.__CURRENT_READING_EXERCISE__ = ex;
      initializeAnswers(exType, ex);
      setIsShowingExercise(true);
      setLlmBoxText('Exercise loaded! Answer the questions and click Submit to check your answers, or Vocabulary for word meanings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExerciseAnswerChange = (index: number, value: ExerciseAnswer) => {
    setExerciseAnswers((current: unknown) => {
      const newAnswers = Array.isArray(current) ? [...current] : [];
      newAnswers[index] = value;
      return newAnswers;
    });
  };

  const isSubmitEnabled = (): boolean => {
    if (!getCurrentExercise() || !isShowingExercise) return false;
    switch (currentExerciseType) {
      case 'FILL_IN_THE_BLANK_READING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => typeof v === 'string' && v.trim().length > 0);
      case 'TRUE_FALSE_READING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => v === true || v === false);
      case 'MULTIPLE_CHOICE_READING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => typeof v === 'number' && v >= 0);
      default:
        return false;
    }
  };

  const normalize = normalizeAnswer;
  const solutionMatches = (user: unknown, entry: unknown) =>
    solutionVariants(entry).some((variant) => normalize(user) === normalize(variant));
  const displaySolution = (entry: unknown): string => solutionVariants(entry)[0] ?? '';

  const stripParentheticalHints = (s: string) =>
    s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  const handleTranslate = async (rawText: string, opts?: { wholeSentence?: boolean }) => {
    try {
      const text = stripParentheticalHints(rawText);
      if (opts?.wholeSentence && text) {
        try {
          const translated = await translateGermanToEnglish(text);
          setLlmBoxText((translated || text).trim());
        } catch {
          setLlmBoxText('Translation failed. Please try again.');
        }
        return;
      }
      let wordsToTranslate: string[] = [];
      if (/_+/.test(text)) {
        wordsToTranslate = text.split(/\s+/).filter(w => !/^_+$/.test(w) && w);
      } else if (text.includes(' / ')) {
        wordsToTranslate = text.split(' / ').map(s => s.trim()).filter(Boolean);
      } else {
        wordsToTranslate = text.split(/\s+/).filter(Boolean);
      }
      const translations = await Promise.all(
        wordsToTranslate.map(async (word) => {
          try {
            const translated = await translateGermanToEnglish(word);
            return { original: word, translated: translated || word };
          } catch {
            return { original: word, translated: word };
          }
        })
      );
      setLlmBoxText(translations.map(t => `${t.original}: ${t.translated}`).join(', '));
    } catch {
      setLlmBoxText('Translation failed. Please try again.');
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const ex = getCurrentExercise();
    if (!ex) return;

    const incorrectItems: string[] = [];
    let allCorrect = true;

    switch (currentExerciseType) {
      case 'FILL_IN_THE_BLANK_READING': {
        ex.exercises?.forEach((_question, i: number) => {
          const correct = ex.solutions?.[i];
          const given = exerciseAnswers?.[i] ?? '';
          if (!solutionMatches(given, correct)) {
            allCorrect = false;
            incorrectItems.push(`Q${i + 1}`);
          }
        });
        break;
      }
      case 'TRUE_FALSE_READING': {
        ex.statements?.forEach((_stmt: string, i: number) => {
          const correct = ex.solutions?.[i];
          const given = exerciseAnswers?.[i];
          if (given !== correct) {
            allCorrect = false;
            incorrectItems.push(`Statement ${i + 1}`);
          }
        });
        break;
      }
      case 'MULTIPLE_CHOICE_READING': {
        ex.exercises?.forEach((_question: unknown, i: number) => {
          const correct = ex.solutions?.[i];
          const given = exerciseAnswers?.[i];
          if (given !== correct) {
            allCorrect = false;
            incorrectItems.push(`Q${i + 1}`);
          }
        });
        break;
      }
    }

    setSubmissionResult({ allCorrect, incorrectItems });

    // Format ONLY incorrect answers for LLM box display
    if (incorrectItems.length > 0) {
      const incorrectAnswersList: string[] = [];
      ex.solutions?.forEach((sol: unknown, i: number) => {
        const label = currentExerciseType === 'TRUE_FALSE_READING' ? `Statement ${i + 1}` : `Q${i + 1}`;
        const isIncorrect = incorrectItems.includes(label);
        if (isIncorrect) {
          if (currentExerciseType === 'FILL_IN_THE_BLANK_READING') {
            incorrectAnswersList.push(`${i + 1}. ${displaySolution(sol)}`);
          } else if (currentExerciseType === 'TRUE_FALSE_READING') {
            incorrectAnswersList.push(`${i + 1}. ${sol ? 'True' : 'False'}`);
          } else if (currentExerciseType === 'MULTIPLE_CHOICE_READING') {
            const q = ex.exercises?.[i] as MultipleChoiceQuestion | undefined;
            incorrectAnswersList.push(`${i + 1}. ${q?.options?.[Number(sol)] || ''}`);
          }
        }
      });
      setLlmBoxText(`Incorrect answers: ${incorrectAnswersList.join(', ')}`);
    } else {
      setLlmBoxText('Excellent! All answers are correct.');
    }

    // Record performance
    const correctCount = (ex.solutions?.length || 5) - incorrectItems.length;
    if (correctCount > 0) {
      // Use passage text + template + index for unique hash (passage is unique per exercise)
      const passage = ex.passage || '';
      const templateName = ex._metadata?.template_name || currentExerciseType;
      const index = ex._metadata?.index || '';
      const questionHash = btoa(passage + templateName + index + topic).replace(/[+/=]/g, '');
      const lastHash = localStorage.getItem('latest_reading_question_hash');
      if (questionHash !== lastHash) {
        localStorage.setItem('latest_reading_question_hash', questionHash);
        (async () => {
          try {
            const consumerId = UserTracker.getOrCreateConsumerId();
            await recordReadingPerformance({
                consumer_id: consumerId,
                reading_topic: topic,
                reading_level: level,
                score: correctCount,
                question_hash: questionHash
            });
            onProgressUpdate?.();
          } catch { /* Progress recording is opportunistic. */ }
        })();
      }
    }
  };

  const getExerciseTemplateProps = (): Record<string, unknown> => {
    const ex = getCurrentExercise();
    if (!ex) return {};
    const templateType = toTemplateType(currentExerciseType);
    switch (currentExerciseType) {
      case 'FILL_IN_THE_BLANK_READING':
        return {
          type: templateType,
          exercises: ex.exercises,
          solutions: ex.solutions,
          answers: exerciseAnswers,
          onAnswerChange: handleExerciseAnswerChange,
          submitted,
          onTranslate: handleTranslate,
          rawTranslate: true,
        };
      case 'TRUE_FALSE_READING':
        return {
          type: templateType,
          text: '',
          statements: ex.statements,
          solutions: ex.solutions,
          answers: exerciseAnswers,
          onAnswerChange: handleExerciseAnswerChange,
          submitted,
          onTranslate: handleTranslate,
          rawTranslate: true,
        };
      case 'MULTIPLE_CHOICE_READING':
        return {
          type: templateType,
          exercises: ex.exercises,
          solutions: ex.solutions,
          answers: exerciseAnswers,
          onAnswerChange: handleExerciseAnswerChange,
          submitted,
          onTranslate: handleTranslate,
          rawTranslate: true,
        };
      default:
        return {};
    }
  };

  // Button label logic
  const getButton1Label = () => {
    if (topic === 'None' || !getCurrentExercise() || !isShowingExercise) return 'Practice';
    if (isSubmitEnabled() && !submitted) return 'Submit';
    return 'Next';
  };

  const handleButton1 = () => {
    const label = getButton1Label();
    if (label === 'Practice') generateExercise();
    else if (label === 'Submit') handleSubmit();
    else generateExercise();
  };

  const currentVocab: { word: string; meaning: string }[] = getCurrentExercise()?.vocabulary || [];

  const handleVocabulary = () => {
    if (!getCurrentExercise() || currentVocab.length === 0) {
      setLlmBoxText('No vocabulary available for this exercise.');
      return;
    }
    // Format vocabulary as single line like grammar help
    const vocabText = currentVocab.map(v => `${v.word}: ${v.meaning}`).join(', ');
    setLlmBoxText(vocabText);
  };

  // ─── Spider chart ───────────────────────────────────────────────────────────
  // ─── Selector list shared between desktop dropdown and mobile bottom sheet ──
  const renderTopicList = (close: () => void) => (
    <ul className="m-0 grid list-none gap-1.5 p-0 max-lg:max-h-none max-lg:pb-[30px]" role="listbox">
      <li
        className={cx(
          'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-0 max-lg:border-b max-lg:border-[#f5f5f5] max-lg:rounded-none max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
          topic === 'None' && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-[#f9f9ff]'
        )}
        onClick={() => { handleTopicChange('None'); close(); }}
      >
        <div className="relative flex h-8 w-8 items-center justify-center [&>*]:rounded-[14px]">
          <svg width="32" height="32">
            <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
            <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]"
              style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${2 * Math.PI * 12}` }} />
          </svg>
          <span className="absolute text-xs font-semibold text-black">0</span>
        </div>
        <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', topic === 'None' && 'max-lg:font-semibold max-lg:text-[#6366f1]')}>None</span>
      </li>
      {getTopicsForLevel(level).map((t, idx) => {
        const title = t.Title;
        const progress = Math.max(0, Math.min(100, performanceData[title] || 0));
        const visibleProgress = progress >= 10 ? progress : 0;
        const circ = 2 * Math.PI * 12;
        const offset = (1 - visibleProgress / 100) * circ;
        const isSelected = topic === title;
        return (
          <li
            key={title}
            className={cx(
              'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-0 max-lg:border-b max-lg:border-[#f5f5f5] max-lg:rounded-none max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
              isSelected && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-[#f9f9ff]'
            )}
            onClick={() => { handleTopicChange(title); close(); }}
          >
            <div className="relative flex h-8 w-8 items-center justify-center [&>*]:rounded-[14px]">
              <svg width="32" height="32">
                <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
                <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]"
                  style={{ strokeDasharray: `${circ}`, strokeDashoffset: `${offset}` }} />
              </svg>
              <span className="absolute text-xs font-semibold text-black">{idx + 1}</span>
            </div>
            <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', isSelected && 'max-lg:font-semibold max-lg:text-[#6366f1]')}>
              {title.length > 40 ? title.substring(0, 44) + '...' : title}
            </span>
          </li>
        );
      })}
    </ul>
  );

  // ─── PRACTICE view ──────────────────────────────────────────────────────────
  if (mode === 'PRACTICE') {
    const ex = getCurrentExercise();
    const passage = ex?.passage || '';
    const format = ex?.format || '';
    const formatLabel = format 
      ? `PASSAGE - ${format.toUpperCase().replace(/_/g, ' ')}`
      : 'PASSAGE';

    return (
      <>
        {isFullscreen && (
          <button
            className="fixed top-5 right-5 z-[1002] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-black/20 bg-white/90 text-[#333] backdrop-blur-lg transition-all duration-200 hover:scale-105 hover:bg-white/95 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-sm:top-[15px] max-sm:right-[15px] max-sm:h-10 max-sm:w-10"
            onClick={() => setIsFullscreen(false)}
            title="Exit fullscreen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="german-reading-container">
          <div className={cx(
            'flex min-h-[calc(100vh-150px)] min-h-[calc(100dvh-150px)] flex-col items-center justify-center p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]',
            'max-lg:h-[calc(100dvh-54px)] max-lg:min-h-[calc(100dvh-54px)] max-lg:w-full max-lg:max-w-none max-lg:items-stretch max-lg:justify-start max-lg:gap-0 max-lg:overflow-hidden max-lg:p-0'
          )}>
            {/* Header */}
            <div className={cx(
              'mb-6 flex w-full max-w-[800px] items-end justify-between gap-5',
              'max-lg:mb-0 max-lg:block max-lg:max-w-none max-lg:p-[16px_20px_4px]',
              'max-sm:flex-col max-sm:items-stretch max-sm:gap-4',
              isFullscreen && 'hidden'
            )}>
              <div className="max-w-[50%] flex-1 text-left max-lg:max-w-none max-lg:w-full max-sm:max-w-full">
                <h1 className="mb-1.5 block text-xs text-[#444] max-lg:hidden">Reading</h1>
                <div className="relative max-lg:mb-3 max-lg:w-full" ref={selectorRef}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[#222] max-lg:min-h-[46px] max-lg:rounded-xl max-lg:border-[#ccc] max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-normal max-lg:text-[#333] max-lg:shadow-none [&_svg]:opacity-60"
                    onClick={() => setIsSelectorOpen(v => !v)}
                  >
                    {topic === 'None' ? 'Select topic' : (topic.length > 40 ? topic.substring(0, 44) + '...' : topic)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isSelectorOpen && !isMobileView && (
                    <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 max-h-[260px] overflow-y-auto rounded-xl border border-black/12 bg-white p-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] max-lg:hidden">
                      {renderTopicList(() => setIsSelectorOpen(false))}
                    </div>
                  )}

                  {isSelectorOpen && isMobileView && (
                    <>
                      <div className="fixed inset-0 z-[700] bg-transparent max-lg:block" onClick={() => setIsSelectorOpen(false)} />
                      <div className="fixed right-0 bottom-0 left-0 z-[701] box-border max-h-[70dvh] min-h-[70dvh] w-auto max-w-screen overflow-x-hidden rounded-t-3xl border-0 bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_20px_rgba(0,0,0,0.1)]">
                        <div className="mb-5 flex items-center justify-between px-2.5 py-0">
                          <span className="text-xl font-bold text-[#1a1a1a]">Select topic</span>
                          <button className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-black/20 bg-transparent text-black/60 hover:border-black/40 hover:text-black/80" onClick={() => setIsSelectorOpen(false)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {renderTopicList(() => setIsSelectorOpen(false))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex max-w-[50%] flex-1 flex-wrap items-end justify-end gap-3 max-lg:mb-2.5 max-lg:w-full max-lg:max-w-none max-lg:flex-none max-lg:justify-stretch max-lg:gap-2 max-sm:mt-2 max-sm:w-full max-sm:gap-2">
                <button
                  className={ACTION_BTN}
                  onClick={handleButton1}
                  disabled={topic === 'None' || isBlocked}
                >
                  {getButton1Label()}
                </button>
                <button
                  className={VOCAB_BTN}
                  onClick={handleVocabulary}
                  disabled={!ex || !isShowingExercise || isBlocked}
                >
                  Vocabulary
                </button>
                <button
                  className={FULLSCREEN_BTN}
                  onClick={() => setIsFullscreen(v => !v)}
                  disabled={topic === 'None' || !isShowingExercise || isBlocked}
                  title="Enter fullscreen"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Exercise box */}
            <div className={cx(
              EXERCISE_BOX,
              isFullscreen && 'fixed! inset-0 z-[1000] m-0! h-screen! max-w-none! rounded-none! border-0! bg-white/95! p-10! pt-20! backdrop-blur-[20px]! max-sm:h-dvh! max-sm:p-5! max-sm:pt-[60px]! max-sm:pb-[calc(20px+env(safe-area-inset-bottom,0px))]!'
            )}>
              {isBlocked ? (
                <CreditLimitBlock message={limitMessage} />
              ) : isLoading ? (
                <div className="flex h-full min-h-full items-center justify-center max-lg:min-h-full"><div className="size-6 animate-spin rounded-full border-2 border-[#f3f3f3] border-t-black" /></div>
              ) : isShowingExercise && ex ? (
                <>
                  {currentInstruction && (
                    <div className={exerciseTitleClassName}>
                      {currentInstruction}
                    </div>
                  )}
                  {passage && (
                    <div className={PASSAGE_BLOCK}>
                      <div className="mb-2 text-[11px] font-bold tracking-[0.8px] text-black/40 uppercase">{formatLabel}</div>
                      {passage}
                    </div>
                  )}
                  <ExercisesTemplate {...getExerciseTemplateProps()} title="" />
                </>
              ) : (
                <div className="flex h-full min-h-full items-center justify-center text-sm text-[#666] max-lg:min-h-full max-lg:p-6 max-lg:text-base max-lg:opacity-60"><p>{defaultMsg}</p></div>
              )}
            </div>

            {/* Hint bar */}
            <div className={cx(
              'relative m-0 flex w-full max-w-[800px] min-h-20 items-center justify-center rounded-2xl border border-black/15 bg-[rgba(248,248,248,0.9)] px-5 py-4 shadow-[0_8px_20px_-5px_rgba(0,0,0,0.1),0_6px_8px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl',
              'before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:animate-settings-glow before:rounded-2xl before:bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] before:bg-size-[400%_400%] before:opacity-80 before:content-[""]',
              'max-lg:relative max-lg:max-w-none max-lg:flex-none max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
              'max-lg:before:inset-0 max-lg:before:rounded-none max-lg:before:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)] max-lg:before:opacity-80',
              isFullscreen && 'hidden'
            )}>
              <div className="relative z-1 max-w-full text-center text-sm leading-normal font-bold break-words text-[#333] max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:font-normal max-lg:text-[#1a1a1a] max-lg:leading-6">
                {isBlocked ? (
                  <span className="text-center text-sm text-[#333] opacity-60">Tap Upgrade to Pro above to continue</span>
                ) : (
                <TypeWriter
                  key={`llm-${llmBoxText}`}
                  text={llmBoxText || (isShowingExercise && currentInstruction
                    ? currentInstruction
                    : defaultMsg)}
                  delay={40}
                  shouldAnimate={true}
                  wordByWord={false}
                />
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── STATS view ─────────────────────────────────────────────────────────────
  const allTopics = getTopicsForLevel(level).map(t => t.Title);
  // Limit to exactly 10 topics for the spider chart
  const chartTopics = allTopics.slice(0, 10);
  const values = chartTopics.map(t => performanceData[t] || 0);
  const { axisPoints, dataPoints, polygon } = buildSpiderData(chartTopics, values);

  const avgScore = chartTopics.length > 0
    ? Math.round(chartTopics.reduce((sum, t) => sum + (performanceData[t] || 0), 0) / chartTopics.length)
    : 0;

  return (
    <div className={cx(
      'relative flex min-h-[calc(100vh-100px)] min-h-[calc(100dvh-100px)] flex-col items-center justify-center gap-5 p-5',
      'max-lg:h-[calc(100dvh-54px)] max-lg:min-h-0 max-lg:max-w-none max-lg:flex-1 max-lg:justify-center max-lg:gap-0 max-lg:bg-white max-lg:px-[15px] max-lg:pt-0 max-lg:pb-[calc(120px+env(safe-area-inset-bottom,0px))]',
      'max-sm:gap-0 max-sm:px-[15px] max-sm:pt-[60px] max-sm:pb-[70px]'
    )}>
      <div className="relative flex w-full max-w-[520px] items-center justify-center max-lg:static max-lg:mx-auto max-lg:w-[clamp(280px,80vw,400px)] max-lg:max-w-[clamp(280px,80vw,400px)] max-sm:max-w-full">
        <svg key={level} className="block h-auto w-full max-w-[500px] overflow-visible max-lg:w-[clamp(280px,80vw,400px)] max-lg:max-w-[clamp(280px,80vw,400px)] max-sm:max-w-[380px]" viewBox="0 0 400 400">
          <g>
            {[1, 2, 3, 4, 5].map(ring => {
              const R = 140 * (ring / 5);
              const pts: string[] = [];
              for (let i = 0; i < chartTopics.length; i++) {
                const angle = (360 / chartTopics.length) * i - 90;
                const rad = (angle * Math.PI) / 180;
                pts.push(`${200 + Math.cos(rad) * R},${200 + Math.sin(rad) * R}`);
              }
              return <polygon key={ring} className="fill-none stroke-black/10 stroke-1" points={pts.join(' ')} />;
            })}

            {axisPoints.map((axis, i) => (
              <g key={i}>
                <line
                  className="fill-none stroke-black/20 stroke-1"
                  x1="200" y1="200" x2={axis.x} y2={axis.y}
                  style={{
                    strokeDasharray: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                    strokeDashoffset: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                    animation: `lr-growLine 1s ease-out ${i * 0.08}s forwards`
                  }}
                />
                <text
                  className="fill-[#333] text-[10px] font-medium max-lg:text-[9px] max-sm:text-[10px]"
                  x={axis.x + (axis.x - 200) * 0.15}
                  y={axis.y + (axis.y - 200) * 0.35}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ opacity: 0, animation: `lr-fadeIn 0.5s ease-out ${0.6 + i * 0.08}s forwards` }}
                >
                  {(() => {
                    const MAX = 12;
                    const tokens = (axis.label || '').trim().split(/\s+/);
                    const lines: string[] = [];
                    let current = '';
                    for (const token of tokens) {
                      const candidate = current ? `${current} ${token}` : token;
                      if (candidate.length <= MAX) current = candidate;
                      else { if (current) lines.push(current); current = token.slice(0, MAX); }
                    }
                    if (current) lines.push(current);
                    const xPos = axis.x + (axis.x - 200) * 0.45;
                    const stepEm = 1.1;
                    const firstDy = -((lines.length - 1) / 2) * stepEm;
                    return lines.map((line, li) => (
                      <tspan key={li} x={xPos} dy={`${li === 0 ? firstDy : stepEm}em`}>{line}</tspan>
                    ));
                  })()}
                </text>
              </g>
            ))}
          </g>

          {dataPoints.map((point, i) => (
            <g key={i}>
              <line
                className="fill-none stroke-[rgba(120,119,198,0.8)] stroke-[3]"
                x1="200" y1="200" x2={point.x} y2={point.y}
                style={{
                  strokeDasharray: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  strokeDashoffset: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  animation: `lr-growDataLine 0.8s ease-out ${0.8 + i * 0.1}s forwards`
                }}
              />
              {point.value >= 10 && (
                <circle
                  className="origin-center fill-[rgba(120,119,198,1)] stroke-2 stroke-white"
                  cx={point.x} cy={point.y} r="5"
                  style={{ opacity: 0, transform: 'scale(0)', animation: `lr-drawPoint 0.4s ease-out ${1.2 + i * 0.1}s forwards` }}
                />
              )}
              {point.value >= 10 && (
                <text
                  className="fill-black text-[10px] font-semibold max-sm:text-[9px]"
                  x={point.x} y={point.y - 12} textAnchor="middle"
                  style={{ opacity: 0, animation: `lr-fadeIn 0.3s ease-out ${1.5 + i * 0.1}s forwards` }}
                >
                  {point.value}%
                </text>
              )}
            </g>
          ))}

          <polygon
            className="fill-[rgba(120,119,198,0.2)] stroke-[rgba(120,119,198,0.6)] stroke-1"
            points={polygon}
            style={{ opacity: 0, animation: 'lr-fadeInPolygon 0.8s ease-out 2s forwards' }}
          />
        </svg>
      </div>

      <div className={cx(
        'relative mx-auto flex w-full max-w-[600px] min-h-[70px] items-center justify-center overflow-hidden rounded-[14px] border border-black/15 bg-[rgba(248,248,248,0.85)] px-5 py-4 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.08),0_4px_6px_-2px_rgba(0,0,0,0.04)] backdrop-blur-[10px]',
        'before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:animate-settings-glow before:rounded-[14px] before:bg-[linear-gradient(45deg,rgba(120,119,198,0.3),rgba(255,206,84,0.3),rgba(120,119,198,0.3),rgba(255,206,84,0.3))] before:bg-size-[400%_400%] before:opacity-60 before:content-[""]',
        'max-lg:fixed max-lg:right-0 max-lg:bottom-0 max-lg:left-0 max-lg:z-[420] max-lg:mx-0 max-lg:max-w-none max-lg:min-h-[calc(100px+env(safe-area-inset-bottom,0px))] max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
        'max-lg:before:inset-0 max-lg:before:rounded-none max-lg:before:bg-[linear-gradient(90deg,#e2bea9,#b8b0d3)] max-lg:before:opacity-80',
        'max-sm:mt-11 max-sm:mb-[calc(20px+env(safe-area-inset-bottom,10px))] max-sm:min-h-[75px] max-sm:px-4 max-sm:py-3'
      )}>
        <div className="relative z-1 max-w-full text-center text-sm leading-normal font-bold break-words text-[#333] max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:font-normal max-lg:text-[#1a1a1a] max-lg:leading-6">
          {chartTopics.length > 0 && <TotalProgressText key={`${level}-${avgScore}`} percent={avgScore} />}
        </div>
      </div>
    </div>
  );
};
