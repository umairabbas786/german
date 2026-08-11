import { API_URL, apiFetchUrl } from '../services/api';

// User tracking utilities for consumer ID management and persistence

export class UserTracker {
  private static COOKIE_NAME = 'langey_consumer_id';
  private static INCOMING_PARAM_NAME = 'consumer_id';
  private static STATE_KEY = 'langey_user_state';
  private static GOOGLE_EMAIL_KEY = 'langey_google_email';
  private static API_BASE = API_URL;
  private static LAST_UPDATE_KEY = 'langey_last_update_timestamp';
  private static UPDATE_INTERVAL_MS = 60000; // Update once per minute max

  private static getStorageItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private static setStorageItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }

  private static removeStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }

  // Read the current identity without minting one. New identities are created only
  // by an explicit welcome-page CTA or the initial German-level selection.
  static getOrCreateConsumerId(): string {
    const consumerId = this.getCookie(this.COOKIE_NAME);
    if (!consumerId) return this.PENDING_CONSUMER_ID;
    this.updateLastUseTimestamp(consumerId);
    return consumerId;
  }

  static createConsumerId(): string {
    const existing = this.getCookie(this.COOKIE_NAME);
    if (existing) {
      this.updateLastUseTimestamp(existing);
      return existing;
    }

    const consumerId = this.generateUniqueId();
    this.setCookie(this.COOKIE_NAME, consumerId, 365);
    this.updateLastUseTimestamp(consumerId);
    window.dispatchEvent(
      new CustomEvent('langey:consumer-id-changed', { detail: { consumerId } }),
    );
    return consumerId;
  }

  static readonly PENDING_CONSUMER_ID = 'pending';

  // True until the user explicitly starts from welcome or selects a level.
  static isPendingIdentity(): boolean {
    return this.getOrCreateConsumerId() === this.PENDING_CONSUMER_ID;
  }

  // Convenience: get current consumer id without creating a new one
  static getConsumerId(): string | null {
    return this.getCookie(this.COOKIE_NAME);
  }

  // Override stored consumer id (used after Google sync)
  static setConsumerId(newId: string): void {
    if (!this.isValidConsumerId(newId)) return;
    this.setCookie(this.COOKIE_NAME, newId.trim(), 365);
  }

  static readAndRemoveIncomingConsumerId(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const url = new URL(window.location.href);
      const rawConsumerId = url.searchParams.get(this.INCOMING_PARAM_NAME);
      if (rawConsumerId === null) return null;

      url.searchParams.delete(this.INCOMING_PARAM_NAME);
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, document.title, nextUrl || '/');

      const consumerId = rawConsumerId.trim();
      return this.isValidConsumerId(consumerId) ? consumerId : null;
    } catch {
      return null;
    }
  }

  static isValidConsumerId(consumerId: string | null | undefined): consumerId is string {
    if (!consumerId) return false;
    const trimmed = consumerId.trim();
    return trimmed.length > 0 && trimmed.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(trimmed);
  }

  // Generate unique ID (UUID-like)
  private static generateUniqueId(): string {
    return 'consumer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Update last use timestamp in database (throttled to avoid excessive API calls)
  private static async updateLastUseTimestamp(consumerId: string): Promise<void> {
    const now = Date.now();
    const lastUpdate = this.getStorageItem(this.LAST_UPDATE_KEY);
    
    // Throttle: only update if last update was more than UPDATE_INTERVAL_MS ago
    if (lastUpdate) {
      const timeSinceLastUpdate = now - parseInt(lastUpdate, 10);
      if (timeSinceLastUpdate < this.UPDATE_INTERVAL_MS) {
        return; // Skip update, too soon
      }
    }
    
    // Update local timestamp
    this.setStorageItem(this.LAST_UPDATE_KEY, now.toString());
    
    // Update in database (fire and forget, don't block)
    try {
      await apiFetchUrl(`${this.API_BASE}/update_consumer_last_use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consumer_id: consumerId }),
      });
    } catch {
      // Silently fail - this is not critical functionality
    }
  }

  // Cookie management functions
  private static setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  private static getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length, c.length);
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }
    
    return null;
  }

  // Google email and name persistence
  static saveGoogleEmail(email: string): void {
    if (email) this.setStorageItem(this.GOOGLE_EMAIL_KEY, email);
  }

  static getGoogleEmail(): string | null {
    return this.getStorageItem(this.GOOGLE_EMAIL_KEY);
  }

  static clearGoogleEmail(): void {
    this.removeStorageItem(this.GOOGLE_EMAIL_KEY);
  }

  // State persistence functions
  static saveUserState(state: 'about' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing'): void {
    this.setStorageItem(this.STATE_KEY, state);
  }

  static getUserState(): 'about' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing' {
    const savedState = this.getStorageItem(this.STATE_KEY);
    return (savedState as 'about' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing') || 'about';
  }

  // German level persistence functions
  static saveGermanLevel(level: string): void {
    const consumerId = this.getConsumerId();
    if (!consumerId) return;
    this.setStorageItem(`langey_german_level_${consumerId}`, level);
  }

  static getStoredGermanLevel(): string | null {
    const consumerId = this.getConsumerId();
    if (!consumerId) return null;
    return this.getStorageItem(`langey_german_level_${consumerId}`);
  }

  static getGermanLevel(): string {
    return this.getStoredGermanLevel() || 'A1';
  }

  private static ONBOARDING_DRAFT_KEY = 'langey_new_user_onboarding_draft';
  private static ONBOARDING_STAGE_KEY = 'langey_onboarding_stage';
  private static ONBOARDING_DONE_KEY = 'langey_new_user_onboarding_done';
  private static GUIDE_KEY = 'langey_guide';
  private static GUIDE_PENDING_KEY = 'langey_guide_pending';

  static hasFinishedNewUserOnboarding(): boolean {
    return this.getStorageItem(this.ONBOARDING_DONE_KEY) === 'true';
  }

  private static markNewUserOnboardingDone(): void {
    this.setStorageItem(this.ONBOARDING_DONE_KEY, 'true');
  }

  static skipNewUserOnboarding(): void {
    this.removeStorageItem(this.ONBOARDING_DRAFT_KEY);
    this.removeStorageItem(this.ONBOARDING_STAGE_KEY);
    this.markNewUserOnboardingDone();
    this.markModulesGuidePending();
  }

  static completeNewUserOnboarding(): void {
    this.removeStorageItem(this.ONBOARDING_DRAFT_KEY);
    this.removeStorageItem(this.ONBOARDING_STAGE_KEY);
    this.markNewUserOnboardingDone();
    this.markModulesGuidePending();
  }

  /** Offer the modules tour once after Explore or full onboarding finish. */
  static markModulesGuidePending(): void {
    const existing = this.getStorageItem(this.GUIDE_KEY);
    if (existing === 'skipped' || existing === 'accepted') return;
    this.setStorageItem(this.GUIDE_PENDING_KEY, 'true');
  }

  static isModulesGuidePending(): boolean {
    const existing = this.getStorageItem(this.GUIDE_KEY);
    if (existing === 'skipped' || existing === 'accepted') return false;
    return this.getStorageItem(this.GUIDE_PENDING_KEY) === 'true';
  }

  static finishModulesGuide(status: 'skipped' | 'accepted'): void {
    this.setStorageItem(this.GUIDE_KEY, status);
    this.removeStorageItem(this.GUIDE_PENDING_KEY);
  }

  static saveNewUserOnboardingDraft<T extends object>(draft: T): void {
    try {
      this.setStorageItem(this.ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
      const stage = (draft as { stage?: unknown }).stage;
      if (typeof stage === 'string' && stage.length > 0) {
        this.setStorageItem(this.ONBOARDING_STAGE_KEY, stage);
      }
    } catch {
      // Tracking failures must not interrupt the user journey.
    }
  }

  static getNewUserOnboardingDraft<T>(): T | null {
    const raw = this.getStorageItem(this.ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  static getOnboardingStage(): string | null {
    return this.getStorageItem(this.ONBOARDING_STAGE_KEY);
  }
}
