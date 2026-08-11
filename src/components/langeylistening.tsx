// langeylistening.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import './langeylistening.animations.css';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { ExercisesTemplate, exerciseTitleClassName } from './ExercisesTemplate';
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

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const GLOW_BORDER =
  'before:pointer-events-none before:absolute before:inset-[-1px] before:-z-10 before:bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] before:bg-size-[400%_400%] before:animate-settings-glow';

const PRACTICE = cx(
  'flex flex-col items-center justify-center p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]',
  'min-h-[calc(100vh-150px)] min-h-[calc(100dvh-150px)]',
  'max-lg:w-full max-lg:max-w-none max-lg:h-[calc(100dvh-54px)] max-lg:min-h-[calc(100dvh-54px)]',
  'max-lg:p-0 max-lg:items-stretch max-lg:justify-start max-lg:gap-0 max-lg:overflow-hidden',
);

const PRACTICE_HEADER = cx(
  'flex w-full max-w-[800px] mb-6 gap-5 justify-between items-end',
  'max-lg:block max-lg:max-w-none max-lg:m-0 max-lg:px-5 max-lg:pt-4 max-lg:pb-1 max-lg:shrink-0 max-lg:bg-transparent',
  'max-sm:flex-col max-sm:gap-4 max-sm:items-stretch',
);

const FIELD_LEFT = cx('text-left flex-1 max-w-[50%]', 'max-lg:w-full max-lg:max-w-none', 'max-sm:max-w-full');

const LABEL = 'mb-1.5 block text-xs text-[#444] max-lg:hidden';

const CUSTOM_SELECTOR = 'relative max-lg:mb-3 max-lg:w-full';

const SELECTOR_TRIGGER = cx(
  'flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[#222]',
  '[&_svg]:opacity-60',
  'max-lg:min-h-[46px] max-lg:rounded-xl max-lg:border-[#ccc] max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-normal max-lg:text-[#333] max-lg:shadow-none',
);

const DROPDOWN_PANEL = cx(
  'absolute inset-x-0 top-[calc(100%+8px)] z-30 max-h-[260px] overflow-y-auto rounded-xl border border-black/12 bg-white p-2',
  'shadow-xl max-lg:hidden',
);

const ACTION_BTN = cx(
  'min-w-[90px] flex-1 cursor-pointer rounded-[10px] border border-black/20 px-[18px] py-2.5 text-sm font-medium',
  'bg-gradient-to-br from-black to-neutral-700 text-white shadow-md backdrop-blur-sm transition-all duration-300',
  'enabled:hover:-translate-y-px enabled:hover:from-neutral-700 enabled:hover:to-neutral-600 enabled:hover:shadow-lg',
  'enabled:active:translate-y-0 enabled:active:shadow-sm',
  'disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-none disabled:bg-black/15 disabled:text-black/40 disabled:shadow-sm',
  'max-lg:min-h-[46px] max-lg:h-auto max-lg:min-w-0 max-lg:w-0 max-lg:flex-1 max-lg:basis-0',
  'max-lg:rounded-xl max-lg:border-[#eee] max-lg:bg-none max-lg:bg-white max-lg:px-2.5 max-lg:py-3 max-lg:text-sm max-lg:font-medium max-lg:text-[#333] max-lg:shadow-none',
  'max-lg:enabled:hover:translate-y-0 max-lg:disabled:border-black/10 max-lg:disabled:bg-none max-lg:disabled:bg-black/15 max-lg:disabled:text-black/40',
  'max-sm:min-w-[80px] max-sm:flex-1 max-sm:px-3.5 max-sm:py-2 max-sm:text-[13px]',
);

const ACTION_BUTTONS = cx(
  'flex flex-1 max-w-[50%] flex-wrap items-end justify-end gap-3',
  'max-lg:mb-2.5 max-lg:flex max-lg:w-full max-lg:max-w-none max-lg:shrink-0 max-lg:justify-stretch max-lg:gap-2',
  'max-sm:mt-2 max-sm:w-full max-sm:max-w-none max-sm:flex-none max-sm:gap-2',
);

