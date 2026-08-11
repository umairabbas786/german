import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserTracker } from '../utils/userTracking';
import { syncSupabaseAuth } from '../services/accountApi';
import type { SupabaseSyncResponse } from '../services/accountApi';

const OAUTH_REDIRECT_KEY = 'langey_oauth_redirect';

let _reloadScheduled = false;
function scheduleReload() {
  if (_reloadScheduled) return;
  _reloadScheduled = true;
  window.location.reload();
}

function getRedirectFlag(): string | null {
  try {
    return sessionStorage.getItem(OAUTH_REDIRECT_KEY);
  } catch {
    return null;
  }
}

function setRedirectFlag(): void {
  try {
    sessionStorage.setItem(OAUTH_REDIRECT_KEY, '1');
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function clearRedirectFlag(): void {
  try {
    sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export interface SupabaseAuthState {
  email: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type SyncResult =
  | { success: true; email: string; resolved_consumer_id: string }
  | { success: false; error: string };

/**
 * Syncs Supabase session with backend and UserTracker.
 */
export async function syncSupabaseSessionWithBackend(
  accessToken: string,
  consumerId: string
): Promise<SyncResult> {
  try {
    const res = await syncSupabaseAuth(accessToken, consumerId);
    if (!res.ok) {
      const err = await res.json().catch((): Partial<SupabaseSyncResponse> => ({}));
      const message = (typeof err?.detail === 'string' ? err.detail : null) ?? (res.statusText || 'Sign-in failed');
      return { success: false, error: message };
    }
    const data = await res.json();
    return {
      success: true,
      email: data.email,
      resolved_consumer_id: data.resolved_consumer_id,
    };
  } catch {
    return { success: false, error: 'Sign-in failed. Please check your connection and try again.' };
  }
}

export function useSupabaseAuth() {
  const [email, setEmail] = useState<string | null>(() => UserTracker.getGoogleEmail());
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasHandledOAuthReturn = useRef(false);

  // On mount: restore state. Only sync if we have session but UserTracker is out of sync.
  useEffect(() => {
    setAuthError(null);
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        clearRedirectFlag();
        setEmail(UserTracker.getGoogleEmail());
        setIsLoading(false);
        return;
      }
      const userEmail = session.user?.email ?? null;
      if (!userEmail) {
        setIsLoading(false);
        return;
      }
      const trackerEmail = UserTracker.getGoogleEmail();
      // Already in sync - no backend call needed
      if (trackerEmail === userEmail) {
        setEmail(userEmail);
        setIsLoading(false);
        return;
      }
      // Returning from OAuth: sync and reload (handled by onAuthStateChange)
      if (getRedirectFlag()) {
        setIsLoading(false);
        return;
      }
      // Page refresh with session: restore from tracker or sync once
      const consumerId = UserTracker.getOrCreateConsumerId();
      if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
        setIsLoading(false);
        return;
      }
      const result = await syncSupabaseSessionWithBackend(session.access_token, consumerId);
      if (result.success) {
        UserTracker.saveGoogleEmail(result.email);
        UserTracker.setConsumerId(result.resolved_consumer_id);
        if (result.resolved_consumer_id !== consumerId) {
          window.dispatchEvent(
            new CustomEvent('langey:consumer-id-changed', {
              detail: { consumerId: result.resolved_consumer_id },
            }),
          );
        }
        setEmail(result.email);
      } else {
        await supabase.auth.signOut();
        UserTracker.clearGoogleEmail();
        setEmail(null);
        setAuthError(result.error);
      }
      setIsLoading(false);
    };
    run();
  }, []);

  // If a valid Google session predates the explicit identity-creation action,
  // connect it only after the welcome CTA or initial level selection mints an ID.
  useEffect(() => {
    const syncAfterIdentityCreation = async () => {
      if (UserTracker.getGoogleEmail()) return;
      const consumerId = UserTracker.getConsumerId();
      if (!consumerId || consumerId === UserTracker.PENDING_CONSUMER_ID) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const result = await syncSupabaseSessionWithBackend(session.access_token, consumerId);
      if (!result.success) {
        setAuthError(result.error);
        return;
      }
      UserTracker.saveGoogleEmail(result.email);
      UserTracker.setConsumerId(result.resolved_consumer_id);
      if (result.resolved_consumer_id !== consumerId) {
        window.dispatchEvent(
          new CustomEvent('langey:consumer-id-changed', {
            detail: { consumerId: result.resolved_consumer_id },
          }),
        );
      }
      setEmail(result.email);
    };

    window.addEventListener('langey:consumer-id-changed', syncAfterIdentityCreation);
    return () => window.removeEventListener('langey:consumer-id-changed', syncAfterIdentityCreation);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        const userEmail = session.user?.email ?? null;
        if (!userEmail) return;
        // Only sync+reload when we initiated OAuth (returning from Google)
        if (!getRedirectFlag()) return;
        if (hasHandledOAuthReturn.current) return;
        hasHandledOAuthReturn.current = true;
        clearRedirectFlag();
        setAuthError(null);
        let consumerId = UserTracker.getOrCreateConsumerId();
        if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
          consumerId = UserTracker.createConsumerId();
        }
        const result = await syncSupabaseSessionWithBackend(session.access_token, consumerId);
        if (result.success) {
          UserTracker.saveGoogleEmail(result.email);
          UserTracker.setConsumerId(result.resolved_consumer_id);
          setEmail(result.email);
          scheduleReload();
        } else {
          await supabase.auth.signOut();
          UserTracker.clearGoogleEmail();
          setEmail(null);
          setAuthError(result.error);
        }
      } else if (event === 'SIGNED_OUT') {
        UserTracker.clearGoogleEmail();
        setEmail(null);
        scheduleReload();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setRedirectFlag();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // SIGNED_OUT event handler will clear state and reload
  }, []);

  return {
    email,
    isLoading,
    isAuthenticated: !!email,
    authError,
    signInWithGoogle,
    signOut,
  };
}
