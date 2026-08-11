// langeylandingpage.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import './langeylandingpage.animations.css';
import logo from '../assets/images/logo-rounded.png';
import { UserTracker } from '../utils/userTracking';
import { LangeyGrammar } from '../components/langeygrammar';
import { LangeyVocabulary } from '../components/langeyvocabulary';
import { LangeySpeaking } from '../components/langeyspeaking';
import { LangeyWriting } from '../components/langeywriting';
import { LangeyReading } from '../components/langeyreading';
import { LangeyListening } from '../components/langeylistening';
import { LangeyRoadmap } from '../components/langeyroadmap';
import { Settings } from '../components/Settings';
import { DailyCreditsDisplay } from '../components/DailyCreditsDisplay';
import FeedbackPopup from './FeedbackPopup';
import { ModulesGuideTour } from './ModulesGuideTour';
import { useFeedbackTimer } from '../hooks/useFeedbackTimer';
import { submitFeedback } from '../services/feedback';
import { deleteRoadmap, getRoadmaps } from '../services/roadmapApi';
import { isModuleMediaActive } from '../utils/audioLifecycle';
import { RoadmapControls } from './layout/RoadmapControls';
import { SettingsIconButton } from './layout/SettingsIconButton';
import {
  FEATURE_TABS,
  GERMAN_LEVELS,
  getDefaultModeForTab,
  getReloadMode,
  getTabFromPath,
  ROADMAP_ENABLED_KEYS,
  saveModeForTab,
  STATS_TABS,
  type GermanLevel,
  type LearningMode as Mode,
  type MainTab,
} from '../features/learning/navigation';
import {
  calculateRoadmapProgress,
  type RoadmapByLevel,
} from '../features/roadmap/progress';

const ENABLE_MODULES_GUIDE =
  String(import.meta.env.VITE_ENABLE_MODULES_GUIDE || '').toLowerCase() === 'true';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

