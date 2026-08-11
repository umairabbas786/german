// langeyroadmap.tsx - German Learning Roadmap Component (Redesigned)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import vocabularySvg from '../assets/svgs/vocabulary.svg';
import grammarSvg    from '../assets/svgs/grammar.svg';
import speakingSvg   from '../assets/svgs/speaking.svg';
import writingSvg    from '../assets/svgs/writing.svg';
import readingSvg    from '../assets/svgs/reading.svg';
import listeningSvg  from '../assets/svgs/listening.svg';
import './langeyroadmap.css';
import { UserTracker } from '../utils/userTracking';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import { createRoadmap, getModulesProgress, getRoadmap, updateRoadmapProgress } from '../services/roadmapApi';

// ─── Feature tile metadata ────────────────────────────────────────────────────
const FEATURE_TILES: Array<{
    type: RoadmapSkill;
    title: string;
    desc: string;
    color: string;
    bg: string;
    basePath: string;
}> = [
    { type: 'vocabulary', title: 'Vocabulary', desc: 'Flashcards with audio & spaced practice',  color: '#7c3aed', bg: '#f5f3ff', basePath: '/vocabulary' },
    { type: 'grammar',    title: 'Grammar',    desc: 'Guided grammar with instant feedback',      color: '#d97706', bg: '#fff9e6', basePath: '/grammar'    },
    { type: 'speaking',   title: 'Speaking',   desc: 'AI conversation practice',                   color: '#059669', bg: '#ecfdf5', basePath: '/speaking'   },
    { type: 'writing',    title: 'Writing',    desc: 'Write freely & get AI corrections',          color: '#2563eb', bg: '#eff6ff', basePath: '/writing'    },
    { type: 'reading',    title: 'Reading',    desc: 'Passages with comprehension exercises',      color: '#9333ea', bg: '#faf5ff', basePath: '/reading'    },
    { type: 'listening',  title: 'Listening',  desc: 'Audio exercises for focused practice',       color: '#be185d', bg: '#fdf2f8', basePath: '/listening'  },
];

// Skills that never get a progress ring.
const NO_RING_SKILLS = new Set<RoadmapSkill>();
const MODULE_PROGRESS_SKILLS: RoadmapSkill[] = ['vocabulary', 'grammar', 'speaking', 'writing', 'reading', 'listening'];

// Features that, when visited, mark stats as needing refresh on next Modules open
const STATS_DIRTY_PATHS = new Set(['/vocabulary', '/grammar', '/speaking', '/writing', '/reading', '/listening']);

export interface LangeyRoadmapProps {
    level: 'A1' | 'A2' | 'B1';
    refreshTrigger?: number;
    onRefreshDone?: () => void;
    roadmapEnabled?: boolean;
    setupTrigger?: number;
    onRoadmapEnabledChange?: (enabled: boolean) => void;
    onRoadmapPresenceChange?: (level: 'A1' | 'A2' | 'B1', hasRoadmap: boolean) => void;
    onRoadmapDataUpdate?: (level: 'A1' | 'A2' | 'B1', current_day: number | null, days: number | null) => void;
    resetTrigger?: number;
}

interface DayTask {
    topic?: string;
    target_cards?: number;
    target_score?: number;
    completed?: boolean;
    remaining?: number;
    current_score?: number;
}

interface SpeakingWritingTask {
    day: number;
    topic: string;
    completed?: boolean;
    target_minutes?: number;
    current_seconds?: number;
    target_words?: number;
    current_words?: number;
}

interface ReadingListeningTask {
    topic: string;
    target_score: number;
    current_score?: number;
    completed?: boolean;
}

interface DayPlan {
    day: number;
    title: string;
    vocabulary: DayTask;
    grammar: DayTask;
    speaking: SpeakingWritingTask;
    writing: SpeakingWritingTask;
    reading?: ReadingListeningTask;
    listening?: ReadingListeningTask;
}

interface Roadmap {
    level: string;
    days: number;
    user_scenario: string;
    current_day: number;
    completed_days: number[];
    plan: DayPlan[];
    speaking: SpeakingWritingTask[];
    writing: SpeakingWritingTask[];
    reading_starts_day: number | null;
    listening_starts_day: number | null;
}

interface RoadmapsResponse {
  success?: boolean;
  roadmaps: Record<string, Roadmap>;
}

interface ModulesProgressResponse {
    success?: boolean;
    vocabulary?: number;
    grammar?: number;
    speaking?: number;
    writing?: number;
    reading?: number;
    listening?: number;
}

interface CreateRoadmapResponse {
  success?: boolean;
  roadmap: Roadmap;
    error?: string;
}

const DAYS_OPTIONS: Record<string, number[]> = {
    'A1': [22, 44, 66],
    'A2': [19, 38, 57],
    'B1': [20, 40, 60],
};

const SELECTABLE_TOPICS = [
    'Living in Germany (Daily Life)',
    'Working in German (Professional)',
    'Studying & Ausbildung (Academic)',
    'Exams & Certification (Official)',
    'Personal Interest (General)',
];

type RoadmapSkill = 'vocabulary' | 'grammar' | 'speaking' | 'writing' | 'reading' | 'listening';

