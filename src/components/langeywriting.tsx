import React, { useEffect, useState, useRef } from 'react';
import { UserTracker } from '../utils/userTracking';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { CreditLimitBlock } from './CreditLimitBlock';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import type { GrammarTopicsByLevel, PracticeMode, RoadmapModuleProps } from '../features/learning/moduleTypes';
import { WritingProgressRing } from './writing/WritingProgressRing';
import { WritingTypewriter as TypeWriter } from './writing/WritingTypewriter';
import { checkWritingGrammar, checkWritingVocabulary, deleteWritingPassage, getWritingPassages } from '../services/learningApi';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - allow JSON import
import levelTopicsData from '../../data/all_grammar_topics.json';

const cx = (...classes: Array<string | false | undefined | null>) => classes.filter(Boolean).join(' ');

const GLOW_BORDER =
  'before:pointer-events-none before:absolute before:inset-[-1px] before:-z-10 before:bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] before:bg-size-[400%_400%] before:animate-settings-glow';

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

const FIELD_LEFT = cx('max-w-[50%] flex-1 text-left', 'max-lg:w-full max-lg:max-w-none', 'max-sm:max-w-full');

const LABEL = 'mb-1.5 block text-xs text-[#444] max-lg:hidden';

const ACTION_BTN = cx(
  'flex h-[38px] min-w-[90px] flex-[1_1_0px] cursor-pointer items-center justify-center rounded-[10px] border border-black/20',
  'bg-gradient-to-br from-black to-[#333] px-[18px] text-sm font-medium text-white',
  'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] backdrop-blur-[4px] transition-all duration-300',
  'enabled:hover:-translate-y-px enabled:hover:from-[#333] enabled:hover:to-[#555]',
  'enabled:hover:shadow-[0_6px_10px_-1px_rgba(0,0,0,0.15),0_4px_6px_-1px_rgba(0,0,0,0.1)]',
  'enabled:active:translate-y-0 enabled:active:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.06)]',
  'disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/15 disabled:text-black/40 disabled:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]',
  'max-lg:!h-auto max-lg:!min-h-[46px] max-lg:!w-0 max-lg:!min-w-0 max-lg:flex-[1_1_0%] max-lg:!rounded-xl max-lg:!border-[#eee] max-lg:!bg-white max-lg:!px-2.5 max-lg:!py-3 max-lg:!text-sm max-lg:!font-medium max-lg:!text-[#333] max-lg:!shadow-none max-lg:enabled:hover:!translate-y-0',
  'max-lg:disabled:!border-black/10 max-lg:disabled:!bg-black/15 max-lg:disabled:!text-black/40',
  'max-sm:min-w-[80px] max-sm:flex-1 max-sm:px-3.5 max-sm:text-[13px]',
);

const VOCAB_BTN = cx(
  ACTION_BTN,
  'max-lg:!border-black max-lg:!bg-black max-lg:!text-white',
  'max-lg:disabled:!border-black/10 max-lg:disabled:!bg-black/15 max-lg:disabled:!text-black/40',
);

const GRAMMAR_BTN = cx(
  ACTION_BTN,
  'relative !border-black/15 !bg-[rgba(248,248,248,0.9)] !text-black/80 backdrop-blur-xl',
  'before:content-[""] before:rounded-[10px] before:opacity-80 disabled:before:opacity-20',
  GLOW_BORDER,
  'enabled:hover:!bg-[rgba(248,248,248,0.95)] enabled:hover:-translate-y-px',
  'max-lg:!border-transparent max-lg:!bg-gradient-to-r max-lg:!from-[#e2bea9] max-lg:!to-[#b8b0d3] max-lg:!text-black max-lg:before:!hidden',
  'max-lg:enabled:hover:!bg-gradient-to-r max-lg:enabled:hover:!from-[#e2bea9] max-lg:enabled:hover:!to-[#b8b0d3] max-lg:enabled:hover:translate-y-0',
);