export const LangeyLandingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial main tab from URL
  const initialMode = getReloadMode(location.pathname);

  const [mainTab, setMainTab] = useState<MainTab>(getTabFromPath(location.pathname));
  const [mode, setMode] = useState<Mode>(initialMode);
  const previousPathRef = useRef(location.pathname);
  const [level, setLevel] = useState<GermanLevel>(() => {
    const savedLevel = UserTracker.getGermanLevel();
    return (savedLevel === 'A1' || savedLevel === 'A2' || savedLevel === 'B1') ? savedLevel : 'A1';
  });
  const [needsLevelSelection, setNeedsLevelSelection] = useState(
    () => !UserTracker.getStoredGermanLevel(),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roadmapRefreshTrigger, setRoadmapRefreshTrigger] = useState(0);
  const [, setIsRoadmapRefreshing] = useState(false);
  const [roadmapProgressValue, setRoadmapProgressValue] = useState<number | null>(null);
  const [roadmapProgressLabel, setRoadmapProgressLabel] = useState<string>('');
  const [roadmapDayByLevel, setRoadmapDayByLevel] = useState<Record<GermanLevel, { current_day: number; days: number } | null>>({ A1: null, A2: null, B1: null });
  const [roadmapResetTrigger, setRoadmapResetTrigger] = useState(0);
  const [roadmapSetupTrigger, setRoadmapSetupTrigger] = useState(0);
  const [featureResetVersion, setFeatureResetVersion] = useState(0);
  const [roadmapEnabledByLevel, setRoadmapEnabledByLevel] = useState<Record<GermanLevel, boolean | null>>(() => {
    const readStoredFlag = (lvl: GermanLevel) => {
      try {
        const stored = localStorage.getItem(ROADMAP_ENABLED_KEYS[lvl]);
        return stored === null ? null : stored === 'true';
      } catch {
        return null;
      }
    };
    return {
      A1: readStoredFlag('A1'),
      A2: readStoredFlag('A2'),
      B1: readStoredFlag('B1'),
    };
  });
  const [consumerId, setConsumerId] = useState<string>(() => UserTracker.getOrCreateConsumerId());
  const [showModulesGuide, setShowModulesGuide] = useState(false);
  const fromRoadmap = new URLSearchParams(location.search).get('fromRoadmap') === 'true';
  const trackableFeatures: MainTab[] = ['vocabulary', 'grammar', 'speaking', 'writing', 'reading', 'listening'];
  const isTrackableFeature = trackableFeatures.includes(mainTab);
  const roadmapSearchParams = new URLSearchParams(location.search);
  const roadmapItemKey = roadmapSearchParams.get('roadmapItem') || undefined;
  const roadmapTopic = roadmapSearchParams.get('topic') || undefined;
  const roadmapTargetWordsParam = roadmapSearchParams.get('targetWords');
  const roadmapTargetWords = roadmapTargetWordsParam ? Number(roadmapTargetWordsParam) : undefined;
  const roadmapTargetMinutesParam = roadmapSearchParams.get('targetMinutes');
  const roadmapTargetMinutes = roadmapTargetMinutesParam ? Number(roadmapTargetMinutesParam) : undefined;
  const initialProgressParam = roadmapSearchParams.get('initialProgress');
  const initialProgress = initialProgressParam ? Number(initialProgressParam) : null;
  const initialLabel = roadmapSearchParams.get('initialLabel') || '';

  const shouldShowRoadmapProgress = fromRoadmap && isTrackableFeature;
  const displayedRoadmapProgress = shouldShowRoadmapProgress ? (roadmapProgressValue ?? 0) : null;
  const displayedRoadmapProgressLabel = roadmapProgressLabel;

  const fetchRoadmapProgress = async (tab: MainTab, lvl: string, cid: string) => {
    try {
      const response = await getRoadmaps(cid);
      const data = await response.json() as {
        success?: boolean;
        roadmaps?: Record<string, RoadmapByLevel | undefined>;
      };
      if (data.success && data.roadmaps) {
        const roadmap = data.roadmaps[lvl];
        if (!roadmap) return;
        const currentDayPlan = roadmap.plan?.find((p) => p.day === roadmap.current_day);
        if (!currentDayPlan) return;
        const { progress, label } = calculateRoadmapProgress(tab, currentDayPlan);
        setRoadmapProgressValue(progress);
        setRoadmapProgressLabel(label);
      }
    } catch {
      // Progress is opportunistic; child modules remain usable without it.
    }
  };

  useEffect(() => {
    if (shouldShowRoadmapProgress) {
      if (initialProgress !== null && initialLabel) {
        setRoadmapProgressValue(initialProgress);
        setRoadmapProgressLabel(initialLabel);
      } else {
        setRoadmapProgressValue(null);
        setRoadmapProgressLabel('');
        fetchRoadmapProgress(mainTab, level, consumerId);
      }
    } else {
      setRoadmapProgressValue(null);
      setRoadmapProgressLabel('');
    }
  }, [mainTab, shouldShowRoadmapProgress, level, consumerId, initialProgress, initialLabel]);
  // Refresh identity-dependent children after an explicit welcome CTA or level choice.
  useEffect(() => {
    const handleConsumerIdChanged = () => {
      const newId = UserTracker.getConsumerId() || UserTracker.getOrCreateConsumerId();
      setConsumerId(newId);
      setNeedsLevelSelection(!UserTracker.getStoredGermanLevel());
    };

    window.addEventListener('langey:consumer-id-changed', handleConsumerIdChanged);
    return () => {
      window.removeEventListener('langey:consumer-id-changed', handleConsumerIdChanged);
    };
  }, []);

  // Feedback timer moved to Landing Page
  const { shouldShowFeedback, hideFeedbackPopup, markFeedbackShown } = useFeedbackTimer({ consumerId, delayMinutes: 60 });

  const handleFeedbackSubmit = async (feedback: string, stars: number) => {
    const result = await submitFeedback({ consumer_id: consumerId, feedback: feedback || undefined, stars });
    if (result.success) {
      markFeedbackShown();
    } else {
      throw new Error(result.error || 'Failed to submit feedback');
    }
  };

  const handleFeedbackClose = () => {
    hideFeedbackPopup();
    markFeedbackShown();
  };

  // Sync mainTab before paint so direct roadmap navigation does not flash stale nav controls.
  useLayoutEffect(() => {
    const nextTab = getTabFromPath(location.pathname);
    const pathChanged = previousPathRef.current !== location.pathname;
    previousPathRef.current = location.pathname;
    setMainTab((current) => current === nextTab ? current : nextTab);
    if (pathChanged) {
      const defaultMode = getDefaultModeForTab(nextTab);
      setMode(defaultMode);
      saveModeForTab(nextTab, defaultMode);
    }
  }, [location.pathname]);

  const handleMainTabChange = (tab: MainTab) => {
    setMainTab(tab);
    const defaultMode = getDefaultModeForTab(tab);
    setMode(defaultMode);
    saveModeForTab(tab, defaultMode);
    if (tab === 'modules') {
      navigate('/');
      setIsRoadmapRefreshing(true);
      setRoadmapRefreshTrigger(t => t + 1);
    } else if (tab === 'vocabulary') {
      navigate('/vocabulary');
    } else if (tab === 'grammar') {
      navigate('/grammar');
    } else if (tab === 'speaking') {
      navigate('/speaking');
    } else if (tab === 'writing') {
      navigate('/writing');
    } else if (tab === 'reading') {
      navigate('/reading');
    } else if (tab === 'listening') {
      navigate('/listening');
    } else if (tab === 'settings') {
      navigate('/settings');
    }
  };

  const handleLevelSelect = (lvl: GermanLevel) => {
    const isInitialSelection = !UserTracker.getStoredGermanLevel();
    const nextConsumerId = UserTracker.createConsumerId();
    setConsumerId(nextConsumerId);
    setLevel(lvl);
    UserTracker.saveGermanLevel(lvl);
    if (isInitialSelection) UserTracker.markModulesGuidePending();
    setNeedsLevelSelection(false);
    // The child reacts to level change (reset practice or refresh stats) — unchanged behavior
  };

  useEffect(() => {
    const readyForGuide =
      ENABLE_MODULES_GUIDE &&
      mainTab === 'modules' &&
      !fromRoadmap &&
      !needsLevelSelection &&
      !!UserTracker.getStoredGermanLevel() &&
      UserTracker.isModulesGuidePending();

    if (!readyForGuide) {
      setShowModulesGuide(false);
      return;
    }

    const timer = window.setTimeout(() => setShowModulesGuide(true), 450);
    return () => window.clearTimeout(timer);
  }, [
    mainTab,
    fromRoadmap,
    needsLevelSelection,
    level,
  ]);

  // Re-check after the explicit welcome flow completes.
  useEffect(() => {
    const maybeOpenGuide = () => {
      if (
        ENABLE_MODULES_GUIDE &&
        mainTab === 'modules' &&
        !fromRoadmap &&
        !needsLevelSelection &&
        !!UserTracker.getStoredGermanLevel() &&
        UserTracker.isModulesGuidePending()
      ) {
        window.setTimeout(() => setShowModulesGuide(true), 450);
      }
    };
    window.addEventListener('langey:onboarding-complete', maybeOpenGuide);
    return () => {
      window.removeEventListener('langey:onboarding-complete', maybeOpenGuide);
    };
  }, [mainTab, fromRoadmap, needsLevelSelection]);

  const setRoadmapEnabledForLevel = (lvl: GermanLevel, enabled: boolean) => {
    setRoadmapEnabledByLevel(prev => ({ ...prev, [lvl]: enabled }));
    try {
      localStorage.setItem(ROADMAP_ENABLED_KEYS[lvl], String(enabled));
    } catch {
      // Local storage persistence is best-effort.
    }
  };

  const handleRoadmapToggleChange = (enabled: boolean) => {
    setFeatureResetVersion(v => v + 1);
    setRoadmapEnabledForLevel(level, enabled);
  };

  const handleResetJourney = async () => {
    if (!window.confirm(`Are you sure you want to reset your ${level} roadmap? All progress will be lost.`)) return;
    try {
      await deleteRoadmap(consumerId, level);
      handleRoadmapToggleChange(false);
      setRoadmapDayByLevel(prev => ({ ...prev, [level]: null }));
      setRoadmapResetTrigger(t => t + 1);
    } catch (error) {
      console.error('Error resetting roadmap:', error);
    }
  };

  const handleRoadmapDataUpdate = (lvl: GermanLevel, current_day: number | null, days: number | null) => {
    setRoadmapDayByLevel(prev => ({
      ...prev,
      [lvl]: current_day !== null && days !== null ? { current_day, days } : null,
    }));
  };

  const handleRoadmapPresenceChange = (lvl: GermanLevel, hasRoadmap: boolean) => {
    setRoadmapEnabledByLevel(prev => {
      if (hasRoadmap && prev[lvl] !== true) {
        try {
          localStorage.setItem(ROADMAP_ENABLED_KEYS[lvl], 'false');
        } catch {
          // Local storage persistence is best-effort.
        }
        return { ...prev, [lvl]: false };
      }
      try {
        localStorage.setItem(ROADMAP_ENABLED_KEYS[lvl], String(hasRoadmap));
      } catch {
        // Local storage persistence is best-effort.
      }
      return { ...prev, [lvl]: hasRoadmap };
    });
  };

  const handleEnableRoadmap = () => {
    if (roadmapDayByLevel[level]) {
      handleRoadmapToggleChange(true);
      return;
    }
    setRoadmapSetupTrigger(t => t + 1);
  };

  const handleModeChange = (newMode: Mode) => {
    if (newMode !== 'STATS') {
      const container = document.querySelector('.german-grammar-container');
      if (container) container.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    }
    setMode(newMode);
    saveModeForTab(mainTab, newMode);
  };

  const isFeatureTab = FEATURE_TABS.includes(mainTab);
  const featureSupportsStats = STATS_TABS.includes(mainTab);
  const canShowStatsMode = featureSupportsStats && !fromRoadmap;
  const activeMode: Mode = fromRoadmap && mode === 'STATS' ? getDefaultModeForTab(mainTab) : mode;
  const roadmapEnabled = roadmapEnabledByLevel[level] ?? false;
  const showLevelSelectionPopup = needsLevelSelection;

  const getFeatureLabel = (tab: MainTab): string => {
    const labels: Partial<Record<MainTab, string>> = {
      vocabulary: 'Vocabulary', grammar: 'Grammar', speaking: 'Speaking',
      writing: 'Writing', reading: 'Reading', listening: 'Listening',
      settings: 'Settings',
    };
    return labels[tab] ?? 'Modules';
  };

  const showFeatureHeader = isFeatureTab || mainTab === 'settings';

  const getMobileHeaderLabel = (): string => {
    if (showFeatureHeader) return getFeatureLabel(mainTab);
    if (mainTab === 'modules') return 'Modules';
    return 'Modules';
  };

  useEffect(() => {
    if (fromRoadmap && mode === 'STATS') {
      handleModeChange(getDefaultModeForTab(mainTab));
    }
  }, [fromRoadmap, mainTab, mode]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  // Breadcrumb structured data based on current page
  const breadcrumbSchema = useMemo(() => {
    const items = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://app.langey.com/"
      }
    ];

    if (mainTab === 'vocabulary') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Vocabulary Practice",
        "item": "https://app.langey.com/vocabulary"
      });
    } else if (mainTab === 'grammar') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Grammar Exercises",
        "item": "https://app.langey.com/grammar"
      });
    } else if (mainTab === 'speaking') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Speaking Practice",
        "item": "https://app.langey.com/speaking"
      });
    } else if (mainTab === 'writing') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Writing Practice",
        "item": "https://app.langey.com/writing"
      });
    } else if (mainTab === 'reading') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Reading Practice",
        "item": "https://app.langey.com/reading"
      });
    } else if (mainTab === 'listening') {
      items.push({
        "@type": "ListItem",
        "position": 2,
        "name": "German Listening Practice",
        "item": "https://app.langey.com/listening"
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items
    };
  }, [mainTab]);

  const renderRoadmapProgressPill = () => (
    <div className="relative flex h-9 w-[172px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-black/20 bg-white px-4 text-xs font-semibold tracking-[0.01em] whitespace-nowrap text-black tabular-nums shadow-[0_2px_4px_-1px_rgba(0,0,0,.06)] max-lg:h-[35px] max-lg:w-[118px] max-lg:rounded-[18px] max-lg:px-3 max-lg:text-[10px]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[rgba(88,204,2,0.18)] transition-[width] duration-300 ease-out"
        style={{ width: `${displayedRoadmapProgress ?? 0}%` }}
      />
      <span className="relative z-[1]">{displayedRoadmapProgressLabel}</span>
    </div>
  );

  return (
    <div
      className="german-grammar-container fixed inset-0 flex h-dvh min-h-[-webkit-fill-available] w-full flex-col overflow-x-hidden overflow-y-auto bg-[linear-gradient(45deg,#f0f1f2_0%,#eceef0_50%,#f0f1f2_100%)] bg-size-[20px_20px] pb-[env(safe-area-inset-bottom)] font-[Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] text-black"
      role="main"
      aria-label="German Grammar Page"
    >
      {/* Breadcrumb Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      {/* FAQ Structured Data for Rich Snippets */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "How can I learn German online for free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "You can learn German online for free with Langey by practicing 6000+ vocabulary words with flashcards, completing 100+ grammar exercises across A1, A2, and B1 levels, and receiving AI-powered feedback on your answers. Simply visit app.langey.com and start learning immediately without any registration required."
              }
            },
            {
              "@type": "Question",
              "name": "What German vocabulary words can I learn?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Langey offers 6000+ German vocabulary words organized by proficiency level (A1, A2, B1). Each word includes audio pronunciation by native speakers, example sentences in context, and English translations. The vocabulary covers everyday topics, essential phrases, and common German words needed for communication."
              }
            },
            {
              "@type": "Question",
              "name": "How do German grammar exercises work on Langey?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "German grammar exercises on Langey include five interactive types: fill-in-the-blank, multiple choice, true/false, sentence building, and word order exercises. Each exercise provides instant AI-powered feedback explaining correct and incorrect answers, helping you understand German grammar rules deeply."
              }
            },
            {
              "@type": "Question",
              "name": "What German proficiency levels does Langey cover?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Langey covers three German proficiency levels: A1 (beginner), A2 (elementary), and B1 (intermediate). Each level includes carefully curated vocabulary and grammar topics aligned with Common European Framework of Reference (CEFR) standards for German language learning."
              }
            },
            {
              "@type": "Question",
              "name": "Can I track my German learning progress?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, Langey provides comprehensive progress tracking for both vocabulary and grammar. You can see how many German words you've mastered, track your grammar exercise scores, and monitor your improvement over time with detailed statistics and visual progress charts."
              }
            },
            {
              "@type": "Question",
              "name": "Is Langey better than traditional German textbooks?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Langey offers advantages over traditional German textbooks including instant AI feedback, interactive exercises, audio pronunciation for every word, spaced repetition for vocabulary retention, and adaptive learning that focuses on your weak areas. The platform is always accessible online and tracks your progress automatically."
              }
            },
            {
              "@type": "Question",
              "name": "How can I practice speaking German online?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Practice speaking German online with Langey's AI-powered conversation scenarios. Engage in realistic roleplay situations like ordering food, asking for directions, or job interviews. Receive real-time feedback on your pronunciation and fluency while building confidence in spoken German."
              }
            },
            {
              "@type": "Question",
              "name": "What German speaking scenarios can I practice?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Langey offers various German speaking scenarios including discussing your day with a friend, discussing finances with spouse, ordering food at a restaurant, asking for directions, and job interview practice. You can also create custom scenarios tailored to your specific German speaking needs."
              }
            }
          ]
        })}
      </script>

      {/* Structured Data for SEO - Enhanced for all pages */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "name": "Langey - Learn German Online",
          "alternateName": "Langey German Learning Platform",
          "description": "Learn German online with interactive lessons, vocabulary flashcards, grammar exercises, reading comprehension, speaking practice, writing practice, and AI-powered feedback. Comprehensive German language learning for A1, A2, and B1 levels.",
          "url": "https://app.langey.com",
          "logo": "https://app.langey.com/logo.png",
          "sameAs": ["https://app.langey.com"],
          "foundingDate": "2024",
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Support",
            "availableLanguage": ["English", "German"]
          },
          "educationalCredentialAwarded": "German Language Proficiency (A1, A2, B1)",
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "German Language Learning Programs",
            "itemListElement": [
              {
                "@type": "Course",
                "name": "German Vocabulary Practice - Learn 6000+ German Words",
                "description": "Learn German vocabulary with interactive flashcards, spaced repetition, and audio pronunciation. Master German words for A1, A2, and B1 levels.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Vocabulary",
                "educationalLevel": ["A1", "A2", "B1"],
                "numberOfLessons": "6000",
                "url": "https://app.langey.com/vocabulary"
              },
              {
                "@type": "Course",
                "name": "German Grammar Exercises - 100+ Topics",
                "description": "Practice German grammar online with interactive exercises and AI feedback. Master German grammar rules for A1, A2, and B1 levels.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Grammar",
                "educationalLevel": ["A1", "A2", "B1"],
                "numberOfLessons": "100",
                "url": "https://app.langey.com/grammar"
              },
              {
                "@type": "Course",
                "name": "German Speaking Practice - AI Conversation Scenarios",
                "description": "Practice spoken German with AI-powered conversation scenarios. Improve German pronunciation, fluency, and speaking confidence with interactive roleplay prompts for A1, A2, and B1 levels.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Speaking",
                "educationalLevel": ["A1", "A2", "B1"],
                "url": "https://app.langey.com/speaking"
              },
              {
                "@type": "Course",
                "name": "German Writing Practice - Correct Your Texts",
                "description": "Practice written German with AI-powered correction. Improve German writing skills, grammar, and vocabulary for A1, A2, and B1 levels.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Writing",
                "educationalLevel": ["A1", "A2", "B1"],
                "url": "https://app.langey.com/writing"
              },
              {
                "@type": "Course",
                "name": "German Reading Practice - Comprehension Exercises",
                "description": "Practice German reading comprehension with interactive passages, fill-in-the-blank, true/false, and multiple choice exercises. Improve German reading skills for A1, A2, and B1 levels.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Reading",
                "educationalLevel": ["A1", "A2", "B1"],
                "url": "https://app.langey.com/reading"
              },
              {
                "@type": "Course",
                "name": "German Listening Practice - Audio Comprehension Exercises",
                "description": "Practice German listening comprehension with audio exercises, fill-in-the-blank, true/false, and multiple choice questions. Improve German listening skills for A1, A2, and B1 levels with native speaker audio.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Listening",
                "educationalLevel": ["A1", "A2", "B1"],
                "url": "https://app.langey.com/listening"
              },
              {
                "@type": "Course",
                "name": "Learn German A1 - Beginner Level",
                "description": "Learn German from scratch with A1 level vocabulary and grammar. Perfect for beginners starting their German language journey.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Language",
                "educationalLevel": "A1"
              },
              {
                "@type": "Course",
                "name": "Learn German A2 - Elementary Level",
                "description": "Advance your German learning with A2 level content. Build confidence in German communication and grammar.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Language",
                "educationalLevel": "A2"
              },
              {
                "@type": "Course",
                "name": "Learn German B1 - Intermediate Level",
                "description": "Master intermediate German with B1 level vocabulary and grammar. Achieve fluency in German language.",
                "provider": { "@type": "Organization", "name": "Langey" },
                "courseMode": "online",
                "inLanguage": "en",
                "teaches": "German Language",
                "educationalLevel": "B1"
              }
            ]
          },
          "offers": {
            "@type": "Offer",
            "name": "German Language Learning Subscription",
            "description": "Interactive German learning with vocabulary flashcards, grammar exercises, reading comprehension, speaking practice, writing practice, AI-powered feedback, and progress tracking - $4.99 per month",
            "price": "4.99",
            "priceCurrency": "USD",
            "priceSpecification": {
              "@type": "UnitPriceSpecification",
              "price": "4.99",
              "priceCurrency": "USD",
              "billingDuration": "P1M",
              "billingIncrement": "P1M"
            },
            "availability": "https://schema.org/InStock",
            "validFrom": "2024-01-01"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "3056",
            "bestRating": "5",
            "worstRating": "1"
          },
          "keywords": "learn german online, german learning platform, german vocabulary, german grammar exercises, german reading practice, german speaking practice, german writing practice, learn german words, practice german online, practice speaking german, german flashcards, interactive german learning, AI german tutor, learn german fast, german conversation practice, german reading comprehension"
        })}
      </script>

      {/* Desktop Header */}
      <header
        className={cx(
          'fixed inset-x-6 top-4 z-[500] mx-auto flex h-14 w-[calc(100%-48px)] max-w-[800px] shrink-0 justify-center overflow-visible rounded-full border-[1.5px] border-black/18 bg-white px-3 max-lg:hidden',
          isFullscreen && 'hidden',
        )}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-[18px]">
            {showFeatureHeader ? (
              <button
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[18px] border-[1.5px] border-langey-ink bg-langey-ink p-0 text-white shadow-[0_2px_4px_-1px_rgba(0,0,0,.06)] transition-[background,transform,border-color,box-shadow] duration-150 hover:scale-[1.03] hover:border-black hover:bg-black hover:shadow-none"
                type="button"
                onClick={() => handleMainTabChange('modules')}
                aria-label="Back to Modules"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 font-[inherit] text-langey-ink no-underline transition-opacity duration-200 hover:opacity-70"
                onClick={() => handleMainTabChange('modules')}
                aria-label="Langey modules"
              >
                <img src={logo} alt="" width={36} height={36} className="block rounded-full" />
              </button>
            )}

            <nav className="flex min-w-0 items-center gap-3.5" aria-label="Main menu">
              {showFeatureHeader ? (
                <span className="text-xs leading-none font-bold tracking-[0.08em] whitespace-nowrap text-langey-ink uppercase" aria-current="page">{getFeatureLabel(mainTab)}</span>
              ) : (
                <button
                  type="button"
                  className={cx(
                    'cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs leading-none font-bold tracking-[0.08em] whitespace-nowrap text-langey-muted uppercase transition-colors duration-200 hover:text-langey-ink',
                    mainTab === 'modules' && 'text-langey-ink',
                  )}
                  onClick={() => handleMainTabChange('modules')}
                  aria-current={mainTab === 'modules' ? 'page' : undefined}
                >
                  Modules
                </button>
              )}
            </nav>
          </div>

          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
            {isFeatureTab && canShowStatsMode && (
              <button
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-black/18 bg-transparent px-[18px] text-[13px] leading-none font-semibold whitespace-nowrap text-langey-ink transition-[transform,border-color,background] duration-200 hover:scale-[1.03] hover:border-black/40 hover:bg-black/4"
                type="button"
                onClick={() => handleModeChange(activeMode === 'STATS' ? getDefaultModeForTab(mainTab) : 'STATS')}
              >
                {activeMode === 'STATS' ? 'Learn' : 'Stats'}
              </button>
            )}
            {displayedRoadmapProgress !== null && (
              <div className="flex shrink-0 items-center">
                {renderRoadmapProgressPill()}
              </div>
            )}
            {mainTab === 'modules' && !fromRoadmap && (
              <RoadmapControls
                roadmapEnabled={roadmapEnabled}
                hasRoadmap={!!roadmapDayByLevel[level]}
                onEnable={handleEnableRoadmap}
                onDisable={() => handleRoadmapToggleChange(false)}
                onReset={handleResetJourney}
              />
            )}
            <SettingsIconButton
              active={mainTab === 'settings'}
              onClick={() => handleMainTabChange('settings')}
            />
            <DailyCreditsDisplay variant="desktop" />
          </div>
        </div>
      </header>

      {showLevelSelectionPopup && createPortal(
        <>
          <div className="landing-overlay-animate fixed inset-0 z-[1200] bg-black/32" aria-hidden="true" />
          <div
            className="landing-sheet-animate fixed inset-x-0 bottom-0 z-[1201] mx-auto flex w-full max-w-[560px] flex-col items-center gap-[22px] rounded-t-[22px] bg-white px-10 pt-[34px] pb-[calc(28px+env(safe-area-inset-bottom,0px))] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open_Sans','Helvetica_Neue',sans-serif] text-langey-ink shadow-[0_-18px_60px_rgba(0,0,0,0.18)] max-sm:px-6 max-sm:pt-[30px] max-sm:pb-[calc(26px+env(safe-area-inset-bottom,0px))]"
            role="dialog"
            aria-modal="true"
            aria-label="Select German level"
          >
            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black/6" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5h12" />
                <path d="M9 3v2" />
                <path d="M5 5c1.15 3.7 3.35 6.15 7 8" />
                <path d="M12 5c-.8 3.1-2.75 5.9-7 8" />
                <path d="M14 20l4-9 4 9" />
                <path d="M15.5 17h5" />
              </svg>
            </div>
            <h2 className="m-0 text-center text-[28px] leading-[1.25] font-bold tracking-[-0.3px] max-sm:text-2xl">
              Select your German level
            </h2>
            <div className="gg-roadmap-toggle m-0 w-full max-sm:w-full">
              {GERMAN_LEVELS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cx(
                    'gg-roadmap-toggle-btn min-w-[86px] max-sm:min-w-0 max-sm:flex-1 max-sm:px-0',
                    level === option && 'active',
                  )}
                  onClick={() => handleLevelSelect(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="m-0 text-center text-[13px] leading-[1.45] text-langey-muted">
              This can be changed later in Settings.
            </p>
            {consumerId === UserTracker.PENDING_CONSUMER_ID && (
              <p className="-mt-2 mb-0 max-w-[360px] text-center text-[11px] leading-[1.45] text-langey-muted">
                By continuing you agree to our{' '}
                <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-[#6e6e73] underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms-and-conditions" target="_blank" rel="noreferrer" className="text-[#6e6e73] underline">Terms & Conditions</a>
              </p>
            )}
          </div>
        </>,
        document.body,
      )}

      {/* Mobile Header (fixed at top, hidden on desktop) */}
      <div className="fixed top-0 right-0 left-0 z-[500] hidden flex-col border-b border-black/8 bg-[rgb(238,239,240)] max-lg:flex">
        <div className="flex h-[54px] items-center gap-2 px-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
            {(fromRoadmap || showFeatureHeader) && (
              <button
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#111] [-webkit-tap-highlight-color:transparent]"
                onClick={() => { handleMainTabChange('modules'); }}
                aria-label="Back to Modules"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <span className="overflow-hidden text-sm font-semibold tracking-[-0.01em] text-ellipsis whitespace-nowrap text-[#111]">
              {getMobileHeaderLabel()}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {mainTab === 'modules' && !fromRoadmap && (
              <RoadmapControls
                roadmapEnabled={roadmapEnabled}
                hasRoadmap={!!roadmapDayByLevel[level]}
                onEnable={handleEnableRoadmap}
                onDisable={() => handleRoadmapToggleChange(false)}
                onReset={handleResetJourney}
              />
            )}
            {mainTab !== 'settings' && (
              <SettingsIconButton onClick={() => handleMainTabChange('settings')} />
            )}
            {displayedRoadmapProgress !== null && renderRoadmapProgressPill()}
            {isFeatureTab && canShowStatsMode && (
              <button
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-black/18 bg-transparent px-[18px] text-[13px] leading-none font-semibold whitespace-nowrap text-langey-ink transition-[transform,border-color,background] duration-200 hover:scale-[1.03] hover:border-black/40 hover:bg-black/4"
                type="button"
                onClick={() => handleModeChange(activeMode === 'STATS' ? getDefaultModeForTab(mainTab) : 'STATS')}
              >
                {activeMode === 'STATS' ? 'Learn' : 'Stats'}
              </button>
            )}
            <DailyCreditsDisplay variant="mobile" />
          </div>
        </div>
      </div>

      <section className="mx-auto mt-[92px] flex min-h-[calc(100dvh-112px)] w-full max-w-[980px] flex-1 flex-col px-5 pb-5 max-lg:mt-0 max-lg:max-w-none max-lg:min-h-dvh max-lg:px-0 max-lg:pt-[54px] max-lg:pb-[calc(60px+env(safe-area-inset-bottom))]">
        <div style={{ display: mainTab === 'modules' ? 'block' : 'none' }}>
          <LangeyRoadmap
            level={level}
            refreshTrigger={roadmapRefreshTrigger}
            onRefreshDone={() => setIsRoadmapRefreshing(false)}
            roadmapEnabled={roadmapEnabled}
            setupTrigger={roadmapSetupTrigger}
            onRoadmapEnabledChange={handleRoadmapToggleChange}
            onRoadmapPresenceChange={handleRoadmapPresenceChange}
            onRoadmapDataUpdate={handleRoadmapDataUpdate}
            resetTrigger={roadmapResetTrigger}
          />
        </div>

        <div style={{ display: mainTab === 'vocabulary' ? 'block' : 'none' }}>
          <LangeyVocabulary
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'LEARN'}
            roadmapProgress={fromRoadmap ? roadmapProgressValue : null}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
            isActive={isModuleMediaActive(mainTab, 'vocabulary', activeMode)}
          />

          {/* SEO-optimized hidden content for vocabulary page */}
          <div style={{ display: 'none' }}>
            <h1>German Vocabulary Practice - Learn German Words</h1>
            <p>Master German vocabulary with our interactive flashcards and spaced repetition system. Learn German words effectively with audio pronunciation, contextual examples, and AI-powered practice.</p>

            <h2>Learn German Words with Flashcards</h2>
            <p>Learn German vocabulary using scientifically-proven flashcard methods. Our German flashcards include audio pronunciation, example sentences, and spaced repetition algorithms to help you memorize German words faster.</p>

            <h3>German Vocabulary Builder</h3>
            <p>Build your German vocabulary systematically with 6000+ words organized by proficiency level. Our German vocabulary builder covers A1, A2, and B1 levels with essential words for everyday communication.</p>

            <h3>Spaced Repetition German Learning</h3>
            <p>Practice German vocabulary with spaced repetition - the most effective method for long-term retention. Our system automatically schedules reviews to optimize your German word memorization.</p>

            <h3>German Pronunciation with Audio</h3>
            <p>Perfect your German pronunciation with native speaker audio for every word. Learn correct German pronunciation through listening and repetition, making your German vocabulary practice more effective.</p>

            <h3>German Vocabulary App Features</h3>
            <p>Track your German vocabulary progress with detailed statistics. See how many German words you've mastered, how many are in progress, and what's left to learn. Our German vocabulary app helps you stay motivated and organized.</p>

            <h3>Learn German Vocabulary by Level</h3>
            <p>Learn German vocabulary tailored to your level - A1 for beginners, A2 for elementary, and B1 for intermediate learners. Each level includes carefully selected German words essential for that proficiency stage.</p>

            <h3>German Words with Context</h3>
            <p>Learn German words in context with example sentences for every vocabulary item. Understanding German words in real sentences helps you remember meanings and use vocabulary correctly in conversations.</p>

            <h3>Interactive German Vocabulary Practice</h3>
            <p>Practice German vocabulary interactively with immediate feedback. Mark words as known or unknown, track your learning progress, and focus on German words that need more practice.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'grammar' ? 'block' : 'none' }}>
          <LangeyGrammar
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'LEARN'}
            onFullscreenChange={(v) => setIsFullscreen(v)}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
          />

          {/* SEO-optimized hidden content for grammar page */}
          <div style={{ display: 'none' }}>
            <h1>German Grammar Exercises Online - Practice German Grammar</h1>
            <p>Master German grammar with interactive exercises and AI-powered feedback. Practice German grammar online with 100+ topics covering A1, A2, and B1 levels. Get instant corrections and detailed explanations for every exercise.</p>

            <h2>Practice German Grammar with Interactive Exercises</h2>
            <p>Practice German grammar online with five types of interactive exercises: fill-in-the-blank, multiple choice, true/false, sentence building, and word order. Each German grammar exercise provides instant feedback and explanations.</p>

            <h3>German Grammar Rules Explained</h3>
            <p>Learn German grammar rules with clear explanations before practicing. Our comprehensive German grammar lessons cover essential topics from beginner to intermediate level, with examples and detailed rules.</p>

            <h3>German Grammar Exercises by Level</h3>
            <p>Practice German grammar exercises organized by proficiency level. A1 grammar exercises for beginners, A2 for elementary learners, and B1 for intermediate students. Each level includes 10 comprehensive grammar topics.</p>

            <h3>Interactive German Grammar Practice</h3>
            <p>Engage with interactive German grammar exercises that adapt to your learning needs. Get AI-powered feedback on your answers, track your grammar progress, and identify areas for improvement.</p>

            <h3>German Grammar Topics Covered</h3>
            <p>Practice German grammar across 100+ essential topics including nouns and articles, verb conjugations, cases, prepositions, adjective declension, modal verbs, tenses, subordinate clauses, and passive voice. Comprehensive coverage for all German grammar needs.</p>

            <h3>AI-Powered German Grammar Feedback</h3>
            <p>Receive instant AI-powered feedback on your German grammar exercises. Our system explains why answers are correct or incorrect, helping you understand German grammar rules deeply and avoid common mistakes.</p>

            <h3>German Grammar Drills and Practice</h3>
            <p>Strengthen your German grammar skills with targeted drills and practice exercises. Repeat German grammar exercises to build muscle memory and confidence in using German grammar correctly.</p>

            <h3>Free German Grammar Practice Online</h3>
            <p>Access free German grammar practice online with unlimited exercises. No subscription required - start practicing German grammar immediately with our comprehensive free platform.</p>

            <h3>German Grammar Worksheets Alternative</h3>
            <p>Better than traditional German grammar worksheets - our interactive exercises provide immediate feedback, progress tracking, and adaptive difficulty. Practice German grammar more effectively online.</p>

            <h3>Learn German Grammar Step by Step</h3>
            <p>Learn German grammar systematically with our structured curriculum. Start with basic German grammar at A1 level and progress through intermediate topics, building a solid foundation in German language structure.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'speaking' ? 'block' : 'none' }}>
          <LangeySpeaking
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'PRACTICE'}
            openedFromRoadmap={fromRoadmap}
            roadmapItemKey={roadmapItemKey}
            roadmapTopic={roadmapTopic}
            roadmapTargetMinutes={roadmapTargetMinutes}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
            onActiveDurationUpdate={fromRoadmap ? (percent: number) => {
              setRoadmapProgressValue(percent);
              if (roadmapTargetMinutes) {
                setRoadmapProgressLabel(`${Math.floor((percent / 100) * roadmapTargetMinutes)} / ${roadmapTargetMinutes} min`);
              }
            } : undefined}
            initialProgress={fromRoadmap ? (roadmapProgressValue ?? 0) : 0}
            isActive={isModuleMediaActive(mainTab, 'speaking', activeMode)}
          />

          {/* SEO-optimized hidden content for speaking page */}
          <div style={{ display: 'none' }}>
            <h1>German Speaking Practice - AI Conversation Scenarios</h1>
            <p>Practice spoken German with AI-powered conversation scenarios. Improve German pronunciation, fluency, and speaking confidence with interactive roleplay prompts for A1, A2, and B1 levels. Build real-world German conversation skills through realistic scenarios.</p>

            <h2>Practice Speaking German with AI</h2>
            <p>Practice speaking German online with our AI conversation partner. Engage in natural German conversations without the pressure of speaking with native speakers. Our AI adapts to your German proficiency level and provides real-time feedback on your speaking.</p>

            <h3>German Conversation Practice Scenarios</h3>
            <p>Practice German speaking through realistic conversation scenarios including discussing your day with a friend, discussing finances with spouse, ordering food at a restaurant, asking for directions, and job interview practice. Each scenario helps you practice German speaking in real-life contexts.</p>

            <h3>German Pronunciation Practice</h3>
            <p>Improve your German pronunciation through interactive speaking exercises. Our AI analyzes your German pronunciation and provides feedback to help you speak German more accurately and confidently.</p>

            <h3>German Speaking Exercises by Level</h3>
            <p>Practice German speaking tailored to your proficiency level. A1 speaking exercises for beginners focus on basic conversations, A2 for elementary learners covers everyday situations, and B1 for intermediate students includes more complex German speaking scenarios.</p>

            <h3>Interactive German Speaking Practice</h3>
            <p>Engage in interactive German speaking practice with AI-powered conversations. Practice German speaking at your own pace, receive instant feedback, and build confidence in your German conversation skills.</p>

            <h3>German Roleplay Practice</h3>
            <p>Practice German speaking through roleplay scenarios that simulate real-world situations. Whether you're practicing for a job interview, ordering food, or having casual conversations, our German roleplay practice helps you speak German naturally.</p>

            <h3>Improve German Fluency</h3>
            <p>Improve your German fluency through regular speaking practice. Our AI conversation partner helps you develop natural German speaking patterns, expand your vocabulary in context, and build confidence in spoken German.</p>

            <h3>German Speaking with AI Feedback</h3>
            <p>Receive real-time AI feedback on your German speaking. Our system analyzes your pronunciation, grammar, and fluency, providing helpful suggestions to improve your German speaking skills.</p>

            <h3>Spoken German Practice Online</h3>
            <p>Practice spoken German online anytime, anywhere. No need to find a conversation partner - our AI is always available to help you practice German speaking and improve your conversation skills.</p>

            <h3>German Conversation Scenarios</h3>
            <p>Practice German conversation through diverse scenarios that cover everyday situations. From casual chats to professional interactions, our German conversation scenarios help you speak German confidently in any context.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'writing' ? 'block' : 'none' }}>
          <LangeyWriting
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'PRACTICE'}
            openedFromRoadmap={fromRoadmap}
            roadmapItemKey={roadmapItemKey}
            roadmapTopic={roadmapTopic}
            roadmapTargetWords={roadmapTargetWords}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
          />

          {/* SEO-optimized hidden content for writing page */}
          <div style={{ display: 'none' }}>
            <h1>German Writing Practice - AI-Powered Text Correction | Langey</h1>
            <p>Practice written German with AI-powered correction and feedback. Improve German writing skills, grammar, vocabulary, and sentence structure for A1, A2, and B1 levels. Get instant corrections and detailed weak point analysis.</p>

            <h2>Practice German Writing Online</h2>
            <p>Practice German writing online with our AI-powered text correction tool. Write in German and receive instant feedback on grammar, vocabulary, and sentence structure. Our AI analyzes your German writing and provides detailed corrections and suggestions for improvement.</p>

            <h3>German Writing Exercises</h3>
            <p>Practice German writing through various exercises including text composition, sentence building, and paragraph writing. Each exercise helps you improve your German writing skills at your own pace with personalized feedback.</p>

            <h3>German Text Correction</h3>
            <p>Get instant German text correction with detailed explanations. Our AI identifies grammar errors, vocabulary mistakes, and suggests improvements to help you write better German.</p>

            <h3>German Writing Skills by Level</h3>
            <p>Practice German writing tailored to your proficiency level. A1 writing exercises for beginners focus on basic sentences and simple texts, A2 for elementary learners covers everyday writing situations, and B1 for intermediate students includes more complex German writing tasks.</p>

            <h3>German Grammar and Vocabulary Feedback</h3>
            <p>Receive comprehensive feedback on your German writing including grammar corrections, vocabulary suggestions, and weak point analysis. Identify areas for improvement and practice specific grammar topics and vocabulary to enhance your German writing skills.</p>

            <h3>Interactive German Writing Practice</h3>
            <p>Engage in interactive German writing practice with AI-powered feedback. Write German texts, receive instant corrections, and track your progress as you improve your German writing abilities.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'reading' ? 'block' : 'none' }}>
          <LangeyReading
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'PRACTICE'}
            onFullscreenChange={setIsFullscreen}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
          />

          {/* SEO-optimized hidden content for reading page */}
          <div style={{ display: 'none' }}>
            <h1>German Reading Practice - Comprehension Exercises A1 A2 B1 | Langey</h1>
            <p>Practice German reading comprehension with interactive exercises. Improve German reading skills with passages, fill-in-the-blank, true/false, and multiple choice exercises for A1, A2, B1 levels. Free German reading practice online with vocabulary support.</p>

            <h2>Practice German Reading Online</h2>
            <p>Practice German reading online with our comprehensive collection of texts and exercises. Read German passages and test your understanding with interactive comprehension questions. Perfect for learners at A1, A2, and B1 levels.</p>

            <h3>German Reading Passages</h3>
            <p>Read German passages specially graded for your proficiency level. From simple A1 stories about daily life to more complex B1 articles and dialogues. Each text comes with carefully designed exercises to test your reading comprehension.</p>

            <h3>German Comprehension Exercises</h3>
            <p>Test your understanding with diverse comprehension exercises. Practice with fill-in-the-blank texts, true/false statements, and multiple choice questions. Our interactive format provides instant feedback on your reading skills.</p>

            <h3>German Reading Skills by Level</h3>
            <p>Improve your German reading skills step by step. Start with A1 reading exercises for beginners, progress to A2 texts for elementary learners, and challenge yourself with B1 reading materials for intermediate students. Build your reading fluency progressively.</p>

            <h3>Interactive German Reading Practice</h3>
            <p>Engage in interactive German reading practice that keeps you motivated. Our platform tracks your progress, highlights your strengths, and helps you identify areas for improvement in your German comprehension.</p>

            <h3>Free German Reading Practice</h3>
            <p>Access high-quality German reading practice anytime, anywhere. Build your German vocabulary and grammatical understanding through context while improving your overall reading fluency.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'listening' ? 'block' : 'none' }}>
          <LangeyListening
            key={`${consumerId}-${featureResetVersion}`}
            level={level}
            mode={activeMode === 'STATS' ? 'STATS' : 'PRACTICE'}
            onFullscreenChange={setIsFullscreen}
            onProgressUpdate={fromRoadmap ? () => fetchRoadmapProgress(mainTab, level, consumerId) : undefined}
            isActive={isModuleMediaActive(mainTab, 'listening', activeMode)}
          />

          {/* SEO-optimized hidden content for listening page */}
          <div style={{ display: 'none' }}>
            <h1>German Listening Practice - Comprehension Exercises | Langey</h1>
            <p>Practice German listening comprehension with audio exercises, fill-in-the-blank, true/false, and multiple choice questions. Improve German listening skills for A1, A2, and B1 levels with native speaker audio.</p>

            <h2>Practice German Listening Online</h2>
            <p>Practice German listening comprehension online with audio passages and interactive exercises. Improve your ability to understand spoken German with fill-in-the-blank, true/false, and multiple choice questions at A1, A2, and B1 levels.</p>

            <h3>German Listening Exercises by Level</h3>
            <p>Practice German listening exercises organized by proficiency level. A1 listening exercises for beginners, A2 for elementary learners, and B1 for intermediate students. Each level includes carefully curated audio passages with native speaker recordings.</p>

            <h3>Interactive German Listening Practice</h3>
            <p>Engage with interactive German listening exercises that help you develop your comprehension skills. Listen to audio passages, answer questions, and receive instant feedback on your understanding of spoken German.</p>

            <h3>German Audio Comprehension</h3>
            <p>Improve your German audio comprehension with diverse listening exercises covering everyday topics. Practice understanding spoken German in real-world contexts including daily routines, shopping, food and drink, family, and more.</p>

            <h3>German Listening Skills</h3>
            <p>Develop strong German listening skills through regular practice with native speaker audio. Our exercises help you recognize German vocabulary, understand sentence structures, and follow conversations in German.</p>
          </div>
        </div>

        <div style={{ display: mainTab === 'settings' ? 'block' : 'none' }}>
          <Settings level={level} onLevelChange={handleLevelSelect} />
        </div>
      </section>

      {/* Global Feedback Popup */}
      <FeedbackPopup
        isVisible={shouldShowFeedback}
        onClose={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
      />

      <ModulesGuideTour
        active={showModulesGuide}
        onClose={() => setShowModulesGuide(false)}
      />
    </div>
  );
};