const VOCAB_BTN = cx(
  ACTION_BTN,
  'relative flex items-center justify-center gap-1.5',
  '!border-black/15 !bg-[rgba(248,248,248,0.9)] !text-black/80 backdrop-blur-xl',
  'before:content-[""] before:rounded-[10px] before:opacity-80 disabled:before:opacity-20',
  GLOW_BORDER,
  'enabled:hover:!bg-[rgba(248,248,248,0.95)] enabled:hover:-translate-y-px',
  'max-lg:!border-transparent max-lg:!bg-gradient-to-r max-lg:from-[#e2bea9] max-lg:to-[#b8b0d3] max-lg:!text-black',
  'max-lg:before:!hidden max-lg:enabled:hover:!bg-gradient-to-r max-lg:enabled:hover:from-[#e2bea9] max-lg:enabled:hover:to-[#b8b0d3] max-lg:enabled:hover:translate-y-0',
);

const FULLSCREEN_BTN = cx(
  ACTION_BTN,
  'flex! min-w-10! w-10! flex-none! items-center justify-center rounded-lg! p-2.5!',
  'border-black/30! bg-transparent! text-black/30!',
  'enabled:hover:border-black/50! enabled:hover:bg-transparent! enabled:hover:text-black/50! enabled:hover:-translate-y-px',
  'disabled:border-black/15! disabled:bg-transparent! disabled:text-black/15!',
  'max-lg:hidden',
);

const EXERCISE_BOX = cx(
  'relative mb-5 flex h-[400px] w-full max-w-[800px] flex-col overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-xl transition-all duration-300',
  '[&>.gg-credit-limit-block]:min-h-full',
  'max-lg:mb-0 max-lg:h-auto max-lg:min-h-0 max-lg:max-w-none max-lg:flex-1 max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-0 max-lg:pt-2.5 max-lg:pb-5 max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-sm:mb-4 max-sm:h-[350px] max-sm:p-4',
);

const EXERCISE_BOX_FULLSCREEN = cx(
  'fixed! inset-0! z-[1000]! m-0! h-screen! w-screen! max-w-none! rounded-none! bg-white/95! p-10! pt-20! backdrop-blur-xl!',
  'max-sm:h-dvh! max-sm:p-5! max-sm:pt-[60px]! max-sm:pb-[calc(20px+env(safe-area-inset-bottom,0px))]!',
);

const LOADING = 'flex min-h-full items-center justify-center max-lg:min-h-full';

const SPINNER = 'size-6 animate-spin rounded-full border-2 border-[#f3f3f3] border-t-black';

const EMPTY_STATE = cx(
  'flex h-full items-center justify-center text-sm text-[#666]',
  'max-lg:min-h-full max-lg:p-6 max-lg:text-base max-lg:opacity-60',
);

const AUDIO_BLOCK = cx(
  'mb-6',
  'max-lg:mx-5 max-lg:mb-5 max-lg:w-[calc(100%-40px)] max-lg:rounded-2xl max-lg:border max-lg:border-black/5 max-lg:bg-black/3 max-lg:p-4',
);

const AUDIO_PLAYER = cx(
  'flex min-h-[52px] items-center gap-3 rounded-xl border border-black/8 bg-[rgba(248,248,250,0.85)] px-4 py-2.5',
  'max-sm:min-h-11 max-sm:gap-1.5 max-sm:px-2.5 max-sm:py-2',
);

const AUDIO_PLAY_BTN = cx(
  'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0',
  'bg-gradient-to-br from-black to-neutral-700 text-white shadow-md transition-all duration-200',
  'hover:scale-[1.08] hover:from-neutral-800 hover:to-neutral-600 hover:shadow-lg active:scale-95',
  'max-sm:size-8',
);

const AUDIO_WAVEFORM_CONTAINER =
  'relative h-8 flex-1 cursor-pointer overflow-hidden rounded-md';

const AUDIO_WAVEFORM = 'relative z-[1] flex h-full items-center gap-px';

const AUDIO_BAR = 'min-w-px flex-1 rounded-[0.5px] bg-black/8 transition-[background,height] duration-100 ease-out';

const AUDIO_BAR_ACTIVE = 'bg-[rgba(120,119,198,0.7)]';

const AUDIO_PROGRESS_LINE =
  'pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-[rgba(120,119,198,0.08)] transition-[width] duration-100 linear';

const AUDIO_TIME = cx(
  'min-w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-black/50',
  'max-sm:min-w-[30px] max-sm:text-[11px]',
);