const ACTION_BUTTONS = cx(
  'flex max-w-[50%] flex-1 flex-wrap items-end justify-end gap-3',
  'max-lg:mb-2.5 max-lg:flex max-lg:w-full max-lg:max-w-none max-lg:shrink-0 max-lg:justify-stretch max-lg:gap-2',
  'max-sm:mt-2 max-sm:w-full max-sm:max-w-none max-sm:flex-none max-sm:gap-2',
);

const WRITING_BOX = cx(
  'relative mb-5 flex h-[400px] w-full max-w-[800px] flex-col rounded-2xl border border-black/10 bg-white/80 p-6',
  'shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300',
  '[&>.gg-credit-limit-block]:min-h-0 [&>.gg-credit-limit-block]:flex-1 [&>.gg-credit-limit-block]:p-0',
  'max-lg:mb-0 max-lg:h-auto max-lg:min-h-0 max-lg:max-w-none max-lg:flex-[1_1_auto] max-lg:overflow-y-auto max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:p-0 max-lg:pb-5 max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-lg:[&>.gg-credit-limit-block]:min-h-full max-lg:[&>.gg-credit-limit-block]:p-6',
  'max-sm:mb-4 max-sm:h-[350px] max-sm:p-4',
);

const TEXTAREA = cx(
  'm-0 h-full w-full resize-none border-0 bg-transparent p-0 pb-10 font-inherit text-lg leading-[1.6] text-black outline-none',
  'max-sm:text-base',
  'max-lg:text-lg max-lg:leading-7 max-lg:p-6',
);

const TEXTAREA_CORRECTIONS = cx(
  'text-transparent caret-black',
  'max-lg:block max-lg:overflow-y-auto max-lg:pb-[calc(120px+env(safe-area-inset-bottom,0px))] max-lg:[-webkit-overflow-scrolling:touch]',
);

const OVERLAY = cx(
  'pointer-events-none absolute inset-6 z-[1] bg-transparent',
  'max-sm:inset-4',
  'max-lg:inset-6 max-lg:bottom-[calc(120px+env(safe-area-inset-bottom,0px))]',
);

const OVERLAY_CORRECTIONS = cx(
  'max-lg:bottom-6 max-lg:overflow-hidden max-lg:p-0',
);

const DISPLAY = cx(
  'm-0 h-full w-full overflow-y-auto p-0 pb-10 text-left font-inherit text-lg leading-[1.6] whitespace-pre-wrap text-black',
  'max-sm:text-base',
  'max-lg:text-lg max-lg:leading-7',
);

const DISPLAY_CORRECTIONS = cx(
  'max-lg:h-full max-lg:min-h-0 max-lg:overflow-y-hidden max-lg:pb-[calc(120px+env(safe-area-inset-bottom,0px))]',
);

const ERROR_HIGHLIGHT =
  'relative cursor-pointer border-b-2 border-[#ff4d4f] bg-red-500/10 transition-all duration-200 hover:bg-red-500/20 pointer-events-auto';

const ERROR_POPUP = cx(
  'z-[2000] w-[min(320px,calc(100vw-24px))] min-w-0 max-w-[calc(100vw-24px)] rounded-xl border border-black/10 bg-white p-4 text-left',
  'shadow-[0_10px_30px_rgba(0,0,0,0.15)]',
);

const POPUP_BTN =
  'mt-1.5 ml-2 cursor-pointer rounded-md border border-[#ccc] bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-[#e0e0e0]';

const POPUP_REPLACE_BTN =
  'mt-1.5 ml-2 cursor-pointer rounded-md border-0 bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333]';

const HINT_BAR = cx(
  'relative flex w-full max-w-[800px] min-h-[80px] items-center justify-center overflow-hidden rounded-2xl border border-black/15',
  'bg-[rgba(248,248,248,0.9)] px-5 py-4',
  'shadow-[0_8px_20px_-5px_rgba(0,0,0,0.1),0_6px_8px_-5px_rgba(0,0,0,0.04)] backdrop-blur-xl',
  'before:content-[""] before:rounded-2xl before:opacity-80',
  GLOW_BORDER,
  'max-lg:relative max-lg:inset-auto max-lg:bottom-auto max-lg:shrink-0 max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:px-8 max-lg:py-6 max-lg:pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-lg:shadow-none max-lg:backdrop-blur-none',
  'max-lg:before:inset-0 max-lg:before:rounded-none max-lg:before:bg-gradient-to-r max-lg:before:from-[#e2bea9] max-lg:before:to-[#b8b0d3] max-lg:before:opacity-80 max-lg:before:z-0',
);

