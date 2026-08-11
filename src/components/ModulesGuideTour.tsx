import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserTracker } from '../utils/userTracking';
import './ModulesGuideTour.animations.css';

type GuideStep = 'prompt' | 'around' | 'roadmap' | 'modules' | 'progress';

const TARGET_ATTR: Partial<Record<GuideStep, string>> = {
  roadmap: 'langey-guide-roadmap',
  modules: 'langey-guide-modules',
  progress: 'langey-guide-progress',
};

const PROMPT_MS = 5000;
const SPOT_SETTLE_MS = 950;
const AROUND_SETTLE_MS = 700;
const BUTTON_FADE_MS = 600;
/** Must be >= copy/button CSS fade so old UI is gone before the next step mounts. */
const CONTENT_FADE_MS = 580;
const DARK_FADE_MS = 350;
const PROMPT_EXIT_MS = 320;
const LETTER_STAGGER_MS = 32;
const LETTER_FADE_MS = 380;

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

function roadmapEnabledFromOnboarding(): boolean {
  try {
    const level = UserTracker.getGermanLevel().toLowerCase();
    return localStorage.getItem(`enable_roadmap_${level}`) === 'true';
  } catch {
    return false;
  }
}

function fullDarkSpot(): SpotRect {
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  return {
    top: h / 2,
    left: w / 2,
    width: 0,
    height: 0,
    radius: 0,
  };
}

function pickVisibleTarget(attr: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${attr}"]`));
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const style = window.getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      continue;
    }
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = node;
      bestArea = area;
    }
  }
  return best;
}

function measureSpot(el: HTMLElement, step: GuideStep): SpotRect {
  let top: number;
  let left: number;
  let right: number;
  let bottom: number;

  if (step === 'modules') {
    const items = el.querySelectorAll<HTMLElement>('.feat-circle-item');
    if (items.length > 0) {
      top = Infinity;
      left = Infinity;
      right = -Infinity;
      bottom = -Infinity;
      items.forEach((item) => {
        const r = item.getBoundingClientRect();
        top = Math.min(top, r.top);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      });
    } else {
      const r = el.getBoundingClientRect();
      top = r.top;
      left = r.left;
      right = r.right;
      bottom = r.bottom;
    }
  } else {
    const r = el.getBoundingClientRect();
    top = r.top;
    left = r.left;
    right = r.right;
    bottom = r.bottom;
  }

  const pad = step === 'modules' ? 6 : 10;
  const width = right - left;
  const height = bottom - top;
  const radius = Math.min(22, Math.max(12, Math.round(Math.min(width, height) * 0.18)));
  return {
    top: top - pad,
    left: left - pad,
    width: width + pad * 2,
    height: height + pad * 2,
    radius,
  };
}

function LetterFadeIn({
  text,
  active,
  onComplete,
}: {
  text: string;
  active: boolean;
  onComplete?: () => void;
}) {
  const chars = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    if (!active) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      onComplete?.();
      return;
    }
    const doneAt = chars.length * LETTER_STAGGER_MS + LETTER_FADE_MS + 80;
    const timer = window.setTimeout(() => onComplete?.(), doneAt);
    return () => window.clearTimeout(timer);
  }, [active, chars.length, onComplete]);

  return (
    <p
      className="langey-guide-typewriter langey-guide-typewriter--live absolute inset-0 m-0 text-[clamp(22px,5.5vw,42px)] leading-[1.15] font-bold tracking-[-0.045em] whitespace-nowrap text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]"
      aria-live="polite"
    >
      {chars.map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className={`langey-guide-letter${active ? ' is-in' : ''}`}
          style={{ transitionDelay: active ? `${i * LETTER_STAGGER_MS}ms` : '0ms' }}
        >
          {ch}
        </span>
      ))}
    </p>
  );
}

interface ModulesGuideTourProps {
  active: boolean;
  onClose?: () => void;
}

