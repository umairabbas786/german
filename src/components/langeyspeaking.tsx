// langeyspeaking.tsx
// Updated UI logic
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './langeyspeaking.animations.css';
import { translateGermanToEnglish } from '../utils/googleTranslate';
import { useVoiceAgent } from '../hooks/useVoiceAgent';
import { CreditLimitBlock } from './CreditLimitBlock';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import type { GermanLevel, GrammarTopicsByLevel, PracticeMode, RoadmapModuleProps } from '../features/learning/moduleTypes';
import { SpeakingProgressRing } from './speaking/SpeakingProgressRing';
import { SpeakingTypewriter as TypeWriter } from './speaking/SpeakingTypewriter';
import { getSpeakingStats } from '../services/learningApi';
import { API_URL } from '../services/api';
import { UserTracker } from '../utils/userTracking';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - allow JSON import
import levelTopicsData from '../../data/all_grammar_topics.json';

const cx = (...classes: Array<string | false | undefined | null>) => classes.filter(Boolean).join(' ');

const PRACTICE_ROOT = cx(
  'flex min-h-[calc(100vh-150px)] min-h-[calc(100dvh-150px)] flex-col items-center justify-center p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]',
  'max-lg:h-[calc(100dvh-54px)] max-lg:min-h-[calc(100dvh-54px)] max-lg:w-full max-lg:max-w-none max-lg:items-stretch max-lg:justify-start max-lg:gap-0 max-lg:overflow-hidden max-lg:p-0',
);

const PRACTICE_STATS_ROOT = cx(
  PRACTICE_ROOT,
  'gap-6',
  'max-lg:box-border max-lg:!h-[calc(100dvh-54px)] max-lg:!min-h-[calc(100dvh-54px)] max-lg:!items-center max-lg:!justify-center max-lg:!gap-0 max-lg:!pb-[calc(100px+env(safe-area-inset-bottom,0px))]',
);

const PRACTICE_HEADER = cx(
  'mb-6 flex w-full max-w-[800px] items-end justify-between gap-5',
  'max-lg:mb-0 max-lg:block max-lg:max-w-none max-lg:flex-none max-lg:bg-transparent max-lg:p-4 max-lg:px-5 max-lg:pt-4 max-lg:pb-1',
  'max-sm:flex-col max-sm:items-stretch max-sm:gap-4',
);

const ACTION_BTN = cx(
  'flex h-[38px] min-w-[90px] flex-[1_1_0px] cursor-pointer items-center justify-center rounded-[10px] border border-black/20',
  'bg-gradient-to-br from-black to-[#333] px-[18px] text-sm font-medium text-white',
  'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-[4px] transition-all duration-300',
  'enabled:hover:-translate-y-px enabled:hover:from-[#333] enabled:hover:to-[#555]',
  'enabled:hover:shadow-[0_6px_10px_-1px_rgba(0,0,0,0.15),0_4px_6px_-1px_rgba(0,0,0,0.1)]',
  'enabled:active:translate-y-0 enabled:active:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.06)]',
  'disabled:cursor-not-allowed disabled:border disabled:border-black/10 disabled:bg-black/15 disabled:text-black/40',
  'disabled:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)]',
  '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:transition-transform [&_svg]:duration-200',
  'max-lg:!h-auto max-lg:!min-h-[46px] max-lg:!w-0 max-lg:!min-w-0 max-lg:flex-[1_1_0%] max-lg:!rounded-xl max-lg:!border-[#eee] max-lg:!bg-white max-lg:!px-2.5 max-lg:!py-3 max-lg:!text-sm max-lg:!font-medium max-lg:!text-[#333] max-lg:!shadow-none max-lg:enabled:hover:!translate-y-0',
  'max-lg:disabled:!border-black/10 max-lg:disabled:!bg-black/15 max-lg:disabled:!text-black/40',
  'max-sm:min-w-[80px] max-sm:flex-1 max-sm:px-3.5 max-sm:text-[13px]',
);

const HELP_BTN = cx(
  ACTION_BTN,
  'speaking-glow-border speaking-help-btn-mobile relative gap-1.5 !border-black/15 !bg-[rgba(248,248,248,0.9)] !text-black/80 backdrop-blur-[12px]',
  'enabled:hover:!bg-[rgba(248,248,248,0.95)]',
  'disabled:!border-black/15 disabled:!bg-[rgba(248,248,248,0.9)] disabled:!text-black/30 disabled:!opacity-100',
  'disabled:!shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]',
  'max-lg:!border-transparent max-lg:!bg-gradient-to-r max-lg:!from-[#e2bea9] max-lg:!to-[#b8b0d3] max-lg:!text-black max-lg:enabled:hover:!bg-gradient-to-r max-lg:enabled:hover:!from-[#e2bea9] max-lg:enabled:hover:!to-[#b8b0d3]',
);