const HINT_BAR_STATS = cx(HINT_BAR, 'min-h-16 max-w-[600px] justify-between gap-3');

const HINT_CONTENT = cx(
  'relative z-[1] max-w-full text-center text-sm leading-normal font-bold break-words whitespace-pre-line text-[#333]',
  'max-lg:w-full max-lg:max-w-none max-lg:text-base max-lg:font-normal max-lg:leading-6 max-lg:text-[#1a1a1a]',
);

const CUSTOM_SELECTOR = 'relative max-lg:mb-3 max-lg:w-full';

const SELECTOR_TRIGGER = cx(
  'flex w-full min-h-[42px] cursor-pointer items-center justify-between rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[#222]',
  '[&_svg]:opacity-60',
  'max-lg:min-h-[46px] max-lg:rounded-xl max-lg:border-[#ccc] max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-normal max-lg:shadow-none',
);

const SELECTOR_TRIGGER_STATIC = cx(
  SELECTOR_TRIGGER,
  'box-border cursor-default justify-start overflow-hidden text-ellipsis whitespace-nowrap text-[0.8em] leading-[1.2]',
  'max-lg:text-[calc(16px*0.8)]',
);

const DROPDOWN_PANEL = cx(
  'absolute inset-x-0 top-[calc(100%+8px)] z-30 max-h-[260px] overflow-y-auto rounded-xl border border-black/12 bg-white p-2',
  'shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] max-lg:hidden',
);

const TOPIC_LIST = 'm-0 grid list-none gap-1.5 p-0 max-lg:max-h-none max-lg:pb-[30px]';

const topicItemClass = (selected: boolean) =>
  cx(
    'flex cursor-pointer items-center justify-between gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-indigo-500/8',
    'max-lg:min-h-12 max-lg:rounded-none max-lg:border-b max-lg:border-[#f5f5f5] max-lg:bg-transparent max-lg:px-0 max-lg:py-3.5',
    selected && 'bg-indigo-500/12 max-lg:bg-transparent',
  );

const topicTitleClass = (selected: boolean) =>
  cx(
    'flex-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#222]',
    'max-lg:text-[15px] max-lg:text-[#333]',
    selected && 'max-lg:font-semibold max-lg:text-indigo-500',
  );

const DELETE_PASSAGE_BTN =
  'flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-1 text-[#999] hover:text-[#ff4d4f]';

const SHEET_OVERLAY = 'fixed inset-0 z-[700] bg-transparent';

const BOTTOM_SHEET = cx(
  'fixed inset-x-0 bottom-0 z-[701] box-border min-h-[60dvh] max-h-[60dvh] overflow-x-hidden rounded-t-3xl border-0 bg-white p-4',
  'pb-[calc(16px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_20px_rgba(0,0,0,0.1)]',
);

const SHEET_HEADER = 'mb-5 flex items-center justify-between px-2.5 py-0';

const SHEET_TITLE = 'text-xl font-bold text-[#1a1a1a]';

const SHEET_CLOSE = cx(
  'flex size-[34px] cursor-pointer items-center justify-center rounded-lg border border-black/20 bg-transparent text-black/60',
  'hover:border-black/40 hover:text-black/80',
);

const DELETE_OVERLAY = cx(
  'fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-5',
  'max-lg:box-border',
);

const DELETE_DIALOG_BTN = cx(
  ACTION_BTN,
  'max-lg:min-w-0 max-lg:flex-1 max-lg:px-3 max-lg:py-2.5',
);

const DELETE_DIALOG = cx(
  WRITING_BOX,
  'h-auto max-h-none max-w-[400px] cursor-default p-6',
  'max-lg:mx-0 max-lg:max-w-[300px] max-lg:flex-none max-lg:rounded-[14px] max-lg:border-[1.5px] max-lg:border-black max-lg:p-[18px_16px] max-lg:shadow-[0_12px_40px_rgba(0,0,0,0.22)]',
);

