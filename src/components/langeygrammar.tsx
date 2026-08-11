// langeygrammar.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import './langeygrammar.css';
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
      out += '<table class="gg-lecture-table"><thead><tr>';
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
        <button className="gg-fullscreen-close" onClick={toggleFullscreen} title="Exit fullscreen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {mode === 'LEARN' ? (
        <div className="gg-practice gg-grammar-practice">
          <div className="gg-practice-header">
            <div className="gg-field-left">
              <h1 className="gg-label">Grammar</h1>
              <div className="gg-custom-selector" ref={selectorRef}>
                <button
                  type="button"
                  className="gg-selector-trigger"
                  onClick={() => setIsSelectorOpen((v) => !v)}
                >
                  {topic === 'None' ? 'Select topic' : (topic.length > 40 ? topic.substring(0, 44) + '...' : topic)}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isSelectorOpen && !isMobileView && (
                  <div className="gg-dropdown-panel">
                    <ul className="gg-topic-list" role="listbox" aria-label="Grammar topics">
                      <li
                        className={`gg-topic-item ${topic === 'None' ? 'selected' : ''}`}
                        role="option"
                        aria-selected={topic === 'None'}
                        onClick={() => {
                          handleTopicChange('None');
                          setIsSelectorOpen(false);
                        }}
                      >
                        <div className="gg-topic-ring">
                          <svg width="32" height="32">
                            <circle cx="16" cy="16" r="12" className="gg-ring-track" />
                            <circle cx="16" cy="16" r="12" className="gg-ring-progress" style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${(1 - 0 / 100) * 2 * Math.PI * 12}` }} />
                          </svg>
                          <span className="gg-step">0</span>
                        </div>
                        <span className="gg-topic-title">None</span>
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
                            className={`gg-topic-item ${topic === title ? 'selected' : ''}`}
                            role="option"
                            aria-selected={topic === title}
                            onClick={() => {
                              handleTopicChange(title);
                              setIsSelectorOpen(false);
                            }}
                          >
                            <div className="gg-topic-ring">
                              <svg width="32" height="32">
                                <circle cx="16" cy="16" r="12" className="gg-ring-track" />
                                <circle cx="16" cy="16" r="12" className="gg-ring-progress" style={{ strokeDasharray: `${circumference}`, strokeDashoffset: `${offset}` }} />
                              </svg>
                              <span className="gg-step">{idx + 1}</span>
                            </div>
                            <span className="gg-topic-title">{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {isSelectorOpen && isMobileView && (
                  <>
                    <div className="gg-sheet-overlay" onClick={() => setIsSelectorOpen(false)} />
                    <div className="gg-bottom-sheet" role="dialog" aria-label="Select grammar topic">
                      <div className="gg-sheet-header">
                        <div className="gg-sheet-title">Select topic</div>
                        <button className="gg-sheet-close" onClick={() => setIsSelectorOpen(false)} aria-label="Close">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <ul className="gg-topic-list" role="listbox" aria-label="Grammar topics">
                        <li
                          className={`gg-topic-item ${topic === 'None' ? 'selected' : ''}`}
                          role="option"
                          aria-selected={topic === 'None'}
                          onClick={() => {
                            handleTopicChange('None');
                            setIsSelectorOpen(false);
                          }}
                        >
                          <div className="gg-topic-ring">
                            <svg width="32" height="32">
                              <circle cx="16" cy="16" r="12" className="gg-ring-track" />
                              <circle cx="16" cy="16" r="12" className="gg-ring-progress" style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${(1 - 0 / 100) * 2 * Math.PI * 12}` }} />
                            </svg>
                            <span className="gg-step">0</span>
                          </div>
                          <span className="gg-topic-title">None</span>
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
                              className={`gg-topic-item ${topic === title ? 'selected' : ''}`}
                              role="option"
                              aria-selected={topic === title}
                              onClick={() => {
                                handleTopicChange(title);
                                setIsSelectorOpen(false);
                              }}
                            >
                              <div className="gg-topic-ring">
                                <svg width="32" height="32">
                                  <circle cx="16" cy="16" r="12" className="gg-ring-track" />
                                  <circle cx="16" cy="16" r="12" className="gg-ring-progress" style={{ strokeDasharray: `${circumference}`, strokeDashoffset: `${offset}` }} />
                                </svg>
                                <span className="gg-step">{idx + 1}</span>
                              </div>
                              <span className="gg-topic-title">{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="gg-action-buttons">
              <button
                className="gg-action-btn"
                onClick={handleButton1}
                disabled={topic === 'None' || isBlocked}
              >
                {getButton1Label()}
              </button>
              <button
                className="gg-action-btn"
                onClick={handleLearn}
                disabled={topic === 'None' || isBlocked}
              >
                Learn
              </button>
              <button
                className="gg-action-btn gg-help-btn"
                onClick={getHelp}
                disabled={!hasExercises() || isBlocked}
              >
                Help
              </button>
              <button
                className="gg-action-btn gg-fullscreen-btn"
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

          <div className={`gg-exercise-box ${isFullscreen ? 'gg-exercise-box-fullscreen' : ''} ${isLectureVisible && !isShowingExercise ? (isLectureExpanded ? 'gg-lecture-expanded' : '') : ''}`}>
            {isBlocked ? (
              <CreditLimitBlock message={limitMessage} />
            ) : isLoading ? (
              <div className="gg-loading"><div className="gg-spinner" /></div>
            ) : (hasExercises() && isShowingExercise) ? (
              <ExercisesTemplate {...getExerciseTemplateProps()} title={currentExerciseTitle} onTranslate={handleTranslate} />
            ) : isLectureVisible && topic !== 'None' ? (
              <div className="gg-lecture-content" dangerouslySetInnerHTML={{ __html: mdToHtml(lectureMarkdown) }} />
            ) : topic === 'None' ? (
              <div className="gg-empty-state">
                <p>{defaultLearnMsg}</p>
              </div>
            ) : (
              <div className="gg-empty-state">
                <p>{selectedTopicMsg}</p>
              </div>
            )}
          </div>

          <div className="gg-hint-bar">
            <div className="gg-hint-content">
              {isBlocked ? (
                <span className="gg-limit-hint">Tap Upgrade to Pro above to continue</span>
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
        <div className="gg-stats">
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
                <div className="gg-spider-wrapper">
                  <svg key={`${level}-${chartPage}`} className="gg-spider-chart" viewBox="0 0 400 400">
                    {/* Grid rings */}
                    <g className="gg-spider-grid">
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
                        return <polygon key={ring} className="gg-grid-line" points={pts.join(' ')} />;
                      })}

                      {/* Axes + labels */}
                      {axisPoints.map((axis, index) => (
                        <g key={index}>
                          <line
                            className="gg-axis-line"
                            x1="200" y1="200" x2={axis.x} y2={axis.y}
                            style={{
                              strokeDasharray: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                              strokeDashoffset: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                              animation: `growLine 1s ease-out ${index * 0.1}s forwards`
                            }}
                          />
                          <text
                            className="gg-axis-label"
                            x={axis.x + (axis.x - 200) * 0.15}
                            y={axis.y + (axis.y - 200) * 0.35}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ opacity: 0, animation: `fadeIn 0.5s ease-out ${0.8 + index * 0.1}s forwards` }}
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
                          className="gg-data-line"
                          x1="200" y1="200" x2={point.x} y2={point.y}
                          style={{
                            strokeDasharray: `${Math.hypot(point.x - 200, point.y - 200)}`,
                            strokeDashoffset: `${Math.hypot(point.x - 200, point.y - 200)}`,
                            animation: `growDataLine 0.8s ease-out ${1 + index * 0.15}s forwards`
                          }}
                        />
                        {point.value >= 10 && (
                          <circle
                            className="gg-data-point"
                            cx={point.x} cy={point.y} r="6"
                            style={{ opacity: 0, transform: 'scale(0)', animation: `drawPoint 0.4s ease-out ${1.5 + index * 0.15}s forwards` }}
                          />
                        )}
                        {point.value >= 10 && (
                          <text
                            className="gg-data-value"
                            x={point.x} y={point.y - 15} textAnchor="middle"
                            style={{ opacity: 0, animation: `fadeIn 0.3s ease-out ${1.7 + index * 0.15}s forwards` }}
                          >
                            {point.value}%
                          </text>
                        )}
                      </g>
                    ))}

                    <polygon
                      className="gg-data-polygon"
                      points={polygon}
                      style={{ opacity: 0, animation: 'fadeInPolygon 0.8s ease-out 2.5s forwards' }}
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
              <div className={`gg-stats-hint-bar${showNav ? ' gg-stats-hint-bar--with-nav' : ''}`}>
                {showNav && (
                  <button
                    className="gg-spider-nav-btn"
                    onClick={() => setChartPage(p => Math.max(0, p - 1))}
                    disabled={chartPage === 0}
                    aria-label="Previous chart"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}
                <div className="gg-hint-content">
                  {topics.length > 0 && (
                    <TotalProgressText key={`${level}-${pct}`} percent={pct} />
                  )}
                </div>
                {showNav && (
                  <button
                    className="gg-spider-nav-btn"
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
