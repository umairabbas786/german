import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserTracker } from '../utils/userTracking';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../services/checkout';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { deleteAccount, getBillingPortal, getSettingsData, getSubscriptionStatus, getUserProfile } from '../services/accountApi';

interface SettingsData {
  vocabulary: { A1: number; A2: number; B1: number };
  grammar: { A1: number; A2: number; B1: number };
  reading: { A1: number; A2: number; B1: number };
  listening: { A1: number; A2: number; B1: number };
  speaking: { A1: number; A2: number; B1: number };
  writing: { A1: number; A2: number; B1: number };
}

interface SettingsProps {
  level: 'A1' | 'A2' | 'B1';
  onLevelChange: (level: 'A1' | 'A2' | 'B1') => void;
}

const LEVELS: Array<'A1' | 'A2' | 'B1'> = ['A1', 'A2', 'B1'];
const EMPTY_SETTINGS_DATA: SettingsData = {
  vocabulary: { A1: 0, A2: 0, B1: 0 },
  grammar: { A1: 0, A2: 0, B1: 0 },
  reading: { A1: 0, A2: 0, B1: 0 },
  listening: { A1: 0, A2: 0, B1: 0 },
  speaking: { A1: 0, A2: 0, B1: 0 },
  writing: { A1: 0, A2: 0, B1: 0 }
};

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const GLASS_CARD = 'overflow-hidden rounded-[9px] border border-slate-200/50 bg-white/40 backdrop-blur-[12px]';
const AVATAR_BORDER = 'border border-slate-300/85';
const SECONDARY_BTN =
  'flex items-center rounded-[7px] border border-[rgba(203,205,205,0.85)] bg-slate-50/50 px-[22px] py-[11px] text-[15px] font-medium text-gray-600 transition-all duration-200 hover:border-gray-500/80 hover:bg-slate-50/80 max-sm:px-3.5 max-sm:py-2 max-sm:text-[11px]';

