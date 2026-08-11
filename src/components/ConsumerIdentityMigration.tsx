import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserTracker } from '../utils/userTracking';

interface ConsumerIdentityMigrationProps {
  children: ReactNode;
}

/**
 * Adopts landing-page ?consumer_id= as the app cookie when no Google account
 * is connected. Holds render until migration finishes so /welcome is skipped
 * for transferred identities.
 */
export function ConsumerIdentityMigration({ children }: ConsumerIdentityMigrationProps) {
  const location = useLocation();
  const [incomingConsumerId, setIncomingConsumerId] = useState<string | null>(() =>
    UserTracker.readAndRemoveIncomingConsumerId()
  );
  const [isReady, setIsReady] = useState(() => incomingConsumerId === null);

  useEffect(() => {
    const nextIncomingConsumerId = UserTracker.readAndRemoveIncomingConsumerId();
    if (!nextIncomingConsumerId) return;

    setIncomingConsumerId(nextIncomingConsumerId);
    setIsReady(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!incomingConsumerId) {
      setIsReady(true);
      return;
    }

    const consumerIdToMigrate = incomingConsumerId;
    let cancelled = false;

    async function migrateConsumerId() {
      try {
        const knownAccountEmail = UserTracker.getGoogleEmail();
        if (knownAccountEmail) return;

        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) {
          UserTracker.setConsumerId(consumerIdToMigrate);
          window.dispatchEvent(
            new CustomEvent('langey:consumer-id-changed', {
              detail: { consumerId: consumerIdToMigrate },
            })
          );
        }
      } catch {
        // If auth state cannot be confirmed, keep the existing identity.
      } finally {
        if (!cancelled) {
          setIncomingConsumerId(null);
          setIsReady(true);
        }
      }
    }

    migrateConsumerId();

    return () => {
      cancelled = true;
    };
  }, [incomingConsumerId]);

  if (!isReady) return null;

  return <>{children}</>;
}
