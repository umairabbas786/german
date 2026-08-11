import { apiFetch } from './api';

export interface SupabaseSyncResponse {
  email: string;
  resolved_consumer_id: string;
  detail?: string;
}

export interface SubscriptionStatusResponse {
  success?: boolean;
  status?: {
    is_pro?: boolean;
    subscription_id?: string | null;
    subscription_cancelled?: boolean;
    subscription_ends_at?: string | null;
    subscription_plan?: string;
  };
}

export interface UserProfileResponse {
  picture?: string;
}

export interface AccountActionResponse {
  success?: boolean;
  has_active_subscription?: boolean;
  message?: string;
}

export interface BillingPortalResponse {
  success?: boolean;
  portal_url?: string;
  is_gift?: boolean;
  message?: string;
  error?: string;
}

export const syncSupabaseAuth = (accessToken: string, consumerId: string) => apiFetch<SupabaseSyncResponse>('/auth/supabase-sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ consumer_id: consumerId }),
});
export const getSubscriptionStatus = (consumerId: string) =>
  apiFetch<SubscriptionStatusResponse>(`/api/subscription-status?consumer_id=${encodeURIComponent(consumerId)}`);
export const getUserProfile = (email: string) =>
  apiFetch<UserProfileResponse>(`/user/profile?email=${encodeURIComponent(email)}`);
export const getSettingsData = <T>(consumerId: string, userId?: string) =>
  apiFetch<T>(`/settings/data?consumer_id=${encodeURIComponent(consumerId)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ''}`);
export const deleteAccount = (email: string, init: RequestInit) =>
  apiFetch<AccountActionResponse>(`/settings/account?email=${encodeURIComponent(email)}`, init);
export const getBillingPortal = (consumerId: string) =>
  apiFetch<BillingPortalResponse>(`/api/get-billing-portal?consumer_id=${encodeURIComponent(consumerId)}`);
