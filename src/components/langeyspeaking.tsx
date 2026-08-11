// langeyspeaking.tsx
// Updated UI logic
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './langeyspeaking.css';
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
      className="gg-translation-popup"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="gg-translation-word">{word}</div>
      <div className="gg-translation-text">{translation}</div>
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
    const firstWord = containerRef.current.querySelector('.gg-clickable-word');
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
              className="gg-clickable-word"
              onClick={(e) => handleWordClick(token, e.currentTarget)}
              style={{ cursor: 'pointer' }}
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
    <div className="gg-evaluation-scroll-container">
      <div className="gg-evaluation-scroll-arrow gg-evaluation-scroll-arrow-up">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </div>
      <div className="gg-speaking-evaluation-wrap">
        <div className="gg-speaking-evaluation-list">
          {levelEvaluationRows.map((row: EvaluationRow) => (
            <div className="gg-speaking-evaluation-row" key={row.slug}>
              <span className="gg-speaking-evaluation-label">{row.label}</span>
              <span className={`gg-speaking-evaluation-tag gg-speaking-evaluation-tag-${row.status.toLowerCase().replace(' ', '-')}`}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="gg-evaluation-scroll-arrow gg-evaluation-scroll-arrow-down">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

  if (mode === 'STATS') {
    const isProgressView = statsViewIndex === 0;
    return (
      <div className="gg-practice gg-speaking-stats-mode">
        <div className="gg-speaking-stats-panel">
          <div className={`gg-speaking-stats-view ${isProgressView ? 'active' : ''}`}>
            {renderProgressRing()}
          </div>
          <div className={`gg-speaking-stats-view ${!isProgressView ? 'active' : ''}`}>
            {renderEvaluationTable()}
          </div>
        </div>

        <div className="gg-speaking-hint-bar gg-speaking-stats-hint gg-speaking-stats-hint--with-nav">
          <button
            className="gg-speaking-stats-nav"
            onClick={() => setStatsViewIndex(0)}
            disabled={isProgressView}
            aria-label="Show speaking progress"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="gg-speaking-hint-content">
            {!isStatsLoading && (
              <TypeWriter key={`${level}-${progressPercent}`} text={`Total Progress: ${progressPercent}%`} delay={50} shouldAnimate={true} />
            )}
          </div>
          <button
            className="gg-speaking-stats-nav"
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

  return (
    <div className="gg-practice" data-roadmap-mode={isRoadmapMode ? 'true' : 'false'}>
      {/* Hidden Audio Element for playback */}
      <audio ref={audioRef} hidden />

      <div className="gg-practice-header">
        <div className="gg-field-left">
          <h1 className="gg-label">{isRoadmapMode ? 'Speaking Topic' : 'Conversation Scenario'}</h1>
          {isRoadmapMode ? (
            <div className="gg-custom-selector">
              <div className="gg-selector-trigger gg-selector-trigger-static">
                {displayRoadmapTopic}
              </div>
            </div>
          ) : (
          <div className="gg-custom-selector" ref={selectorRef}>
            <button
              type="button"
              className="gg-selector-trigger"
              onClick={() => setIsSelectorOpen((v) => !v)}
            >
              {topic === 'None' ? (customTopic || 'Select scenario') : topic}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isSelectorOpen && !isMobileView && (
              <div className="gg-dropdown-panel">
                <div style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type custom scenario..."
                    className="gg-exercise-input"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      if (e.target.value) setTopic('None');
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <ul className="gg-topic-list">
                  {PREDEFINED_SCENARIOS.map((t) => (
                    <li
                      key={t}
                      className={`gg-topic-item ${topic === t ? 'selected' : ''}`}
                      onClick={() => handleTopicChange(t)}
                    >
                      <span className="gg-topic-title">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isSelectorOpen && isMobileView && (
              <>
                <div className="gg-sheet-overlay" onClick={() => setIsSelectorOpen(false)} />
                <div className="gg-bottom-sheet">
                  <div className="gg-sheet-header">
                    <div className="gg-sheet-title">Select scenario</div>
                    <button className="gg-sheet-close" onClick={() => setIsSelectorOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div style={{ padding: '0 4px 8px' }}>
                    <input
                      type="text"
                      placeholder="Type custom scenario..."
                      className="gg-exercise-input"
                      value={customTopic}
                      onChange={(e) => {
                        setCustomTopic(e.target.value);
                        if (e.target.value) setTopic('None');
                      }}
                    />
                  </div>
                  <ul className="gg-topic-list">
                    {PREDEFINED_SCENARIOS.map((t) => (
                      <li
                        key={t}
                        className={`gg-topic-item ${topic === t ? 'selected' : ''}`}
                        onClick={() => handleTopicChange(t)}
                      >
                        <span className="gg-topic-title">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div className="gg-action-buttons">
          <button
            className={`gg-action-btn gg-start-stop-btn ${isSessionActive ? 'stop' : 'start'}`}
            onClick={handleStartStop}
            disabled={(topic === 'None' && !customTopic) || isBlocked}
          >
            {isSessionActive ? 'Stop' : 'Start'}
          </button>
          <button
            className="gg-action-btn gg-mute-btn"
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
            className="gg-action-btn gg-help-btn"
            onClick={handleSuggest}
            disabled={(!isSessionActive || (aiText === "" && !isSessionActive)) || isAiThinking || isAiSpeaking || isBlocked}
          >
            Suggest
          </button>
        </div>
      </div>

      <div className="gg-exercise-box">
        {isBlocked ? (
          <CreditLimitBlock message={limitMessage} />
        ) : isConnecting || (isSessionActive && !hasReceivedAiChunks) ? (
          <div className="gg-loading"><div className="gg-spinner" /></div>
        ) : !isSessionActive && !aiText ? (
          <div className="gg-empty-state">
            <p>{defaultMsg}</p>
          </div>
        ) : (
          <div className="gg-speaking-display">
            {isCallEnded && (
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#000' }}>
                Call ended
              </h2>
            )}
            {!isCallEnded && (
              <>
                <ClickableText
                  text={displayAiText}
                  className="gg-speaking-ai"
                  defaultMsg={defaultMsg}
                  waitingForAiMsg={waitingForAiMsg}
                />
                {/* AI states take full priority — user cannot change state during these */}
                {isAiSpeaking && (
                  <div className="gg-user-speaking-tag" style={{ backgroundColor: '#e6f3ff', color: '#0066cc' }}>
                    AI Speaking
                  </div>
                )}
                {!isAiSpeaking && isAiThinking && (
                  <div className="gg-user-speaking-tag" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                    Thinking
                  </div>
                )}
                {/* User states: only visible when AI is fully idle */}
                {!isAiSpeaking && !isAiThinking && isMuted && (
                  <div className="gg-user-speaking-tag" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                    Muted
                  </div>
                )}
                {/* Default: show User Speaking when no AI states are active */}
                {!isAiSpeaking && !isAiThinking && !isMuted && (
                  <div className="gg-user-speaking-tag">
                    User Speaking
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="gg-speaking-hint-bar">
        <div className="gg-speaking-hint-content">
          {isBlocked ? (
            <span className="gg-limit-hint">Tap Upgrade to Pro above to continue</span>
          ) : isCallEnded ? (
            <TypeWriter text="Maximum time for a single call is 30 minutes. Please start again." delay={40} shouldAnimate={true} />
          ) : isGeneratingSuggestion ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="gg-suggestion-spinner" />
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
