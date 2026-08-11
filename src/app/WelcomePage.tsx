import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewUserOnboarding } from '../components/NewUserOnboarding';
import { UserTracker } from '../utils/userTracking';

const ENABLE_NEW_USER_JOURNEY =
  String(import.meta.env.VITE_ENABLE_NEW_USER_JOURNEY || '').toLowerCase() === 'true';

export function WelcomePage() {
  const navigate = useNavigate();
  const shouldSkipWelcome =
    !ENABLE_NEW_USER_JOURNEY || UserTracker.hasFinishedNewUserOnboarding();

  useEffect(() => {
    if (shouldSkipWelcome) {
      window.location.replace('/');
      return;
    }

    // Back from Lemon often restores this page from bfcache (stuck on loading).
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && UserTracker.hasFinishedNewUserOnboarding()) {
        window.location.replace('/');
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [shouldSkipWelcome]);

  if (shouldSkipWelcome) return null;

  return (
    <NewUserOnboarding
      onComplete={() => {
        window.dispatchEvent(new CustomEvent('langey:onboarding-complete'));
        navigate('/', { replace: true });
      }}
    />
  );
}