const EXERCISE_BOX = cx(
  'relative mb-5 flex h-[400px] w-full max-w-[800px] flex-col overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-6',
  'shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] backdrop-blur-[12px] transition-all duration-300',
  'max-lg:mb-0 max-lg:h-auto max-lg:min-h-0 max-lg:max-w-none max-lg:flex-[1_1_auto] max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-2.5 max-lg:pt-2.5 max-lg:pb-5 max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-sm:mb-4 max-sm:h-[350px] max-sm:p-4',
);

const HINT_BAR = cx(
  'speaking-hint-glow speaking-hint-glow-mobile relative flex w-full max-w-[800px] min-h-[80px] items-center justify-center overflow-hidden',
  'rounded-2xl border border-black/15 bg-[rgba(248,248,248,0.9)] p-4 px-5',
  'shadow-[0_8px_20px_-5px_rgba(0,0,0,0.1),0_6px_8px_-5px_rgba(0,0,0,0.04)] backdrop-blur-[12px]',
  'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[420] max-lg:max-w-none',
  'max-lg:min-h-[calc(100px+env(safe-area-inset-bottom,0px))] max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-6 max-lg:px-8 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
);

const HINT_BAR_PRACTICE = cx(
  HINT_BAR,
  'max-lg:relative max-lg:inset-auto max-lg:flex-shrink-0 max-lg:z-auto',
);

const HINT_CONTENT = cx(
  'relative z-[1] max-w-full text-center text-sm leading-normal font-bold break-words whitespace-pre-line text-[#333]',
  'max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:font-normal max-lg:leading-6 max-lg:text-[#1a1a1a]',
);

const EVAL_TAG: Record<EvaluationRow['status'], string> = {
  STRONG: 'bg-[rgba(17,124,77,0.12)] text-[#117c4d]',
  'NEEDS PRACTICE': 'bg-[rgba(196,93,28,0.14)] text-[#a54f18]',
  'NOT USED': 'bg-black/8 text-black/56',
};

const PREDEFINED_SCENARIOS = [
  "Discussing your day with a friend",
  "Discussing finances with spouse",
  "Ordering food at a restaurant",
  "Asking for directions",
  "Job interview practice",
  "Buying a train ticket",
  "Meeting a new neighbor",
  "Making a hotel reservation",
  "Discussing plans for the weekend"
];

const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

interface SpeakingEvaluationCount {
  level: GermanLevel;
  correct_attempt_count: number;
  incorrect_attempt_count: number;
}

type SpeakingEvaluation = Record<string, SpeakingEvaluationCount>;

interface EvaluationRow {
  slug: string;
  label: string;
  correctAttempts: number;
  incorrectAttempts: number;
  status: 'STRONG' | 'NEEDS PRACTICE' | 'NOT USED';
  statusRank: number;
}

interface SpeakingStats {
  total_time_seconds: number;
  target_seconds: number;
  speaking_evaluation: SpeakingEvaluation;
}

export interface LangeySpeakingProps extends RoadmapModuleProps {
  mode?: PracticeMode;
  roadmapTargetMinutes?: number;
  onActiveDurationUpdate?: (percent: number) => void;
  initialProgress?: number;
  isActive?: boolean;
}

interface TranslationPopupProps {
  word: string;
  translation: string;
  position: { top: number; left: number };
  onClose: () => void;
}

