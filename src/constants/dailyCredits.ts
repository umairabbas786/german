/**
 * Free-tier daily credit budget (UI fallbacks & progress display).
 * Must match backend `DAILY_CREDITS_INITIAL` in `backend/features/daily_credits.py`.
 */
export const DAILY_CREDITS_MAX = 50;

export const DEFAULT_LIMIT_MESSAGE =
  "You've used your daily credits. Come back tomorrow or upgrade for unlimited practice.";

/** Battery / ring color bands: Full above 70% of daily max, Medium above 30% (exclusive of Full band). */
export const DAILY_CREDITS_BATTERY_FULL_MIN = Math.round(0.7 * DAILY_CREDITS_MAX);
export const DAILY_CREDITS_BATTERY_MEDIUM_MIN = Math.round(0.3 * DAILY_CREDITS_MAX);
