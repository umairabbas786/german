// langeylistening.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import './langeylistening.css';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { ExercisesTemplate } from './ExercisesTemplate';
import { CreditLimitBlock } from './CreditLimitBlock';
import { translateGermanToEnglish } from '../utils/googleTranslate';
import { stopHtmlAudio } from '../utils/audioLifecycle';
import { TypewriterText as TypeWriter } from './shared/TypewriterText';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import { toTemplateType, type ListeningExerciseType } from '../features/exercises/comprehension';
import type { FullscreenModuleProps, PracticeMode } from '../features/learning/moduleTypes';
import { generateListeningExercise as requestListeningExercise, getListeningAudioUrl, recordListeningPerformance, retrieveListeningPerformance } from '../services/learningApi';
import { buildSpiderData } from '../features/stats/spiderChart';
import { TotalProgressText } from './stats/TotalProgressText';
import type { ComprehensionExercise, ExerciseAnswer, ExerciseAnswers, MultipleChoiceQuestion } from '../features/exercises/comprehensionPayload';
import { normalizeAnswer, solutionVariants } from '../features/exercises/comprehensionPayload';
import type { TopicsByLevel } from '../features/learning/moduleTypes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - allow JSON import
import levelTopicsData from '../../data/all_listening_topics.json';

export interface LangeyListeningProps extends FullscreenModuleProps {
  mode: PracticeMode;
  isActive?: boolean;
}

