// langeygrammar.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import './langeygrammar.animations.css';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { ExercisesTemplate, ExerciseType } from './ExercisesTemplate';
import { CreditLimitBlock } from './CreditLimitBlock';
import { translateGermanToEnglish } from '../utils/googleTranslate';
import { TypewriterText as TypeWriter } from './shared/TypewriterText';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import type { FullscreenModuleProps, LearnMode } from '../features/learning/moduleTypes';
import { assistLearning, generateExercise, recordLearningPerformance, retrieveLearningPerformance } from '../services/learningApi';
import { buildSpiderData as buildSharedSpiderData } from '../features/stats/spiderChart';
import { TotalProgressText } from './stats/TotalProgressText';
import type { GrammarAnswer, LlmAssistResponse } from '../features/exercises/grammarPayload';
import type { TopicsByLevel } from '../features/learning/moduleTypes';
import { normalizeAnswer } from '../features/exercises/comprehensionPayload';
import type { ExerciseAnswers, MultipleChoiceQuestion } from '../features/exercises/comprehensionPayload';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - allow JSON import
import levelTopicsData from '../../data/all_grammar_topics.json';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

type Mode = LearnMode;

export interface LangeyGrammarProps extends FullscreenModuleProps {
  mode: Mode; // 'LEARN' shows practice, 'STATS' shows stats
}

