import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import bestUserFeedback from '../data/best_user_feedback.json';
import logo from '../assets/images/logo-rounded.png';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../services/checkout';
import { UserTracker } from '../utils/userTracking';
import './NewUserOnboarding.css';
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
    <main className={`nju-shell nju-shell-${stage}`}>
      <header className="nju-top">
        <div className="nju-progress" aria-hidden="true">
          {STAGE_ORDER.map((item, index) => (
            <span key={item} className={index <= stepIndex ? 'active' : ''} />
          ))}
        </div>
      </header>

      <div className="nju-viewport">
        {stage === 'welcome' && (
          <motion.section key="welcome" className="nju-page nju-welcome" {...pageMotion}>
            <div className="nju-marquee" aria-label="Reviews from Langey learners">
              <div className="nju-marquee-window">
                {[0, 1].map((rowIndex) => (
                  <div
                    key={rowIndex}
                    className={`nju-marquee-row ${rowIndex === 0 ? 'nju-marquee-row-upper' : 'nju-marquee-row-lower'}`}
                  >
                    <div className={`nju-marquee-track ${rowIndex === 1 ? 'nju-marquee-track-reverse' : ''}`}>
                      {scrollingCards.map((item, index) => (
                        <article className="nju-marquee-card" key={`${rowIndex}-${item.name}-${index}`}>
                          <div className="nju-marquee-stars">★★★★★</div>
                          <p>{item.text}</p>
                          <div className="nju-marquee-author">
                            <span>{item.name.charAt(0)}</span>
                            <strong>{item.name}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="nju-welcome-copy">
              <div className="nju-brand">
                <img src={logo} alt="Langey" />
              </div>
              <h1>Learn German with Langey.</h1>
            </div>

            <div className="nju-welcome-actions">
              <button type="button" className="nju-primary nju-welcome-cta" onClick={handleWelcomeContinue}>
                Build my learning plan <ArrowRight size={18} strokeWidth={2.4} />
              </button>
              <button type="button" className="nju-welcome-skip" onClick={handleExploreLangey}>
                Explore Langey
              </button>
            </div>

            <p className="nju-legal nju-welcome-legal">
              By continuing you agree to our{' '}
              <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms & Conditions</a>
            </p>
          </motion.section>
        )}

        {(stage === 'plan' || stage === 'paywall') && (
          <section className={`nju-page nju-plan-flow${level ? ' has-level' : ''}`}>
            <div className="nju-flow-center">
              <AnimatePresence initial={false}>
                {level && (
                  <motion.div
                    className="nju-plan-requirement"
                    initial={{ opacity: 0, y: -18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    aria-live="polite"
                  >
                    <span>Your plan needs</span>
                    <strong><AnimatedMinutes value={dailyMinutes} /></strong>
                    <small>min / study day</small>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false} custom={flowDirection}>
                {stage === 'plan' ? (
                  <motion.div
                    key="plan-options"
                    layout
                    className="nju-flow-body nju-plan-controls"
                    {...flowMotion}
                  >
                    <div className="nju-copy">
                      <h1>What level do you want to learn?</h1>
                    </div>

                    <div className="nju-level-row" role="group" aria-label="German level">
                      {(['A1', 'A2', 'B1'] as GermanLevel[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`nju-level-pill${level === option ? ' selected' : ''}`}
                          onClick={() => setLevel(option)}
                          aria-pressed={level === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>

                    <div className="nju-months-block">
                      <div className="nju-months-label">
                        <span>Finish in</span>
                        <strong>{months} {months === 1 ? 'month' : 'months'}</strong>
                      </div>
                      <input
                        className="nju-months-slider"
                        type="range"
                        min={1}
                        max={6}
                        step={1}
                        value={months}
                        onChange={(event) => setMonths(Number(event.target.value) as MonthsChoice)}
                        aria-label="Number of months"
                      />
                      <div className="nju-months-scale" aria-hidden="true">
                        {[1, 2, 3, 4, 5, 6].map((value) => (
                          <span key={value} className={months === value ? 'active' : ''}>{value}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pricing"
                    className="nju-flow-body nju-pricing-content"
                    {...flowMotion}
                  >
                    <div className="nju-product-grid">
                      <article className={`nju-product nju-product-free${dailyMinutes <= 30 ? ' is-best-fit' : ''}`}>
                        {dailyMinutes <= 30 && <span className="nju-pro-badge">Best fit</span>}
                        <div className="nju-product-heading">
                          <span>Free</span>
                          <strong>$0</strong>
                        </div>
                        <span className={`nju-usage-tag${dailyMinutes <= 30 ? ' nju-usage-tag-fit' : ' nju-usage-tag-miss'}`}>
                          30 min / day
                        </span>
                      </article>

                      <article className={`nju-product nju-product-pro${dailyMinutes > 30 ? ' is-best-fit' : ''}`}>
                        {dailyMinutes > 30 && <span className="nju-pro-badge">Best fit</span>}
                        <div className="nju-product-heading">
                          <span>Pro</span>
                          <strong>$4.99 <small>/ mo</small></strong>
                        </div>
                        <span className={`nju-usage-tag${dailyMinutes > 30 ? ' nju-usage-tag-fit' : ' nju-usage-tag-miss'}`}>
                          Unlimited
                        </span>
                      </article>
                    </div>

                    <p className={`nju-plan-fit${dailyMinutes <= 30 ? ' fits-free' : ''}`}>
                      {dailyMinutes <= 30 ? 'Your plan fits the Free daily limit.' : 'Faster plans need Langey Pro.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {stage === 'plan' ? (
              <div className="nju-bottom-actions">
                <button type="button" className="nju-back-inline" onClick={handleBack} aria-label="Go back">
                  <ChevronLeft size={22} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="nju-primary"
                  onClick={handlePlanContinue}
                  disabled={!level}
                >
                  Continue <ChevronRight size={17} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <div className="nju-paywall-actions">
                <div className="nju-bottom-actions">
                  <button type="button" className="nju-back-inline" onClick={handleBack} aria-label="Go back">
                    <ChevronLeft size={22} strokeWidth={2.2} />
                  </button>
                  <button type="button" className="nju-primary" onClick={handleChoosePaid}>
                    Unlock Langey Pro
                  </button>
                </div>
                <button type="button" className="nju-link" onClick={handleChooseFree}>
                  Use Free
                </button>
                <small>Cancel anytime.</small>
              </div>
            )}
          </section>
        )}

        {stage === 'auth' && (
          <motion.section key="auth" className="nju-page nju-auth" {...pageMotion}>
            <div className="nju-auth-center">
              <div className="nju-auth-main">
                <h1>Sign in to save your progress</h1>

                {(error || authError) && (
                  <div className="nju-error" role="alert">{error || authError}</div>
                )}

                <button
                  type="button"
                  className="nju-google"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading || isWorking}
                >
                  {isAuthLoading || isWorking ? <span className="nju-spinner" /> : <GoogleMark />}
                  Sign in with Google
                </button>
              </div>

              <div className="nju-auth-secondary">
                {intent === 'free' && (
                  <button
                    type="button"
                    className="nju-guest"
                    onClick={() => void handleGuestContinue()}
                    disabled={isWorking}
                  >
                    Continue as Guest
                  </button>
                )}

                <button type="button" className="nju-link nju-auth-back" onClick={handleBack}>
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
