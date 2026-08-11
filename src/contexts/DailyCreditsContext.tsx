import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { DAILY_CREDITS_MAX, DEFAULT_LIMIT_MESSAGE } from '../constants/dailyCredits';
import { UserTracker } from '../utils/userTracking';
import { CreditLimitBlockPopup } from '../components/CreditLimitBlockPopup';
import { getDailyCredits, syncGoogleUser } from '../services/creditsApi';

interface DailyCreditsContextType {
  creditsLeft: number | null;  // null = loading, -1 = unlimited (Pro)
  isPro: boolean;
  isLoading: boolean;
  /** True when free user has no credits left — shared across all practice pages */
  isBlocked: boolean;
  limitMessage: string;
  refreshCredits: () => Promise<void>;
  /** Update credits; pass message when hitting the limit so all pages show it */
  setCreditsLeft: (n: number | null, message?: string) => void;
  isCreditBlockPopupOpen: boolean;
  setIsCreditBlockPopupOpen: (open: boolean) => void;
  showCreditBlockPopup: () => void;
}

const DailyCreditsContext = createContext<DailyCreditsContextType | null>(null);

export function DailyCreditsProvider({ children }: { children: React.ReactNode }) {
  const [creditsLeft, setCreditsLeftRaw] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [limitMessage, setLimitMessage] = useState(DEFAULT_LIMIT_MESSAGE);
  const [isCreditBlockPopupOpen, setIsCreditBlockPopupOpen] = useState(false);
  const [activePopupId, setActivePopupId] = useState(1);
  const prevCreditsRef = useRef<number | null>(null);
  const isProRef = useRef(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBlocked = !isPro && creditsLeft !== null && creditsLeft <= 0;

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // Keep ref in sync so the guarded setter always has fresh value
  useEffect(() => { isProRef.current = isPro; }, [isPro]);

  const maybeShowBlockPopup = useCallback(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const lastShownDate = localStorage.getItem('langey_credit_blocked_popup_last_shown_date');

    if (lastShownDate !== today) {
      const currentIdStr = localStorage.getItem('langey_credit_blocked_popup_id') || '1';
      const currentId = parseInt(currentIdStr, 10);
      if (currentId <= 5) {
        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = setTimeout(() => {
          setActivePopupId(currentId);
          setIsCreditBlockPopupOpen(true);
          localStorage.setItem('langey_credit_blocked_popup_last_shown_date', today);
          localStorage.setItem('langey_credit_blocked_popup_id', (currentId + 1).toString());
        }, 2000);
      }
    }
  }, []);

  // Guarded setter: if user is Pro, ignore any credit updates from API responses
  const setCreditsLeft = useCallback((n: number | null, message?: string) => {
    if (isProRef.current) return;
    setCreditsLeftRaw(n);

    if (n !== null && n <= 0) {
      if (message) setLimitMessage(message);
      else setLimitMessage((prev) => prev || DEFAULT_LIMIT_MESSAGE);
      maybeShowBlockPopup();
    }
  }, [maybeShowBlockPopup]);

  // Show the upgrade prompt when credits hit 0 from a positive value.
  useEffect(() => {
    if (creditsLeft === 0 && prevCreditsRef.current !== null && prevCreditsRef.current > 0) {
      maybeShowBlockPopup();
    }
    prevCreditsRef.current = creditsLeft;
  }, [creditsLeft, maybeShowBlockPopup]);

  const showCreditBlockPopup = useCallback(() => {
    const currentIdStr = localStorage.getItem('langey_credit_blocked_popup_id') || '1';
    const currentId = parseInt(currentIdStr, 10);
    if (currentId <= 5) {
      setActivePopupId(currentId);
      setIsCreditBlockPopupOpen(true);
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    // Never mint a consumer_id here — identity is created only at onboarding
    // guest continue or Google sign-in sync.
    const email = UserTracker.getGoogleEmail();
    let consumerId = UserTracker.getConsumerId();

    if (email && consumerId && consumerId !== UserTracker.PENDING_CONSUMER_ID) {
      try {
        const syncResp = await syncGoogleUser({ email, consumer_id: consumerId });
        if (syncResp.ok) {
          const data = await syncResp.json();
          if (data.resolved_consumer_id) {
            UserTracker.setConsumerId(data.resolved_consumer_id);
            consumerId = data.resolved_consumer_id;
          }
        }
      } catch { /* non-critical, proceed with current consumerId */ }
    }

    if (!consumerId || consumerId === UserTracker.PENDING_CONSUMER_ID) {
      setIsLoading(false);
      return;
    }

    try {
      const resp = await getDailyCredits(consumerId);
      if (resp.ok) {
        const data = await resp.json();
        const pro = data.is_pro ?? false;
        setIsPro(pro);
        isProRef.current = pro;
        const next = pro ? -1 : (data.credits_left ?? DAILY_CREDITS_MAX);
        setCreditsLeftRaw(next);
        if (!pro && typeof next === 'number' && next <= 0) {
          setLimitMessage(DEFAULT_LIMIT_MESSAGE);
        }
      }
      // On non-OK / network error: keep last known credits (never fake a full refill)
    } catch {
      // preserve last known credits / pro status
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  // Re-fetch pro status & credits when user returns to a stale tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshCredits();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshCredits]);

  // Re-fetch when identity appears or the explicit welcome flow completes.
  useEffect(() => {
    const handleConsumerIdChanged = () => {
      void refreshCredits();
    };
    const handleOnboardingComplete = () => {
      void refreshCredits();
    };
    window.addEventListener('langey:consumer-id-changed', handleConsumerIdChanged);
    window.addEventListener('langey:onboarding-complete', handleOnboardingComplete);
    return () => {
      window.removeEventListener('langey:consumer-id-changed', handleConsumerIdChanged);
      window.removeEventListener('langey:onboarding-complete', handleOnboardingComplete);
    };
  }, [refreshCredits]);

  return (
    <DailyCreditsContext.Provider value={{
      creditsLeft,
      isPro,
      isLoading,
      isBlocked,
      limitMessage,
      refreshCredits,
      setCreditsLeft,
      isCreditBlockPopupOpen,
      setIsCreditBlockPopupOpen,
      showCreditBlockPopup
    }}>
      {children}
      <CreditLimitBlockPopup
        isOpen={isCreditBlockPopupOpen}
        onClose={() => setIsCreditBlockPopupOpen(false)}
        popupId={activePopupId}
      />
    </DailyCreditsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- colocated public context hook
export function useDailyCredits() {
  const ctx = useContext(DailyCreditsContext);
  if (!ctx) throw new Error('useDailyCredits must be used within DailyCreditsProvider');
  return ctx;
}