export const Settings: React.FC<SettingsProps> = ({ level, onLevelChange }) => {
  const navigate = useNavigate();
  const { email: googleEmail, isLoading: isAuthLoading, authError, signInWithGoogle, signOut } = useSupabaseAuth();
  const [googlePicture, setGooglePicture] = useState<string | null>(null);
  const [consumerId] = useState<string>(() => UserTracker.getOrCreateConsumerId());
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProgressExpanded, setIsProgressExpanded] = useState(false);
  const [isPlanSelectionExpanded, setIsPlanSelectionExpanded] = useState(false);
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    is_pro: boolean;
    subscription_id: string | null;
    subscription_cancelled: boolean;
    subscription_ends_at: string | null;
    subscription_plan: 'monthly' | 'annual';
  }>({ is_pro: false, subscription_id: null, subscription_cancelled: false, subscription_ends_at: null, subscription_plan: 'monthly' });

  // subscription_id is the Lemon Squeezy ID. If it's null but the user is pro,
  // they subscribed via Google Play (mobile app) — they must manage it on the app.
  const isGooglePlaySub = subscriptionStatus.is_pro && !subscriptionStatus.subscription_id;
  const MONTHLY_VARIANT_ID = import.meta.env.VITE_MONTHLY_VARIANT_ID || '';
  const ANNUAL_VARIANT_ID = import.meta.env.VITE_ANNUAL_VARIANT_ID || '';

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await getSubscriptionStatus(consumerId);
      const data = await response.json();
      if (data.success && data.status) {
        setSubscriptionStatus({
          is_pro: data.status.is_pro || false,
          subscription_id: data.status.subscription_id || null,
          subscription_cancelled: data.status.subscription_cancelled || false,
          subscription_ends_at: data.status.subscription_ends_at || null,
          subscription_plan: data.status.subscription_plan === 'annual' ? 'annual' : 'monthly'
        });
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  const fetchUserProfile = async (email: string) => {
    try {
      const response = await getUserProfile(email);
      const data = await response.json();
      if (data && data.picture) {
        setGooglePicture(data.picture);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchSettingsData = async () => {
    if (consumerId === UserTracker.PENDING_CONSUMER_ID) {
      setSettingsData(EMPTY_SETTINGS_DATA);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const user_id = googleEmail || undefined;
      const response = await getSettingsData<SettingsData & { error?: string }>(consumerId, user_id);
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching settings data:', data.error);
        setSettingsData(EMPTY_SETTINGS_DATA);
      } else {
        setSettingsData(data);
      }
    } catch (error) {
      console.error('Error fetching settings data:', error);
      setSettingsData(EMPTY_SETTINGS_DATA);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial account hydration intentionally runs once for the stable consumer identity.
  useEffect(() => {
    // Initial load only
    fetchSubscriptionStatus();
    if (googleEmail) {
      fetchUserProfile(googleEmail);
    }
  }, [consumerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    signOut();
  };

  const handleDeleteAccount = async () => {
    if (!googleEmail) return;
    
    // Case 1: Active Pro (not cancelled) — block deletion
    if (subscriptionStatus.is_pro && !subscriptionStatus.subscription_cancelled) {
      alert('You have an active Pro subscription. Please cancel your subscription first before deleting your account.');
      return;
    }
    
    // Case 2: Cancelled Pro (still has remaining days)
    let confirmed: boolean;
    if (subscriptionStatus.is_pro && subscriptionStatus.subscription_cancelled) {
      const endsAt = subscriptionStatus.subscription_ends_at
        ? new Date(subscriptionStatus.subscription_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'your billing period ends';
      confirmed = window.confirm(
        `Warning: You still have Pro access until ${endsAt}. Deleting your account will remove all remaining usage days and permanently erase your data. Are you sure?`
      );
    } else {
      // Case 3: Free user
      confirmed = window.confirm('Warning: This will permanently erase your account. Are you sure you want to continue?');
    }
    
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await deleteAccount(googleEmail, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        await signOut();
        fetchSettingsData();
        fetchSubscriptionStatus();
      } else {
        // Check if user has active subscription
        if (data.has_active_subscription) {
          alert('Please cancel your subscription first before deleting your account. Visit your subscription management page to cancel.');
        } else {
          alert(`Error deleting account: ${data.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error deleting account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpgradeToPro = (variantId: string, billingPeriod: 'monthly' | 'annual') => {
    if (!googleEmail) {
      alert('Please connect your Google account first to upgrade to Pro.');
      return;
    }

    const checkoutLink = createCheckoutLink({
      planOption: billingPeriod === 'monthly' ? CHECKOUT_PLAN_OPTIONS.MONTHLY : CHECKOUT_PLAN_OPTIONS.ANNUAL,
      consumerId,
      email: googleEmail,
    });

    if (!variantId || !checkoutLink) {
      alert('Checkout plan not configured. Please contact support.');
      return;
    }

    window.location.href = checkoutLink;
  };

  const handleManageSubscription = async () => {
    try {
      const response = await getBillingPortal(consumerId);
      const data = await response.json();
      
      if (data.success && data.portal_url) {
        window.location.href = data.portal_url;
      } else if (data.is_gift) {
        alert(data.message || "You've got Langey Pro as a gift from us 🎁 — enjoy unlimited access, on the house!");
      } else {
        alert(`Error: ${data.error || 'Failed to get billing portal'}`);
      }
    } catch (error) {
      console.error('Error getting billing portal:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  const handleProgressToggle = () => {
    const newExpandedState = !isProgressExpanded;
    setIsProgressExpanded(newExpandedState);
    
    // Only fetch data when expanding for the first time
    if (newExpandedState && !hasLoadedProgress) {
      setHasLoadedProgress(true);
      fetchSettingsData();
    }
  };

  if (isAuthLoading) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-[770px] flex-col justify-center p-[26px] font-sans text-[#333] max-sm:m-0 max-sm:p-4">
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.08)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(255,206,84,0.08)_0%,transparent_50%),radial-gradient(circle_at_40%_80%,rgba(120,119,198,0.06)_0%,transparent_50%),linear-gradient(45deg,#f0f1f2_0%,#eceef0_50%,#f0f1f2_100%)] bg-size-[100%_100%,100%_100%,100%_100%,20px_20px]">
          <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-gray-500" />
          <p className="m-0 text-sm text-gray-500">Refreshing account data...</p>
        </div>
      </div>
    );
  }

  const formatSpeakingTime = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderValue = (value: number | string, type: 'percent' | 'time' | 'count' = 'percent') => {
    if (isLoading && !settingsData) return '-';
    if (value === 0 || value === '0m') return <span className="text-gray-300">-</span>;
    
    if (type === 'percent') {
      return (
        <span className="inline-flex rounded px-[9px] py-1 text-[10px] font-medium text-gray-600 bg-slate-50/50 max-sm:px-1.5 max-sm:py-[3px] max-sm:text-[8px]">
          {value}%
        </span>
      );
    }
    if (type === 'count') {
      return (
        <span className="inline-flex rounded px-[9px] py-1 text-[10px] font-medium text-gray-600 bg-slate-50/50 max-sm:px-1.5 max-sm:py-[3px] max-sm:text-[8px]">
          {value} items
        </span>
      );
    }
    return <span className="text-gray-500">{value}</span>;
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-[770px] flex-col justify-center p-[26px] font-sans text-[#333] max-sm:m-0 max-sm:p-4">
      {/* Header */}
      <div className="mb-[35px] flex items-center justify-between border-b border-[#c8c8c8] pb-[26px] max-sm:mb-6 max-sm:gap-3 max-sm:pb-4">
        <div className="flex flex-col items-start">
          <h1 className="m-0 text-left text-[22px] leading-tight font-semibold text-gray-900 max-sm:text-xl max-sm:leading-snug">
            Manage your Account
          </h1>
        </div>
        <a
          href="mailto:info@langey.com"
          className="cursor-pointer rounded-[7px] border border-[#c8c8c8] bg-transparent px-[18px] py-[9px] text-sm font-medium text-gray-600 no-underline transition-all duration-200 hover:border-slate-300 hover:bg-black/[0.02] max-sm:px-3 max-sm:py-1.5 max-sm:whitespace-nowrap"
        >
          Contact Us
        </a>
      </div>

      {/* Learning Level */}
      <div className="mb-[26px] max-sm:mb-6">
        <h2 className="mb-[18px] text-left text-xs font-semibold tracking-wider text-gray-600 uppercase max-sm:mb-3 max-sm:text-[10px]">
          LEARNING LEVEL
        </h2>
        <div className={cx(GLASS_CARD, 'flex items-center justify-between gap-[18px] px-[26px] py-[18px] max-sm:gap-3 max-sm:px-5 max-sm:py-4')}>
          <div className="flex items-center gap-[13px]">
            <div className={cx('flex size-10 items-center justify-center overflow-hidden rounded-full bg-slate-50/50', AVATAR_BORDER)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5h12" />
                <path d="M9 3v2" />
                <path d="M5 5c1.15 3.7 3.35 6.15 7 8" />
                <path d="M12 5c-.8 3.1-2.75 5.9-7 8" />
                <path d="M14 20l4-9 4 9" />
                <path d="M15.5 17h5" />
              </svg>
            </div>
            <div className="flex flex-col items-start">
              <h3 className="m-0 mb-0.5 text-left text-[13px] font-semibold text-gray-900">German Level</h3>
              <p className="m-0 text-left text-xs text-gray-500 max-sm:hidden">Used across roadmap and practice screens</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5 rounded-[10px] bg-black/[0.04] p-1 max-sm:gap-1 max-sm:p-[3px]">
            {LEVELS.map((option) => (
              <button
                key={option}
                type="button"
                className={cx(
                  'h-8 min-w-12 cursor-pointer rounded-lg border-0 bg-transparent text-[13px] font-semibold text-gray-500 transition-all duration-200 max-sm:h-[30px] max-sm:min-w-[38px] max-sm:text-xs',
                  level === option
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'hover:bg-white/65 hover:text-gray-900'
                )}
                onClick={() => onLevelChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="mb-0">
        <h2 className="mb-[18px] text-left text-xs font-semibold tracking-wider text-gray-600 uppercase max-sm:mb-3 max-sm:text-[10px]">
          ACCOUNT MANAGEMENT
        </h2>
        {authError && (
          <div className="mb-[18px] rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Sign-in failed: {authError}
          </div>
        )}
        <div className={cx(GLASS_CARD, 'flex items-center justify-between px-[26px] py-[18px] max-sm:gap-3 max-sm:px-5 max-sm:py-4')}>
          <div className="flex items-center gap-[13px]">
            <div className={cx('flex size-10 items-center justify-center overflow-hidden rounded-full bg-slate-50/50', AVATAR_BORDER)}>
              {googlePicture ? (
                <img src={googlePicture} alt="User" className="size-full object-cover" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21C20 19.6044 20 18.9067 19.8278 18.3389C19.44 17.0605 18.4395 16.06 17.1611 15.6722C16.5933 15.5 15.8956 15.5 14.5 15.5H9.5C8.10444 15.5 7.40665 15.5 6.83886 15.6722C5.56045 16.06 4.56004 17.0605 4.17224 18.3389C4 18.9067 4 19.6044 4 21M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div className="flex flex-col items-start">
              <h3 className="m-0 mb-0.5 text-left text-[13px] font-semibold text-gray-900">{googleEmail ? 'Signed In' : 'Guest Mode'}</h3>
              <p className="m-0 text-left text-xs text-gray-500 max-sm:hidden">
                {googleEmail ? googleEmail : 'Sync to save progress'}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center justify-end gap-[26px] max-sm:gap-3">
            {googleEmail ? (
              <>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-gray-500 transition-colors duration-200 hover:text-gray-600 max-sm:text-[11px]"
                  onClick={handleLogout}
                >
                  Logout
                </button>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-red-500 transition-colors duration-200 hover:text-red-600 disabled:cursor-not-allowed max-sm:text-[11px]"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </>
            ) : (
              <button type="button" className={cx(SECONDARY_BTN, 'cursor-pointer')} onClick={signInWithGoogle}>
                Save Data with Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="mt-[26px] mb-[26px] max-sm:mt-0 max-sm:mb-6">
        <h2 className="mb-[18px] text-left text-xs font-semibold tracking-wider text-gray-600 uppercase max-sm:mb-3 max-sm:text-[10px]">
          SUBSCRIPTION MANAGEMENT
        </h2>
        <div className={cx(GLASS_CARD, 'flex flex-col items-stretch px-[26px] py-[18px] max-sm:px-5 max-sm:py-4')}>
          <div className="flex items-center justify-between max-sm:gap-3">
            <div className="flex items-center gap-[13px]">
              <div className={cx('flex size-10 items-center justify-center overflow-hidden rounded-full bg-slate-50/50', AVATAR_BORDER)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={subscriptionStatus.is_pro ? "#FFD700" : "transparent"} stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex flex-col items-start">
                {googleEmail && subscriptionStatus.is_pro ? (
                  <div className="mb-0.5 flex items-center gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-[5px]">
                    <h3 className="m-0 text-left text-[13px] font-semibold text-gray-900">Pro Member</h3>
                    <div className="flex items-center gap-[5px]">
                      <span
                        className={cx(
                          'rounded px-1.5 py-[3px] text-[8px] leading-none font-bold tracking-wide',
                          subscriptionStatus.subscription_cancelled
                            ? 'bg-red-100/80 text-red-600'
                            : 'bg-green-100/80 text-green-700'
                        )}
                      >
                        {subscriptionStatus.subscription_cancelled ? 'CANCELLED' : 'ACTIVE'}
                      </span>
                      <span className="rounded bg-slate-200/80 px-1.5 py-[3px] text-[8px] leading-none font-bold tracking-wide text-gray-600">
                        {subscriptionStatus.subscription_plan.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <h3 className="m-0 mb-0.5 text-left text-[13px] font-semibold text-gray-900">
                    {!googleEmail ? 'Free - Guest' : 'Free Mode'}
                  </h3>
                )}
                <p className="m-0 text-left text-xs text-gray-500 max-sm:hidden">
                  {!googleEmail
                    ? 'Connect Google account to access Pro features'
                    : subscriptionStatus.is_pro
                      ? subscriptionStatus.subscription_cancelled && subscriptionStatus.subscription_ends_at
                        ? `Access until ${new Date(subscriptionStatus.subscription_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Enjoying unlimited access to all features'
                      : 'Free Mode offers limited access.'}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center justify-end gap-[26px] max-sm:gap-3">
              {subscriptionStatus.is_pro ? (
                isGooglePlaySub ? (
                  // Subscribed via Google Play — can only be managed inside the mobile app.
                  <button
                    type="button"
                    className="cursor-default border-0 bg-transparent p-0 text-[13px] font-medium text-slate-300 max-sm:text-[11px]"
                    disabled
                  >
                    Manage on App
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-gray-500 transition-colors duration-200 hover:text-gray-600 max-sm:text-[11px]"
                    onClick={handleManageSubscription}
                  >
                    Manage Account
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="relative flex cursor-pointer items-center overflow-hidden rounded-[7px] border border-black/15 bg-[rgba(248,248,248,0.9)] px-[22px] py-[11px] text-[15px] font-semibold text-gray-900 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(248,248,248,0.95)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(0,0,0,0.1)] max-sm:px-4 max-sm:py-2.5 max-sm:text-xs max-sm:whitespace-nowrap"
                  onClick={() => setIsPlanSelectionExpanded((isExpanded) => !isExpanded)}
                  aria-expanded={isPlanSelectionExpanded}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-[-1px] -z-10 animate-settings-glow rounded-[7px] bg-[linear-gradient(45deg,rgba(120,119,198,0.5),rgba(255,206,84,0.5),rgba(120,119,198,0.5),rgba(255,206,84,0.5))] bg-size-[400%_400%] opacity-80"
                  />
                  Get Unlimited Access
                </button>
              )}
            </div>
          </div>

          {!subscriptionStatus.is_pro && (
            <div
              className={cx(
                'grid w-full opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out',
                isPlanSelectionExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr]'
              )}
              aria-hidden={!isPlanSelectionExpanded}
            >
              <div
                className={cx(
                  'flex min-h-0 gap-3 overflow-hidden max-sm:gap-2',
                  isPlanSelectionExpanded && 'pt-[18px] max-sm:pt-4'
                )}
              >
                <button
                  type="button"
                  className="relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[7px] border-2 border-[rgba(203,205,205,0.85)] bg-slate-50/50 px-[22px] py-[11px] text-[15px] font-bold text-gray-600 transition-all duration-200 hover:border-gray-500/80 hover:bg-slate-50/80 max-sm:gap-[5px] max-sm:px-2 max-sm:py-2.5 max-sm:text-[11px]"
                  onClick={() => handleUpgradeToPro(MONTHLY_VARIANT_ID, 'monthly')}
                  tabIndex={isPlanSelectionExpanded ? 0 : -1}
                >
                  Monthly — $4.99/mo
                </button>
                <button
                  type="button"
                  className="relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[7px] border-2 border-[rgba(203,205,205,0.85)] bg-slate-50/50 px-[22px] py-[11px] text-[15px] font-bold text-gray-600 transition-all duration-200 hover:border-gray-500/80 hover:bg-slate-50/80 max-sm:gap-[5px] max-sm:px-2 max-sm:py-2.5 max-sm:text-[11px]"
                  onClick={() => handleUpgradeToPro(ANNUAL_VARIANT_ID, 'annual')}
                  tabIndex={isPlanSelectionExpanded ? 0 : -1}
                >
                  Annual — $30/year
                  <span className="rounded bg-green-100 px-[9px] py-[5px] text-xs leading-none font-bold whitespace-nowrap text-green-700 max-sm:absolute max-sm:top-[-9px] max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:px-[7px] max-sm:py-1 max-sm:text-[10px]">
                    50% OFF
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legal */}
      <div className="mb-[26px] max-sm:mb-6">
        <h2 className="mb-[18px] text-left text-xs font-semibold tracking-wider text-gray-600 uppercase max-sm:mb-3 max-sm:text-[10px]">
          LEGAL TERMS
        </h2>
        <div className={cx(GLASS_CARD, 'flex gap-3 px-[18px] py-3.5 max-sm:gap-2 max-sm:px-3.5 max-sm:py-2.5')}>
          <button type="button" className={cx(SECONDARY_BTN, 'flex-1 cursor-pointer justify-center')} onClick={() => navigate('/privacy-policy')}>
            Privacy Policy
          </button>
          <button type="button" className={cx(SECONDARY_BTN, 'flex-1 cursor-pointer justify-center')} onClick={() => navigate('/terms-and-conditions')}>
            Terms & Conditions
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mt-0">
        <div className="mb-[18px] flex items-center justify-between gap-[13px] max-sm:mb-3">
          <h2 className="m-0 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase max-sm:text-[10px]">
            PROGRESS OVERVIEW
          </h2>
          <div className="flex items-center gap-[13px]">
            {isLoading && isProgressExpanded && (
              <div className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-gray-500" />
            )}
            <button
              type="button"
              className="flex cursor-pointer items-center justify-center rounded p-1 text-gray-500 transition-all duration-200 hover:bg-black/[0.02] hover:text-gray-600"
              onClick={handleProgressToggle}
              aria-label={isProgressExpanded ? 'Collapse progress overview' : 'Expand progress overview'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cx('transition-transform duration-200 ease-out', isProgressExpanded && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
        {isProgressExpanded && (
          <div className={cx(GLASS_CARD, 'w-full')}>
            <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-slate-200/50 bg-gray-50/30 px-[22px] py-[13px] text-left text-xs font-semibold tracking-wider text-gray-500 uppercase max-sm:px-2.5 max-sm:py-3 max-sm:text-[9px]">
                  FEATURE
                </th>
                <th className="w-[15%] border-b border-slate-200/50 bg-gray-50/30 px-[22px] py-[13px] text-center text-xs font-semibold tracking-wider text-gray-500 uppercase max-sm:w-[20%] max-sm:px-1 max-sm:py-3 max-sm:text-[9px]">
                  A1
                </th>
                <th className="w-[15%] border-b border-slate-200/50 bg-gray-50/30 px-[22px] py-[13px] text-center text-xs font-semibold tracking-wider text-gray-500 uppercase max-sm:w-[20%] max-sm:px-1 max-sm:py-3 max-sm:text-[9px]">
                  A2
                </th>
                <th className="w-[15%] border-b border-slate-200/50 bg-gray-50/30 px-[22px] py-[13px] text-center text-xs font-semibold tracking-wider text-gray-500 uppercase max-sm:w-[20%] max-sm:px-1 max-sm:py-3 max-sm:text-[9px]">
                  B1
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="flex h-11 items-center gap-[13px] border-b border-slate-100 px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </span>
                  Vocabulary
                </td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.vocabulary.A1 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.vocabulary.A2 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.vocabulary.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="flex h-11 items-center gap-[13px] border-b border-slate-100 px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
                    </svg>
                  </span>
                  Grammar
                </td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.grammar.A1 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.grammar.A2 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.grammar.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="flex h-11 items-center gap-[13px] border-b border-slate-100 px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </span>
                  Reading
                </td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.reading.A1 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.reading.A2 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.reading.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="flex h-11 items-center gap-[13px] border-b border-slate-100 px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </span>
                  Listening
                </td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.listening.A1 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.listening.A2 || 0, 'percent')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.listening.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="flex h-11 items-center gap-[13px] border-b border-slate-100 px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <path d="M12 19v4"/>
                      <path d="M8 23h8"/>
                    </svg>
                  </span>
                  Speaking
                </td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(formatSpeakingTime(settingsData?.speaking.A1 || 0), 'time')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(formatSpeakingTime(settingsData?.speaking.A2 || 0), 'time')}</td>
                <td className="h-11 border-b border-slate-100 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(formatSpeakingTime(settingsData?.speaking.B1 || 0), 'time')}</td>
              </tr>
              <tr>
                <td className="flex h-11 items-center gap-[13px] px-[22px] py-1 align-middle text-sm font-medium text-gray-800 max-sm:gap-2 max-sm:px-2.5 max-sm:py-3 max-sm:text-[8px]">
                  <span className="flex w-3.5 items-center justify-center text-gray-400 max-sm:w-5 [&_svg]:max-sm:size-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </span>
                  Writing
                </td>
                <td className="h-11 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.writing.A1 || 0, 'count')}</td>
                <td className="h-11 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.writing.A2 || 0, 'count')}</td>
                <td className="h-11 px-[22px] py-1 text-center align-middle text-xs text-gray-800 max-sm:w-[20%] max-sm:px-1 max-sm:py-3">{renderValue(settingsData?.writing.B1 || 0, 'count')}</td>
              </tr>
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};