// ─── Skill SVG image map ──────────────────────────────────────────────────────
const SKILL_SVGS: Record<RoadmapSkill, string> = {
    vocabulary: vocabularySvg,
    grammar:    grammarSvg,
    speaking:   speakingSvg,
    writing:    writingSvg,
    reading:    readingSvg,
    listening:  listeningSvg,
};

// Per-skill SVG scale for roadmap tiles (1 = default size)
const VOCABULARY_TILE_SVG_SCALE = 1;
const GRAMMAR_TILE_SVG_SCALE    = 1;
const SPEAKING_TILE_SVG_SCALE   = 0.8;
const WRITING_TILE_SVG_SCALE    = 0.9;
const READING_TILE_SVG_SCALE    = 1.1;
const LISTENING_TILE_SVG_SCALE  = 1;

const SKILL_TILE_SVG_SCALES: Record<RoadmapSkill, number> = {
    vocabulary: VOCABULARY_TILE_SVG_SCALE,
    grammar:    GRAMMAR_TILE_SVG_SCALE,
    speaking:   SPEAKING_TILE_SVG_SCALE,
    writing:    WRITING_TILE_SVG_SCALE,
    reading:    READING_TILE_SVG_SCALE,
    listening:  LISTENING_TILE_SVG_SCALE,
};

const RINGED_TILE_ICON_BASE_SIZE   = 50;
const NO_RING_TILE_ICON_BASE_SIZE  = 60;

// ─── Ring SVG constants (desktop) ────────────────────────────────────────────
const RING_SIZE          = 148;
const RING_STROKE        = 8;
const RING_RADIUS        = (RING_SIZE - RING_STROKE) / 2;  // 70
const RING_CENTER        = RING_SIZE / 2;                   // 74
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ─── FeatureCircle ────────────────────────────────────────────────────────────
interface FeatureCircleProps {
    tile: typeof FEATURE_TILES[0];
    progress: number;
    isActive: boolean;
    onClick: () => void;
    index: number;
    /** roadmap mode: feature has no content on this day */
    unavailable?: boolean;
    /** roadmap mode: first day the feature becomes available */
    startsOnDay?: number | null;
    forceNoRing?: boolean;
}