export const ModulesGuideTour: React.FC<ModulesGuideTourProps> = ({ active, onClose }) => {
  const [step, setStep] = useState<GuideStep>('prompt');
  const [spot, setSpot] = useState<SpotRect>(() => fullDarkSpot());
  const [spotReady, setSpotReady] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [promptLeaving, setPromptLeaving] = useState(false);
  const [tourLeaving, setTourLeaving] = useState(false);
  const advancingRef = useRef(false);
  const buttonTimerRef = useRef<number | null>(null);
  const stepGenRef = useRef(0);
  const fromOnboardingRoadmap = useMemo(() => roadmapEnabledFromOnboarding(), [active]); // eslint-disable-line react-hooks/exhaustive-deps -- preserve established effect timing

  const isTour = step !== 'prompt';
  const isLastTourStep = step === 'progress';
  const needsSpot = step === 'roadmap' || step === 'modules' || step === 'progress';

  const copy = useMemo(() => {
    if (step === 'prompt') return '';
    if (step === 'around') return "Let's show you around";
    if (step === 'roadmap') {
      return fromOnboardingRoadmap
        ? 'We created the roadmap for you — turn it off if you want to learn freely'
        : 'Turn on Roadmap for a day-by-day plan or learn freely without it';
    }
    if (step === 'modules') return 'Tap a module to complete its tasks';
    return 'Your total progress across all days';
  }, [step, fromOnboardingRoadmap]);

  const stageLayout = step === 'modules' ? 'modules' : 'center';

  const finish = (status: 'skipped' | 'accepted') => {
    UserTracker.finishModulesGuide(status);
    setStep('prompt');
    setSpot(fullDarkSpot());
    setSpotReady(false);
    setShowText(false);
    setShowNext(false);
    setPromptLeaving(false);
    setTourLeaving(false);
    onClose?.();
  };

  const startTour = () => {
    setPromptLeaving(false);
    setTourLeaving(false);
    setSpot(fullDarkSpot());
    setSpotReady(false);
    setStep('around');
  };

  useEffect(() => {
    if (!active) {
      setStep('prompt');
      setSpot(fullDarkSpot());
      setSpotReady(false);
      setShowText(false);
      setShowNext(false);
      setPromptLeaving(false);
      setTourLeaving(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active || step !== 'prompt' || promptLeaving) return;
    const timer = window.setTimeout(() => setPromptLeaving(true), PROMPT_MS);
    return () => window.clearTimeout(timer);
  }, [active, step, promptLeaving]);

  useEffect(() => {
    if (!promptLeaving || step !== 'prompt') return;
    const timer = window.setTimeout(() => finish('skipped'), PROMPT_EXIT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptLeaving, step]);

  // Reset text/button; veil stays in hole-mode and only morphs geometry.
  useEffect(() => {
    if (!active || !isTour) return;
    stepGenRef.current += 1;
    if (buttonTimerRef.current !== null) {
      window.clearTimeout(buttonTimerRef.current);
      buttonTimerRef.current = null;
    }
    setShowText(false);
    setShowNext(false);
    setSpotReady(false);
    if (!needsSpot) {
      setSpot(fullDarkSpot());
      // Allow geometry paint before marking ready.
      const timer = window.setTimeout(() => setSpotReady(true), 40);
      return () => window.clearTimeout(timer);
    }
  }, [active, isTour, step, needsSpot]);

  useEffect(() => {
    if (!active || !isTour || !needsSpot) return;

    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const attr = TARGET_ATTR[step];
      if (!attr) return;
      const el = pickVisibleTarget(attr);
      if (!el) {
        tries += 1;
        if (tries < 40) window.setTimeout(measure, 80);
        return;
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => {
        if (cancelled) return;
        setSpot(measureSpot(el, step));
        setSpotReady(true);
      }, 160);
    };

    measure();
    const onResize = () => {
      if (!needsSpot) {
        setSpot(fullDarkSpot());
        return;
      }
      measure();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, isTour, step, needsSpot]);

  useEffect(() => {
    if (!active || !isTour || !spotReady || showText) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduceMotion ? 0 : needsSpot ? SPOT_SETTLE_MS : AROUND_SETTLE_MS;
    const timer = window.setTimeout(() => setShowText(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, isTour, spotReady, showText, needsSpot]);

  const handleLettersDone = useCallback(() => {
    const gen = stepGenRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (buttonTimerRef.current !== null) {
      window.clearTimeout(buttonTimerRef.current);
      buttonTimerRef.current = null;
    }
    if (reduceMotion) {
      if (gen === stepGenRef.current) setShowNext(true);
      return;
    }
    buttonTimerRef.current = window.setTimeout(() => {
      buttonTimerRef.current = null;
      if (gen !== stepGenRef.current) return;
      setShowNext(true);
    }, BUTTON_FADE_MS);
  }, []);

  if (!active) return null;

  const goNext = () => {
    if (advancingRef.current) return;
    if (buttonTimerRef.current !== null) {
      window.clearTimeout(buttonTimerRef.current);
      buttonTimerRef.current = null;
    }
    stepGenRef.current += 1;

    if (step === 'progress') {
      setShowText(false);
      setShowNext(false);
      advancingRef.current = true;
      window.setTimeout(() => {
        setTourLeaving(true);
        window.setTimeout(() => {
          advancingRef.current = false;
          finish('accepted');
        }, DARK_FADE_MS);
      }, CONTENT_FADE_MS);
      return;
    }

    advancingRef.current = true;
    setShowText(false);
    setShowNext(false);
    window.setTimeout(() => {
      if (step === 'around') setStep('roadmap');
      else if (step === 'roadmap') setStep('modules');
      else if (step === 'modules') setStep('progress');
      advancingRef.current = false;
    }, CONTENT_FADE_MS);
  };

  return createPortal(
    <div
      className={`langey-guide-root langey-guide-root--${step}${isTour ? ' langey-guide-root--tour' : ' langey-guide-root--prompt'}${tourLeaving ? ' langey-guide-root--leaving' : ''}`}
      role="dialog"
      aria-modal={isTour ? true : undefined}
      aria-label="Langey modules guide"
    >
      {step === 'prompt' ? (
        <div
          className={`langey-guide-prompt-banner fixed inset-x-4 bottom-6 z-[9999] mx-auto flex w-auto max-w-[380px] flex-col gap-3.5 overflow-hidden rounded-[18px] border border-gray-900/[0.18] bg-gradient-to-b from-white to-slate-50 px-[18px] pt-[18px] pb-[30px] shadow-[0_12px_40px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] max-sm:bottom-[max(24px,env(safe-area-inset-bottom,0px))] sm:right-6 sm:left-auto sm:mx-0${promptLeaving ? ' langey-guide-prompt-banner--out' : ''}`}
          role="dialog"
          aria-label="Welcome to Langey"
        >
          <div className="flex flex-col items-stretch gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-lg leading-tight font-bold tracking-[-0.03em] text-gray-900">Welcome to Langey</p>
              <span className="inline-flex shrink-0 items-center rounded-full bg-gray-900/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-wider text-gray-600 uppercase" aria-hidden="true">1 min</span>
            </div>
            <p className="m-0 text-sm leading-[1.45] text-gray-500">Let&apos;s take a quick tour of Modules</p>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <button
              type="button"
              className="min-h-[42px] flex-1 cursor-pointer rounded-xl border border-gray-900 bg-gray-900 px-3.5 py-2 text-sm font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-gray-800 disabled:opacity-70"
              onClick={startTour}
              disabled={promptLeaving}
            >
              Start tour
            </button>
          </div>
          <div className="absolute right-4 bottom-2.5 left-4 h-0.5 overflow-hidden rounded-sm bg-gray-900/[0.06]" aria-hidden="true">
            <span className="langey-guide-prompt-timer-bar block h-full w-full rounded-sm bg-gray-900" />
          </div>
        </div>
      ) : (
        <>
          <div className="langey-guide-shield fixed inset-0 z-[12000] bg-transparent" aria-hidden="true" />
          {/* Always hole-mode: zero-size hole = full dark; never switch paint modes. */}
          <div
            className={`langey-guide-veil${spot.width < 1 && spot.height < 1 ? ' is-full-dark' : ''}`}
            style={{
              top: spot.top,
              left: spot.left,
              width: Math.max(spot.width, 0),
              height: Math.max(spot.height, 0),
              borderRadius: spot.radius,
            }}
            aria-hidden="true"
          />
          <div
            className={`langey-guide-stage langey-guide-stage--${stageLayout}`}
            style={{
              '--langey-guide-spot-top': `${spot.top}px`,
              '--langey-guide-spot-bottom': `${spot.top + spot.height}px`,
            } as React.CSSProperties}
          >
            <div className={`langey-guide-copy-block flex flex-col items-center${showText ? ' is-visible' : ''}`}>
              <div className="langey-guide-typewriter-slot relative w-max max-w-[min(92vw,920px)] max-sm:w-[90vw] max-sm:max-w-[90vw] sm:w-[min(90vw,980px)] sm:max-w-[min(90vw,980px)]">
                <p className="langey-guide-typewriter langey-guide-typewriter--ghost pointer-events-none m-0 text-[clamp(22px,5.5vw,42px)] leading-[1.15] font-bold tracking-[-0.045em] whitespace-nowrap text-white invisible [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]" aria-hidden="true">
                  {copy}
                </p>
                <LetterFadeIn key={step} text={copy} active={showText} onComplete={handleLettersDone} />
              </div>
            </div>
            <div className={`langey-guide-next-wrap flex min-h-11 items-center justify-center${showNext ? ' is-visible' : ''}`}>
              <button
                type="button"
                className="langey-guide-btn langey-guide-btn--next min-h-11 min-w-[120px] cursor-pointer rounded-full border border-white bg-white px-6 text-sm font-semibold text-gray-900 shadow-[0_8px_28px_rgba(0,0,0,0.18)] transition-colors duration-200 hover:bg-gray-100 disabled:opacity-100"
                onClick={goNext}
                tabIndex={showNext ? 0 : -1}
                disabled={!showNext}
              >
                {isLastTourStep ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};

export default ModulesGuideTour;