const SPINNER = 'mx-auto size-6 animate-spin rounded-full border-2 border-black/10 border-t-black';

interface Correction {
  original: string;
  correction: string;
  type?: string;
  explanation?: string;
  topic_code?: string;
  result?: 'correct' | 'incorrect';
}

interface Passage {
  id: string;
  passage: string;
  level: string;
  created_at: string;
  grammar_evaluation?: GrammarEvaluation | null;
  roadmap_item_key?: string | null;
}

interface GrammarEvaluationCount {
  level: 'A1' | 'A2' | 'B1';
  correct_attempt_count: number;
  incorrect_attempt_count: number;
}

type GrammarEvaluation = Record<string, GrammarEvaluationCount>;

interface EvaluationRow {
  slug: string;
  label: string;
  correctAttempts: number;
  incorrectAttempts: number;
  status: 'STRONG' | 'NEEDS PRACTICE' | 'NOT USED';
  statusRank: number;
}

const EVAL_TAG: Record<EvaluationRow['status'], string> = {
  STRONG: 'bg-[rgba(17,124,77,0.12)] text-[#117c4d]',
  'NEEDS PRACTICE': 'bg-[rgba(196,93,28,0.14)] text-[#a54f18]',
  'NOT USED': 'bg-black/8 text-black/56',
};

export interface LangeyWritingProps extends RoadmapModuleProps {
  mode?: PracticeMode;
  roadmapTargetWords?: number;
}