const HINT_BAR = cx(
  'relative m-0 flex w-full max-w-[800px] min-h-[80px] items-center justify-center rounded-2xl border border-black/15',
  'bg-[rgba(248,248,248,0.9)] px-5 py-4 shadow-lg backdrop-blur-xl',
  'before:rounded-2xl before:opacity-80',
  GLOW_BORDER,
  'max-lg:relative max-lg:inset-auto max-lg:bottom-auto max-lg:shrink-0 max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6',
  'max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-lg:before:inset-0 max-lg:before:rounded-none max-lg:before:bg-gradient-to-r max-lg:before:from-[#e2bea9] max-lg:before:to-[#b8b0d3] max-lg:before:opacity-80 max-lg:before:z-0',
);

const HINT_CONTENT = cx(
  'relative z-[1] max-w-full text-center text-sm font-bold leading-normal break-words text-[#333]',
  'max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:font-normal max-lg:leading-6 max-lg:text-[#1a1a1a]',
);

const FULLSCREEN_CLOSE = cx(
  'fixed top-5 right-5 z-[1002] flex size-11 cursor-pointer items-center justify-center rounded-full border border-black/20 bg-white/90 text-neutral-700 backdrop-blur-sm transition-all duration-200',
  'hover:scale-105 hover:bg-white/95 hover:shadow-md',
  'max-sm:top-[15px] max-sm:right-[15px] max-sm:size-10',
);

const TOPIC_LIST = cx('m-0 grid list-none gap-1.5 p-0', 'max-lg:max-h-none max-lg:pb-[30px]');

const topicItemClass = (selected: boolean) =>
  cx(
    'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-indigo-500/8',
    'max-lg:min-h-0 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
    selected && 'bg-indigo-500/12 max-lg:bg-transparent',
  );

const topicTitleClass = (selected: boolean) =>
  cx(
    'flex-1 text-sm text-[#222]',
    'max-lg:text-[15px] max-lg:text-[#333]',
    selected && 'max-lg:font-semibold max-lg:text-indigo-500',
  );

const TOPIC_RING = 'relative flex size-8 items-center justify-center max-lg:[&>*]:rounded-[14px]';

const RING_TRACK = 'fill-none stroke-black/10 stroke-3';

const RING_PROGRESS = 'origin-[16px_16px] -rotate-90 fill-none stroke-black/80 stroke-3 [stroke-linecap:round]';

const STEP = 'absolute text-xs font-semibold text-black';

const SHEET_OVERLAY = 'fixed inset-0 z-[700] bg-transparent max-lg:z-[700]';

const BOTTOM_SHEET = cx(
  'fixed inset-x-0 bottom-0 z-[701] max-h-[65vh] overflow-y-auto overflow-x-hidden rounded-t-[14px] bg-white p-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.15)]',
  'max-lg:box-border max-lg:min-h-[70dvh] max-lg:max-h-[70dvh] max-lg:max-w-screen max-lg:rounded-t-3xl max-lg:border-0 max-lg:p-4',
  'max-lg:pb-[calc(16px+env(safe-area-inset-bottom,0px))] max-lg:shadow-[0_-8px_20px_rgba(0,0,0,0.1)]',
);

const SHEET_HEADER = 'flex items-center justify-between px-1 py-2 pb-3 max-lg:mb-5 max-lg:px-2.5 max-lg:py-0';

const SHEET_TITLE = 'text-sm font-semibold text-[#222] max-lg:text-xl max-lg:font-bold max-lg:text-[#1a1a1a]';

const SHEET_CLOSE = cx(
  'flex size-[34px] items-center justify-center rounded-lg border border-black/20 bg-transparent text-black/60',
  'hover:border-black/40 hover:text-black/80',
);

const STATS = cx(
  'relative flex min-h-[calc(100vh-100px)] min-h-[calc(100dvh-100px)] flex-col items-center justify-center gap-5 p-5',
  'max-lg:h-[calc(100dvh-54px)] max-lg:min-h-0 max-lg:max-w-none max-lg:flex-1 max-lg:justify-center max-lg:bg-white max-lg:px-[15px]',
  'max-lg:pb-[calc(120px+env(safe-area-inset-bottom,0px))] max-lg:pt-0 max-lg:gap-0',
  'max-sm:gap-0 max-sm:px-[15px] max-sm:pt-[60px] max-sm:pb-[70px]',
);