export const LangeyGrammar: React.FC<LangeyGrammarProps> = ({
  level,
  mode,
  onFullscreenChange,
  onProgressUpdate,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Grammar topic selection + exercise state
  const [topic, setTopic] = useState('None');
  const [isLoading, setIsLoading] = useState(false);
  const [currentExerciseTitle, setCurrentExerciseTitle] = useState('');
  const [currentExerciseType, setCurrentExerciseType] = useState<ExerciseType>('FILL_IN_THE_BLANK_READING_WRITING');
  const [exerciseAnswers, setExerciseAnswers] = useState<ExerciseAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState('');
  const [, setSubmissionHardcoded] = useState('');
  const [submissionReason, setSubmissionReason] = useState(''); // Animated reason from LLM
  const [llmBoxText, setLlmBoxText] = useState('');
  const [justResetPractice, setJustResetPractice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const isMobileView = useIsMobileLayout();
  const [lectureMarkdown, setLectureMarkdown] = useState('');
  const [isLectureVisible, setIsLectureVisible] = useState(false);
  const [isLectureExpanded, setIsLectureExpanded] = useState(false);
  const [isShowingExercise, setIsShowingExercise] = useState(false);
  const defaultLearnMsg = 'Select grammar topic and click Learn to understand or Generate to practice';
  const selectedTopicMsg = 'Click Learn to understand or Generate to get questions';
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const performanceRequestIdRef = useRef(0);
  const exerciseFeedbackRequestIdRef = useRef(0);

  // Stats state
  const [isStatsVisualizationComplete, setIsStatsVisualizationComplete] = useState(false);
  const [, setStatsFeedback] = useState<string[]>([]);
  const [, setCurrentStatsIndex] = useState(0);
  const [performanceData, setPerformanceData] = useState<Record<string, number>>({});
  const [chartPage, setChartPage] = useState(0);


  // Topics per level from JSON
  const levelToTopics = levelTopicsData as TopicsByLevel;
  const getTopicsForLevel = (lvl: string) => (levelToTopics?.[lvl] || []);
  const grammarHelp = useMemo(
    () => Object.fromEntries(['A1', 'A2', 'B1'].flatMap(l => getTopicsForLevel(l).map(t => [t.Title, true]))),
    [] // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing
  );

  // Read topic from URL params (from Roadmap navigation)
  useEffect(() => {
    if (location.pathname !== '/grammar') return;
    const topicParam = searchParams.get('topic');
    if (topicParam) {
      // Check if topic exists in the available topics for this level
      const availableTopics = getTopicsForLevel(level).map(t => t.Title);
      if (availableTopics.includes(topicParam)) {
        setTopic(topicParam);
        setLlmBoxText(selectedTopicMsg);
      }
    }
  }, [searchParams, level, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  // Helpers
  const initializeAnswersForType = (t: ExerciseType) => {
    switch (t) {
      case 'FILL_IN_THE_BLANK_READING_WRITING':
      case 'SENTENCE_BUILDING_WRITING':
      case 'WORD_ORDER_WRITING':
        setExerciseAnswers(['', '', '', '', '']);
        break;
      case 'TRUE_FALSE_READING':
        setExerciseAnswers([undefined, undefined, undefined, undefined, undefined]);
        break;
      case 'MULTIPLE_CHOICE_READING':
        setExerciseAnswers([-1, -1, -1, -1, -1]);
        break;
    }
  };

  const llmAssist = async (payload: Record<string, unknown>): Promise<LlmAssistResponse> => {
    try {
      const consumerId = UserTracker.getOrCreateConsumerId();
      const payloadWithConsumerId = { ...payload, consumer_id: consumerId };
      const resp = await assistLearning(payloadWithConsumerId);
      return await resp.json() as LlmAssistResponse;
    } catch {
      return {};
    }
  };

  const mdToHtml = (md: string): string => {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '<').replace(/>/g, '>');
    const formatInline = (s: string) => escapeHtml(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    const lines = md.split('\n');
    let inList = false;
    let inTable = false;
    let tableHeader: string[] = [];
    let tableRows: string[][] = [];
    let out = '';

    const flushTable = () => {
      if (!inTable || tableHeader.length === 0) return;
      out += '<table class="my-4 w-full border-collapse overflow-hidden rounded-lg bg-white/60 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] max-sm:my-3 max-sm:text-xs [&_tbody_tr:hover]:bg-[rgba(120,119,198,0.05)] [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr_th]:border-r [&_tbody_tr_th]:border-black/[0.06] [&_tbody_tr_th]:bg-[rgba(120,119,198,0.08)] [&_tbody_tr_th]:font-semibold [&_tbody_tr_th]:text-[#333] [&_td]:border-b [&_td]:border-black/[0.08] [&_td]:px-3 [&_td]:py-2.5 [&_td]:leading-normal [&_td]:text-[#444] [&_th]:border-b-2 [&_th]:border-[rgba(120,119,198,0.3)] [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-[#333] [&_th]:uppercase [&_thead]:bg-[rgba(120,119,198,0.15)] max-sm:[&_td]:px-2.5 max-sm:[&_td]:py-2 max-sm:[&_th]:text-[11px]"><thead><tr>';
      tableHeader.forEach(cell => {
        out += `<th>${formatInline(cell.trim())}</th>`;
      });
      out += '</tr></thead><tbody>';
      tableRows.forEach(row => {
        out += '<tr>';
        row.forEach((cell, idx) => {
          const tag = idx === 0 ? 'th' : 'td';
          out += `<${tag}>${formatInline(cell.trim())}</${tag}>`;
        });
        out += '</tr>';
      });
      out += '</tbody></table>';
      inTable = false;
      tableHeader = [];
      tableRows = [];
    };

    for (const raw of lines) {
      const line = raw;
      // Table detection: lines starting with |
      if (/^\s*\|/.test(line)) {
        if (!inTable) {
          if (inList) { out += '</ul>'; inList = false; }
          inTable = true;
        }
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        // Check if this is a separator row (contains only dashes and pipes)
        if (/^\s*\|[-\s:|]+\|\s*$/.test(line)) {
          // This is the separator row, skip it (header already captured)
          continue;
        }
        if (tableHeader.length === 0) {
          tableHeader = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      }
      // Not a table row - flush table if we were in one
      if (inTable) {
        flushTable();
      }

      if (/^###\s+/.test(line)) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`;
        continue;
      }
      if (/^##\s+/.test(line)) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`;
        continue;
      }
      if (/^#\s+/.test(line)) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`;
        continue;
      }
      if (/^\s*-\s+/.test(line)) {
        if (!inList) { out += '<ul>'; inList = true; }
        const item = line.replace(/^\s*-\s+/, '');
        out += `<li>${formatInline(item)}</li>`;
        continue;
      }
      if (inList) { out += '</ul>'; inList = false; }
      if (/^\s*---\s*$/.test(line)) {
        out += '<hr/>';
        continue;
      }
      if (line.trim() === '') { out += '<br/>'; continue; }
      out += `<p>${formatInline(line)}</p>`;
    }
    if (inList) out += '</ul>';
    if (inTable) flushTable();
    return out;
  };

  const handleLearn = async () => {
    if (isBlocked) return;
    setSubmissionFeedback('');
    setSubmissionReason('');
    setIsLectureExpanded(false);
    setIsShowingExercise(false);
    if (topic === 'None') {
      setLectureMarkdown('');
      setIsLectureVisible(false);
      setLlmBoxText(defaultLearnMsg);
      return;
    }
    if (lectureMarkdown) {
      setIsLectureVisible(true);
      setLlmBoxText('Click Practice to resume your exercise.');
      return;
    }
    try {
      const result = await llmAssist({ trigger: 'LEARN_CLICKED', level, topic_title: topic });
      const md = result?.lecture_markdown || '';
      setLectureMarkdown(md);
      setIsLectureVisible(true);
      setLlmBoxText('Click Practice to get questions.');
    } catch {
      setLectureMarkdown('');
      setIsLectureVisible(false);
    }
  };

  const resetPracticeState = () => {
    exerciseFeedbackRequestIdRef.current += 1;
    setCurrentExerciseType('FILL_IN_THE_BLANK_READING_WRITING');
    setCurrentExerciseTitle('');
    setExerciseAnswers({});
    setSubmitted(false);
    setSubmissionFeedback('');
    setSubmissionHardcoded('');
    setSubmissionReason('');
    setIsLoading(false);
    setIsShowingExercise(false);
    try {
      window.__CURRENT_EXERCISE__ = undefined;
    } catch {
      // Window state cleanup must not interrupt navigation.
    }
  };

  // Passing fullscreen up so the parent can hide header
  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isSelectorOpen && selectorRef.current && !selectorRef.current.contains(target)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isSelectorOpen]);

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    setLectureMarkdown('');
    setIsLectureVisible(false);
    setIsLectureExpanded(false);
    // clear current exercise
    resetPracticeState();
    if (newTopic !== 'None') {
      setLlmBoxText(selectedTopicMsg);
    } else {
      setLlmBoxText(defaultLearnMsg);
    }
  };

  const getCurrentExerciseData = () => {
    return window.__CURRENT_EXERCISE__;
  };
  const hasExercises = () => currentExerciseTitle && getCurrentExerciseData();

  const getExerciseTemplateProps = (): Record<string, unknown> => {
    const currentData = getCurrentExerciseData();
    switch (currentExerciseType) {
      case 'FILL_IN_THE_BLANK_READING_WRITING': {
        const d = currentData as { title: string; exercises: string[]; solutions: string[] };
        return {
          type: currentExerciseType, exercises: d.exercises, solutions: d.solutions,
          answers: exerciseAnswers, onAnswerChange: handleExerciseAnswerChange, submitted
        };
      }
      case 'TRUE_FALSE_READING': {
        const d = currentData as { title: string; text: string; statements: string[]; solutions: boolean[] };
        return {
          type: currentExerciseType, text: d.text, statements: d.statements, solutions: d.solutions,
          answers: exerciseAnswers, onAnswerChange: handleExerciseAnswerChange, submitted
        };
      }
      case 'MULTIPLE_CHOICE_READING': {
        const d = currentData as { title: string; exercises: { question: string; options: string[] }[]; solutions: number[] };
        return {
          type: currentExerciseType, exercises: d.exercises, solutions: d.solutions,
          answers: exerciseAnswers, onAnswerChange: handleExerciseAnswerChange, submitted
        };
      }
      case 'SENTENCE_BUILDING_WRITING': {
        const d = currentData as { title: string; prompts: string[]; solutions: (string | string[])[] };
        return {
          type: currentExerciseType, prompts: d.prompts, solutions: d.solutions,
          answers: exerciseAnswers, onAnswerChange: handleExerciseAnswerChange, submitted
        };
      }
      case 'WORD_ORDER_WRITING': {
        const d = currentData as { title: string; jumbledWords: string[][]; solutions: (string | string[])[] };
        return {
          type: currentExerciseType, jumbledWords: d.jumbledWords, solutions: d.solutions,
          answers: exerciseAnswers, onAnswerChange: handleExerciseAnswerChange, submitted
        };
      }
      default:
        return {};
    }
  };

  const handleExerciseAnswerChange = (index: number, value: GrammarAnswer) => {
    const newAnswers = Array.isArray(exerciseAnswers) ? [...exerciseAnswers] : [];
    newAnswers[index] = value;
    setExerciseAnswers(newAnswers);
  };

  const isSubmitEnabled = (): boolean => {
    if (!hasExercises()) return false;
    switch (currentExerciseType) {
      case 'FILL_IN_THE_BLANK_READING_WRITING':
      case 'SENTENCE_BUILDING_WRITING':
      case 'WORD_ORDER_WRITING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => typeof v === 'string' && v.trim().length > 0);
      case 'TRUE_FALSE_READING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => v === true || v === false);
      case 'MULTIPLE_CHOICE_READING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => typeof v === 'number' && v >= 0);
      default:
        return false;
    }
  };

  const generateExercises = async () => {
    if (topic === 'None' || isBlocked) return;
    exerciseFeedbackRequestIdRef.current += 1;
    setIsLoading(true);
    setCurrentExerciseType('FILL_IN_THE_BLANK_READING_WRITING');
    setExerciseAnswers({});
    setSubmitted(false);
    setSubmissionFeedback('');
    setSubmissionHardcoded('');
    setSubmissionReason('');

    try {
      const levelTopics = getTopicsForLevel(level);
      const selectedTopic = levelTopics.find(t => t.Title === topic) || levelTopics[0];
      const consumerId = UserTracker.getOrCreateConsumerId();

      const payload = {
        level,
        topic_title: selectedTopic.Title,
        exercise_type: 'FILL_IN_THE_BLANK_READING_WRITING',  // Not used anymore
        consumer_id: consumerId,
      };
      const resp = await generateExercise(payload);
      const data = await resp.json();

      // Check if blocked by credits
      if (data.limit_status?.is_blocked && !isPro) {
        setCreditsLeft(0, data.limit_status.message);
        return;
      }
      if (data.error) {
        console.error('Exercise generation error:', data.error);
        setLlmBoxText('Error generating exercise. Please try again.');
        return;
      }

      if (data.credits_left !== undefined) setCreditsLeft(data.credits_left);
      const ex = data.exercise;
      // Backend returns exercise with type property
      const exerciseType = ex.type || 'FILL_IN_THE_BLANK_READING_WRITING';
      setCurrentExerciseType(exerciseType);
      setCurrentExerciseTitle(ex.title || selectedTopic.Title);
      window.__CURRENT_EXERCISE__ = ex;
      initializeAnswersForType(exerciseType);
      setIsShowingExercise(true);
      setLlmBoxText('Exercise loaded! Answer the questions and click Submit to check your answers, or Help for guidance.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextExercises = () => {
    if (topic === 'None' || isBlocked) return;
    exerciseFeedbackRequestIdRef.current += 1;
    setIsLoading(true);
    setSubmissionFeedback('');
    setSubmissionHardcoded('');
    setSubmissionReason('');
    setSubmitted(false);

    (async () => {
      try {
        const levelTopics = getTopicsForLevel(level);
        const selectedTopic = levelTopics.find(t => t.Title === topic) || levelTopics[0];
        const consumerId = UserTracker.getOrCreateConsumerId();

        const payload = {
          level,
          topic_title: selectedTopic.Title,
          exercise_type: 'FILL_IN_THE_BLANK_READING_WRITING',  // Not used anymore
          consumer_id: consumerId,
        };
        const resp = await generateExercise(payload);
        const data = await resp.json();

        if (data.limit_status?.is_blocked && !isPro) {
          setCreditsLeft(0, data.limit_status.message);
          return;
        }
        if (data.error) {
          console.error('Exercise generation error:', data.error);
          setLlmBoxText('Error generating exercise. Please try again.');
          return;
        }

        if (data.credits_left !== undefined) setCreditsLeft(data.credits_left);
        const ex = data.exercise;
        // Backend returns exercise with type property
        const exerciseType = ex.type || 'FILL_IN_THE_BLANK_READING_WRITING';
        setCurrentExerciseType(exerciseType);
        setCurrentExerciseTitle(ex.title || selectedTopic.Title);
        window.__CURRENT_EXERCISE__ = ex;
        initializeAnswersForType(exerciseType);
        setIsShowingExercise(true);
        setLlmBoxText('Exercise loaded! Answer the questions and click Submit to check your answers, or Help for guidance.');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const getHelp = () => {
    if (topic === 'None' || !(topic in grammarHelp)) return;

    setSubmissionFeedback('');
    setSubmissionHardcoded('');
    setSubmissionReason('');

    const hasCurrentExercise = hasExercises();
    if (hasCurrentExercise) {
      const requestId = exerciseFeedbackRequestIdRef.current;
      // Get static help from backend via llmAssist
      llmAssist({
        trigger: 'HELP_CLICKED_EXERCISE',
        level,
        topic_title: topic,
        exercise_template: currentExerciseType,
        exercise: getCurrentExerciseData()
      }).then((r) => {
        if (requestId !== exerciseFeedbackRequestIdRef.current) return;
        setLlmBoxText(r?.message || 'No help available for this exercise.');
      });
    } else {
      // No exercise loaded - use Learn button instead
      setLlmBoxText('Click Learn to understand the topic, or Practice to get exercises.');
    }
  };

  /** Remove hint text in parentheses (e.g. infinitives after prompts) before translating. */
  const stripParentheticalHints = (s: string) =>
    s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  const handleTranslate = async (rawText: string, opts?: { wholeSentence?: boolean }) => {
    setSubmissionFeedback('');
    setSubmissionHardcoded('');
    setSubmissionReason('');
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

      // Check if it has underscores (fill-in-the-blank)
      if (/_+/.test(text)) {
        // Split by spaces and remove underscore blanks
        wordsToTranslate = text.split(/\s+/).filter(w => !/^_+$/.test(w) && w);
      } else if (text.includes(' / ')) {
        // Slash-separated items
        wordsToTranslate = text.split(' / ').map(s => s.trim()).filter(Boolean);
      } else {
        // Regular sentence - split into words
        wordsToTranslate = text.split(/\s+/).filter(Boolean);
      }

      // Translate each word/item
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

      // Format as "German: English, German: English, ..."
      const formattedResult = translations.map(t => `${t.original}: ${t.translated}`).join(', ');
      setLlmBoxText(formattedResult);
    } catch {
      setLlmBoxText('Translation failed. Please try again.');
    }
  };

  const fetchPerformanceData = async (selectedLevel: string) => {
    const requestId = ++performanceRequestIdRef.current;
    try {
      const consumerId = UserTracker.getOrCreateConsumerId();
      const response = await retrieveLearningPerformance({ consumer_id: consumerId, german_level: selectedLevel });
      const data = await response.json();
      if (requestId === performanceRequestIdRef.current) {
        setPerformanceData(data.data || {});
      }
    } catch (e) {
      console.error('Failed to fetch performance data:', e);
      if (requestId === performanceRequestIdRef.current) {
        setPerformanceData({});
      }
    }
  };

  // Spider (radar) chart geometry
  const buildSpiderData = (topics: string[], values: number[]) =>
    buildSharedSpiderData(topics, values, 50);

  // SUBMIT handler with optimized UX
  const handleSubmit = () => {
    setSubmitted(true);
    const requestId = ++exerciseFeedbackRequestIdRef.current;

    const ex = getCurrentExerciseData();
    let correctCount = 0;
    const normalize = normalizeAnswer;

    const writingVariants = (entry: string | string[]): string[] =>
      Array.isArray(entry) ? entry.filter((x): x is string => typeof x === 'string') : [entry];
    const writingAnswerMatches = (user: unknown, entry: string | string[]) =>
      writingVariants(entry).some((v) => normalize(user) === normalize(v));
    const displayWritingSolution = (entry: string | string[]): string =>
      Array.isArray(entry) ? (entry[0] ?? '') : entry;
    
    // Check correctness and collect incorrect answers
    const incorrectAnswers: { index: number; answer: string }[] = [];
    try {
      switch (currentExerciseType) {
        case 'FILL_IN_THE_BLANK_READING_WRITING':
          ex?.solutions?.forEach((s, i) => {
            const isCorrect = normalize(exerciseAnswers?.[i]) === normalize(s);
            if (isCorrect) {
              correctCount++;
            } else {
              incorrectAnswers.push({ index: i + 1, answer: String(s) });
            }
          });
          break;
        case 'SENTENCE_BUILDING_WRITING':
        case 'WORD_ORDER_WRITING':
          ex?.solutions?.forEach((s, i) => {
            const writingSolution = s as string | string[];
            const isCorrect = writingAnswerMatches(exerciseAnswers?.[i], writingSolution);
            if (isCorrect) {
              correctCount++;
            } else {
              incorrectAnswers.push({ index: i + 1, answer: displayWritingSolution(writingSolution) });
            }
          });
          break;
        case 'TRUE_FALSE_READING':
          ex?.solutions?.forEach((s, i) => {
            const isCorrect = exerciseAnswers?.[i] === s;
            if (isCorrect) {
              correctCount++;
            } else {
              incorrectAnswers.push({ index: i + 1, answer: s ? 'True' : 'False' });
            }
          });
          break;
        case 'MULTIPLE_CHOICE_READING':
          ex?.solutions?.forEach((s, i) => {
            const isCorrect = exerciseAnswers?.[i] === s;
            if (isCorrect) {
              correctCount++;
            } else {
              const question = ex?.exercises?.[i] as MultipleChoiceQuestion | undefined;
              const correctOption = question?.options?.[Number(s)] || String(s);
              incorrectAnswers.push({ index: i + 1, answer: correctOption });
            }
          });
          break;
        default:
          correctCount = 0;
      }
    } catch {
      correctCount = 0;
    }

    const hasIncorrect = correctCount < (ex?.solutions?.length || 5);

    // question hash & performance
    const generateQuestionHash = () => btoa(currentExerciseTitle).replace(/[+/=]/g, '');
    const questionHash = generateQuestionHash();
    const lastQuestionHash = localStorage.getItem('latest_question_hash');
    if (questionHash !== lastQuestionHash) {
      localStorage.setItem('latest_question_hash', questionHash);
      if (correctCount > 0) {
        (async () => {
          try {
            const consumerId = UserTracker.getOrCreateConsumerId();
            const response = await recordLearningPerformance({
                consumer_id: consumerId,
                german_topic: topic,
                german_level: level,
                score: correctCount,
                question_hash: questionHash
            });
            await response.json();
            onProgressUpdate?.();
          } catch (e) {
            console.error('Failed to record performance:', e);
          }
        })();
      }
    }

    if (hasIncorrect) {
      // Format incorrect answers with original indices
      const formattedIncorrect = incorrectAnswers
        .map((item) => `${item.index}. ${item.answer}`)
        .join('. ');
      const incorrectLine = `Incorrect answers: ${formattedIncorrect}`;
      
      // Animate the incorrect answers line
      setSubmissionFeedback(incorrectLine);
      setSubmissionReason(''); // Clear previous reason
      
      // Calculate exact animation end time: text length * 40ms per character
      const animationEndTime = incorrectLine.length * 40;
      const startTime = Date.now();
      
      // Call LLM for reason in background
      llmAssist({ trigger: 'SUBMIT_REASON_ONLY', exercise: ex, user_answers: exerciseAnswers })
        .then((r) => {
          if (requestId !== exerciseFeedbackRequestIdRef.current) return;
          const reason = r?.reason || '';
          if (reason) {
            // Calculate remaining time until animation ends
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, animationEndTime - elapsedTime);
            // Show reason exactly when animation finishes
            setTimeout(() => {
              if (requestId !== exerciseFeedbackRequestIdRef.current) return;
              setSubmissionReason(reason);
            }, remainingTime);
          }
        });
    } else {
      setSubmissionHardcoded('');
      setSubmissionReason('');
      llmAssist({ trigger: 'SUBMIT_CLICKED_CORRECT' })
        .then((r) => {
          if (requestId !== exerciseFeedbackRequestIdRef.current) return;
          setSubmissionFeedback(r?.message || 'Excellent!');
        });
    }
  };

  const toggleFullscreen = () => setIsFullscreen(v => !v);

  // === Lifecycle / effects mapping to new "mode" prop ===

  // Track level changes (from parent): reset practice if we're in LEARN
  const prevLevel = useRef(level);
  useEffect(() => {
    if (prevLevel.current !== level) {
      prevLevel.current = level;
      setTopic('None');
      setIsSelectorOpen(false);
      setLectureMarkdown('');
      setIsLectureVisible(false);
      setIsLectureExpanded(false);
      setChartPage(0);
      if (mode === 'LEARN') {
        fetchPerformanceData(level);
        resetPracticeState();
        setJustResetPractice(true);
        setLlmBoxText(defaultLearnMsg);
      } else if (mode === 'STATS') {
        // refresh stats data when level changes and stats is visible
        fetchPerformanceData(level);
        setIsStatsVisualizationComplete(false);
        setStatsFeedback([]);
        setCurrentStatsIndex(0);
      }
    }
  }, [level, mode]);

  // Keep learn layout pinned after stats toggle (mobile container can retain scroll offset)
  // useEffect(() => {
  //   const container = document.querySelector('.german-grammar-container');
  //   if (container) container.scrollTop = 0;
  // }, [mode]);

  // When mode changes: mirror original tracking + LLM guidance behavior
  useEffect(() => {
    if (mode === 'LEARN') {
      fetchPerformanceData(level);
      if (justResetPractice) {
        setJustResetPractice(false);
        return;
      }
      if (topic === 'None') {
        setLlmBoxText(defaultLearnMsg);
      } else if (!hasExercises()) {
        setLlmBoxText(selectedTopicMsg);
      } else {
        setLlmBoxText('Exercise loaded! Answer the questions and click Submit to check your answers, or Help for guidance.');
      }
    } else if (mode === 'STATS') {
      fetchPerformanceData(level);
      setIsStatsVisualizationComplete(false);
      setStatsFeedback([]);
      setCurrentStatsIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!isSelectorOpen || mode !== 'LEARN') return;
    setPerformanceData({});
    fetchPerformanceData(level);
  }, [isSelectorOpen, level, mode]);

  // Generate LLM text after stats visualization "animates"
  useEffect(() => {
    if (mode === 'STATS' && !isStatsVisualizationComplete) {
      const timer = setTimeout(() => {
        setIsStatsVisualizationComplete(true);
        llmAssist({ trigger: 'STATS_CLICKED', level }).then((r) => {
          setStatsFeedback(Array.isArray(r?.feedback) ? r.feedback : []);
          setCurrentStatsIndex(0);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [mode, level, isStatsVisualizationComplete]);

  // ESC to exit fullscreen + body scroll lock (unchanged)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  // Button 1 logic
  const getButton1Label = () => {
    if (topic === 'None') return 'Practice';
    if (!hasExercises()) return 'Practice';
    if (hasExercises() && !isShowingExercise) return 'Practice';
    if (isSubmitEnabled() && !submitted) return 'Submit';
    return 'Next';
  };

  const handleButton1 = () => {
    const label = getButton1Label();
    if (label === 'Practice') {
      if (hasExercises() && !isShowingExercise) {
        setIsShowingExercise(true);
        setLlmBoxText('Exercise resumed. Answer the questions and click Submit to check your answers, or Help for guidance.');
      } else {
        generateExercises();
      }
    } else if (label === 'Submit') {
      handleSubmit();
    } else if (label === 'Next') {
      nextExercises();
    }
  };

  // === Render ===
  return (
    <>
      {/* Fullscreen close button (unchanged) */}
      {isFullscreen && (
        <button
          className="fixed top-5 right-5 z-[1002] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-black/20 bg-white/90 text-[#333] backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white/95 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-sm:top-[15px] max-sm:right-[15px] max-sm:h-10 max-sm:w-10"
          onClick={toggleFullscreen}
          title="Exit fullscreen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {mode === 'LEARN' ? (
        <div className="flex min-h-[calc(100vh-150px)] min-h-[calc(100dvh-150px)] flex-col items-center justify-center p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] max-lg:h-[calc(100dvh-54px)] max-lg:min-h-[calc(100dvh-54px)] max-lg:w-full max-lg:max-w-none max-lg:items-stretch max-lg:justify-start max-lg:gap-0 max-lg:overflow-hidden max-lg:p-0">
          <div className={cx('flex w-full max-w-[800px] items-end justify-between gap-5 mb-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4 max-lg:mb-0 max-lg:block max-lg:w-full max-lg:max-w-none max-lg:flex-[0_0_auto] max-lg:bg-transparent max-lg:px-5 max-lg:pt-4 max-lg:pb-1', isFullscreen && 'hidden')}>
            <div className="max-w-[50%] flex-1 text-left max-sm:max-w-full max-lg:w-full max-lg:max-w-none">
              <h1 className="mb-1.5 block text-xs text-[#444] max-lg:hidden">Grammar</h1>
              <div className="relative max-lg:mb-3 max-lg:w-full" ref={selectorRef}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[#222] max-lg:min-h-[46px] max-lg:rounded-xl max-lg:border-[#ccc] max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-normal max-lg:shadow-none [&_svg]:opacity-60"
                  onClick={() => setIsSelectorOpen((v) => !v)}
                >
                  {topic === 'None' ? 'Select topic' : (topic.length > 40 ? topic.substring(0, 44) + '...' : topic)}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isSelectorOpen && !isMobileView && (
                  <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 max-h-[260px] overflow-y-auto rounded-xl border border-black/12 bg-white p-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] max-sm:hidden">
                    <ul className="m-0 grid list-none gap-1.5 p-0 max-lg:max-h-none max-lg:pb-[30px]" role="listbox" aria-label="Grammar topics">
                      <li
                        className={cx(
                          'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-0 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
                          topic === 'None' && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-transparent',
                        )}
                        role="option"
                        aria-selected={topic === 'None'}
                        onClick={() => {
                          handleTopicChange('None');
                          setIsSelectorOpen(false);
                        }}
                      >
                        <div className="relative flex h-8 w-8 items-center justify-center">
                          <svg width="32" height="32">
                            <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
                            <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]" style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${(1 - 0 / 100) * 2 * Math.PI * 12}` }} />
                          </svg>
                          <span className="absolute text-xs font-semibold text-black">0</span>
                        </div>
                        <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', topic === 'None' && 'max-lg:font-semibold max-lg:text-indigo-500')}>None</span>
                      </li>
                      {getTopicsForLevel(level).map((t, idx) => {
                        const title = t.Title;
                        const progress = Math.max(0, Math.min(100, performanceData[title] || 0));
                        const visibleProgress = progress >= 10 ? progress : 0;
                        const circumference = 2 * Math.PI * 12;
                        const offset = (1 - visibleProgress / 100) * circumference;
                        return (
                          <li
                            key={title}
                            className={cx(
                              'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-0 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
                              topic === title && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-transparent',
                            )}
                            role="option"
                            aria-selected={topic === title}
                            onClick={() => {
                              handleTopicChange(title);
                              setIsSelectorOpen(false);
                            }}
                          >
                            <div className="relative flex h-8 w-8 items-center justify-center">
                              <svg width="32" height="32">
                                <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
                                <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]" style={{ strokeDasharray: `${circumference}`, strokeDashoffset: `${offset}` }} />
                              </svg>
                              <span className="absolute text-xs font-semibold text-black">{idx + 1}</span>
                            </div>
                            <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', topic === title && 'max-lg:font-semibold max-lg:text-indigo-500')}>{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {isSelectorOpen && isMobileView && (
                  <>
                    <div className="fixed inset-0 z-30 bg-black/30 max-lg:z-[700] max-lg:bg-transparent" onClick={() => setIsSelectorOpen(false)} />
                    <div className="fixed right-0 bottom-0 left-0 z-[31] max-h-[65vh] overflow-y-auto overflow-x-hidden rounded-t-[14px] bg-white p-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.15)] max-lg:z-[701] max-lg:box-border max-lg:min-h-[70dvh] max-lg:max-h-[70dvh] max-lg:w-auto max-lg:max-w-[100vw] max-lg:rounded-t-[24px] max-lg:border-0 max-lg:px-4 max-lg:py-4 max-lg:pb-[calc(16px+env(safe-area-inset-bottom,0px))] max-lg:shadow-[0_-8px_20px_rgba(0,0,0,0.1)]" role="dialog" aria-label="Select grammar topic">
                      <div className="flex items-center justify-between px-1 py-2 pb-3 max-lg:mb-5 max-lg:px-2.5">
                        <div className="text-sm font-semibold text-[#222] max-lg:text-xl max-lg:font-bold max-lg:text-[#1a1a1a]">Select topic</div>
                        <button className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-black/20 bg-transparent text-black/60 hover:border-black/40 hover:text-black/80" onClick={() => setIsSelectorOpen(false)} aria-label="Close">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <ul className="m-0 grid w-full max-w-full list-none gap-0 overflow-x-hidden p-0 px-1 pb-[30px] max-lg:gap-0" role="listbox" aria-label="Grammar topics">
                        <li
                          className={cx(
                            'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-12 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
                            topic === 'None' && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-transparent',
                          )}
                          role="option"
                          aria-selected={topic === 'None'}
                          onClick={() => {
                            handleTopicChange('None');
                            setIsSelectorOpen(false);
                          }}
                        >
                          <div className="relative flex h-8 w-8 items-center justify-center [&_*]:rounded-[14px]">
                            <svg width="32" height="32">
                              <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
                              <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]" style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${(1 - 0 / 100) * 2 * Math.PI * 12}` }} />
                            </svg>
                            <span className="absolute text-xs font-semibold text-black">0</span>
                          </div>
                          <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', topic === 'None' && 'max-lg:font-semibold max-lg:text-indigo-500')}>None</span>
                        </li>
                        {getTopicsForLevel(level).map((t, idx) => {
                          const title = t.Title;
                          const progress = Math.max(0, Math.min(100, performanceData[title] || 0));
                          const visibleProgress = progress >= 10 ? progress : 0;
                          const circumference = 2 * Math.PI * 12;
                          const offset = (1 - visibleProgress / 100) * circumference;
                          return (
                            <li
                              key={title}
                              className={cx(
                                'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)] max-lg:min-h-12 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
                                topic === title && 'bg-[rgba(120,119,198,0.12)] max-lg:bg-transparent',
                              )}
                              role="option"
                              aria-selected={topic === title}
                              onClick={() => {
                                handleTopicChange(title);
                                setIsSelectorOpen(false);
                              }}
                            >
                              <div className="relative flex h-8 w-8 items-center justify-center [&_*]:rounded-[14px]">
                                <svg width="32" height="32">
                                  <circle cx="16" cy="16" r="12" className="fill-none stroke-black/10 stroke-[3]" />
                                  <circle cx="16" cy="16" r="12" className="origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-[3] [stroke-linecap:round]" style={{ strokeDasharray: `${circumference}`, strokeDashoffset: `${offset}` }} />
                                </svg>
                                <span className="absolute text-xs font-semibold text-black">{idx + 1}</span>
                              </div>
                              <span className={cx('flex-1 text-sm text-[#222] max-lg:text-[15px]', topic === title && 'max-lg:font-semibold max-lg:text-indigo-500')}>{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex max-w-[50%] flex-1 flex-wrap items-end justify-end gap-3 max-sm:mt-2 max-sm:w-full max-sm:max-w-none max-sm:gap-2 max-lg:mb-2.5 max-lg:w-full max-lg:max-w-none max-lg:flex-[0_0_auto] max-lg:justify-stretch max-lg:gap-2">
              <button
                className="min-w-[90px] flex-1 cursor-pointer rounded-[10px] border border-black/20 bg-gradient-to-br from-black to-[#333] px-[18px] py-2.5 text-sm font-medium text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-px hover:from-[#333] hover:to-[#555] disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/15 disabled:text-black/40 max-sm:min-w-[80px] max-sm:px-3.5 max-sm:py-2 max-sm:text-[13px] max-lg:min-h-[46px] max-lg:w-0 max-lg:min-w-0 max-lg:flex-[1_1_0] max-lg:rounded-xl max-lg:border-[#eee] max-lg:bg-white max-lg:px-2.5 max-lg:py-3 max-lg:text-sm max-lg:text-[#333] max-lg:shadow-none max-lg:hover:translate-y-0"
                onClick={handleButton1}
                disabled={topic === 'None' || isBlocked}
              >
                {getButton1Label()}
              </button>
              <button
                className="min-w-[90px] flex-1 cursor-pointer rounded-[10px] border border-black/20 bg-gradient-to-br from-black to-[#333] px-[18px] py-2.5 text-sm font-medium text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-px hover:from-[#333] hover:to-[#555] disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/15 disabled:text-black/40 max-sm:min-w-[80px] max-sm:px-3.5 max-sm:py-2 max-sm:text-[13px] max-lg:min-h-[46px] max-lg:w-0 max-lg:min-w-0 max-lg:flex-[1_1_0] max-lg:rounded-xl max-lg:border-[#eee] max-lg:bg-white max-lg:px-2.5 max-lg:py-3 max-lg:text-sm max-lg:text-[#333] max-lg:shadow-none max-lg:hover:translate-y-0"
                onClick={handleLearn}
                disabled={topic === 'None' || isBlocked}
              >
                Learn
              </button>
              <button
                className="gg-help-btn-glow relative flex min-w-[90px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-black/15 bg-[rgba(248,248,248,0.9)] px-[18px] py-2.5 text-sm font-medium text-black/80 backdrop-blur-xl transition-all duration-300 hover:-translate-y-px hover:bg-[rgba(248,248,248,0.95)] disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/15 disabled:text-black/40 max-sm:min-w-[80px] max-sm:px-3.5 max-sm:py-2 max-sm:text-[13px] max-lg:min-h-[46px] max-lg:w-0 max-lg:min-w-0 max-lg:flex-[1_1_0] max-lg:rounded-xl max-lg:border-transparent max-lg:bg-gradient-to-r max-lg:from-[#e2bea9] max-lg:to-[#b8b0d3] max-lg:px-2.5 max-lg:py-3 max-lg:text-sm max-lg:text-black max-lg:shadow-none max-lg:hover:translate-y-0 max-lg:hover:from-[#e2bea9] max-lg:hover:to-[#b8b0d3] max-lg:disabled:bg-black/15 max-lg:disabled:text-black/40 max-lg:[&::before]:hidden"
                onClick={getHelp}
                disabled={!hasExercises() || isBlocked}
              >
                Help
              </button>
              <button
                className="flex !min-w-10 !w-10 !flex-none cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-transparent p-2.5 text-black/30 transition-all duration-300 hover:-translate-y-px hover:border-black/50 hover:text-black/50 disabled:cursor-not-allowed disabled:border-black/15 disabled:text-black/15 max-sm:!min-w-[35px] max-sm:!w-[35px] max-sm:p-2 max-lg:hidden"
                onClick={toggleFullscreen}
                disabled={topic === 'None' || (!hasExercises() && !isLectureVisible) || isBlocked}
                title="Enter fullscreen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a 2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
          </div>

          <div className={cx(
            'relative mb-5 flex h-[400px] w-full max-w-[800px] flex-col overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl max-sm:mb-4 max-sm:h-[350px] max-sm:p-4 max-lg:mb-0 max-lg:h-auto max-lg:min-h-0 max-lg:max-w-none max-lg:flex-[1_1_auto] max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-[10px_0_20px] max-lg:shadow-none max-lg:backdrop-blur-none max-lg:transition-none [&>.gg-credit-limit-block]:min-h-full',
            isFullscreen && 'fixed! top-0! left-0! z-[1000]! m-0! h-screen! max-w-none! rounded-none! border-0! bg-white/95! p-10! pt-20! backdrop-blur-[20px]! max-sm:h-dvh! max-sm:p-5! max-sm:pt-[60px]! max-sm:pb-[calc(20px+env(safe-area-inset-bottom,0px))]!',
            isLectureVisible && !isShowingExercise && isLectureExpanded && 'h-auto',
          )}>
            {isBlocked ? (
              <CreditLimitBlock message={limitMessage} />
            ) : isLoading ? (
              <div className="flex h-full min-h-full items-center justify-center max-lg:min-h-full"><div className="gg-spinner-animate h-6 w-6 rounded-full border-2 border-[#f3f3f3] border-t-black" /></div>
            ) : (hasExercises() && isShowingExercise) ? (
              <ExercisesTemplate {...getExerciseTemplateProps()} title={currentExerciseTitle} onTranslate={handleTranslate} />
            ) : isLectureVisible && topic !== 'None' ? (
              <div
                className="mx-auto max-w-[680px] py-1 text-left text-sm leading-[1.7] text-[#222] max-lg:box-border max-lg:w-full max-lg:px-3 [&_h1]:my-2.5 [&_h1]:text-left [&_h2]:my-2.5 [&_h2]:text-left [&_h3]:my-2.5 [&_h3]:text-left [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-black/15 [&_li]:my-1 [&_ol]:my-2.5 [&_ol]:mb-3.5 [&_ol]:pl-[1.1rem] [&_ol]:list-outside [&_p]:my-2 [&_p]:text-left [&_ul]:my-2.5 [&_ul]:mb-3.5 [&_ul]:pl-[1.1rem] [&_ul]:list-outside"
                dangerouslySetInnerHTML={{ __html: mdToHtml(lectureMarkdown) }}
              />
            ) : topic === 'None' ? (
              <div className="flex h-full min-h-full items-center justify-center text-sm text-[#666] max-lg:min-h-full max-lg:p-6 max-lg:text-base max-lg:opacity-60">
                <p>{defaultLearnMsg}</p>
              </div>
            ) : (
              <div className="flex h-full min-h-full items-center justify-center text-sm text-[#666] max-lg:min-h-full max-lg:p-6 max-lg:text-base max-lg:opacity-60">
                <p>{selectedTopicMsg}</p>
              </div>
            )}
          </div>

          <div className={cx('gg-glow-border relative flex min-h-[80px] w-full max-w-[800px] items-center justify-center rounded-2xl border border-black/15 bg-[rgba(248,248,248,0.9)] p-4 px-5 shadow-[0_8px_20px_-5px_rgba(0,0,0,0.1),0_6px_8px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl max-lg:relative max-lg:bottom-auto max-lg:left-auto max-lg:right-auto max-lg:z-auto max-lg:m-0 max-lg:flex-[0_0_auto] max-lg:max-w-none max-lg:min-h-[calc(100px+env(safe-area-inset-bottom,0px))] max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-6 max-lg:px-8 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none max-lg:transition-none max-lg:[&::before]:inset-0 max-lg:[&::before]:rounded-none max-lg:[&::before]:bg-gradient-to-r max-lg:[&::before]:from-[#e2bea9] max-lg:[&::before]:to-[#b8b0d3] max-lg:[&::before]:opacity-80 max-lg:[&::before]:animate-none', isFullscreen && 'hidden')}>
            <div className="relative z-[1] max-w-full text-center text-sm leading-normal font-bold break-words text-[#333] max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:leading-6 max-lg:font-normal max-lg:text-[#1a1a1a]">
              {isBlocked ? (
                <span className="text-center text-sm text-[#333] opacity-60">Tap Upgrade to Pro above to continue</span>
              ) : (
                <>
              {/* Animate incorrect answers line */}
              {submissionFeedback && !submissionFeedback.includes('Excellent') && submissionFeedback.includes('Incorrect') && (
                <div>
                  <TypeWriter
                    key={`feedback-${submissionFeedback}`}
                    text={submissionFeedback}
                    delay={40}
                    shouldAnimate={true}
                    wordByWord={false}
                  />
                </div>
              )}
              
              {/* Animate reason part separately */}
              {submissionReason && (
                <div>
                  <TypeWriter
                    key={`reason-${submissionReason}`}
                    text={`Explanation: ${submissionReason}`}
                    delay={40}
                    shouldAnimate={true}
                    wordByWord={false}
                  />
                </div>
              )}
              
              {/* Fall back to normal feedback for other cases */}
              {!submissionFeedback?.includes('Incorrect') && (submissionFeedback || llmBoxText) && (
                <TypeWriter
                  key={`llm-${llmBoxText}-${submissionFeedback}`}
                  text={submissionFeedback || llmBoxText}
                  delay={40}
                  shouldAnimate={true}
                  wordByWord={false}
                />
              )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-[calc(100vh-100px)] min-h-[calc(100dvh-100px)] flex-col items-center justify-center gap-5 p-5 max-sm:gap-0 max-sm:px-[15px] max-sm:pt-[60px] max-sm:pb-[70px] max-lg:h-[calc(100dvh-54px)] max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:flex-[1_1_auto] max-lg:items-center max-lg:justify-center max-lg:bg-white max-lg:px-[15px] max-lg:pt-0 max-lg:pb-[calc(120px+env(safe-area-inset-bottom,0px))]">
          {(() => {
            const allTopics = getTopicsForLevel(level).map(t => t.Title);
            const CHART_MAX = Math.ceil(allTopics.length / 3);
            const chartGroups: string[][] = [];
            for (let i = 0; i < allTopics.length; i += CHART_MAX) {
              chartGroups.push(allTopics.slice(i, i + CHART_MAX));
            }
            const currentGroup = chartGroups[chartPage] || [];
            const currentValues = currentGroup.map(t => performanceData[t] || 0);
            const { axisPoints, dataPoints, polygon } = buildSpiderData(currentGroup, currentValues);
            return (
              <>
                <div className="relative flex w-full max-w-[520px] items-center justify-center max-sm:static max-sm:max-w-full max-lg:static max-lg:mx-auto max-lg:w-[clamp(280px,80vw,400px)] max-lg:max-w-[clamp(280px,80vw,400px)]">
                  <svg key={`${level}-${chartPage}`} className="block h-auto w-full max-w-[500px] overflow-visible max-sm:max-w-[380px] max-lg:w-[clamp(280px,80vw,400px)] max-lg:max-w-[clamp(280px,80vw,400px)]" viewBox="0 0 400 400">
                    {/* Grid rings */}
                    <g>
                      {[1, 2, 3, 4, 5].map((ring) => {
                        const AXIS_COUNT = axisPoints.length;
                        const RADIUS = 140 * (ring / 5);
                        const pts: string[] = [];
                        for (let i = 0; i < AXIS_COUNT; i++) {
                          const angle = (360 / AXIS_COUNT) * i - 90;
                          const rad = (angle * Math.PI) / 180;
                          const x = 200 + Math.cos(rad) * RADIUS;
                          const y = 200 + Math.sin(rad) * RADIUS;
                          pts.push(`${x},${y}`);
                        }
                        return <polygon key={ring} className="fill-none stroke-black/10 stroke-1" points={pts.join(' ')} />;
                      })}

                      {/* Axes + labels */}
                      {axisPoints.map((axis, index) => (
                        <g key={index}>
                          <line
                            className="fill-none stroke-black/20 stroke-1"
                            x1="200" y1="200" x2={axis.x} y2={axis.y}
                            style={{
                              strokeDasharray: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                              strokeDashoffset: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                              animation: `gg-grow-line 1s ease-out ${index * 0.1}s forwards`
                            }}
                          />
                          <text
                            className="fill-[#333] text-[10px] font-medium max-lg:text-[9px]"
                            x={axis.x + (axis.x - 200) * 0.15}
                            y={axis.y + (axis.y - 200) * 0.35}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ opacity: 0, animation: `gg-fade-in 0.5s ease-out ${0.8 + index * 0.1}s forwards` }}
                          >
                            {(() => {
                              const MAX = 16;
                              const tokens = (axis.label || '').trim().split(/\s+/);
                              const lines: string[] = [];
                              let current = '';
                              for (const token of tokens) {
                                const candidate = current ? `${current} ${token}` : token;
                                if (candidate.length <= MAX) current = candidate;
                                else {
                                  if (current) lines.push(current);
                                  current = token.length > MAX ? token.slice(0, MAX) : token;
                                }
                              }
                              if (current) lines.push(current);
                              const stepEm = 1.1;
                              const firstDy = -((lines.length - 1) / 2) * stepEm;
                              const xPos = axis.x + (axis.x - 200) * 0.45;
                              return lines.map((line, li) => (
                                <tspan key={li} x={xPos} dy={`${li === 0 ? firstDy : stepEm}em`}>{line}</tspan>
                              ));
                            })()}
                          </text>
                        </g>
                      ))}
                    </g>

                    {/* Data lines + points */}
                    {dataPoints.map((point, index) => (
                      <g key={index}>
                        <line
                          className="fill-none stroke-[rgba(120,119,198,0.8)] stroke-[3]"
                          x1="200" y1="200" x2={point.x} y2={point.y}
                          style={{
                            strokeDasharray: `${Math.hypot(point.x - 200, point.y - 200)}`,
                            strokeDashoffset: `${Math.hypot(point.x - 200, point.y - 200)}`,
                            animation: `gg-grow-data-line 0.8s ease-out ${1 + index * 0.15}s forwards`
                          }}
                        />
                        {point.value >= 10 && (
                          <circle
                            className="origin-center fill-[rgba(120,119,198,1)] stroke-white stroke-2"
                            cx={point.x} cy={point.y} r="6"
                            style={{ opacity: 0, transform: 'scale(0)', animation: `gg-draw-point 0.4s ease-out ${1.5 + index * 0.15}s forwards` }}
                          />
                        )}
                        {point.value >= 10 && (
                          <text
                            className="fill-black text-[10px] font-semibold max-sm:text-[9px]"
                            x={point.x} y={point.y - 15} textAnchor="middle"
                            style={{ opacity: 0, animation: `gg-fade-in 0.3s ease-out ${1.7 + index * 0.15}s forwards` }}
                          >
                            {point.value}%
                          </text>
                        )}
                      </g>
                    ))}

                    <polygon
                      className="fill-[rgba(120,119,198,0.2)] stroke-[rgba(120,119,198,0.6)] stroke-1"
                      points={polygon}
                      style={{ opacity: 0, animation: 'gg-fade-in-polygon 0.8s ease-out 2.5s forwards' }}
                    />
                  </svg>
                </div>
              </>
            );
          })()}

          {(() => {
            const topics = getTopicsForLevel(level).map((t: { Title: string }) => t.Title);
            const chartPageSize = Math.ceil(topics.length / 3);
            const totalPages = chartPageSize > 0 ? Math.ceil(topics.length / chartPageSize) : 0;
            const showNav = totalPages > 1;
            const pct = topics.length > 0
              ? Math.round(topics.reduce((sum: number, t: string) => sum + (performanceData[t] || 0), 0) / topics.length)
              : 0;

            return (
              <div className={cx(
                'gg-glow-border-muted relative mx-auto flex w-full max-w-[600px] items-center justify-center overflow-hidden rounded-[14px] border border-black/15 bg-[rgba(248,248,248,0.85)] p-4 px-5 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.08),0_4px_6px_-2px_rgba(0,0,0,0.04)] backdrop-blur-[10px] max-sm:mt-11 max-sm:mb-[calc(20px+env(safe-area-inset-bottom,10px))] max-sm:min-h-[75px] max-sm:px-4 max-sm:py-3',
                showNav && 'justify-between px-3.5 py-[13px]',
              )}>
                {showNav && (
                  <button
                    className="relative z-[2] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/15 bg-transparent text-black shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-[border-color,color,box-shadow] duration-200 hover:border-black/35 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-30 touch-manipulation [-webkit-tap-highlight-color:transparent]"
                    onClick={() => setChartPage(p => Math.max(0, p - 1))}
                    disabled={chartPage === 0}
                    aria-label="Previous chart"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}
                <div className={cx('relative z-[1] max-w-full text-center text-sm leading-normal font-bold break-words text-[#333]', showNav && 'min-w-0 flex-1 text-center')}>
                  {topics.length > 0 && (
                    <TotalProgressText key={`${level}-${pct}`} percent={pct} />
                  )}
                </div>
                {showNav && (
                  <button
                    className="relative z-[2] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/15 bg-transparent text-black shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-[border-color,color,box-shadow] duration-200 hover:border-black/35 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-30 touch-manipulation [-webkit-tap-highlight-color:transparent]"
                    onClick={() => setChartPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={chartPage === totalPages - 1}
                    aria-label="Next chart"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </>
  );
};
