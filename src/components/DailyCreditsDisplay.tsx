import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDailyCredits } from '../contexts/DailyCreditsContext';
import { UserTracker } from '../utils/userTracking';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../services/checkout';
import {
  DAILY_CREDITS_MAX,
  DAILY_CREDITS_BATTERY_FULL_MIN,
  DAILY_CREDITS_BATTERY_MEDIUM_MIN,
} from '../constants/dailyCredits';
import { HealthBatteryIcon } from './icons/HealthBatteryIcon';

type HealthLevel = 'Full' | 'Medium' | 'Low' | 'Empty';

function getHealthColor(creditsLeft: number, isPro: boolean): string {
  if (isPro) return 'var(--credits-pro, #7877c6)';
  if (creditsLeft > DAILY_CREDITS_BATTERY_FULL_MIN) return 'var(--credits-green, #58cc02)';
  if (creditsLeft > DAILY_CREDITS_BATTERY_MEDIUM_MIN) return 'var(--credits-yellow, #f59e0b)';
  return 'var(--credits-red, #ef4444)';
}

function getHealthLevel(creditsLeft: number, isPro: boolean): HealthLevel {
  if (isPro || creditsLeft > DAILY_CREDITS_BATTERY_FULL_MIN) return 'Full';
  if (creditsLeft > DAILY_CREDITS_BATTERY_MEDIUM_MIN) return 'Medium';
  if (creditsLeft > 0) return 'Low';
  return 'Empty';
}

interface DailyCreditsDisplayProps {
  variant: 'desktop' | 'mobile';
}

export function DailyCreditsDisplay({ variant }: DailyCreditsDisplayProps) {
  const { creditsLeft, isPro, isLoading } = useDailyCredits();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isDropdownOpen && !target.closest('.gg-daily-credits-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleUpgradeClick = () => {
    const googleEmail = UserTracker.getGoogleEmail();
    const checkoutLink = googleEmail
      ? createCheckoutLink({
        planOption: CHECKOUT_PLAN_OPTIONS.BOTH,
        consumerId: UserTracker.getOrCreateConsumerId(),
        email: googleEmail,
      })
      : null;

    if (checkoutLink) {
      window.location.href = checkoutLink;
    } else {
      navigate('/settings');
    }
  };

  const effectiveCredits = isPro ? DAILY_CREDITS_MAX : (creditsLeft ?? DAILY_CREDITS_MAX);
  const healthLevel = getHealthLevel(effectiveCredits, isPro);
  const healthColor = isLoading ? '#9ca3af' : getHealthColor(effectiveCredits, isPro);
  const iconLevel = healthLevel.toLowerCase() as 'full' | 'medium' | 'low' | 'empty';

  const dropdownContent = (
    <div className="gg-daily-credits-dropdown-list">
      <div className="gg-daily-credits-dropdown-text">
        {isPro
          ? 'You have unlimited health with Pro.'
          : healthLevel === 'Empty'
            ? 'You have no health remaining today, come back tomorrow for full recharge.'
            : `You have ${healthLevel} health which will recharge everyday.`}
      </div>
      {!isPro && (
        <button
          type="button"
          className="gg-daily-credits-upgrade-link"
          onClick={(e) => {
            e.stopPropagation();
            handleUpgradeClick();
          }}
        >
          Upgrade to Pro for Unlimited
        </button>
      )}
    </div>
  );
  const containerClass = variant === 'desktop'
    ? 'gg-daily-credits-container gg-daily-credits-desktop'
    : 'gg-daily-credits-container gg-daily-credits-mobile';

  return (
    <div className={containerClass}>
      <button
        type="button"
        className="gg-daily-credits-circle"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label="Daily health"
        style={{
          borderColor: healthColor,
          color: healthColor
        }}
      >
        <HealthBatteryIcon color={healthColor} level={iconLevel} />
      </button>
      {isDropdownOpen && dropdownContent}
    </div>
  );
}