const SPIDER_WRAPPER = cx(
  'relative flex w-full max-w-[520px] items-center justify-center',
  'max-lg:static max-lg:mx-auto max-lg:w-[var(--stats-chart-size,clamp(280px,80vw,400px))] max-lg:max-w-[var(--stats-chart-size,clamp(280px,80vw,400px))]',
  'max-sm:max-w-full',
);

const SPIDER_CHART = cx(
  'block h-auto w-full max-w-[500px] overflow-visible',
  'max-lg:w-[var(--stats-chart-size,clamp(280px,80vw,400px))] max-lg:max-w-[var(--stats-chart-size,clamp(280px,80vw,400px))]',
  'max-sm:max-w-[380px]',
);

const STATS_HINT_BAR = cx(
  'relative mx-auto flex w-full max-w-[600px] min-h-[70px] items-center justify-center overflow-hidden rounded-[14px] border border-black/15',
  'bg-[rgba(248,248,248,0.85)] px-5 py-4 shadow-md backdrop-blur-[10px]',
  'before:rounded-[14px] before:opacity-60',
  GLOW_BORDER,
  'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[420] max-lg:m-0 max-lg:max-w-none max-lg:min-h-[calc(100px+env(safe-area-inset-bottom,0px))]',
  'max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-lg:before:inset-0 max-lg:before:rounded-none max-lg:before:bg-gradient-to-r max-lg:before:from-[#e2bea9] max-lg:before:to-[#b8b0d3] max-lg:before:opacity-80 max-lg:before:z-0',
  'max-sm:mb-[calc(20px+env(safe-area-inset-bottom,10px))] max-sm:mt-11 max-sm:min-h-[75px] max-sm:px-4 max-sm:py-3',
);

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
    <div className={AUDIO_PLAYER}>


      {/* Play / Pause */}
      <button className={AUDIO_PLAY_BTN} onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
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
        className={AUDIO_WAVEFORM_CONTAINER}
        ref={progressBarRef}
        onClick={handleProgressClick}
        role="application"
        aria-label="Audio waveform progress"
      >

        <div className={AUDIO_WAVEFORM}>
          {barHeights.map((h, i) => {
            const barPosition = ((i + 0.5) / barHeights.length) * 100;
            const isPast = barPosition <= progress;
            return (
              <div
                key={i}
                className={cx(AUDIO_BAR, isPast && AUDIO_BAR_ACTIVE)}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        {/* Progress line */}
        <div className={AUDIO_PROGRESS_LINE} style={{ width: `${progress}%` }} />
      </div>



      {/* Time left */}
      <span className={AUDIO_TIME}>{formatTime(timeLeft)}</span>
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
    <ul className={TOPIC_LIST} role="listbox">
      <li
        className={topicItemClass(topic === 'None')}
        onClick={() => { handleTopicChange('None'); close(); }}
      >
        <div className={TOPIC_RING}>
          <svg width="32" height="32">
            <circle cx="16" cy="16" r="12" className={RING_TRACK} />
            <circle cx="16" cy="16" r="12" className={RING_PROGRESS}
              style={{ strokeDasharray: `${2 * Math.PI * 12}`, strokeDashoffset: `${2 * Math.PI * 12}` }} />
          </svg>
          <span className={STEP}>0</span>
        </div>
        <span className={topicTitleClass(topic === 'None')}>None</span>
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
            className={topicItemClass(isSelected)}
            onClick={() => { handleTopicChange(title); close(); }}
          >
            <div className={TOPIC_RING}>
              <svg width="32" height="32">
                <circle cx="16" cy="16" r="12" className={RING_TRACK} />
                <circle cx="16" cy="16" r="12" className={RING_PROGRESS}
                  style={{ strokeDasharray: `${circ}`, strokeDashoffset: `${offset}` }} />
              </svg>
              <span className={STEP}>{idx + 1}</span>
            </div>
            <span className={topicTitleClass(isSelected)}>{title.length > 40 ? title.substring(0, 44) + '...' : title}</span>
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
          <button className={FULLSCREEN_CLOSE} onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <div>
          <div className={PRACTICE}>
            {/* Header */}
            {!isFullscreen && (
            <div className={PRACTICE_HEADER}>
              <div className={FIELD_LEFT}>
                <h1 className={LABEL}>Listening</h1>

                <div className={CUSTOM_SELECTOR} ref={selectorRef}>
                  <button
                    type="button"
                    className={SELECTOR_TRIGGER}
                    onClick={() => setIsSelectorOpen(v => !v)}
                  >
                    {topic === 'None' ? 'Select topic' : (topic.length > 40 ? topic.substring(0, 44) + '...' : topic)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isSelectorOpen && !isMobileView && (
                    <div className={DROPDOWN_PANEL}>
                      {renderTopicList(() => setIsSelectorOpen(false))}
                    </div>
                  )}

                  {isSelectorOpen && isMobileView && (
                    <>
                      <div className={SHEET_OVERLAY} onClick={() => setIsSelectorOpen(false)} />
                      <div className={BOTTOM_SHEET}>
                        <div className={SHEET_HEADER}>
                          <span className={SHEET_TITLE}>Select topic</span>
                          <button className={SHEET_CLOSE} onClick={() => setIsSelectorOpen(false)}>
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

              <div className={ACTION_BUTTONS}>
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
            )}

            {/* Exercise box */}
            <div className={cx(EXERCISE_BOX, isFullscreen && EXERCISE_BOX_FULLSCREEN)}>
              {isBlocked ? (
                <CreditLimitBlock message={limitMessage} />
              ) : isLoading ? (
                <div className={LOADING}><div className={SPINNER} /></div>
              ) : isShowingExercise && ex ? (
                <>
                  {/* Instruction (purple box) */}
                  {currentInstruction && (
                    <div className={exerciseTitleClassName}>
                      {currentInstruction}
                    </div>
                  )}
                  {/* Audio player instead of passage */}
                  {audioUrl && (
                    <div className={AUDIO_BLOCK}>
                      <AudioPlayer src={audioUrl} isMobile={isMobileView} isActive={isActive} />
                    </div>
                  )}
                  {/* Exercise questions */}
                  <ExercisesTemplate {...getExerciseTemplateProps()} title="" />
                </>
              ) : (
                <div className={EMPTY_STATE}><p>{defaultMsg}</p></div>
              )}
            </div>

            {/* Hint bar — shows LLM text or instruction */}
            {!isFullscreen && (
            <div className={HINT_BAR}>
              <div className={HINT_CONTENT}>
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
            )}
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
    <div className={STATS} style={{ '--stats-chart-size': 'clamp(280px, 80vw, 400px)' } as React.CSSProperties}>
      <div className={SPIDER_WRAPPER}>
        <svg key={level} className={SPIDER_CHART} viewBox="0 0 400 400">
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
                    animation: `ll-growLine 1s ease-out ${i * 0.08}s forwards`
                  }}
                />
                <text
                  className="fill-[#333] text-[10px] font-medium max-lg:text-[9px] max-sm:text-[10px]"
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
                className="fill-none stroke-[rgba(120,119,198,0.8)] stroke-3"
                x1="200" y1="200" x2={point.x} y2={point.y}
                style={{
                  strokeDasharray: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  strokeDashoffset: `${Math.hypot(point.x - 200, point.y - 200)}`,
                  animation: `ll-growDataLine 0.8s ease-out ${0.8 + i * 0.1}s forwards`
                }}
              />
              {point.value >= 10 && (
                <circle
                  className="origin-center fill-[rgba(120,119,198,1)] stroke-2 stroke-white"
                  cx={point.x} cy={point.y} r="5"
                  style={{ opacity: 0, transform: 'scale(0)', animation: `ll-drawPoint 0.4s ease-out ${1.2 + i * 0.1}s forwards` }}
                />
              )}
              {point.value >= 10 && (
                <text
                  className="fill-black text-[10px] font-semibold max-sm:text-[9px]"
                  x={point.x} y={point.y - 12} textAnchor="middle"
                  style={{ opacity: 0, animation: `ll-fadeIn 0.3s ease-out ${1.5 + i * 0.1}s forwards` }}
                >
                  {point.value}%
                </text>
              )}
            </g>
          ))}

          <polygon
            className="fill-[rgba(120,119,198,0.2)] stroke-[rgba(120,119,198,0.6)] stroke-1"
            points={polygon}
            style={{ opacity: 0, animation: 'll-fadeInPolygon 0.8s ease-out 2s forwards' }}
          />
        </svg>
      </div>

      <div className={STATS_HINT_BAR}>
        <div className={HINT_CONTENT}>
          {chartTopics.length > 0 && <TotalProgressText key={`${level}-${avgScore}`} percent={avgScore} />}
        </div>
      </div>
    </div>
  );
};
