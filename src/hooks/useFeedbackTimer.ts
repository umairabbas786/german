import { useState, useEffect, useCallback } from 'react';

interface UseFeedbackTimerProps {
  consumerId: string | null;
  delayMinutes?: number;
}

interface UseFeedbackTimerReturn {
  shouldShowFeedback: boolean;
  showFeedbackPopup: () => void;
  hideFeedbackPopup: () => void;
  markFeedbackShown: () => void;
  resetTimer: () => void;
}

const FEEDBACK_SHOWN_KEY = 'langey_feedback_shown';
const CONSUMER_CREATION_KEY = 'langey_consumer_creation_time';

function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export const useFeedbackTimer = ({
  consumerId,
  delayMinutes = 60
}: UseFeedbackTimerProps): UseFeedbackTimerReturn => {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Check if feedback was already shown
  const wasFeedbackShown = useCallback(() => {
    if (!consumerId) return true;
    const shown = getStorageItem(`${FEEDBACK_SHOWN_KEY}_${consumerId}`);
    return shown === 'true';
  }, [consumerId]);

  // Mark feedback as shown in localStorage
  const markFeedbackShown = useCallback(() => {
    if (consumerId) {
      setStorageItem(`${FEEDBACK_SHOWN_KEY}_${consumerId}`, 'true');
    }
  }, [consumerId]);

  // Set consumer creation time
  const setConsumerCreationTime = useCallback(() => {
    if (consumerId) {
      const existingTime = getStorageItem(`${CONSUMER_CREATION_KEY}_${consumerId}`);
      if (!existingTime) {
        setStorageItem(`${CONSUMER_CREATION_KEY}_${consumerId}`, Date.now().toString());
      }
    }
  }, [consumerId]);

  // Get consumer creation time
  const getConsumerCreationTime = useCallback(() => {
    if (!consumerId) return null;
    const timeStr = getStorageItem(`${CONSUMER_CREATION_KEY}_${consumerId}`);
    return timeStr ? parseInt(timeStr, 10) : null;
  }, [consumerId]);

  // Check if enough time has passed since consumer creation
  const hasEnoughTimePassed = useCallback(() => {
    const creationTime = getConsumerCreationTime();
    if (!creationTime) return false;
    
    const currentTime = Date.now();
    const timeDiff = currentTime - creationTime;
    const requiredTime = delayMinutes * 60 * 1000; // Convert minutes to milliseconds
    
    return timeDiff >= requiredTime;
  }, [getConsumerCreationTime, delayMinutes]);

  // Handle user interaction
  const handleUserInteraction = useCallback(() => {
    if (!timerStarted || wasFeedbackShown() || !hasEnoughTimePassed() || userInteracted) {
      return;
    }

    setUserInteracted(true);
    setShouldShowFeedback(true);
    markFeedbackShown();
  }, [timerStarted, wasFeedbackShown, hasEnoughTimePassed, userInteracted, markFeedbackShown]);

  // Show feedback popup manually
  const showFeedbackPopup = useCallback(() => {
    setShouldShowFeedback(true);
  }, []);

  // Hide feedback popup
  const hideFeedbackPopup = useCallback(() => {
    setShouldShowFeedback(false);
  }, []);

  // Reset timer (useful for testing)
  const resetTimer = useCallback(() => {
    if (consumerId) {
      removeStorageItem(`${FEEDBACK_SHOWN_KEY}_${consumerId}`);
      removeStorageItem(`${CONSUMER_CREATION_KEY}_${consumerId}`);
      setTimerStarted(false);
      setUserInteracted(false);
      setShouldShowFeedback(false);
    }
  }, [consumerId]);

  // Initialize timer when consumerId is available
  useEffect(() => {
    if (consumerId && consumerId !== 'pending' && !wasFeedbackShown()) {
      setConsumerCreationTime();
      setTimerStarted(true);
    }
  }, [consumerId, wasFeedbackShown, setConsumerCreationTime]);

  // Add event listeners for user interactions
  useEffect(() => {
    if (!timerStarted || userInteracted) return;

    const events = ['click', 'keydown', 'touchstart', 'scroll'];

    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [timerStarted, userInteracted, handleUserInteraction]);

  return {
    shouldShowFeedback,
    showFeedbackPopup,
    hideFeedbackPopup,
    markFeedbackShown,
    resetTimer
  };
};

export default useFeedbackTimer;
