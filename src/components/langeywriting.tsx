import React, { useEffect, useState, useRef } from 'react';
import './langeywriting.css';
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
            className="gg-error-highlight"
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
        className="gg-topic-item"
        onClick={handleNewPassage}
        style={{ borderBottom: '1px solid #eee', marginBottom: 4 }}
      >
        <span className="gg-topic-title" style={{ fontWeight: 600, color: '#1890ff' }}>+ New Passage</span>
      </div>
      <ul className="gg-topic-list">
        {passages.map((p) => (
          <li
            key={p.id}
            className={`gg-topic-item ${selectedPassageId === p.id ? 'selected' : ''}`}
            onClick={() => handlePassageSelect(p)}
          >
            <span className="gg-topic-title">{p.passage.substring(0, 30) || "Untitled"}...</span>
            <button
              className="gg-delete-passage-btn"
              onClick={(e) => handleDeletePassage(e, p)}
              title="Delete passage"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ff4d4f'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </li>
        ))}
        {passages.length === 0 && (
          <div style={{ padding: 10, color: '#999', fontSize: 13, fontStyle: 'italic' }}>No saved passages</div>
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
    <div className="gg-evaluation-scroll-container">
      <div className="gg-evaluation-scroll-arrow gg-evaluation-scroll-arrow-up">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </div>
      <div className="gg-writing-evaluation-wrap">
        <div className="gg-writing-evaluation-list">
          {levelEvaluationRows.map((row: EvaluationRow) => (
            <div className="gg-writing-evaluation-row" key={row.slug}>
              <span className="gg-writing-evaluation-label">{row.label}</span>
              <span className={`gg-writing-evaluation-tag gg-writing-evaluation-tag-${row.status.toLowerCase().replace(' ', '-')}`}>
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

  if (mode === 'STATS') {
    const isProgressView = statsViewIndex === 0;
    return (
      <div className="gg-writing gg-writing-stats-mode">
        <div className="gg-writing-stats-panel">
          <>
            <div className={`gg-writing-stats-view ${isProgressView ? 'active' : ''}`}>
              {renderProgressRing()}
            </div>
            <div className={`gg-writing-stats-view ${!isProgressView ? 'active' : ''}`}>
              {renderEvaluationTable()}
            </div>
          </>
        </div>

        <div className="gg-writing-hint-bar gg-writing-stats-hint gg-writing-stats-hint--with-nav">
          <button
            className="gg-writing-stats-nav"
            onClick={() => setStatsViewIndex(0)}
            disabled={isProgressView}
            aria-label="Show writing progress"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="gg-writing-hint-content">
            {!isStatsLoading && (
              <TypeWriter key={`${level}-${progressPercent}`} text={`Total Progress: ${progressPercent}%`} delay={50} shouldAnimate={true} />
            )}
          </div>
          <button
            className="gg-writing-stats-nav"
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

  return (
    <div className="gg-writing" data-roadmap-mode={isRoadmapMode ? 'true' : 'false'}>
      <div className="gg-writing-header">
        <div className="gg-field-left">
          <h1 className="gg-label">{isRoadmapMode ? 'Writing Topic' : 'Your Passages'}</h1>
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
              {getSelectorLabel()}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isSelectorOpen && !isMobileView && (
              <div className="gg-dropdown-panel">
                {renderPassageList()}
              </div>
            )}

            {isSelectorOpen && isMobileView && (
              <>
                <div className="gg-sheet-overlay" onClick={() => setIsSelectorOpen(false)} style={{ zIndex: 30 }} />
                <div className="gg-bottom-sheet" style={{ zIndex: 31 }}>
                  <div className="gg-sheet-header">
                    <div className="gg-sheet-title">Your Passages</div>
                    <button className="gg-sheet-close" onClick={() => setIsSelectorOpen(false)}>
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

        <div className="gg-writing-actions">
          <button
            className="gg-writing-btn"
            onClick={handleCorrect}
            disabled={isLoading || hasVisibleCorrections || !text.trim() || text === defaultMsg || isBlocked}
          >
            {isLoading ? 'Checking...' : 'Check Vocabulary'}
          </button>
          <button
            className={`gg-writing-btn gg-weak-points-btn ${!isRoadmapMode && getWordCount(text) < 10 ? 'gg-weak-points-disabled' : ''}`}
            onClick={handleEvaluate}
            disabled={isAnalyzing || hasVisibleCorrections || !text.trim() || text === defaultMsg || isBlocked}
            title={!isRoadmapMode && getWordCount(text) < 10 ? "Write at least 10 words" : ""}
          >
            {isAnalyzing ? 'Checking...' : 'Check Grammar'}
          </button>
        </div>
      </div>

      <div className={`gg-writing-box ${hasVisibleCorrections ? 'gg-writing-box-with-corrections' : ''}`} onClick={() => setPopup(null)}>
        {isBlocked ? (
          <CreditLimitBlock message={limitMessage} />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              onScroll={handleScroll}
              className="gg-writing-textarea"
              spellCheck={false}
              autoCorrect="off"
              placeholder={defaultMsg}
              value={text}
              onChange={(e) => {
                // Clear all corrections when user starts typing
                if (corrections.length > 0) {
                  setCorrections([]);
                  setAnalysis('');
                }
                setText(e.target.value);
              }}
            />
            {hasVisibleCorrections && (
              <div className="gg-writing-overlay">
                <div className="gg-writing-display" ref={displayRef}>
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
          className="gg-error-popup"
          style={{
            position: 'fixed',
            top: popup.position.top,
            left: popup.position.left,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{popup.correction.type || 'Writing'} Error</div>
          <div style={{ marginBottom: 4 }}>Suggestion: <strong>{popup.correction.correction}</strong></div>
          {popup.correction.type !== 'Vocabulary' && (
            <div style={{ fontSize: '0.9em', color: '#666', marginBottom: 8 }}>Mistake: {popup.correction.explanation || popup.correction.type || 'Writing'}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => ignoreCorrection(popup.correction)}>Ignore</button>
            <button className="replace-btn" onClick={() => applyCorrection(popup.correction)}>Replace</button>
          </div>
        </div>
      )}

      <div className="gg-writing-hint-bar">
        <div className="gg-writing-hint-content">
          {isBlocked ? (
            <span className="gg-limit-hint">Tap Upgrade to Pro above to continue</span>
          ) : isAnalyzing ? (
            <div className="gg-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
          ) : analysis ? (
            <TypeWriter text={analysis} delay={20} shouldAnimate={true} />
          ) : (
            <span>{defaultHint}</span>
          )}
        </div>
      </div>

      {deleteConfirmation && (
        <div className="gg-sheet-overlay gg-delete-passage-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirmation(null)}>
          <div className="gg-writing-box gg-delete-passage-dialog" style={{ height: 'auto', maxHeight: 'none', maxWidth: 400, padding: 24, cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Delete Passage?</h3>
            <p style={{ marginBottom: 20, color: '#666' }}>Are you sure you want to delete this passage? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="gg-writing-btn"
                style={{ background: '#eee', color: '#333', border: '1px solid #ddd', minWidth: 80 }}
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="gg-writing-btn"
                style={{ background: '#ff4d4f', color: 'white', border: 'none', minWidth: 80 }}
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