const FeatureCircle: React.FC<FeatureCircleProps> = ({
    tile, progress, isActive, onClick, index, unavailable = false, forceNoRing = false,
}) => {
    const noRing = forceNoRing || unavailable;
    const [animProg, setAnimProg] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setAnimProg(progress), 80 + index * 60);
        return () => clearTimeout(t);
    }, [progress, index]);

    const offset = RING_CIRCUMFERENCE - (animProg / 100) * RING_CIRCUMFERENCE;
    // White background for all; light grey when unavailable
    const bgColor = unavailable ? '#e0e0e5' : '#ffffff';
    // Icon size: larger for no-ring circles, scaled per skill
    const baseIconSize = noRing ? NO_RING_TILE_ICON_BASE_SIZE : RINGED_TILE_ICON_BASE_SIZE;
    const iconSize = Math.round(baseIconSize * SKILL_TILE_SVG_SCALES[tile.type]);

    return (
        <button
            className={`feat-circle-btn${isActive ? ' feat-circle-btn--active' : ''}${unavailable ? ' feat-circle-btn--unavailable' : ''}`}
            onClick={onClick}
            style={{ '--feat-bg': bgColor } as React.CSSProperties}
            aria-label={tile.title}
        >
            <div className={`feat-circle-wrap${noRing ? ' feat-circle-wrap--no-ring' : ''}`}>
                {/* Progress ring — only for ringed skills */}
                {!noRing && (
                    <svg
                        className="feat-circle-ring"
                        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        {/* Track */}
                        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
                            fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={RING_STROKE} />
                        {/* Fill — always green, always in DOM for smooth CSS transition */}
                        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={RING_STROKE}
                            strokeDasharray={RING_CIRCUMFERENCE}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            style={{
                                transform: 'rotate(-90deg)',
                                transformOrigin: '50% 50%',
                                transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                        />
                    </svg>
                )}

                {/* Inner white circle with floating SVG illustration */}
                <div className={`feat-circle-inner${noRing ? ' feat-circle-inner--no-ring' : ''}`}>
                    <div className={`feat-circle-icon${unavailable ? ' feat-circle-icon--unavailable' : ''}`}>
                        <img
                            src={SKILL_SVGS[tile.type]}
                            alt={tile.title}
                            width={iconSize}
                            height={iconSize}
                            draggable={false}
                        />
                    </div>
                </div>
            </div>

            <span className="feat-circle-label">{tile.title}</span>
        </button>
    );
};

// ─── RoadmapPopup ─────────────────────────────────────────────────────────────
interface RoadmapPopupProps {
    tile: typeof FEATURE_TILES[0];
    subtitle: string;
    requirement: string;
    progress: number;
    colIndex: number;
    unavailable: boolean;
    startsOnDay: number | null;
    onStart: () => void;
    onClose: () => void;
}

const RoadmapPopup: React.FC<RoadmapPopupProps> = ({
    tile, subtitle, requirement, progress, colIndex,
    unavailable, startsOnDay, onStart, onClose,
}) => {
    const isAuto     = NO_RING_SKILLS.has(tile.type);
    const isComplete = !isAuto && !unavailable && progress >= 100;

    return (
        <div
            className={`feat-popup feat-popup--col${colIndex}${unavailable ? ' feat-popup--unavailable' : ''}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="feat-popup-arrow" />

            {/* Header — SVG illustration + title + badge */}
            <div className="feat-popup-header">
                <div className="feat-popup-icon-wrap">
                    <img src={SKILL_SVGS[tile.type]} alt={tile.title} width={18} height={18} draggable={false} />
                </div>
                <span className="feat-popup-title">{tile.title}</span>
                {unavailable && startsOnDay != null ? (
                    <span className="feat-popup-badge feat-popup-badge--day">Day {startsOnDay}</span>
                ) : isAuto ? (
                    <span className="feat-popup-badge feat-popup-badge--auto">AUTO</span>
                ) : (
                    <span className="feat-popup-badge">
                        {isComplete ? '✓' : `${progress}%`}
                    </span>
                )}
            </div>

            {/* Body */}
            {unavailable ? (
                <p className="feat-popup-topic feat-popup-topic--unavailable">
                    {startsOnDay != null
                        ? `Available from Day ${startsOnDay}. Keep going!`
                        : 'No session scheduled for today.'}
                </p>
            ) : (
                subtitle && <p className="feat-popup-topic">{subtitle}</p>
            )}
            {!unavailable && requirement && (
                <div className="feat-popup-req">
                    <span className="feat-popup-req-label">TARGET</span>
                    <p className="feat-popup-req-text">{requirement}</p>
                </div>
            )}

            {/* Single unified action button — same "Got it" style for all */}
            <button
                className="feat-popup-close-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    if (unavailable) onClose();
                    else onStart();
                }}
            >
                {unavailable ? 'Got it' : isComplete ? 'Practice Again →' : 'Start →'}
            </button>
        </div>
    );
};

// ─── Pure helper: per-tile roadmap data (module-level so useMemo can reference it) ─
function buildTileInfo(currentDayPlan: DayPlan | undefined, rm: Roadmap) {
    const vocabTarget    = currentDayPlan?.vocabulary.target_cards || 31;
    const vocabRemaining = currentDayPlan?.vocabulary.remaining ?? vocabTarget;
    const vocabProgress  = vocabTarget > 0 ? Math.max(0, Math.min(100, Math.round(((vocabTarget - vocabRemaining) / vocabTarget) * 100))) : 0;

    const grammarTarget   = currentDayPlan?.grammar.target_score || 70;
    const grammarCurrent  = currentDayPlan?.grammar.current_score ?? 0;
    const grammarProgress = grammarTarget > 0 ? Math.max(0, Math.min(100, Math.round((grammarCurrent / grammarTarget) * 100))) : 0;

    const readingTarget   = currentDayPlan?.reading?.target_score  || 75;
    const readingCurrent  = currentDayPlan?.reading?.current_score ?? 0;
    const readingProgress = readingTarget > 0 ? Math.max(0, Math.min(100, Math.round((readingCurrent / readingTarget) * 100))) : 0;

    const listeningTarget   = currentDayPlan?.listening?.target_score  || 75;
    const listeningCurrent  = currentDayPlan?.listening?.current_score ?? 0;
    const listeningProgress = listeningTarget > 0 ? Math.max(0, Math.min(100, Math.round((listeningCurrent / listeningTarget) * 100))) : 0;

    const speakingTarget  = currentDayPlan?.speaking?.target_minutes;
    const speakingCurrent = currentDayPlan?.speaking?.current_seconds ?? 0;
    const speakingProgress = speakingTarget ? Math.max(0, Math.min(100, Math.round((speakingCurrent / (speakingTarget * 60)) * 100))) : 0;

    const writingTarget   = currentDayPlan?.writing?.target_words;
    const writingCurrent  = currentDayPlan?.writing?.current_words ?? 0;
    const writingProgress = writingTarget ? Math.max(0, Math.min(100, Math.round((writingCurrent / writingTarget) * 100))) : 0;

    const available: Record<RoadmapSkill, boolean> = {
        vocabulary: true,
        grammar:    true,
        speaking:   !!(currentDayPlan?.speaking?.topic?.trim()),
        writing:    !!(currentDayPlan?.writing?.topic?.trim()),
        reading:    !!(currentDayPlan?.reading?.topic),
        listening:  !!(currentDayPlan?.listening?.topic),
    };

    // Next FUTURE occurrence of each feature after the current day.
    // We intentionally exclude the current day itself (since it's unavailable — otherwise
    // the circle would not be greyed out). This prevents stale "Available from Day 1"
    // messages when a feature already started but has no session today.
    const cur = rm.current_day;

    const futureSpeaking  = (rm.speaking || []).filter(s => s.day > cur && !!s.topic?.trim());
    const futureWriting   = (rm.writing  || []).filter(w => w.day > cur && !!w.topic?.trim());
    const speakingNextDay = futureSpeaking.length > 0 ? Math.min(...futureSpeaking.map(s => s.day)) : null;
    const writingNextDay  = futureWriting.length  > 0 ? Math.min(...futureWriting.map(w => w.day))  : null;

    // For reading/listening we only have the absolute first day from the backend.
    // Only surface it when it's still in the future; otherwise the date is stale.
    const readingNextDay   = (rm.reading_starts_day   && rm.reading_starts_day   > cur) ? rm.reading_starts_day   : null;
    const listeningNextDay = (rm.listening_starts_day && rm.listening_starts_day > cur) ? rm.listening_starts_day : null;

    const startsOnDay: Record<RoadmapSkill, number | null> = {
        vocabulary: null,
        grammar:    null,
        speaking:   speakingNextDay,
        writing:    writingNextDay,
        reading:    readingNextDay,
        listening:  listeningNextDay,
    };

    const progresses: Record<RoadmapSkill, number> = {
        vocabulary: vocabProgress, grammar: grammarProgress,
        speaking: speakingProgress, writing: writingProgress,
        reading: readingProgress, listening: listeningProgress,
    };

    const subtitles: Record<RoadmapSkill, string> = {
        vocabulary: 'Flashcards',
        grammar:    currentDayPlan?.grammar.topic    || 'Grammar Practice',
        speaking:   currentDayPlan?.speaking.topic   || 'Speaking Practice',
        writing:    currentDayPlan?.writing.topic    || 'Writing Practice',
        reading:    currentDayPlan?.reading?.topic   || 'Reading Passage',
        listening:  currentDayPlan?.listening?.topic || 'Listening Exercise',
    };

    const requirements: Record<RoadmapSkill, string> = {
        vocabulary: `Complete ${vocabTarget} flashcards`,
        grammar:    `Achieve ${grammarTarget}% or higher`,
        speaking:   speakingTarget ? `Practice for ${speakingTarget} minutes` : '',
        writing:    writingTarget ? `Write ${writingTarget} words` : '',
        reading:    `Achieve ${readingTarget}% or higher`,
        listening:  `Achieve ${listeningTarget}% or higher`,
    };

    const navPaths: Record<RoadmapSkill, string> = {
        vocabulary: `/vocabulary?fromRoadmap=true&initialProgress=${vocabProgress}&initialLabel=${encodeURIComponent(`${Math.min(vocabTarget, Math.max(0, vocabTarget - vocabRemaining))} / ${vocabTarget} cards`)}`,
        grammar:    `/grammar?topic=${encodeURIComponent(currentDayPlan?.grammar.topic || 'Modal Verbs')}&fromRoadmap=true&initialProgress=${grammarProgress}&initialLabel=${encodeURIComponent(`${grammarCurrent}% / ${grammarTarget}% target`)}`,
        speaking:   `/speaking?scenario=${encodeURIComponent(currentDayPlan?.speaking.topic || 'Greetings')}&fromRoadmap=true&roadmapItem=${encodeURIComponent(`${rm.level}_DAY_${currentDayPlan?.day || rm.current_day}`)}&topic=${encodeURIComponent(currentDayPlan?.speaking.topic || 'Speaking Practice')}&targetMinutes=${encodeURIComponent(String(speakingTarget ?? ''))}&initialProgress=${speakingProgress}&initialLabel=${encodeURIComponent(`${Math.floor(speakingCurrent / 60)} / ${speakingTarget} min`)}`,
        writing:    `/writing?fromRoadmap=true&roadmapItem=${encodeURIComponent(`${rm.level}_DAY_${currentDayPlan?.day || rm.current_day}`)}&topic=${encodeURIComponent(currentDayPlan?.writing.topic || 'Writing Practice')}&targetWords=${encodeURIComponent(String(writingTarget ?? ''))}&initialProgress=${writingProgress}&initialLabel=${encodeURIComponent(`${writingCurrent} / ${writingTarget} words`)}`,
        reading:    `/reading?topic=${encodeURIComponent(currentDayPlan?.reading?.topic || '')}&fromRoadmap=true&initialProgress=${readingProgress}&initialLabel=${encodeURIComponent(`${readingCurrent}% / ${readingTarget}% target`)}`,
        listening:  `/listening?topic=${encodeURIComponent(currentDayPlan?.listening?.topic || '')}&fromRoadmap=true&initialProgress=${listeningProgress}&initialLabel=${encodeURIComponent(`${listeningCurrent}% / ${listeningTarget}% target`)}`,
    };

    return { progresses, subtitles, requirements, navPaths, available, startsOnDay };
}

const getModuleProgressAverage = (progresses: Record<RoadmapSkill, number>) => {
    const total = MODULE_PROGRESS_SKILLS.reduce((sum, skill) => sum + (progresses[skill] ?? 0), 0);
    return Math.max(0, Math.min(100, Math.round(total / MODULE_PROGRESS_SKILLS.length)));
};

const getRoadmapDayProgress = (rm: Roadmap) => {
    if (!rm.days) return 0;
    return Math.max(0, Math.min(100, Math.round((rm.current_day / rm.days) * 100)));
};

// ─── Main component ───────────────────────────────────────────────────────────
export const LangeyRoadmap: React.FC<LangeyRoadmapProps> = ({
    level,
    refreshTrigger,
    onRefreshDone,
    roadmapEnabled = false,
    setupTrigger = 0,
    onRoadmapEnabledChange,
    onRoadmapPresenceChange,
    onRoadmapDataUpdate,
    resetTrigger,
}) => {
    const navigate         = useNavigate();
    const [activeCircle, setActiveCircle]         = useState<RoadmapSkill | null>(null);
    const isMobileView = useIsMobileLayout();
    const circleGridRef    = useRef<HTMLDivElement | null>(null);
    const [selectedDays, setSelectedDays]         = useState<number>(DAYS_OPTIONS[level]?.[0] || 22);
    const [selectedTopic, setSelectedTopic]       = useState<string>('');
    const [isTopicSelectorOpen, setIsTopicSelectorOpen] = useState(false);
    const [isLoading, setIsLoading]               = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [, setIsRefreshingStats] = useState(false);
    const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false);
    const location     = useLocation();
    const prevPathname = useRef(location.pathname);

    // Stats ring data — starts at 0, animates in after load
    const [statsData, setStatsData] = useState<Record<RoadmapSkill, number>>({
        vocabulary: 0, grammar: 0, speaking: 0, writing: 0, reading: 0, listening: 0,
    });
    // Bumped after each qualifying roadmap fetch to drive the stats animation
    const [statsAnimTrigger, setStatsAnimTrigger] = useState(0);

    // ── FIRST: smart stats refresh flag ──────────────────────────────────────
    // true on mount (page load/reload) or when user visits a trackable feature.
    // Stats are only re-fetched when this is true on the next Modules open.
    const statsNeedsRefresh = useRef(true);

    const [roadmaps, setRoadmaps] = useState<{ [key: string]: Roadmap }>({});

    const [consumerId, setConsumerId] = useState(() => UserTracker.getOrCreateConsumerId());
    const selectorRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const refreshConsumerId = () => setConsumerId(UserTracker.getOrCreateConsumerId());
        window.addEventListener('langey:consumer-id-changed', refreshConsumerId);
        return () => {
            window.removeEventListener('langey:consumer-id-changed', refreshConsumerId);
        };
    }, []);

    const roadmap     = roadmaps[level] || null;
    const daysOptions = DAYS_OPTIONS[level] || [22, 44, 66];
    const topics      = SELECTABLE_TOPICS;

    // ── Compute allTasksDone at component level so it can be surfaced to parent ─
    const allTasksDone = useMemo(() => {
        if (!roadmapEnabled || !roadmap) return false;
        const currentDayPlan = roadmap.plan.find(p => p.day === roadmap.current_day);
        const ti = buildTileInfo(currentDayPlan, roadmap);
        return !!(
            (ti.progresses.vocabulary ?? 0) >= 100 &&
            (ti.progresses.grammar    ?? 0) >= 100 &&
            (!ti.available.speaking  || (ti.progresses.speaking  ?? 0) >= 100) &&
            (!ti.available.writing   || (ti.progresses.writing   ?? 0) >= 100) &&
            (!ti.available.reading   || (ti.progresses.reading   ?? 0) >= 100) &&
            (!ti.available.listening || (ti.progresses.listening ?? 0) >= 100)
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roadmapEnabled, roadmap, level]);

    // Reset UI state when level changes
    useEffect(() => {
        setSelectedDays(DAYS_OPTIONS[level]?.[0] || 22);
        setSelectedTopic('');
        setIsTopicSelectorOpen(false);
        setActiveCircle(null);
    }, [level]);

    useEffect(() => {
        const onDocClick = (event: MouseEvent) => {
            if (isTopicSelectorOpen && selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsTopicSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [isTopicSelectorOpen]);

    useEffect(() => {
        if (!activeCircle || isMobileView) return;
        const onOutside = (e: MouseEvent) => {
            if (circleGridRef.current && !circleGridRef.current.contains(e.target as Node)) {
                setActiveCircle(null);
            }
        };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, [activeCircle, isMobileView]);

    // ── FIRST: mark dirty when user visits a trackable feature ───────────────
    useEffect(() => {
        if (STATS_DIRTY_PATHS.has(location.pathname)) {
            statsNeedsRefresh.current = true;
        }
    }, [location.pathname]);

    // ── SECOND: fetch only the current level's roadmap ────────────────────────
    const fetchRoadmaps = async (isRefresh = false) => {
        if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
            setStatsData({ vocabulary: 0, grammar: 0, speaking: 0, writing: 0, reading: 0, listening: 0 });
            setIsInitialLoading(false);
            setIsRefreshingStats(false);
            return;
        }

        const shouldLoadStats = !isRefresh || statsNeedsRefresh.current;

        if (shouldLoadStats && !isRefresh) {
            // Zero out rings so they animate in from empty
            setStatsData({ vocabulary: 0, grammar: 0, speaking: 0, writing: 0, reading: 0, listening: 0 });
        }

        if (isRefresh) setIsRefreshingStats(true);
        else           setIsInitialLoading(true);

        try {
            // Pass level so the backend only enriches that one roadmap
            const response = await getRoadmap<RoadmapsResponse>(consumerId, level);
            const data     = await response.json();
            if (data.success && data.roadmaps) {
                setRoadmaps(data.roadmaps);
                // Only call presence callback for the level we actually fetched
                onRoadmapPresenceChange?.(level, !!data.roadmaps[level]);
            } else {
                setRoadmaps(prev => { const updated = { ...prev }; delete updated[level]; return updated; });
                onRoadmapPresenceChange?.(level, false);
            }
        } catch (error) {
            console.error('Error fetching roadmaps:', error);
            setRoadmaps(prev => { const updated = { ...prev }; delete updated[level]; return updated; });
            onRoadmapPresenceChange?.(level, false);
        } finally {
            setIsInitialLoading(false);
            setIsRefreshingStats(false);
            if (isRefresh) onRefreshDone?.();

            if (shouldLoadStats) {
                statsNeedsRefresh.current = false;
                setStatsAnimTrigger(t => t + 1);
            }
        }
    };

    // Lean stats endpoint — only the current level, only 4 features
    const fetchStats = async (lv: string) => {
        if (consumerId === UserTracker.PENDING_CONSUMER_ID) return;
        try {
            const response = await getModulesProgress<ModulesProgressResponse>(consumerId, lv);
            const data = await response.json();
            if (data.success) {
                setStatsData({
                    vocabulary: data.vocabulary ?? 0,
                    grammar:    data.grammar    ?? 0,
                    speaking:   data.speaking   ?? 0,
                    writing:    data.writing    ?? 0,
                    reading:    data.reading    ?? 0,
                    listening:  data.listening  ?? 0,
                });
            }
        } catch { /* silently ignore */ }
    };

    // Initial load — skip API calls until cookie consent is answered
    useEffect(() => {
        if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
            setIsInitialLoading(false);
            return;
        }
        fetchRoadmaps(false);
    }, [consumerId]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    // Re-fetch when Modules tab is re-opened
    useEffect(() => {
        if (refreshTrigger === undefined || refreshTrigger === 0) return;
        fetchRoadmaps(true);
    }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    // Stats animation: fires (with delay for visual effect) after qualifying fetch
    useEffect(() => {
        if (statsAnimTrigger === 0) return;
        const t = setTimeout(() => fetchStats(level), 350);
        return () => clearTimeout(t);
    }, [statsAnimTrigger, level]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    // Level change: zero rings immediately; statsAnimTrigger dep handles the re-fetch
    useEffect(() => {
        setStatsData({ vocabulary: 0, grammar: 0, speaking: 0, writing: 0, reading: 0, listening: 0 });
        // Re-fetch roadmap for the new level (always needed — different level's data)
        fetchRoadmaps(false);
    }, [level]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    // Pathname → Modules: refresh roadmap (stats flag already handled above)
    useEffect(() => {
        if (location.pathname === '/' && prevPathname.current !== '/') {
            fetchRoadmaps(true);
        }
        prevPathname.current = location.pathname;
    }, [location.pathname, consumerId]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    useEffect(() => {
        if (!resetTrigger) return;
        setRoadmaps(prev => { const u = { ...prev }; delete u[level]; return u; });
        setSelectedTopic('');
        setSelectedDays(DAYS_OPTIONS[level]?.[0] || 22);
        setActiveCircle(null);
        setIsSetupSheetOpen(false);
        onRoadmapPresenceChange?.(level, false);
    }, [resetTrigger]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    useEffect(() => {
        const r = roadmaps[level];
        onRoadmapDataUpdate?.(level, r?.current_day ?? null, r?.days ?? null);
    }, [level, roadmaps]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    useEffect(() => {
        if (!setupTrigger) return;
        const openOrEnableExistingRoadmap = async () => {
            if (roadmaps[level]) {
                onRoadmapEnabledChange?.(true);
                return;
            }

            try {
                const response = await getRoadmap<RoadmapsResponse>(consumerId, level);
                const data = await response.json();
                const existingRoadmap = data.success && data.roadmaps ? data.roadmaps[level] : null;

                if (existingRoadmap) {
                    setRoadmaps(data.roadmaps);
                    onRoadmapEnabledChange?.(true);
                    onRoadmapDataUpdate?.(level, existingRoadmap.current_day ?? null, existingRoadmap.days ?? null);
                    return;
                }
            } catch (error) {
                console.error('Error checking existing roadmap:', error);
            }

            setSelectedTopic('');
            setSelectedDays(DAYS_OPTIONS[level]?.[0] || 22);
            setIsTopicSelectorOpen(false);
            setIsSetupSheetOpen(true);
        };

        openOrEnableExistingRoadmap();
    }, [setupTrigger]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!selectedTopic) return;
        setIsLoading(true);
        try {
            const response = await createRoadmap<CreateRoadmapResponse>({ consumer_id: consumerId, level, days: selectedDays, user_scenario: selectedTopic });
            const data = await response.json();
            if (data.success && data.roadmap) {
                setRoadmaps(prev => ({ ...prev, [level]: data.roadmap }));
                onRoadmapEnabledChange?.(true);
                onRoadmapPresenceChange?.(level, true);
                setIsSetupSheetOpen(false);
            } else {
                alert(data.error || 'Failed to create roadmap');
            }
        } catch (error) {
            console.error('Error creating roadmap:', error);
            alert('Failed to create roadmap. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevDay = async () => {
        if (!roadmap || roadmap.current_day <= 1) return;
        try {
            await updateRoadmapProgress({ consumer_id: consumerId, level, current_day: roadmap.current_day - 1 });
            setActiveCircle(null);
            fetchRoadmaps(true);
        } catch (error) { console.error('Error going to previous day:', error); }
    };

    const handleNextDay = async () => {
        if (!roadmap) return;
        const nextDay = roadmap.current_day + 1;
        if (nextDay > roadmap.days) return;
        try {
            await updateRoadmapProgress({ consumer_id: consumerId, level, current_day: nextDay });
            setActiveCircle(null);
            fetchRoadmaps(true);
        } catch (error) { console.error('Error moving to next day:', error); }
    };

    const handleTopicSelect = (topic: string) => {
        setSelectedTopic(topic);
        setIsTopicSelectorOpen(false);
    };

    // ── Setup UI ──────────────────────────────────────────────────────────────
    const renderTopicItems = () => (
        <ul className="gg-roadmap-topic-list">
            {topics.map((t) => (
                <li
                    key={t}
                    className={`gg-roadmap-topic-item ${selectedTopic === t ? 'selected' : ''}`}
                    onClick={() => handleTopicSelect(t)}
                >
                    <span className="gg-roadmap-topic-item-text">{t}</span>
                    {selectedTopic === t && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </li>
            ))}
        </ul>
    );

    const renderSetupContent = () => (
        <div className="gg-roadmap-setup-content">
            <div className="gg-roadmap-setup-icon" aria-hidden="true">
                <Languages size={24} strokeWidth={2} />
            </div>
            <h2 className="gg-roadmap-setup-title">Configure {level} Roadmap</h2>
            <div className="gg-roadmap-section">
                <label className="gg-roadmap-section-label">LEARNING FOCUS</label>
                <div className="gg-roadmap-topic-selector" ref={selectorRef}>
                    <button type="button" className="gg-roadmap-topic-trigger" onClick={() => setIsTopicSelectorOpen(v => !v)}>
                        <span className={selectedTopic ? '' : 'placeholder'}>{selectedTopic || 'Select a topic'}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {isTopicSelectorOpen && (
                        <div className="gg-roadmap-topic-dropdown">{renderTopicItems()}</div>
                    )}
                </div>
            </div>
            <div className="gg-roadmap-section">
                <label className="gg-roadmap-section-label">DURATION</label>
                <div className="gg-roadmap-toggle">
                    {daysOptions.map((days) => (
                        <button key={days} className={`gg-roadmap-toggle-btn ${selectedDays === days ? 'active' : ''}`} onClick={() => setSelectedDays(days)}>
                            {days} Days
                        </button>
                    ))}
                </div>
            </div>
            <button className={`gg-roadmap-generate-btn-full ${isLoading ? 'loading' : ''}`} onClick={handleGenerate} disabled={isLoading || !selectedTopic}>
                {isLoading ? <span className="gg-roadmap-btn-spinner" /> : <>Start Journey</>}
            </button>
        </div>
    );

    const renderSetupSheet = () => ReactDOM.createPortal(
        <>
            <div className="gg-roadmap-config-overlay" onClick={() => setIsSetupSheetOpen(false)} />
            <div className="gg-roadmap-config-sheet">
                <button className="gg-roadmap-sheet-close gg-roadmap-sheet-close-floating" onClick={() => setIsSetupSheetOpen(false)} aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
                {renderSetupContent()}
            </div>
        </>,
        document.body
    );

    // ── THIRD: per-tile roadmap data including availability ───────────────────
    // ── Circle grid ───────────────────────────────────────────────────────────
    const renderCircleGrid = (roadmapActive: boolean, currentDayPlan: DayPlan | undefined) => {
        const tileInfo = (roadmapActive && roadmap) ? buildTileInfo(currentDayPlan, roadmap) : null;

        return (
            <div className="feat-circles-grid" ref={circleGridRef} data-tour="langey-guide-modules">
                {FEATURE_TILES.map((tile, index) => {
                    const colIndex   = index % 3;
                    const isActive   = activeCircle === tile.type;
                    const unavail    = roadmapActive && !(tileInfo?.available[tile.type] ?? true);
                    const startsOn   = tileInfo?.startsOnDay[tile.type] ?? null;

                    let ringProgress = 0;
                    if (roadmapActive && !unavail) {
                        ringProgress = tileInfo?.progresses[tile.type] ?? 0;
                    } else if (!roadmapActive && !NO_RING_SKILLS.has(tile.type)) {
                        ringProgress = statsData[tile.type];
                    }
                    const forceNoRing = NO_RING_SKILLS.has(tile.type);

                    const navPath  = tileInfo?.navPaths[tile.type]    ?? tile.basePath;
                    const subtitle = tileInfo?.subtitles[tile.type]   ?? '';
                    const req      = tileInfo?.requirements[tile.type] ?? '';

                    const handleClick = () => {
                        if (!roadmapActive) { navigate(tile.basePath); return; }
                        setActiveCircle(isActive ? null : tile.type);
                    };

                    return (
                        <div key={tile.type} className={`feat-circle-item${isActive ? ' feat-circle-item--active' : ''}`}>
                            <FeatureCircle
                                tile={tile}
                                progress={ringProgress}
                                isActive={isActive}
                                onClick={handleClick}
                                index={index}
                                unavailable={unavail}
                                startsOnDay={startsOn}
                                forceNoRing={forceNoRing}
                            />
                            {roadmapActive && isActive && !isMobileView && (
                                <RoadmapPopup
                                    tile={tile}
                                    subtitle={subtitle}
                                    requirement={req}
                                    progress={ringProgress}
                                    colIndex={colIndex}
                                    unavailable={unavail}
                                    startsOnDay={startsOn}
                                    onStart={() => { setActiveCircle(null); navigate(navPath); }}
                                    onClose={() => setActiveCircle(null)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMobileCirclePopup = (
        roadmapActive: boolean,
        currentDayPlan: DayPlan | undefined,
    ) => {
        if (!isMobileView || !roadmapActive || !activeCircle || !roadmap) return null;

        const tileInfo = buildTileInfo(currentDayPlan, roadmap);
        const tile     = FEATURE_TILES.find(t => t.type === activeCircle);
        if (!tile) return null;

        const index      = FEATURE_TILES.findIndex(t => t.type === activeCircle);
        const colIndex   = index % 3;
        const unavail    = !(tileInfo.available[tile.type] ?? true);
        const startsOn   = tileInfo.startsOnDay[tile.type] ?? null;
        const ringProgress = unavail ? 0 : (tileInfo.progresses[tile.type] ?? 0);
        const navPath    = tileInfo.navPaths[tile.type] ?? tile.basePath;
        const subtitle   = tileInfo.subtitles[tile.type] ?? '';
        const req        = tileInfo.requirements[tile.type] ?? '';

        return ReactDOM.createPortal(
            <>
                <div
                    className="gg-roadmap-config-overlay feat-popup-overlay"
                    onClick={() => setActiveCircle(null)}
                    aria-hidden="true"
                />
                <RoadmapPopup
                    tile={tile}
                    subtitle={subtitle}
                    requirement={req}
                    progress={ringProgress}
                    colIndex={colIndex}
                    unavailable={unavail}
                    startsOnDay={startsOn}
                    onStart={() => { setActiveCircle(null); navigate(navPath); }}
                    onClose={() => setActiveCircle(null)}
                />
            </>,
            document.body,
        );
    };

    // ── Unified view — circles only, no arrows (day nav is in header pill) ──────
    const renderView = () => {
        const roadmapActive  = roadmapEnabled && !!roadmap;
        const currentDayPlan = roadmapActive ? roadmap!.plan.find(p => p.day === roadmap!.current_day) : undefined;
        const moduleProgress = roadmapActive && roadmap
            ? getRoadmapDayProgress(roadmap)
            : getModuleProgressAverage(statsData);
        const progressStyle = { '--roadmap-progress': `${moduleProgress}%` } as React.CSSProperties;

        return (
            <div className={`gg-roadmap-view${!roadmapActive ? ' gg-roadmap-view-simple' : ''}`}>
                <div className="gg-roadmap-scroll-body">
                    <div className="gg-roadmap-nav-wrap">
                        {renderCircleGrid(roadmapActive, currentDayPlan)}
                    </div>
                </div>
                <div className="gg-roadmap-module-progress" data-tour="langey-guide-progress">
                    <div className={`gg-progress-pill gg-roadmap-module-progress-pill${roadmapActive ? ' gg-roadmap-module-progress-pill--with-nav' : ''}`} style={progressStyle}>
                        {roadmapActive && roadmap ? (
                            <>
                                {/* Left: nav button + start day */}
                                <div className="gg-roadmap-pill-side gg-roadmap-pill-side--left">
                                    <button
                                        type="button"
                                        className="gg-roadmap-pill-nav-btn"
                                        onClick={handlePrevDay}
                                        disabled={roadmap.current_day <= 1}
                                        aria-label="Previous day"
                                    >
                                        <ChevronLeft size={20} strokeWidth={2.5} />
                                    </button>
                                    <span className="gg-roadmap-pill-day"><span className="gg-roadmap-pill-day-word">Day </span>{roadmap.current_day}</span>
                                </div>

                                {/* Center: combined Roadmap+% tag + level tag */}
                                <div className="gg-roadmap-pill-center">
                                    <span className="gg-roadmap-pill-tag">Roadmap {moduleProgress}%</span>
                                    <span className="gg-roadmap-pill-tag">{level}</span>
                                </div>

                                {/* Right: end day + nav button */}
                                <div className="gg-roadmap-pill-side gg-roadmap-pill-side--right">
                                    <span className="gg-roadmap-pill-day"><span className="gg-roadmap-pill-day-word">Day </span>{roadmap.days}</span>
                                    <button
                                        type="button"
                                        className="gg-roadmap-pill-nav-btn"
                                        onClick={handleNextDay}
                                        disabled={!allTasksDone || roadmap.current_day >= roadmap.days}
                                        aria-label="Next day"
                                    >
                                        <ChevronRight size={20} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* No roadmap: center only — combined Progress+% tag + level tag */
                            <div className="gg-roadmap-pill-center">
                                <span className="gg-roadmap-pill-tag">Progress {moduleProgress}%</span>
                                <span className="gg-roadmap-pill-tag">{level}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isInitialLoading) {
        return <div className="gg-roadmap gg-roadmap-loading"><div className="gg-roadmap-spinner" /></div>;
    }

    const roadmapActive  = roadmapEnabled && !!roadmap;
    const currentDayPlan = roadmapActive ? roadmap!.plan.find(p => p.day === roadmap!.current_day) : undefined;

    return (
        <div className="gg-roadmap">
            {renderView()}
            {renderMobileCirclePopup(roadmapActive, currentDayPlan)}
            {isSetupSheetOpen && renderSetupSheet()}
        </div>
    );
};