// ─── Audio Player Component ──────────────────────────────────────────────────
function AudioPlayer({ src, isMobile, isActive }: { src: string; isMobile: boolean; isActive: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  useEffect(() => {
    if (!isActive) {
      stopHtmlAudio(audioRef.current);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isActive]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);



  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeLeft = duration > 0 ? duration - currentTime : 0;

  // State for real waveform data
  const [waveform, setWaveform] = useState<number[]>([]);

  // Generate real waveform from audio data
  useEffect(() => {
    if (!src) return;
    const count = isMobile ? 50 : 150;
    
    // 1. Initialize as flat line first to prevent flicker
    setWaveform(Array(count).fill(4));

    const analyzeAudio = async () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        // Fallback to randomized but grow it slightly after mount
        setTimeout(() => {
          setWaveform(Array.from({ length: count }, (_, i) => 
            10 + Math.sin(i * 0.15) * 7 + Math.random() * 8
          ));
        }, 50);
        return;
      }
      
      const audioContext = new AudioContextClass();
      
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to fetch audio");
        const arrayBuffer = await response.arrayBuffer();
        
        audioContext.decodeAudioData(arrayBuffer, (buffer) => {
          const channelData = buffer.getChannelData(0);
          const samplesPerBar = Math.floor(channelData.length / count);
          const peaks = [];

          for (let i = 0; i < count; i++) {
            let max = 0;
            const start = i * samplesPerBar;
            for (let j = 0; j < samplesPerBar; j++) {
              const peak = Math.abs(channelData[start + j]);
              if (peak > max) max = peak;
            }
            peaks.push(max);
          }

          const highestPeak = Math.max(...peaks) || 1;
          const normalized = peaks.map(p => {
            const h = (p / highestPeak) * 24 + 4;
            return Math.min(28, h);
          });
          
          // Small timeout to ensure the "flat" state was rendered first
          setTimeout(() => {
            setWaveform(normalized);
          }, 50);
          audioContext.close();
        }, (err) => {
          console.warn("Waveform decoding failed:", err);
          // Fallback growth
          setTimeout(() => {
             setWaveform(Array.from({ length: count }, (_, i) => 
              10 + Math.sin(i * 0.15) * 7 + Math.random() * 8
            ));
          }, 50);
          audioContext.close();
        });
      } catch (err) {
        console.warn("Waveform analysis error:", err);
        // Fallback growth
        setTimeout(() => {
           setWaveform(Array.from({ length: count }, (_, i) => 
            10 + Math.sin(i * 0.15) * 7 + Math.random() * 8
          ));
        }, 50);
        audioContext.close();
      }
    };

    analyzeAudio();
  }, [src, isMobile]);

  const barHeights = waveform;

  return (
    <div className="ll-audio-player">


      {/* Play / Pause */}
      <button className="ll-audio-play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Waveform + progress */}
      <div
        className="ll-audio-waveform-container"
        ref={progressBarRef}
        onClick={handleProgressClick}
        role="application"
        aria-label="Audio waveform progress"
      >

        <div className="ll-audio-waveform">
          {barHeights.map((h, i) => {
            const barPosition = ((i + 0.5) / barHeights.length) * 100;
            const isPast = barPosition <= progress;
            return (
              <div
                key={i}
                className={`ll-audio-bar ${isPast ? 'll-audio-bar-active' : ''}`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        {/* Progress line */}
        <div className="ll-audio-progress-line" style={{ width: `${progress}%` }} />
      </div>



      {/* Time left */}
      <span className="ll-audio-time">{formatTime(timeLeft)}</span>
    </div>
  );
}

export const LangeyListening: React.FC<LangeyListeningProps> = ({
  level,
  mode,
  onFullscreenChange,
  onProgressUpdate,
  isActive = true,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('None');
  const [isLoading, setIsLoading] = useState(false);
  const [currentExerciseType, setCurrentExerciseType] = useState<ListeningExerciseType>('FILL_IN_THE_BLANK_LISTENING');
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

  const defaultMsg = 'Select a listening topic and click Practice to start an exercise.';

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
    if (location.pathname !== '/listening') return;
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
      const resp = await retrieveListeningPerformance({ consumer_id: consumerId, listening_level: lvl });
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

  const getCurrentExercise = () => window.__CURRENT_LISTENING_EXERCISE__;

  const resetExerciseState = () => {
    setCurrentExerciseType('FILL_IN_THE_BLANK_LISTENING');
    setCurrentInstruction('');
    setExerciseAnswers({});
    setSubmitted(false);
    setSubmissionResult(null);
    setIsShowingExercise(false);
    setLlmBoxText('');
    window.__CURRENT_LISTENING_EXERCISE__ = undefined;
  };

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    resetExerciseState();
    setLlmBoxText(defaultMsg);
  };

  const initializeAnswers = (type: ListeningExerciseType, ex: ComprehensionExercise) => {
    switch (type) {
      case 'FILL_IN_THE_BLANK_LISTENING':
        setExerciseAnswers(Array(ex.exercises?.length || 5).fill(''));
        break;
      case 'TRUE_FALSE_LISTENING':
        setExerciseAnswers(Array(ex.statements?.length || 5).fill(undefined));
        break;
      case 'MULTIPLE_CHOICE_LISTENING':
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
      const resp = await requestListeningExercise({ level, topic_title: topic, consumer_id: consumerId, version: 'v2' });
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
      const exType: ListeningExerciseType = ex.type || 'FILL_IN_THE_BLANK_LISTENING';
      setCurrentExerciseType(exType);

      // Enhance instruction with format in brackets
      let instr = ex.instruction || 'Listen to the audio and answer the questions.';
      if (ex.format) {
        const formatMap: Record<string, string> = {
          'short_story': 'Short Story',
          'dialogue': 'Dialogue',
          'announcement': 'Announcement'
        };
        const label = formatMap[ex.format] || ex.format.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        // Inject (Label) after the word "audio" or "Audio"
        instr = instr.replace(/([aA]udio)/, `$1 (${label})`);
      }
      
      setCurrentInstruction(instr);
      window.__CURRENT_LISTENING_EXERCISE__ = ex;
      initializeAnswers(exType, ex);
      setIsShowingExercise(true);
      setLlmBoxText(`Exercise loaded! Listen to the ${ex.format?.replace('_', ' ') || 'audio'}, answer the questions and click Submit to check your answers, or Vocabulary for word meanings.`);

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
      case 'FILL_IN_THE_BLANK_LISTENING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => typeof v === 'string' && v.trim().length > 0);
      case 'TRUE_FALSE_LISTENING':
        return Array.isArray(exerciseAnswers) && exerciseAnswers.some((v) => v === true || v === false);
      case 'MULTIPLE_CHOICE_LISTENING':
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
      case 'FILL_IN_THE_BLANK_LISTENING': {
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
      case 'TRUE_FALSE_LISTENING': {
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
      case 'MULTIPLE_CHOICE_LISTENING': {
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
        const label = currentExerciseType === 'TRUE_FALSE_LISTENING' ? `Statement ${i + 1}` : `Q${i + 1}`;
        const isIncorrect = incorrectItems.includes(label);
        if (isIncorrect) {
          if (currentExerciseType === 'FILL_IN_THE_BLANK_LISTENING') {
            incorrectAnswersList.push(`${i + 1}. ${displaySolution(sol)}`);
          } else if (currentExerciseType === 'TRUE_FALSE_LISTENING') {
            incorrectAnswersList.push(`${i + 1}. ${sol ? 'True' : 'False'}`);
          } else if (currentExerciseType === 'MULTIPLE_CHOICE_LISTENING') {
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
      const passage = ex.passage || '';
      const templateName = ex._metadata?.template_name || currentExerciseType;
      const index = ex._metadata?.index || '';
      const questionHash = btoa(passage + templateName + index + topic).replace(/[+/=]/g, '');
      const lastHash = localStorage.getItem('latest_listening_question_hash');
      if (questionHash !== lastHash) {
        localStorage.setItem('latest_listening_question_hash', questionHash);
        (async () => {
          try {
            const consumerId = UserTracker.getOrCreateConsumerId();
            await recordListeningPerformance({
                consumer_id: consumerId,
                listening_topic: topic,
                listening_level: level,
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
      case 'FILL_IN_THE_BLANK_LISTENING':
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
      case 'TRUE_FALSE_LISTENING':
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
      case 'MULTIPLE_CHOICE_LISTENING':
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

  // ─── Build audio URL ──────────────────────────────────────────────────────────
  const getAudioUrl = () => {
    const ex = getCurrentExercise();
    if (!ex) return '';
    const templateName = ex.type || currentExerciseType;
    const index = ex.index || ex._metadata?.index || 1;
    // topic title -> lowercase, replace spaces with _, replace & with &
    const topicSlug = topic.toLowerCase().replace(/\s+/g, '_');
    // Template: e.g. FILL_IN_THE_BLANK_LISTENING -> fill_in_the_blank_listening
    const templateSlug = templateName.toLowerCase();
    const filename = `${topicSlug}_${templateSlug}_${index}.mp3`;
    return getListeningAudioUrl(level, filename);
  };

  // ─── Spider chart ───────────────────────────────────────────────────────────
  // ─── Selector list shared between desktop dropdown and mobile bottom sheet ──
  const renderTopicList = (close: () => void) => (
    <ul className="ll-topic-list" role="listbox">
      <li
        className={`ll-topic-item ${topic === 'None' ? 'selected' : ''}`}
        onClick={() => { handleTopicChange('None'); close(); }}
      >
        <div className="ll-topic-ring">
          <svg width="32" height="32">
            <circle cx="16" cy="16" r="12" className="ll-ring-track" />
            <circle cx="16" cy="16" r="12" className="ll-ring-progress"
              style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${2 * Math.PI * 12}` }} />
          </svg>
          <span className="ll-step">0</span>
        </div>
        <span className="ll-topic-title">None</span>
      </li>
      {getTopicsForLevel(level).map((t, idx) => {
        const title = t.Title;
        const progress = Math.max(0, Math.min(100, performanceData[title] || 0));
        const visibleProgress = progress >= 10 ? progress : 0;
        const circ = 2 * Math.PI * 12;
        const offset = (1 - visibleProgress / 100) * circ;
        return (
          <li
            key={title}
            className={`ll-topic-item ${topic === title ? 'selected' : ''}`}
            onClick={() => { handleTopicChange(title); close(); }}
          >
            <div className="ll-topic-ring">
              <svg width="32" height="32">
                <circle cx="16" cy="16" r="12" className="ll-ring-track" />
                <circle cx="16" cy="16" r="12" className="ll-ring-progress"
                  style={{ strokeDasharray: `${circ}`, strokeDashoffset: `${offset}` }} />
              </svg>
              <span className="ll-step">{idx + 1}</span>
            </div>
            <span className="ll-topic-title">{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
          </li>
        );
      })}
    </ul>
  );

  // ─── PRACTICE view ──────────────────────────────────────────────────────────
  if (mode === 'PRACTICE') {
    const ex = getCurrentExercise();
    const audioUrl = getAudioUrl();

    return (
      <>
        {isFullscreen && (
          <button className="ll-fullscreen-close" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className={`german-listening-container ${isFullscreen ? 'fullscreen-mode' : ''}`}>
          <div className="ll-practice">
            {/* Header */}
            <div className="ll-practice-header">
              <div className="ll-field-left">
                <h1 className="ll-label">Listening</h1>

                <div className="ll-custom-selector" ref={selectorRef}>
                  <button
                    type="button"
                    className="ll-selector-trigger"
                    onClick={() => setIsSelectorOpen(v => !v)}
                  >
                    {topic === 'None' ? 'Select topic' : (topic.length > 40 ? topic.substring(0, 44) + '...' : topic)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isSelectorOpen && !isMobileView && (
                    <div className="ll-dropdown-panel">
                      {renderTopicList(() => setIsSelectorOpen(false))}
                    </div>
                  )}

                  {isSelectorOpen && isMobileView && (
                    <>
                      <div className="ll-sheet-overlay" onClick={() => setIsSelectorOpen(false)} />
                      <div className="ll-bottom-sheet">
                        <div className="ll-sheet-header">
                          <span className="ll-sheet-title">Select topic</span>
                          <button className="ll-sheet-close" onClick={() => setIsSelectorOpen(false)}>
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

              <div className="ll-action-buttons">
                <button
                  className="ll-action-btn"
                  onClick={handleButton1}
                  disabled={topic === 'None' || isBlocked}
                >
                  {getButton1Label()}
                </button>
                <button
                  className="ll-action-btn ll-vocab-btn"
                  onClick={handleVocabulary}
                  disabled={!ex || !isShowingExercise || isBlocked}
                >
                  Vocabulary
                </button>
                <button
                  className="ll-action-btn ll-fullscreen-btn"
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
            <div className={`ll-exercise-box ${isFullscreen ? 'll-exercise-box-fullscreen' : ''}`}>
              {isBlocked ? (
                <CreditLimitBlock message={limitMessage} />
              ) : isLoading ? (
                <div className="ll-loading"><div className="ll-spinner" /></div>
              ) : isShowingExercise && ex ? (
                <>
                  {/* Instruction (purple box) */}
                  {currentInstruction && (
                    <div className="et-exercise-title">
                      {currentInstruction}
                    </div>
                  )}
                  {/* Audio player instead of passage */}
                  {audioUrl && (
                    <div className="ll-audio-block">
                      <AudioPlayer src={audioUrl} isMobile={isMobileView} isActive={isActive} />
                    </div>
                  )}
                  {/* Exercise questions */}
                  <ExercisesTemplate {...getExerciseTemplateProps()} title="" />
                </>
              ) : (
                <div className="ll-empty-state"><p>{defaultMsg}</p></div>
              )}
            </div>

            {/* Hint bar — shows LLM text or instruction */}
            <div className="ll-hint-bar">
              <div className="ll-hint-content">
                {isBlocked ? (
                  <span className="gg-limit-hint">Tap Upgrade to Pro above to continue</span>
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
    <div className="ll-stats">
      <div className="ll-spider-wrapper">
        <svg key={level} className="ll-spider-chart" viewBox="0 0 400 400">
          <g>
            {[1, 2, 3, 4, 5].map(ring => {
              const R = 140 * (ring / 5);
              const pts: string[] = [];
              for (let i = 0; i < chartTopics.length; i++) {
                const angle = (360 / chartTopics.length) * i - 90;
                const rad = (angle * Math.PI) / 180;
                pts.push(`${200 + Math.cos(rad) * R},${200 + Math.sin(rad) * R}`);
              }
              return <polygon key={ring} className="ll-grid-line" points={pts.join(' ')} />;
            })}

            {axisPoints.map((axis, i) => (
              <g key={i}>
                <line
                  className="ll-axis-line"
                  x1="200" y1="200" x2={axis.x} y2={axis.y}
                  style={{
                    strokeDasharray: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                    strokeDashoffset: `${Math.hypot(axis.x - 200, axis.y - 200)}`,
                    animation: `ll-growLine 1s ease-out ${i * 0.08}s forwards`
                  }}
                />
                <text
                  className="ll-axis-label"
                  x={axis.x + (axis.x - 200) * 0.15}
                  y={axis.y + (axis.y - 200) * 0.35}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ opacity: 0, animation: `ll-fadeIn 0.5s ease-out ${0.6 + i * 0.08}s forwards` }}
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
                className="ll-data-line"
                x1="200" y1="200" x2={point.x} y2={point.y}
                style={{
                  strokeDasharray: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  strokeDashoffset: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  animation: `ll-growDataLine 0.8s ease-out ${0.8 + i * 0.1}s forwards`
                }}
              />
              {point.value >= 10 && (
                <circle
                  className="ll-data-point"
                  cx={point.x} cy={point.y} r="5"
                  style={{ opacity: 0, transform: 'scale(0)', animation: `ll-drawPoint 0.4s ease-out ${1.2 + i * 0.1}s forwards` }}
                />
              )}
              {point.value >= 10 && (
                <text
                  className="ll-data-value"
                  x={point.x} y={point.y - 12} textAnchor="middle"
                  style={{ opacity: 0, animation: `ll-fadeIn 0.3s ease-out ${1.5 + i * 0.1}s forwards` }}
                >
                  {point.value}%
                </text>
              )}
            </g>
          ))}

          <polygon
            className="ll-data-polygon"
            points={polygon}
            style={{ opacity: 0, animation: 'll-fadeInPolygon 0.8s ease-out 2s forwards' }}
          />
        </svg>
      </div>

      <div className="ll-stats-hint-bar">
        <div className="ll-hint-content">
          {chartTopics.length > 0 && <TotalProgressText key={`${level}-${avgScore}`} percent={avgScore} />}
        </div>
      </div>
    </div>
  );
};