export const LangeyWriting: React.FC<LangeyWritingProps> = ({
  level,
  mode = 'PRACTICE',
  openedFromRoadmap = false,
  roadmapItemKey,
  roadmapTopic,
  roadmapTargetWords,
  onProgressUpdate,
}) => {
  const { setCreditsLeft, isPro, isBlocked, limitMessage } = useDailyCredits();
  const [text, setText] = useState('');
  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null); // New Ref to track ID instantly
  const [corrections, setCorrections] = useState<Correction[]>([]);
  // isCorrecting removed - derived from corrections.length > 0 instead
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popup, setPopup] = useState<{ correction: Correction; position: { top: number; left: number } } | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Passage | null>(null);
  const isMobileView = useIsMobileLayout();
  const [statsViewIndex, setStatsViewIndex] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const selectorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const consumerId = UserTracker.getOrCreateConsumerId();

  const defaultMsg = "Start writing in German here...";
  const isRoadmapMode = openedFromRoadmap && !!roadmapItemKey;
  const defaultHint = isRoadmapMode
    ? roadmapTargetWords
      ? `Write at least ${roadmapTargetWords} words`
      : 'Write your roadmap passage'
    : "Check Vocabulary for word issues or Check Grammar for grammar issues.";
  const roadmapTopicLabel = roadmapTopic || 'Roadmap Writing';
  const displayRoadmapTopic = isMobileView && roadmapTopicLabel.length > 40
    ? `${roadmapTopicLabel.substring(0, 48)}...`
    : roadmapTopicLabel;

  const getWordCount = (str: string) => {
    if (!str || str === defaultMsg) return 0;
    return str.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const getTopicTitle = (slug?: string) => {
    if (!slug) return 'Grammar';
    for (const topicLevel of ['A1', 'A2', 'B1'] as const) {
      const topic = ((levelTopicsData as GrammarTopicsByLevel)[topicLevel] || []).find((item) => item.slug === slug);
      if (topic?.Title) return topic.Title;
    }
    return 'Grammar';
  };

  const applySavedPassageId = (passageId?: string | null) => {
    if (!passageId) return;
    selectedIdRef.current = passageId;
    setSelectedPassageId(passageId);
  };

  useEffect(() => {
    fetchPassages();
    // Reset text field and related state when level changes
    setText('');
    setSelectedPassageId(null);
    selectedIdRef.current = null;
    setCorrections([]);
    setAnalysis('');
  }, [level, isRoadmapMode, roadmapItemKey]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  useEffect(() => {
    if (mode !== 'STATS') return;
    setIsStatsLoading(true);
    fetchPassages().finally(() => setIsStatsLoading(false));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  useEffect(() => {
    if (mode !== 'PRACTICE') return;
    const container = document.querySelector('.german-grammar-container');
    if (container) container.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [mode]);

  // Close selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSelectorOpen && selectorRef.current && !selectorRef.current.contains(event.target as Node) && !isMobileView) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSelectorOpen, isMobileView]);

  // Automatically exit correcting mode when all corrections are handled - REMOVED (implied by state)

  const fetchPassages = async () => {
    try {
      const response = await getWritingPassages(consumerId, level);
      const data = await response.json();
      if (data.success) {
        setPassages(data.data);
        if (isRoadmapMode) {
          const roadmapPassage = data.data.find((p: Passage) => p.roadmap_item_key === roadmapItemKey);
          if (roadmapPassage) {
            setText(roadmapPassage.passage);
            selectedIdRef.current = roadmapPassage.id;
            setSelectedPassageId(roadmapPassage.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching passages:', error);
    }
  };

  const handleDeletePassage = (e: React.MouseEvent, p: Passage) => {
    e.stopPropagation();
    setDeleteConfirmation(p);
    setIsSelectorOpen(false); // Close dropdown to show modal clearly
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      await deleteWritingPassage(deleteConfirmation.id, consumerId);

      if (selectedPassageId === deleteConfirmation.id) {
        handleNewPassage();
      }
      fetchPassages();
    } catch (error) {
      console.error('Error deleting passage:', error);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const handleCorrect = async () => {
    if (isBlocked || !text.trim() || text === defaultMsg) return;

    setIsLoading(true);
    setAnalysis('');

    try {
      const response = await checkWritingVocabulary({
          level,
          passage: text,
          consumer_id: consumerId,
          passage_id: selectedIdRef.current,
          roadmap_item_key: isRoadmapMode ? roadmapItemKey : undefined
      });
      const data = await response.json();
      applySavedPassageId(data.passage_id);
      if (data.limit_status) {
        if (data.limit_status.is_blocked && !isPro) {
          setCreditsLeft(0, data.limit_status.message);
        } else if (data.limit_status.credits_left !== undefined) {
          setCreditsLeft(data.limit_status.credits_left);
        }
      }
      const newCorrections = data.corrections || [];

      // Filter out corrections that don't match any text (hallucinations/mismatches)
      // otherwise they stay in state but are invisible to user
      const validCorrections = newCorrections
        .filter((c: Correction) => c.original && text.includes(c.original))
        .map((c: Correction) => ({
          ...c,
          type: 'Vocabulary',
          explanation: 'Vocabulary'
        }));

      if (validCorrections.length === 0) {
        setAnalysis("No vocabulary issues found.");
      } else {
        setCorrections(validCorrections);
      }
      await fetchPassages();
      onProgressUpdate?.();
    } catch (error) {
      console.error('Error checking vocabulary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (isBlocked || !text.trim() || text === defaultMsg) return;

    // Check word count - if less than 10 words, show message instead
    const wordCount = getWordCount(text);
    if (!isRoadmapMode && wordCount < 10) {
      setAnalysis("Please write at least 10 words before the assessment.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis('');

    try {
      const response = await checkWritingGrammar({
          level,
          passage: text,
          consumer_id: consumerId,
          passage_id: selectedIdRef.current,
          roadmap_item_key: isRoadmapMode ? roadmapItemKey : undefined
      });
      const data = await response.json();
      applySavedPassageId(data.passage_id);
      if (data.limit_status) {
        if (data.limit_status.is_blocked && !isPro) {
          setCreditsLeft(0, data.limit_status.message);
        } else if (data.limit_status.credits_left !== undefined) {
          setCreditsLeft(data.limit_status.credits_left);
        }
      }
      const grammarCorrections = (data.corrections || [])
        .filter((c: Correction) => c.result === 'incorrect' && c.original && text.includes(c.original))
        .map((c: Correction) => ({
          ...c,
          type: 'Grammar',
          explanation: getTopicTitle(c.topic_code)
        }));

      if (grammarCorrections.length === 0) {
        setAnalysis(`No grammar issues found.\n${isRoadmapMode ? "Progress Updated for Roadmap." : "Check Stats to see your evaluation in detail."}`);
      } else {
        setCorrections(grammarCorrections);
      }
      await fetchPassages();
      onProgressUpdate?.();
    } catch (error) {
      console.error('Error evaluating writing:', error);
      setAnalysis("Error evaluating writing.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePassageSelect = (p: Passage) => {
    setText(p.passage);
    selectedIdRef.current = p.id; // Update Ref
    setSelectedPassageId(p.id);
    setIsSelectorOpen(false);
    setCorrections([]);
    setAnalysis('');
  };

  const handleNewPassage = () => {
    setText('');
    selectedIdRef.current = null; // Reset Ref
    setSelectedPassageId(null);
    setIsSelectorOpen(false);
    setCorrections([]);
    setAnalysis('');
  }
  const applyCorrection = (correction: Correction) => {
    const index = findCorrectionIndex(text, correction.original);
    const newText = index === -1
      ? text
      : text.slice(0, index) + correction.correction + text.slice(index + correction.original.length);
    setText(newText);
    setCorrections(prev => prev.filter(c => c !== correction));
    setPopup(null);
  };

  const ignoreCorrection = (correction: Correction) => {
    setCorrections(prev => prev.filter(c => c !== correction));
    setPopup(null);
  };

  const findCorrectionIndex = (value: string, original: string) => {
    let index = value.indexOf(original);
    while (index !== -1) {
      const before = value[index - 1];
      const after = value[index + original.length];
      if ((!before || /[\s.,!?;:()[\]{}"']/u.test(before)) && (!after || /[\s.,!?;:()[\]{}"']/u.test(after))) return index;
      index = value.indexOf(original, index + original.length);
    }
    return -1;
  };

  const hasVisibleCorrections = corrections.some(c => findCorrectionIndex(text, c.original) !== -1);

  const renderHighlightedText = () => {
    if (corrections.length === 0) return text;

    let segments: { text: string; correction?: Correction }[] = [{ text }];

    corrections.forEach(corr => {
      const newSegments: typeof segments = [];
      segments.forEach(seg => {
        if (seg.correction) {
          newSegments.push(seg);
        } else {
          const index = findCorrectionIndex(seg.text, corr.original);
          if (index !== -1) {
            newSegments.push({ text: seg.text.slice(0, index) });
            newSegments.push({ text: corr.original, correction: corr });
            newSegments.push({ text: seg.text.slice(index + corr.original.length) });
          } else {
            newSegments.push(seg);
          }
        }
      });
      segments = newSegments;
    });

    return segments.map((seg, i) => {
      if (seg.correction) {
        return (
          <span
            key={i}
            className={ERROR_HIGHLIGHT}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const popupWidth = Math.min(320, Math.max(0, window.innerWidth - 24));
              const popupHalf = popupWidth / 2;
              const popupLeft = Math.min(
                Math.max(rect.left + rect.width / 2, popupHalf + 12),
                window.innerWidth - popupHalf - 12
              );
              setPopup({
                correction: seg.correction!,
                position: {
                  top: rect.top, // Fixed position relative to viewport
                  left: popupLeft
                }
              });
            }}
          >
            {seg.text}
          </span>
        );
      }
      return <span key={i}>{seg.text}</span>;
    });
  };

  // Determine label for selector
  const getSelectorLabel = () => {
    if (selectedPassageId) {
      const p = passages.find(x => x.id === selectedPassageId);
      if (p) return p.passage.substring(0, 30) + (p.passage.length > 30 ? '...' : '');
    }
    return "Select passage";
  };

  const renderPassageList = () => (
    <>
      <div
        className={cx(topicItemClass(false), 'mb-1 border-b border-[#eee]')}
        onClick={handleNewPassage}
      >
        <span className="flex-1 text-sm font-semibold text-[#1890ff]">+ New Passage</span>
      </div>
      <ul className={TOPIC_LIST}>
        {passages.map((p) => (
          <li
            key={p.id}
            className={topicItemClass(selectedPassageId === p.id)}
            onClick={() => handlePassageSelect(p)}
          >
            <span className={topicTitleClass(selectedPassageId === p.id)}>{p.passage.substring(0, 30) || 'Untitled'}...</span>
            <button
              className={DELETE_PASSAGE_BTN}
              onClick={(e) => handleDeletePassage(e, p)}
              title="Delete passage"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </li>
        ))}
        {passages.length === 0 && (
          <div className="p-2.5 text-[13px] text-[#999] italic">No saved passages</div>
        )}
      </ul>
    </>
  );

  const handleScroll = () => {
    if (textareaRef.current && displayRef.current) {
      displayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [corrections]);

  const getLevelTargetWords = () => ({ A1: 1000, A2: 1500, B1: 2000 }[level]);

  const savedWordCount = passages.reduce((sum, p) => {
    return sum + getWordCount(p.passage);
  }, 0);

  const progressPercent = Math.min(100, Math.round((savedWordCount / getLevelTargetWords()) * 100));

  const defaultEvaluation = (): GrammarEvaluation => {
    const evaluation: GrammarEvaluation = {};
    (['A1', 'A2', 'B1'] as const).forEach((topicLevel) => {
      ((levelTopicsData as GrammarTopicsByLevel)[topicLevel] || []).forEach((topic) => {
        evaluation[topic.slug] = {
          level: topicLevel,
          correct_attempt_count: 0,
          incorrect_attempt_count: 0
        };
      });
    });
    return evaluation;
  };

  const mergedEvaluation = passages.reduce((acc, p) => {
    const evaluation = p.grammar_evaluation || {};
    Object.entries(evaluation).forEach(([slug, counts]) => {
      if (!acc[slug]) {
        acc[slug] = {
          level: counts?.level || 'A1',
          correct_attempt_count: 0,
          incorrect_attempt_count: 0
        };
      }
      acc[slug].correct_attempt_count += Number(counts?.correct_attempt_count || 0);
      acc[slug].incorrect_attempt_count += Number(counts?.incorrect_attempt_count || 0);
    });
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

  const renderProgressRing = () => {
    return (
      <WritingProgressRing
        percent={progressPercent}
        wordCount={savedWordCount}
        targetWords={getLevelTargetWords()}
      />
    );
  };

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

        <div className={HINT_BAR_STATS}>
          <button
            className="relative z-[1] flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/12 bg-white/72 text-[#111] disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => setStatsViewIndex(0)}
            disabled={isProgressView}
            aria-label="Show writing progress"
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
            aria-label="Show writing evaluation"
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

  const grammarBtnClass = cx(
    GRAMMAR_BTN,
    !isRoadmapMode && getWordCount(text) < 10 && '!text-black/40 before:opacity-30',
  );

  return (
    <div className={PRACTICE_ROOT} data-roadmap-mode={isRoadmapMode ? 'true' : 'false'}>
      <div className={PRACTICE_HEADER}>
        <div className={FIELD_LEFT}>
          <h1 className={LABEL}>{isRoadmapMode ? 'Writing Topic' : 'Your Passages'}</h1>
          {isRoadmapMode ? (
            <div className={CUSTOM_SELECTOR}>
              <div className={SELECTOR_TRIGGER_STATIC}>
              {displayRoadmapTopic}
              </div>
            </div>
          ) : (
          <div className={CUSTOM_SELECTOR} ref={selectorRef}>
            <button
              type="button"
              className={SELECTOR_TRIGGER}
              onClick={() => setIsSelectorOpen((v) => !v)}
            >
              {getSelectorLabel()}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isSelectorOpen && !isMobileView && (
              <div className={DROPDOWN_PANEL}>
                {renderPassageList()}
              </div>
            )}

            {isSelectorOpen && isMobileView && (
              <>
                <div className={SHEET_OVERLAY} onClick={() => setIsSelectorOpen(false)} style={{ zIndex: 30 }} />
                <div className={BOTTOM_SHEET} style={{ zIndex: 31 }}>
                  <div className={SHEET_HEADER}>
                    <div className={SHEET_TITLE}>Your Passages</div>
                    <button type="button" className={SHEET_CLOSE} onClick={() => setIsSelectorOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {renderPassageList()}
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div className={ACTION_BUTTONS}>
          <button
            className={VOCAB_BTN}
            onClick={handleCorrect}
            disabled={isLoading || hasVisibleCorrections || !text.trim() || text === defaultMsg || isBlocked}
          >
            {isLoading ? 'Checking...' : 'Check Vocabulary'}
          </button>
          <button
            className={grammarBtnClass}
            onClick={handleEvaluate}
            disabled={isAnalyzing || hasVisibleCorrections || !text.trim() || text === defaultMsg || isBlocked}
            title={!isRoadmapMode && getWordCount(text) < 10 ? 'Write at least 10 words' : ''}
          >
            {isAnalyzing ? 'Checking...' : 'Check Grammar'}
          </button>
        </div>
      </div>

      <div className={WRITING_BOX} onClick={() => setPopup(null)}>
        {isBlocked ? (
          <CreditLimitBlock message={limitMessage} />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              onScroll={handleScroll}
              className={cx(TEXTAREA, hasVisibleCorrections && TEXTAREA_CORRECTIONS)}
              spellCheck={false}
              autoCorrect="off"
              placeholder={defaultMsg}
              value={text}
              onChange={(e) => {
                if (corrections.length > 0) {
                  setCorrections([]);
                  setAnalysis('');
                }
                setText(e.target.value);
              }}
            />
            {hasVisibleCorrections && (
              <div className={cx(OVERLAY, OVERLAY_CORRECTIONS)}>
                <div className={cx(DISPLAY, DISPLAY_CORRECTIONS, 'pointer-events-none')} ref={displayRef}>
                  {renderHighlightedText()}
                  <br />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {popup && (
        <div
          className={ERROR_POPUP}
          style={{
            position: 'fixed',
            top: popup.position.top,
            left: popup.position.left,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 font-bold">{popup.correction.type || 'Writing'} Error</div>
          <div className="mb-1">Suggestion: <strong>{popup.correction.correction}</strong></div>
          {popup.correction.type !== 'Vocabulary' && (
            <div className="mb-2 text-[0.9em] text-[#666]">Mistake: {popup.correction.explanation || popup.correction.type || 'Writing'}</div>
          )}
          <div className="flex justify-end">
            <button type="button" className={POPUP_BTN} onClick={() => ignoreCorrection(popup.correction)}>Ignore</button>
            <button type="button" className={POPUP_REPLACE_BTN} onClick={() => applyCorrection(popup.correction)}>Replace</button>
          </div>
        </div>
      )}

      <div className={HINT_BAR}>
        <div className={HINT_CONTENT}>
          {isBlocked ? (
            <span className="text-center text-sm text-[#333] opacity-60">Tap Upgrade to Pro above to continue</span>
          ) : isAnalyzing ? (
            <div className={SPINNER} />
          ) : analysis ? (
            <TypeWriter text={analysis} delay={20} shouldAnimate={true} />
          ) : (
            <span>{defaultHint}</span>
          )}
        </div>
      </div>

      {deleteConfirmation && (
        <div className={DELETE_OVERLAY} onClick={() => setDeleteConfirmation(null)}>
          <div className={DELETE_DIALOG} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-2 text-[17px] font-bold text-[#1a1a1a] max-lg:mb-2">Delete Passage?</h3>
            <p className="mb-5 text-sm leading-[1.45] text-[#666] max-lg:mb-4">Are you sure you want to delete this passage? This action cannot be undone.</p>
            <div className="flex justify-end gap-3 max-lg:gap-2.5">
              <button
                type="button"
                className={cx(DELETE_DIALOG_BTN, 'min-w-[80px] !border-[#ddd] !bg-[#eee] !text-[#333]')}
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cx(DELETE_DIALOG_BTN, 'min-w-[80px] !border-0 !bg-[#ff4d4f] !text-white')}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
