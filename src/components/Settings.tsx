import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';
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
      <div className="settings-container">
        <div className="settings-loading-overlay">
          <div className="settings-spinner-large"></div>
          <p className="settings-loading-text">Refreshing account data...</p>
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
    if (value === 0 || value === '0m') return <span className="text-gray-400">-</span>;
    
    if (type === 'percent') {
      return <span className="settings-badge">{value}%</span>;
    }
    if (type === 'count') {
      return <span className="settings-badge">{value} items</span>;
    }
    return <span className="text-gray-600">{value}</span>;
  };

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <h1 className="settings-main-title">Manage your Account</h1>
        </div>
        <a href="mailto:info@langey.com" className="settings-contact-btn">
          Contact Us
        </a>
      </div>

      {/* Learning Level */}
      <div className="settings-section settings-level-section">
        <h2 className="settings-section-title">LEARNING LEVEL</h2>
        <div className="settings-card settings-level-card">
          <div className="settings-account-info">
            <div className="settings-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5h12" />
                <path d="M9 3v2" />
                <path d="M5 5c1.15 3.7 3.35 6.15 7 8" />
                <path d="M12 5c-.8 3.1-2.75 5.9-7 8" />
                <path d="M14 20l4-9 4 9" />
                <path d="M15.5 17h5" />
              </svg>
            </div>
            <div className="settings-account-text">
              <h3 className="settings-account-name">German Level</h3>
              <p className="settings-account-status">Used across roadmap and practice screens</p>
            </div>
          </div>
          <div className="settings-level-options">
            {LEVELS.map((option) => (
              <button
                key={option}
                type="button"
                className={`settings-level-option ${level === option ? 'active' : ''}`}
                onClick={() => onLevelChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="settings-section settings-account-section">
        <h2 className="settings-section-title">ACCOUNT MANAGEMENT</h2>
        {authError && (
          <div className="settings-auth-error">
            Sign-in failed: {authError}
          </div>
        )}
        <div className="settings-card settings-account-card">
          <div className="settings-account-info">
            <div className="settings-avatar">
              {googlePicture ? (
                <img src={googlePicture} alt="User" className="settings-avatar-img" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21C20 19.6044 20 18.9067 19.8278 18.3389C19.44 17.0605 18.4395 16.06 17.1611 15.6722C16.5933 15.5 15.8956 15.5 14.5 15.5H9.5C8.10444 15.5 7.40665 15.5 6.83886 15.6722C5.56045 16.06 4.56004 17.0605 4.17224 18.3389C4 18.9067 4 19.6044 4 21M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div className="settings-account-text">
              <h3 className="settings-account-name">{googleEmail ? 'Signed In' : 'Guest Mode'}</h3>
              <p className="settings-account-status">
                {googleEmail ? googleEmail : 'Sync to save progress'}
              </p>
            </div>
          </div>
          <div className="settings-account-actions">
            {googleEmail ? (
              <>
                <button className="settings-action-btn" onClick={handleLogout}>Logout</button>
                <button className="settings-action-btn settings-delete-text" onClick={handleDeleteAccount} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </>
            ) : (
              <button className="settings-google-btn" onClick={signInWithGoogle}>
                Save Data with Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="settings-section settings-subscription-section">
        <h2 className="settings-section-title">SUBSCRIPTION MANAGEMENT</h2>
        <div className={`settings-card settings-account-card settings-subscription-card ${isPlanSelectionExpanded ? 'expanded' : ''}`}>
          <div className="settings-subscription-summary">
            <div className="settings-account-info">
              <div className="settings-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={subscriptionStatus.is_pro ? "#FFD700" : "transparent"} stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="settings-account-text">
                {googleEmail && subscriptionStatus.is_pro ? (
                  <div className="settings-subscription-title-row">
                    <h3 className="settings-account-name">Pro Member</h3>
                    <div className="settings-subscription-tags">
                      <span className={`settings-subscription-tag ${subscriptionStatus.subscription_cancelled ? 'cancelled' : 'active'}`}>
                        {subscriptionStatus.subscription_cancelled ? 'CANCELLED' : 'ACTIVE'}
                      </span>
                      <span className="settings-subscription-tag plan">
                        {subscriptionStatus.subscription_plan.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <h3 className="settings-account-name">
                    {!googleEmail ? 'Free - Guest' : 'Free Mode'}
                  </h3>
                )}
                <p className="settings-account-status">
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
            <div className="settings-account-actions">
              {subscriptionStatus.is_pro ? (
                isGooglePlaySub ? (
                  // Subscribed via Google Play — can only be managed inside the mobile app.
                  <button className="settings-action-btn settings-action-btn-disabled" disabled>
                    Manage on App
                  </button>
                ) : (
                  <button className="settings-action-btn" onClick={handleManageSubscription}>
                    Manage Account
                  </button>
                )
              ) : (
                <button
                  className="settings-upgrade-btn"
                  onClick={() => setIsPlanSelectionExpanded((isExpanded) => !isExpanded)}
                  aria-expanded={isPlanSelectionExpanded}
                >
                  Get Unlimited Access
                </button>
              )}
            </div>
          </div>

          {!subscriptionStatus.is_pro && (
            <div className="settings-plan-selection" aria-hidden={!isPlanSelectionExpanded}>
              <div className="settings-plan-selection-inner">
                <button
                  className="settings-plan-btn"
                  onClick={() => handleUpgradeToPro(MONTHLY_VARIANT_ID, 'monthly')}
                  tabIndex={isPlanSelectionExpanded ? 0 : -1}
                >
                  Monthly — $4.99/mo
                </button>
                <button
                  className="settings-plan-btn settings-annual-plan-btn"
                  onClick={() => handleUpgradeToPro(ANNUAL_VARIANT_ID, 'annual')}
                  tabIndex={isPlanSelectionExpanded ? 0 : -1}
                >
                  Annual — $30/year
                  <span className="settings-sale-tag">50% OFF</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legal */}
      <div className="settings-section">
        <h2 className="settings-section-title">LEGAL TERMS</h2>
        <div className="settings-card settings-legal-card">
          <button className="settings-legal-btn" onClick={() => navigate('/privacy-policy')}>Privacy Policy</button>
          <button className="settings-legal-btn" onClick={() => navigate('/terms-and-conditions')}>Terms & Conditions</button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="settings-section settings-progress-section">
        <div className="settings-section-header-row">
          <h2 className="settings-section-title">PROGRESS OVERVIEW</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            {isLoading && isProgressExpanded && <div className="settings-spinner-small"></div>}
            <button 
              className="settings-expand-toggle"
              onClick={handleProgressToggle}
              aria-label={isProgressExpanded ? "Collapse progress overview" : "Expand progress overview"}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={`settings-expand-arrow ${isProgressExpanded ? 'expanded' : ''}`}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
        {isProgressExpanded && (
          <div className="settings-card settings-table-card">
            <table className="settings-table">
            <thead>
              <tr>
                <th className="settings-th-feature">FEATURE</th>
                <th>A1</th>
                <th>A2</th>
                <th>B1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </span>
                  Vocabulary
                </td>
                <td>{renderValue(settingsData?.vocabulary.A1 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.vocabulary.A2 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.vocabulary.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
                    </svg>
                  </span>
                  Grammar
                </td>
                <td>{renderValue(settingsData?.grammar.A1 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.grammar.A2 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.grammar.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </span>
                  Reading
                </td>
                <td>{renderValue(settingsData?.reading.A1 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.reading.A2 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.reading.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </span>
                  Listening
                </td>
                <td>{renderValue(settingsData?.listening.A1 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.listening.A2 || 0, 'percent')}</td>
                <td>{renderValue(settingsData?.listening.B1 || 0, 'percent')}</td>
              </tr>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <path d="M12 19v4"/>
                      <path d="M8 23h8"/>
                    </svg>
                  </span>
                  Speaking
                </td>
                <td>{renderValue(formatSpeakingTime(settingsData?.speaking.A1 || 0), 'time')}</td>
                <td>{renderValue(formatSpeakingTime(settingsData?.speaking.A2 || 0), 'time')}</td>
                <td>{renderValue(formatSpeakingTime(settingsData?.speaking.B1 || 0), 'time')}</td>
              </tr>
              <tr>
                <td className="settings-feature-cell">
                  <span className="settings-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </span>
                  Writing
                </td>
                <td>{renderValue(settingsData?.writing.A1 || 0, 'count')}</td>
                <td>{renderValue(settingsData?.writing.A2 || 0, 'count')}</td>
                <td>{renderValue(settingsData?.writing.B1 || 0, 'count')}</td>
              </tr>
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};
