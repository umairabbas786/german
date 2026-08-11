import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import bestUserFeedback from '../data/best_user_feedback.json';
import logo from '../assets/images/logo-rounded.png';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../services/checkout';
import { UserTracker } from '../utils/userTracking';
import './NewUserOnboarding.animations.css';
import { AnimatedMinutes } from './onboarding/AnimatedMinutes';
import { GoogleMark } from './onboarding/GoogleMark';
import {
  DEFAULT_SCENARIO,
  minutesPerDay,
  readJourneyDraft,
  roadmapDaysForMonths,
  STAGE_ORDER,
  type GermanLevel,
  type Intent,
  type JourneyDraft,
  type MonthsChoice,
  type Stage,
} from '../features/onboarding/journey';
import { createRoadmap as requestRoadmapCreation } from '../services/roadmapApi';
import { getDailyCredits } from '../services/creditsApi';

interface NewUserOnboardingProps {
  onComplete: () => void;
}

const testimonials = bestUserFeedback.map((item) => ({
  name: item.display_name,
  text: item.feedback,
}));
const scrollingCards = [...testimonials, ...testimonials, ...testimonials];

const primaryBtn =
  'inline-flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-0 bg-[#19191b] text-base font-semibold tracking-[-0.02em] text-white transition-[transform,opacity] duration-[180ms] hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 md:mx-auto md:w-[280px] md:max-w-full md:self-center md:px-7';

const backBtn =
  'grid h-[54px] w-[54px] shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] border-[rgba(25,25,27,0.12)] bg-white/75 text-[#555] transition-[background,border-color] duration-150 hover:border-[rgba(25,25,27,0.22)] hover:bg-white';

const linkBtn =
  'cursor-pointer border-0 bg-transparent p-2 text-sm font-medium text-[#19191b] underline underline-offset-[3px]';

const bottomActions =
  'absolute inset-x-0 bottom-0 flex w-full items-center gap-3 md:max-w-full md:justify-center md:self-center';