function TranslationPopup({ word, translation, position, onClose }: TranslationPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className={cx(
        'speaking-popup-fade-in absolute z-[1000] min-w-[100px] max-w-[250px] -translate-x-1/2 rounded-[10px] border border-black/15 bg-white/[0.98] p-2.5 px-3.5',
        'shadow-[0_8px_20px_-5px_rgba(0,0,0,0.15),0_6px_8px_-5px_rgba(0,0,0,0.1)] backdrop-blur-[12px]',
        'max-sm:min-w-[60px] max-sm:max-w-[120px] max-sm:rounded-md max-sm:p-1 max-sm:px-2',
        'max-sm:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.12),0_3px_6px_-3px_rgba(0,0,0,0.08)]',
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="mb-1 text-xs font-semibold text-black/60 lowercase max-sm:mb-0.5 max-sm:text-base">{word}</div>
      <div className="text-sm leading-snug font-medium text-black max-sm:text-xs max-sm:leading-[1.3]">{translation}</div>
    </div>
  );
}

interface ClickableTextProps {
  text: string;
  className?: string;
  defaultMsg?: string;
  waitingForAiMsg?: string;
}

// Translation cache shared across component instances
const translationCache = new Map<string, string>();
const translationPromises = new Map<string, Promise<string>>();


function ClickableText({ text, className, defaultMsg, waitingForAiMsg }: ClickableTextProps) {
  const [popup, setPopup] = useState<{ word: string; translation: string; position: { top: number; left: number } } | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef(text);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't make words clickable for default/waiting messages
  const isDefaultMessage = text === defaultMsg || text === waitingForAiMsg;

  // Close popup when text changes (new turn), but keep it during streaming (appending)
  useEffect(() => {
    const prev = prevTextRef.current || '';
    if (text !== prev) {
      // If the new text does not start with the old text, it's a replacement/new turn
      if (!text.startsWith(prev)) {
        setPopup(null);
      }
      prevTextRef.current = text;
    }
  }, [text]);

  // Word-by-word animation effect (only for AI messages)
  useEffect(() => {
    // Clear any existing animation
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    // If it's a default message, show immediately without animation
    if (isDefaultMessage) {
      setDisplayedText(text);
      return;
    }

    // Split text into words
    const words = text.split(/(\s+)/); // Keep spaces
    let currentIndex = 0;

    // Start with empty text
    setDisplayedText('');

    const animateNextWord = () => {
      if (currentIndex < words.length) {
        setDisplayedText(words.slice(0, currentIndex + 1).join(''));
        currentIndex++;
        animationTimeoutRef.current = setTimeout(animateNextWord, 100);
      }
    };

    // Start animation
    animateNextWord();

    // Cleanup
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [text, isDefaultMessage]);

  // Split text into words/tokens (words separated by spaces, punctuation included)
  const tokenizeText = (text: string): string[] => {
    // Match words and punctuation separately, preserving spaces
    const tokens: string[] = [];
    const regex = /(\S+|\s+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  };

  // Clean word for translation (remove punctuation)
  const cleanWord = (word: string): string => {
    // eslint-disable-next-line no-useless-escape -- quote is explicit in the character class
    return word.trim().replace(/[.,!?;:()\\[\\]{}'\"]/g, '').toLowerCase();
  };

  const handleWordClick = async (word: string, element: HTMLElement) => {
    const clean = cleanWord(word);
    if (!clean || clean.length === 0) return;

    // If clicking the same word, close popup
    if (popup?.word === clean) {
      setPopup(null);
      return;
    }

    const cachedTranslation = translationCache.get(clean);

    // Calculate position for popup relative to container
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const wordRect = element.getBoundingClientRect();

    // Get first word's position to detect if we're on second line
    const firstWord = containerRef.current.querySelector('[data-speaking-word]');
    const firstWordRect = firstWord?.getBoundingClientRect();
    const lineHeight = firstWordRect?.height || wordRect.height;

    // Check if word is on second line or below (compare relative to container)
    const wordTopRelative = wordRect.top - containerRect.top;
    const firstWordTopRelative = firstWordRect ? firstWordRect.top - containerRect.top : 0;
    const isOnSecondLine = wordTopRelative > firstWordTopRelative + lineHeight * 1.2;

    // Position popup above the first line if word is on second line, otherwise above clicked word
    let popupTop: number;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isOnSecondLine) {
      // Position above first line
      popupTop = isMobile ? -50 : -60;
    } else {
      // Position above clicked word
      popupTop = isMobile ? wordTopRelative - 50 : wordTopRelative - 65; // Move up more on desktop
    }

    // Calculate horizontal position (center popup on word)
    // Since CSS uses transform: translateX(-50%), left should be the center point
    const wordLeftRelative = wordRect.left - containerRect.left;
    const wordCenter = wordLeftRelative + wordRect.width / 2;
    const popupWidth = 120; // Approximate popup width
    // Set left to word center (translateX(-50%) will center it), but keep within bounds
    const popupLeft = Math.max(
      popupWidth / 2 + 10, // Don't go off left edge (account for translateX(-50%))
      Math.min(
        wordCenter, // Center point of the word
        containerRect.width - popupWidth / 2 - 10 // Don't go off right edge
      )
    );

    // Close any existing popup and show new one
    setPopup({
      word: clean,
      translation: cachedTranslation || '-',
      position: {
        top: popupTop,
        left: popupLeft,
      },
    });

    if (cachedTranslation) return;

    let translationPromise = translationPromises.get(clean);
    if (!translationPromise) {
      translationPromise = translateGermanToEnglish(clean)
        .then((translation) => {
          const result = translation || clean;
          translationCache.set(clean, result);
          return result;
        })
        .finally(() => translationPromises.delete(clean));
      translationPromises.set(clean, translationPromise);
    }

    try {
      const translation = await translationPromise;
      setPopup((current) => current?.word === clean
        ? { ...current, translation }
        : current);
    } catch (error) {
      console.error(`Translation error for "${clean}":`, error);
      setPopup((current) => current?.word === clean
        ? { ...current, translation: clean }
        : current);
    }
  };

  const tokens = tokenizeText(displayedText);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {tokens.map((token, index) => {
        const isWord = /\S/.test(token) && !/^\s+$/.test(token);
        if (isWord && !isDefaultMessage) {
          return (
            <span
              key={index}
              data-speaking-word
              className="cursor-pointer underline decoration-black/30 underline-offset-4 transition-all duration-200 hover:rounded-sm hover:bg-[rgba(120,119,198,0.1)] hover:decoration-[rgba(120,119,198,0.6)] max-sm:underline-offset-0.5 max-lg:underline-offset-4"
              onClick={(e) => handleWordClick(token, e.currentTarget)}
            >
              {token}
            </span>
          );
        }
        return <span key={index}>{token}</span>;
      })}
      {popup && (
        <TranslationPopup
          word={popup.word}
          translation={popup.translation}
          position={popup.position}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}


export const LangeySpeaking: React.FC<LangeySpeakingProps> = ({
  level,
  mode = 'PRACTICE',
  openedFromRoadmap = false,
  roadmapItemKey,
  roadmapTopic,
  roadmapTargetMinutes,
  onProgressUpdate,
  onActiveDurationUpdate,
  initialProgress = 0,
  isActive = true,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('None');
  const [customTopic, setCustomTopic] = useState('');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const isMobileView = useIsMobileLayout();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);

  const [suggestion, setSuggestion] = useState('');
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [statsViewIndex, setStatsViewIndex] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [stats, setStats] = useState<SpeakingStats>({
    total_time_seconds: 0,
    target_seconds: 1,
    speaking_evaluation: {},
  });

  // Track initial connection/loading state
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasReceivedAiChunks, setHasReceivedAiChunks] = useState(false);

  const defaultMsg = "Select a scenario and press Start to begin conversation.";
  const waitingForAiMsg = "Press 'Suggest' for input recommendations";
  const isRoadmapMode = openedFromRoadmap && !!roadmapItemKey;
  const roadmapHint = roadmapTargetMinutes ? `Practice for ${roadmapTargetMinutes} minutes` : 'Press Start to begin roadmap speaking.';
  const roadmapTopicLabel = roadmapTopic || customTopic || 'Roadmap Speaking';
  const displayRoadmapTopic = isMobileView && roadmapTopicLabel.length > 40
    ? `${roadmapTopicLabel.substring(0, 48)}...`
    : roadmapTopicLabel;

  const selectorRef = useRef<HTMLDivElement | null>(null);

  // Read scenario from URL params (from Roadmap navigation)
  useEffect(() => {
    const scenarioParam = searchParams.get('scenario');
    if (scenarioParam) {
      setCustomTopic(scenarioParam);
      setTopic('None');
    }
  }, [searchParams]);

  const fetchSpeakingStats = async () => {
    setIsStatsLoading(true);
    try {
      const consumerId = UserTracker.getOrCreateConsumerId();
      const response = await getSpeakingStats(consumerId, level);
      const data = await response.json();
      if (data.success) {
        setStats({
          total_time_seconds: Number(data.total_time_seconds || 0),
          target_seconds: Number(data.target_seconds || 1),
          speaking_evaluation: data.speaking_evaluation || {},
        });
      }
    } catch (error) {
      console.error('Error fetching speaking stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'STATS') fetchSpeakingStats();
  }, [mode, level]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  const {
    aiText,
    isAiSpeaking,
    isAiThinking,
    audioRef,
    startAgent,
    stopAgent,
    setMuted,
    requestSuggestion,
  } = useVoiceAgent(API_URL, {
    onCreditsUpdate: (credits) => setCreditsLeft(credits),
    onLimitReached: (message) => {
      if (isPro) return;
      setCreditsLeft(0, message);
      setIsSessionActive(false);
      setIsConnecting(false);
    },
    onDurationUpdate: (seconds) => {
      if (roadmapTargetMinutes) {
        const progressIncrement = (seconds / (roadmapTargetMinutes * 60)) * 100;
        const currentProgress = Math.min(100, Math.round(initialProgress + progressIncrement));
        onActiveDurationUpdate?.(currentProgress);
      }
    },
    onSuggestion: (text) => {
      setSuggestion(text || "Sorry, couldn't generate a suggestion.");
      setIsGeneratingSuggestion(false);
    },
  });

  const stopAgentRef = useRef(stopAgent);
  stopAgentRef.current = stopAgent;

  useEffect(() => {
    if (!isActive) {
      stopAgentRef.current();
      setIsSessionActive(false);
      setIsConnecting(false);
      setIsMuted(false);
    }
  }, [isActive]);

  useEffect(() => () => stopAgentRef.current(), []);

  // If credits run out (this screen or another), stop any active speaking session
  useEffect(() => {
    if (isBlocked && isSessionActive) {
      stopAgent();
      setIsSessionActive(false);
      setIsConnecting(false);
    }
  }, [isBlocked, isSessionActive, stopAgent]);

  // Timer for 30 minutes limit
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSessionActive) {
      timer = setTimeout(() => {
        handleStop();
        setIsCallEnded(true);
      }, 1800000); // 30 minutes
    }
    return () => clearTimeout(timer);
  }, [isSessionActive]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  // Handle Outside Click for Selector
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (isSelectorOpen && selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isSelectorOpen]);

  // Handle initial loading state and "Press Suggest" logic
  useEffect(() => {
    if (isSessionActive) {
      // If aiText becomes available (and it's not empty), we have received chunks
      if (aiText && aiText.length > 0) {
        if (isConnecting) setIsConnecting(false);
        if (!hasReceivedAiChunks) {
          setHasReceivedAiChunks(true);
          setSuggestion(''); // Clear suggestion when AI chunks start appearing
        }
      }
    } else {
      // Reset when session ends
      setIsConnecting(false);
      setHasReceivedAiChunks(false);
    }
  }, [isSessionActive, aiText, isConnecting, hasReceivedAiChunks]);

  // Clear suggestion when AI starts speaking (audio)
  useEffect(() => {
    if (isAiSpeaking) {
      setSuggestion('');
    }
  }, [isAiSpeaking]);

  const handleStartStop = async () => {
    if (isBlocked) return;
    if (isSessionActive) {
      handleStop();
    } else {
      if (topic === 'None' && !customTopic) return;

      // REQUIRED PATTERN: Unlock audio synchronously on user gesture (iOS Safari/Chrome requirement)
      // The AudioContext will be created fresh inside startAgent, but we need to prime
      // the audio element here (synchronously, before any awaits) so iOS Safari allows playback.
      if (audioRef.current) {
        audioRef.current.onplaying = null;
        audioRef.current.onended = null;
        try {
          audioRef.current.src = SILENT_AUDIO_DATA_URI;
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        } catch (error) {
          console.warn('[useVoiceAgent] Safari audio unlock failed:', error);
        }
      }

      // UI Update - Set isConnecting(true) to show spinner immediately
      setIsConnecting(true);
      setHasReceivedAiChunks(false);

      // Permission - Request microphone access
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.error("Microphone permission denied:", error);
        setIsConnecting(false);
        setIsSessionActive(false);
        alert("We need microphone access to practice speaking! Please check your browser settings.");
        return;
      }

      setIsSessionActive(true);
      setIsCallEnded(false);
      setSuggestion('');
      setIsMuted(false);
      setMuted(false);

      // Only AFTER audio context is resumed:
      startAgent(level, topic === 'None' ? customTopic : topic, {
        useV2Tracking: true,
        roadmapItemKey: isRoadmapMode ? roadmapItemKey : undefined,
      });
    }
  };

  const handleStop = () => {
    stopAgent();
    setIsSessionActive(false);
    setIsConnecting(false);
    if (isRoadmapMode) {
      window.setTimeout(() => onProgressUpdate?.(), 1600);
    }
  };

  const handleMuteUnmute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    setMuted(newState);
  };

  const handleSuggest = () => {
    if ((!aiText || aiText === defaultMsg) && !(isSessionActive && !hasReceivedAiChunks)) {
      return;
    }
    if (!isSessionActive) {
      return;
    }

    setIsGeneratingSuggestion(true);
    setSuggestion('');
    requestSuggestion();
  };

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    setCustomTopic('');
    setIsSelectorOpen(false);
  };

  const formatDuration = (seconds: number) => {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTarget = (seconds: number) => {
    const hours = Math.round(seconds / 3600);
    return `${hours}h`;
  };

  const progressPercent = Math.min(100, Math.round((stats.total_time_seconds / Math.max(1, stats.target_seconds)) * 100));

  const defaultEvaluation = (): SpeakingEvaluation => {
    const evaluation: SpeakingEvaluation = {};
    ((levelTopicsData as GrammarTopicsByLevel)[level] || []).forEach((topic) => {
      evaluation[topic.slug] = {
        level,
        correct_attempt_count: 0,
        incorrect_attempt_count: 0
      };
    });
    return evaluation;
  };

  const mergedEvaluation = Object.entries(stats.speaking_evaluation || {}).reduce((acc, [slug, counts]) => {
    if (!acc[slug]) {
      acc[slug] = {
        level: counts?.level || level,
        correct_attempt_count: 0,
        incorrect_attempt_count: 0
      };
    }
    acc[slug].correct_attempt_count += Number(counts?.correct_attempt_count || 0);
    acc[slug].incorrect_attempt_count += Number(counts?.incorrect_attempt_count || 0);
    return acc;
  }, defaultEvaluation());

  const levelEvaluationRows: EvaluationRow[] = ((levelTopicsData as GrammarTopicsByLevel)[level] || []).map((topic) => {
    const counts = mergedEvaluation[topic.slug] || { correct_attempt_count: 0, incorrect_attempt_count: 0 };
    const correctAttempts = counts.correct_attempt_count;
    const incorrectAttempts = counts.incorrect_attempt_count;
    const totalAttempts = correctAttempts + incorrectAttempts;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    const status: EvaluationRow['status'] = totalAttempts === 0
      ? 'NOT USED'
      : accuracy >= 0.7
        ? 'STRONG'
        : 'NEEDS PRACTICE';
    return {
      slug: topic.slug,
      label: topic.Title,
      correctAttempts,
      incorrectAttempts,
      status,
      statusRank: status === 'STRONG' ? 0 : status === 'NEEDS PRACTICE' ? 1 : 2,
    };
  }).sort((a: EvaluationRow, b: EvaluationRow) => a.statusRank - b.statusRank || a.label.localeCompare(b.label));

  const renderProgressRing = () => (
    <SpeakingProgressRing
      percent={progressPercent}
      timeLabel={formatDuration(stats.total_time_seconds)}
      targetLabel={formatTarget(stats.target_seconds)}
    />
  );

  const renderEvaluationTable = () => (
    <div className="relative flex w-full max-w-[600px] flex-col items-center max-lg:max-h-full max-lg:justify-center">
      <div className="pointer-events-none flex w-full items-center justify-center py-1 opacity-[0.28] max-lg:mb-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </div>
      <div className="h-[400px] w-full max-w-[600px] overflow-y-auto bg-transparent max-sm:h-[360px]">
        <div className="flex w-full flex-col">
          {levelEvaluationRows.map((row: EvaluationRow) => (
            <div className="flex items-center justify-between gap-3.5 border-b border-black/10 px-3 py-3.5" key={row.slug}>
              <span className="flex-[1_1_auto] text-left text-sm leading-[1.35] font-bold text-black/78">{row.label}</span>
              <span className={cx('shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap', EVAL_TAG[row.status])}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none flex w-full items-center justify-center py-1 opacity-[0.28] max-lg:mt-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  );

  // Display logic
  let displayAiText = aiText;
  if (!isSessionActive && !aiText) {
    displayAiText = defaultMsg;
  }

  const speakingAiClass = cx(
    'mb-6 max-w-[90%] text-[32px] leading-[1.3] font-bold text-black',
    'max-lg:mx-0 max-lg:mb-6 max-lg:text-2xl max-lg:text-center',
    'max-sm:text-2xl',
  );

  const userSpeakingTagClass = cx(
    'speaking-user-tag-pulse pointer-events-none absolute bottom-6 left-1/2 inline-flex -translate-x-1/2 items-center justify-center',
    'rounded-[20px] border border-[rgba(120,119,198,0.2)] bg-[rgba(120,119,198,0.15)] px-4 py-1.5 text-[13px] font-semibold tracking-[0.5px] text-[#555]',
    'max-sm:bottom-4 max-sm:px-2.5 max-sm:py-1 max-sm:text-[11px]',
  );

  if (mode === 'STATS') {
    const isProgressView = statsViewIndex === 0;
    return (
      <div className={PRACTICE_STATS_ROOT}>
        <div className="flex min-h-[420px] w-full max-w-[800px] items-center justify-center p-0 max-lg:min-h-0 max-lg:flex-[1_1_auto] max-lg:items-center max-lg:justify-center max-sm:min-h-[320px]">
          <div className={cx('w-full items-center justify-center', isProgressView ? 'flex' : 'hidden', 'max-lg:h-full max-lg:items-center max-lg:justify-center')}>
            {renderProgressRing()}
          </div>
          <div className={cx('w-full items-center justify-center', !isProgressView ? 'flex' : 'hidden', 'max-lg:h-full max-lg:items-center max-lg:justify-center')}>
            {renderEvaluationTable()}
          </div>
        </div>

        <div className={cx(HINT_BAR, 'min-h-16 max-w-[600px] justify-between gap-3')}>
          <button
            className="relative z-[1] flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/12 bg-white/72 text-[#111] disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => setStatsViewIndex(0)}
            disabled={isProgressView}
            aria-label="Show speaking progress"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className={HINT_CONTENT}>
            {!isStatsLoading && (
              <TypeWriter key={`${level}-${progressPercent}`} text={`Total Progress: ${progressPercent}%`} delay={50} shouldAnimate={true} />
            )}
          </div>
          <button
            className="relative z-[1] flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/12 bg-white/72 text-[#111] disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => setStatsViewIndex(1)}
            disabled={!isProgressView}
            aria-label="Show speaking evaluation"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const selectorTriggerClass = cx(
    'flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[#222]',
    'max-lg:min-h-[46px] max-lg:rounded-xl max-lg:border-[#ccc] max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-normal max-lg:shadow-none',
  );

  const selectorTriggerStaticClass = cx(
    selectorTriggerClass,
    'box-border cursor-default justify-start overflow-hidden text-ellipsis whitespace-nowrap text-[0.8em] leading-[1.2] min-h-[42px]',
    'max-lg:min-h-[46px] max-lg:text-[calc(16px*0.8)]',
  );

  return (
    <div className={PRACTICE_ROOT} data-roadmap-mode={isRoadmapMode ? 'true' : 'false'}>
      {/* Hidden Audio Element for playback */}
      <audio ref={audioRef} hidden />

      <div className={PRACTICE_HEADER}>
        <div className="max-w-[50%] flex-1 text-left max-lg:w-full max-lg:max-w-none max-sm:max-w-full">
          <h1 className="mb-1.5 block text-xs text-[#444] max-lg:hidden">{isRoadmapMode ? 'Speaking Topic' : 'Conversation Scenario'}</h1>
          {isRoadmapMode ? (
            <div className="relative max-lg:mb-3 max-lg:w-full">
              <div className={selectorTriggerStaticClass}>
                {displayRoadmapTopic}
              </div>
            </div>
          ) : (
          <div className="relative max-lg:mb-3 max-lg:w-full" ref={selectorRef}>
            <button
              type="button"
              className={selectorTriggerClass}
              onClick={() => setIsSelectorOpen((v) => !v)}
            >
              {topic === 'None' ? (customTopic || 'Select scenario') : topic}
              <svg className="opacity-60" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isSelectorOpen && !isMobileView && (
              <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 max-h-[260px] overflow-y-auto rounded-xl border border-black/12 bg-white p-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] max-sm:hidden">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Type custom scenario..."
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-[4px] transition-all duration-300 focus:-translate-y-px focus:border-[rgba(120,119,198,0.5)] focus:bg-white/95 focus:shadow-[0_4px_6px_-1px_rgba(120,119,198,0.1),0_2px_4px_-1px_rgba(120,119,198,0.06)] focus:outline-none"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      if (e.target.value) setTopic('None');
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {PREDEFINED_SCENARIOS.map((t) => (
                    <li
                      key={t}
                      className={cx(
                        'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[rgba(120,119,198,0.08)]',
                        topic === t && 'bg-[rgba(120,119,198,0.12)]',
                      )}
                      onClick={() => handleTopicChange(t)}
                    >
                      <span className="flex-1 text-sm text-[#222]">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isSelectorOpen && isMobileView && (
              <>
                <div className="fixed inset-0 z-[700] bg-transparent max-lg:block" onClick={() => setIsSelectorOpen(false)} />
                <div className="fixed right-0 bottom-0 left-0 z-[701] box-border max-h-[70dvh] min-h-[70dvh] w-auto max-w-screen overflow-x-hidden overflow-y-auto rounded-t-3xl border-0 bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_20px_rgba(0,0,0,0.1)]">
                  <div className="mb-5 px-2.5 pt-0 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-[#1a1a1a]">Select scenario</div>
                      <button
                        type="button"
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-black/20 bg-transparent text-black/60"
                        onClick={() => setIsSelectorOpen(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="px-1 pb-2">
                    <input
                      type="text"
                      placeholder="Type custom scenario..."
                      className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-[4px] transition-all duration-300 focus:-translate-y-px focus:border-[rgba(120,119,198,0.5)] focus:bg-white/95 focus:shadow-[0_4px_6px_-1px_rgba(120,119,198,0.1),0_2px_4px_-1px_rgba(120,119,198,0.06)] focus:outline-none"
                      value={customTopic}
                      onChange={(e) => {
                        setCustomTopic(e.target.value);
                        if (e.target.value) setTopic('None');
                      }}
                    />
                  </div>
                  <ul className="m-0 grid w-full max-w-full list-none gap-0 overflow-x-hidden px-1 pb-[30px]">
                    {PREDEFINED_SCENARIOS.map((t) => (
                      <li
                        key={t}
                        className={cx(
                          'flex min-h-12 cursor-pointer items-center gap-2.5 border-b border-[#f5f5f5] px-0 py-3.5',
                          topic === t && 'bg-transparent',
                        )}
                        onClick={() => handleTopicChange(t)}
                      >
                        <span className={cx('flex-1 text-[15px] text-[#333]', topic === t && 'font-semibold text-[#6366f1]')}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div className="flex max-w-[50%] flex-1 flex-wrap items-end justify-end gap-3 max-lg:mb-2.5 max-lg:w-full max-lg:max-w-none max-lg:gap-2 max-sm:mt-2 max-sm:w-full max-sm:max-w-none max-sm:flex-none max-sm:justify-stretch max-sm:gap-2">
          <button
            className={cx(
              ACTION_BTN,
              isSessionActive
                ? '!bg-white !text-[#D32F2F] enabled:hover:!bg-[#f5f5f5] enabled:hover:!text-[#B71C1C] max-lg:enabled:hover:!bg-white'
                : '!bg-white !text-black enabled:hover:!bg-[#f5f5f5] enabled:hover:!text-black max-lg:enabled:hover:!bg-white',
            )}
            onClick={handleStartStop}
            disabled={(topic === 'None' && !customTopic) || isBlocked}
          >
            {isSessionActive ? 'Stop' : 'Start'}
          </button>
          <button
            className={cx(
              ACTION_BTN,
              '!bg-white !text-[#333] enabled:hover:!bg-[#f5f5f5] max-lg:enabled:hover:!bg-white',
              'disabled:!border-black/20 disabled:!bg-white disabled:!text-black/30 disabled:!opacity-100 disabled:!shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]',
            )}
            onClick={handleMuteUnmute}
            disabled={!isSessionActive}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>
          <button
            className={HELP_BTN}
            onClick={handleSuggest}
            disabled={(!isSessionActive || (aiText === "" && !isSessionActive)) || isAiThinking || isAiSpeaking || isBlocked}
          >
            Suggest
          </button>
        </div>
      </div>

      <div className={EXERCISE_BOX}>
        {isBlocked ? (
          <CreditLimitBlock message={limitMessage} />
        ) : isConnecting || (isSessionActive && !hasReceivedAiChunks) ? (
          <div className="flex h-full w-full items-center justify-center max-lg:min-h-full">
            <div className="speaking-spinner h-10 w-10 rounded-full border-[3px] border-black/10 border-t-black" />
          </div>
        ) : !isSessionActive && !aiText ? (
          <div className="flex h-full items-center justify-center text-sm text-[#666] max-lg:min-h-full max-lg:p-6 max-lg:text-base max-lg:opacity-60">
            <p>{defaultMsg}</p>
          </div>
        ) : (
          <div className="gg-speaking-display relative flex h-full w-full flex-col items-center justify-center p-5 text-center max-lg:min-h-full max-lg:flex-[1_1_auto] max-lg:p-5 [&>.gg-credit-limit-block]:min-h-full">
            {isCallEnded && (
              <h2 className="mb-4 text-2xl font-bold text-black">
                Call ended
              </h2>
            )}
            {!isCallEnded && (
              <>
                <ClickableText
                  text={displayAiText}
                  className={speakingAiClass}
                  defaultMsg={defaultMsg}
                  waitingForAiMsg={waitingForAiMsg}
                />
                {/* AI states take full priority — user cannot change state during these */}
                {isAiSpeaking && (
                  <div className={userSpeakingTagClass} style={{ backgroundColor: '#e6f3ff', color: '#0066cc', borderColor: 'rgba(0,102,204,0.2)' }}>
                    AI Speaking
                  </div>
                )}
                {!isAiSpeaking && isAiThinking && (
                  <div className={userSpeakingTagClass} style={{ backgroundColor: '#fff3e0', color: '#e65100', borderColor: 'rgba(230,81,0,0.2)' }}>
                    Thinking
                  </div>
                )}
                {/* User states: only visible when AI is fully idle */}
                {!isAiSpeaking && !isAiThinking && isMuted && (
                  <div className={userSpeakingTagClass} style={{ backgroundColor: '#fce4ec', color: '#c62828', borderColor: 'rgba(198,40,40,0.2)' }}>
                    Muted
                  </div>
                )}
                {/* Default: show User Speaking when no AI states are active */}
                {!isAiSpeaking && !isAiThinking && !isMuted && (
                  <div className={userSpeakingTagClass}>
                    User Speaking
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className={HINT_BAR_PRACTICE}>
        <div className={HINT_CONTENT}>
          {isBlocked ? (
            <span className="text-center text-sm text-[#333] opacity-60">Tap Upgrade to Pro above to continue</span>
          ) : isCallEnded ? (
            <TypeWriter text="Maximum time for a single call is 30 minutes. Please start again." delay={40} shouldAnimate={true} />
          ) : isGeneratingSuggestion ? (
            <div className="flex items-center justify-center">
              <div className="speaking-suggestion-spinner h-5 w-5 rounded-full border-2 border-black/10 border-t-black" />
            </div>
          ) : suggestion ? (
            <TypeWriter text={suggestion} delay={40} shouldAnimate={true} />
          ) : isSessionActive ? (
            <span>{waitingForAiMsg}</span>
          ) : (
            <span>{isRoadmapMode ? roadmapHint : defaultMsg}</span>
          )}
        </div>
      </div>
    </div>
  );
};
