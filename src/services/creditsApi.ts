import { apiFetch } from './api';

export interface GoogleUserSyncResponse {
  resolved_consumer_id?: string;
}

export interface DailyCreditsResponse {
  is_pro?: boolean;
  credits_left?: number;
}

export const syncGoogleUser = (payload: unknown) => apiFetch<GoogleUserSyncResponse>('/user_google_map_sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
export const getDailyCredits = (consumerId: string) =>
  apiFetch<DailyCreditsResponse>(`/api/daily-credits?consumer_id=${encodeURIComponent(consumerId)}`);