export const NewUserOnboarding: React.FC<NewUserOnboardingProps> = ({ onComplete }) => {
  const initialDraft = useMemo(readJourneyDraft, []);
  const [stage, setStage] = useState<Stage>(initialDraft.stage);
  const [level, setLevel] = useState<GermanLevel | null>(initialDraft.level);
  const [months, setMonths] = useState<MonthsChoice>(initialDraft.months);
  const [intent, setIntent] = useState<Intent | null>(initialDraft.intent);
  const [roadmapCreated, setRoadmapCreated] = useState(initialDraft.roadmapCreated);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalizeStarted = useRef(false);
  const journeyFinished = useRef(false);
  /** 1 = forward (content exits left / enters from right), -1 = back (exits right / enters from left). */
  const [flowDirection, setFlowDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const { email, isLoading: isAuthLoading, authError, signInWithGoogle } = useSupabaseAuth();

  const resolvedLevel = level ?? 'A1';
  const dailyMinutes = minutesPerDay(resolvedLevel, months);
  const stepIndex = STAGE_ORDER.indexOf(stage);
  const slideEase = [0.22, 1, 0.36, 1] as const;
  const pageMotion = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.38, ease: slideEase },
    };
  const flowVariants = {
    enter: (direction: number) => ({
      opacity: reduceMotion ? 1 : 0,
      x: reduceMotion ? 0 : 72 * direction,
    }),
    center: { opacity: 1, x: 0 },
    exit: (direction: number) => ({
      opacity: reduceMotion ? 1 : 0,
      x: reduceMotion ? 0 : -72 * direction,
    }),
  };
  const flowMotion = {
    custom: flowDirection,
    variants: flowVariants,
    initial: 'enter' as const,
    animate: 'center' as const,
    exit: 'exit' as const,
    transition: { duration: reduceMotion ? 0 : 0.38, ease: slideEase },
  };

  useEffect(() => {
    // After finish, state updates must not re-persist an auth draft or / redirects back to /welcome.
    if (journeyFinished.current) return;
    UserTracker.saveNewUserOnboardingDraft({
      stage,
      level,
      months,
      intent,
      roadmapCreated,
    } satisfies JourneyDraft);
  }, [stage, level, months, intent, roadmapCreated]);

  useEffect(() => {
    if (!email || isAuthLoading || stage !== 'auth' || !intent) return;
    if (finalizeStarted.current || journeyFinished.current) return;
    finalizeStarted.current = true;
    void finalizeAuthenticatedJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isAuthLoading, stage, intent]);

  const transitionTo = (next: Stage) => {
    setError(null);
    if (next === 'auth') finalizeStarted.current = false;
    setStage(next);
  };

  const ensureIdentity = () => UserTracker.createConsumerId();

  const createRoadmap = async (consumerId: string) => {
    if (!level) throw new Error('Choose a German level first.');
    if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
      throw new Error('Please accept cookies so we can save your plan.');
    }
    const days = roadmapDaysForMonths(level, months);
    const response = await requestRoadmapCreation<{
      success?: boolean;
      roadmap?: unknown;
      error?: string;
    }>({
        consumer_id: consumerId,
        level,
        days,
        user_scenario: DEFAULT_SCENARIO,
    });
    const data = await response.json().catch(() => ({ success: false, roadmap: undefined, error: undefined }));
    if (!response.ok || !data.success || !data.roadmap) {
      throw new Error(data.error || 'We could not save your roadmap. Please try again.');
    }
    try {
      localStorage.setItem(`enable_roadmap_${level.toLowerCase()}`, 'true');
    } catch {
      // Server-side roadmap is the source of truth.
    }
    setRoadmapCreated(true);
  };

  const finishFree = () => {
    journeyFinished.current = true;
    if (level) UserTracker.saveGermanLevel(level);
    UserTracker.completeNewUserOnboarding();
    onComplete();
  };

  const goToCheckout = (consumerId: string, userEmail: string) => {
    if (level) UserTracker.saveGermanLevel(level);
    const checkoutLink = createCheckoutLink({
      planOption: CHECKOUT_PLAN_OPTIONS.BOTH,
      consumerId,
      email: userEmail,
      paidFromOnboarding: true,
    });
    if (!checkoutLink) {
      setError('Checkout is not configured yet. Please contact info@langey.com.');
      finalizeStarted.current = false;
      return;
    }
    journeyFinished.current = true;
    UserTracker.completeNewUserOnboarding();
    window.location.assign(checkoutLink);
  };

  const finalizeAuthenticatedJourney = async () => {
    if (!email || !intent || !level) return;
    setIsWorking(true);
    setError(null);
    try {
      // Google sync may already have resolved the identity created on the welcome CTA.
      const consumerId = ensureIdentity();
      await createRoadmap(consumerId);
      if (intent === 'paid') {
        const id = UserTracker.getConsumerId() || consumerId;
        let isPro = false;
        try {
          const resp = await getDailyCredits(id);
          if (resp.ok) {
            const data = await resp.json();
            isPro = Boolean(data.is_pro);
          }
        } catch {
          // Treat as free and continue to checkout.
        }
        if (isPro) finishFree();
        else goToCheckout(id, email);
      } else {
        finishFree();
      }
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : 'Could not finish setup.');
      finalizeStarted.current = false;
    } finally {
      // Avoid re-renders after paid checkout redirect (would race with location.assign).
      if (!journeyFinished.current) setIsWorking(false);
    }
  };

  const handleWelcomeContinue = () => {
    ensureIdentity();
    transitionTo('plan');
  };

  const handleExploreLangey = () => {
    ensureIdentity();
    journeyFinished.current = true;
    UserTracker.skipNewUserOnboarding();
    onComplete();
  };

  const handlePlanContinue = () => {
    if (!level) return;
    setFlowDirection(1);
    transitionTo('paywall');
  };

  const handleChoosePaid = () => {
    setIntent('paid');
    transitionTo('auth');
  };

  const handleChooseFree = () => {
    setIntent('free');
    transitionTo('auth');
  };

  const handleGoogleSignIn = () => {
    void signInWithGoogle();
  };

  const handleGuestContinue = async () => {
    if (intent !== 'free' || !level) return;
    setIsWorking(true);
    setError(null);
    try {
      const consumerId = ensureIdentity();
      await createRoadmap(consumerId);
      finishFree();
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : 'Could not continue as guest.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleBack = () => {
    if (stage === 'plan') transitionTo('welcome');
    else if (stage === 'paywall') {
      setFlowDirection(-1);
      transitionTo('plan');
    } else if (stage === 'auth') transitionTo('paywall');
  };

  return (
    <main className="fixed inset-0 z-[10000] box-border flex h-dvh flex-col overflow-hidden bg-[linear-gradient(45deg,#f0f1f2_0%,#eceef0_50%,#f0f1f2_100%)] bg-[length:20px_20px] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-[Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#19191b] [&_*]:box-border">
      <header className="flex shrink-0 flex-col items-center px-5 pt-3.5">
        <div className="grid w-full max-w-[420px] grid-cols-4 gap-1.5" aria-hidden="true">
          {STAGE_ORDER.map((item, index) => (
            <span
              key={item}
              className={`h-[3px] rounded-full transition-[background] duration-[280ms] ${index <= stepIndex ? 'bg-[#19191b]' : 'bg-[rgba(25,25,27,0.12)]'}`}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-5 pt-3 pb-6 md:max-w-[560px] md:px-7 md:pt-5 md:pb-9">
        {stage === 'welcome' && (
          <motion.section
            key="welcome"
            className="relative flex min-h-0 w-full flex-1 flex-col items-center text-center"
            {...pageMotion}
          >
            <div
              className="-mx-[50vw] relative flex min-h-0 w-screen flex-1 items-center justify-center overflow-hidden"
              aria-label="Reviews from Langey learners"
            >
              <div className="nju-marquee-window flex w-full flex-col gap-4 overflow-hidden px-0 py-2.5 [mask-image:linear-gradient(90deg,transparent_0%,#000_8%,#000_92%,transparent_100%)] [-webkit-mask-image:linear-gradient(90deg,transparent_0%,#000_8%,#000_92%,transparent_100%)] max-md:gap-3.5 max-md:py-2 max-h-[760px]:gap-2.5 max-h-[760px]:py-1.5 max-h-[680px]:gap-2 max-h-[680px]:py-1 md:gap-[18px] md:max-h-[860px]:gap-3.5 md:max-h-[860px]:py-2 md:max-h-[760px]:gap-2.5 md:max-h-[760px]:py-1 md:max-h-[660px]:gap-2 md:max-h-[660px]:py-0.5">
                {[0, 1].map((rowIndex) => (
                  <div
                    key={rowIndex}
                    className={`${rowIndex === 0 ? '-translate-y-1 max-h-[600px]:translate-y-0 md:max-h-[660px]:translate-y-0' : 'translate-y-1 max-h-[600px]:translate-y-0 md:max-h-[660px]:translate-y-0'}`}
                  >
                    <div className={`nju-marquee-track flex w-max gap-4 px-4 max-h-[680px]:gap-2.5 ${rowIndex === 1 ? 'nju-marquee-track-reverse' : ''}`}>
                      {scrollingCards.map((item, index) => (
                        <article
                          className="flex w-[min(300px,78vw)] shrink-0 flex-col gap-3 rounded-[20px] border border-black/[0.06] bg-[#f7f7f7] p-5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] max-md:w-[min(282px,74vw)] max-md:gap-2.5 max-md:p-[17px_19px] max-h-[760px]:w-[min(270px,74vw)] max-h-[760px]:gap-2.5 max-h-[760px]:rounded-[18px] max-h-[760px]:p-4 max-h-[680px]:w-[min(248px,70vw)] max-h-[680px]:gap-2 max-h-[680px]:rounded-2xl max-h-[680px]:p-[13px_15px] md:w-[340px] md:gap-3.5 md:rounded-[22px] md:p-6 md:max-h-[860px]:w-[312px] md:max-h-[860px]:gap-[11px] md:max-h-[860px]:rounded-[18px] md:max-h-[860px]:p-[18px_22px] md:max-h-[760px]:w-[286px] md:max-h-[760px]:gap-2 md:max-h-[760px]:rounded-2xl md:max-h-[760px]:p-[15px_18px] md:max-h-[660px]:w-[260px] md:max-h-[660px]:gap-2 md:max-h-[660px]:p-3"
                          key={`${rowIndex}-${item.name}-${index}`}
                        >
                          <div className="text-xs tracking-[3px] text-[#19191b] opacity-45 max-h-[680px]:text-[10px] max-h-[680px]:tracking-[2px] md:text-[13px] md:max-h-[860px]:text-[11px] md:max-h-[860px]:tracking-[2px]">
                            ★★★★★
                          </div>
                          <p className="m-0 line-clamp-4 overflow-hidden text-[15px] leading-normal font-medium tracking-[-0.01em] text-[#19191b] max-h-[760px]:line-clamp-3 max-h-[760px]:text-[13.5px] max-h-[680px]:line-clamp-3 max-h-[680px]:text-[12.5px] max-h-[680px]:leading-snug max-h-[600px]:line-clamp-2 md:text-base md:max-h-[860px]:line-clamp-3 md:max-h-[860px]:text-[14.5px] md:max-h-[860px]:leading-[1.42] md:max-h-[760px]:line-clamp-3 md:max-h-[760px]:text-[13px] md:max-h-[760px]:leading-[1.38] md:max-h-[660px]:line-clamp-2 md:max-h-[660px]:text-xs md:max-h-[660px]:leading-[1.34]">
                            {item.text}
                          </p>
                          <div className="mt-auto flex items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/[0.07] text-[11px] font-bold text-[#666] max-h-[680px]:h-[22px] max-h-[680px]:w-[22px] max-h-[680px]:text-[9px] md:h-[30px] md:w-[30px] md:text-xs md:max-h-[860px]:h-[26px] md:max-h-[860px]:w-[26px] md:max-h-[860px]:text-[10px]">
                              {item.name.charAt(0)}
                            </span>
                            <strong className="text-[13px] font-semibold text-[#666] max-h-[680px]:text-[11px] md:text-sm md:max-h-[860px]:text-[12.5px]">
                              {item.name}
                            </strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-1 w-full shrink-0 px-1 md:mt-[22px] md:max-h-[760px]:mt-3">
              <div className="mb-[18px] inline-flex items-center justify-center">
                <img
                  src={logo}
                  alt="Langey"
                  className="block h-[clamp(64px,18vw,76px)] w-[clamp(64px,18vw,76px)] rounded-full"
                />
              </div>
              <h1 className="m-0 text-[clamp(24px,6.4vw,32px)] leading-[1.15] font-extrabold tracking-[-0.045em] text-[#19191b] md:text-[32px]">
                Learn German with Langey.
              </h1>
            </div>

            <div className="mt-4 flex w-full shrink-0 flex-col items-center gap-2.5 md:max-h-[760px]:mt-3">
              <button type="button" className={primaryBtn} onClick={handleWelcomeContinue}>
                Build my learning plan <ArrowRight size={18} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="min-h-[54px] w-full cursor-pointer rounded-full border-[1.5px] border-[rgba(25,25,27,0.12)] bg-white/75 px-6 py-3.5 text-[15px] font-semibold text-[#555] transition-[background,border-color] duration-150 hover:border-[rgba(25,25,27,0.22)] hover:bg-white md:w-[280px]"
                onClick={handleExploreLangey}
              >
                Explore Langey
              </button>
            </div>

            <p className="mt-[18px] shrink-0 px-6 pb-2 text-center text-[11px] leading-[1.45] text-[#999] max-md:px-[18px] max-md:leading-normal md:mt-[22px] md:max-h-[760px]:mt-3.5">
              By continuing you agree to our{' '}
              <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-[#666] underline">
                Privacy Policy
              </a>
              {' '}and{' '}
              <a href="/terms-and-conditions" target="_blank" rel="noreferrer" className="text-[#666] underline">
                Terms & Conditions
              </a>
            </p>
          </motion.section>
        )}

        {(stage === 'plan' || stage === 'paywall') && (
          <section className="relative flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden">
            <div className="absolute inset-x-0 top-0 bottom-[54px] flex min-h-0 w-full flex-col justify-center">
              <AnimatePresence initial={false}>
                {level && (
                  <motion.div
                    className="flex min-h-[150px] shrink-0 flex-col items-center justify-center gap-[3px] py-[18px] pb-5 text-center"
                    initial={{ opacity: 0, y: -18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    aria-live="polite"
                  >
                    <span className="text-base font-medium text-[#5c5c5f]">Your plan needs</span>
                    <strong className="min-w-[2ch] text-[clamp(96px,28vw,132px)] leading-[0.9] font-extrabold tracking-[-0.055em] text-[#19191b] tabular-nums">
                      <AnimatedMinutes value={dailyMinutes} />
                    </strong>
                    <small className="text-[15px] font-medium text-[#777]">min / study day</small>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false} custom={flowDirection}>
                {stage === 'plan' ? (
                  <motion.div
                    key="plan-options"
                    layout
                    className="flex h-[230px] w-full shrink-0 flex-col justify-center py-2"
                    {...flowMotion}
                  >
                    <div className="mb-6 text-center">
                      <h1 className="text-[clamp(24px,6vw,30px)] leading-[1.15] font-bold tracking-[-0.04em] text-[#19191b]">
                        What level do you want to learn?
                      </h1>
                    </div>

                    <div className="mb-[34px] grid grid-cols-3 gap-2.5" role="group" aria-label="German level">
                      {(['A1', 'A2', 'B1'] as GermanLevel[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`h-12 cursor-pointer rounded-full border-[1.5px] text-[15px] font-semibold tracking-[-0.02em] transition-[border-color,color,background,box-shadow] duration-200 ${
                            level === option
                              ? 'border-[#19191b] bg-white font-bold text-[#19191b] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                              : 'border-[#e4e4e6] bg-white/75 text-[#666]'
                          }`}
                          onClick={() => setLevel(option)}
                          aria-pressed={level === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-baseline justify-between px-0.5">
                        <span className="text-sm font-medium text-[#777]">Finish in</span>
                        <strong className="text-lg font-bold tracking-[-0.03em]">
                          {months} {months === 1 ? 'month' : 'months'}
                        </strong>
                      </div>
                      <input
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(25,25,27,0.12)] outline-none [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#19191b] [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.18)] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#19191b] [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                        type="range"
                        min={1}
                        max={6}
                        step={1}
                        value={months}
                        onChange={(event) => setMonths(Number(event.target.value) as MonthsChoice)}
                        aria-label="Number of months"
                      />
                      <div className="flex justify-between px-0.5 text-xs font-medium text-[#aaa]" aria-hidden="true">
                        {[1, 2, 3, 4, 5, 6].map((value) => (
                          <span key={value} className={months === value ? 'font-bold text-[#19191b]' : ''}>
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pricing"
                    className="flex h-[230px] w-full shrink-0 flex-col justify-center py-1"
                    {...flowMotion}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <article
                        className={`relative flex min-h-[154px] flex-col items-center justify-between gap-4 rounded-[20px] border-[1.5px] bg-white/[0.72] px-4 pt-[22px] pb-[18px] text-center ${
                          dailyMinutes <= 30
                            ? 'border-[#19191b] shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
                            : 'border-black/[0.06]'
                        }`}
                      >
                        {dailyMinutes <= 30 && (
                          <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 rounded-full bg-[#185c35] px-2 py-1 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap text-white uppercase">
                            Best fit
                          </span>
                        )}
                        <div className="flex flex-col items-center gap-[5px]">
                          <span className="text-sm font-[650] text-[#777]">Free</span>
                          <strong className="text-[21px] font-bold tracking-[-0.03em] text-[#19191b]">$0</strong>
                        </div>
                        <span
                          className={`inline-flex min-h-[30px] items-center justify-center rounded-full px-[11px] py-1.5 text-xs font-semibold whitespace-nowrap ${
                            dailyMinutes <= 30 ? 'bg-[#185c35] text-white' : 'bg-[#fce8e8] text-[#b33a3a]'
                          }`}
                        >
                          30 min / day
                        </span>
                      </article>

                      <article
                        className={`relative flex min-h-[154px] flex-col items-center justify-between gap-4 rounded-[20px] border-[1.5px] bg-white px-4 pt-[22px] pb-[18px] text-center ${
                          dailyMinutes > 30
                            ? 'border-[#19191b] shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
                            : 'border-black/[0.06]'
                        }`}
                      >
                        {dailyMinutes > 30 && (
                          <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 rounded-full bg-[#185c35] px-2 py-1 text-[10px] font-bold tracking-[0.04em] whitespace-nowrap text-white uppercase">
                            Best fit
                          </span>
                        )}
                        <div className="flex flex-col items-center gap-[5px]">
                          <span className="text-sm font-[650] text-[#777]">Pro</span>
                          <strong className="text-[21px] font-bold tracking-[-0.03em] text-[#19191b]">
                            $4.99 <small className="text-xs font-medium tracking-[-0.01em] text-[#777]">/ mo</small>
                          </strong>
                        </div>
                        <span
                          className={`inline-flex min-h-[30px] items-center justify-center rounded-full px-[11px] py-1.5 text-xs font-semibold whitespace-nowrap ${
                            dailyMinutes > 30 ? 'bg-[#185c35] text-white' : 'bg-[#fce8e8] text-[#b33a3a]'
                          }`}
                        >
                          Unlimited
                        </span>
                      </article>
                    </div>

                    <p
                      className={`mt-[18px] text-center text-[15px] font-semibold ${
                        dailyMinutes <= 30 ? 'text-[#5a7a52]' : 'text-[#8a6a1a]'
                      }`}
                    >
                      {dailyMinutes <= 30 ? 'Your plan fits the Free daily limit.' : 'Faster plans need Langey Pro.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {stage === 'plan' ? (
              <div className={bottomActions}>
                <button type="button" className={backBtn} onClick={handleBack} aria-label="Go back">
                  <ChevronLeft size={22} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={`${primaryBtn} m-0 flex-1 md:flex-[0_0_280px]`}
                  onClick={handlePlanContinue}
                  disabled={!level}
                >
                  Continue <ChevronRight size={17} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-0 flex w-full flex-col items-center gap-2.5">
                <div className={`${bottomActions} relative`}>
                  <button type="button" className={backBtn} onClick={handleBack} aria-label="Go back">
                    <ChevronLeft size={22} strokeWidth={2.2} />
                  </button>
                  <button type="button" className={`${primaryBtn} m-0 flex-1 md:flex-[0_0_280px]`} onClick={handleChoosePaid}>
                    Unlock Langey Pro
                  </button>
                </div>
                <button type="button" className={linkBtn} onClick={handleChooseFree}>
                  Use Free
                </button>
                <small className="text-[11px] text-[#999]">Cancel anytime.</small>
              </div>
            )}
          </section>
        )}

        {stage === 'auth' && (
          <motion.section
            key="auth"
            className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center"
            {...pageMotion}
          >
            <div className="relative mx-0 flex min-h-0 w-full flex-1 items-center justify-center px-3 pb-14 text-center md:pb-14">
              <div className="flex w-full flex-col items-center">
                <h1 className="mb-7 text-[22px] leading-[1.35] font-normal tracking-[-0.02em] text-[#1a1a1a]">
                  Sign in to save your progress
                </h1>

                {(error || authError) && (
                  <div
                    className="mx-auto mb-3 w-full max-w-[320px] rounded-xl bg-[rgba(180,40,40,0.08)] px-3 py-2.5 text-[13px] leading-snug text-[#8b1e1e]"
                    role="alert"
                  >
                    {error || authError}
                  </div>
                )}

                <button
                  type="button"
                  className="inline-flex min-h-14 w-full max-w-[340px] min-w-0 cursor-pointer items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-[#f8f9fa] px-7 py-4 text-base font-medium tracking-[0.1px] text-[#3c4043] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[background] duration-150 hover:not-disabled:bg-white disabled:cursor-not-allowed disabled:opacity-55 md:min-h-[58px] md:w-[360px] md:px-8 md:text-[17px] [&_svg]:h-[22px] [&_svg]:w-[22px] md:[&_svg]:h-6 md:[&_svg]:w-6"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading || isWorking}
                >
                  {isAuthLoading || isWorking ? (
                    <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-black/15 border-t-[#19191b]" />
                  ) : (
                    <GoogleMark />
                  )}
                  Sign in with Google
                </button>
              </div>

              <div className="absolute top-[calc(50%+40px)] left-1/2 flex w-full -translate-x-1/2 flex-col items-center">
                {intent === 'free' && (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent px-6 py-2.5 text-sm text-[#888] underline underline-offset-[3px]"
                    onClick={() => void handleGuestContinue()}
                    disabled={isWorking}
                  >
                    Continue as Guest
                  </button>
                )}

                <button type="button" className={`${linkBtn} mt-0.5 text-[#888]`} onClick={handleBack}>
                  Go back
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
};

export default NewUserOnboarding;
