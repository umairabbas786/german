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
import './langeylandingpage.animations.css';

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
  const isDesktop = variant === 'desktop';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isDropdownOpen && !target.closest('[data-daily-credits-container]')) {
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
    <div
      className={[
        'landing-dropdown-animate absolute top-full z-[1000] flex flex-col justify-center gap-2 rounded-xl border border-black/10 bg-white p-3 px-3.5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_10px_10px_-5px_rgba(0,0,0,0.04)]',
        isDesktop ? 'right-0 left-auto mt-1 min-w-[300px]' : 'left-0 mt-2 box-border w-full min-w-0',
      ].join(' ')}
    >
      <div className="mb-0 text-xs leading-[1.45] text-[#333]">
        {isPro
          ? 'You have unlimited health with Pro.'
          : healthLevel === 'Empty'
            ? 'You have no health remaining today, come back tomorrow for full recharge.'
            : `You have ${healthLevel} health which will recharge everyday.`}
      </div>
      {!isPro && (
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[#7877c6] underline hover:text-[#5a58a8]"
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

  return (
    <div className="relative shrink-0" data-daily-credits-container>
      <button
        type="button"
        className={[
          'flex cursor-pointer items-center justify-center rounded-full border p-0 select-none transition-all duration-300',
          isDesktop
            ? 'h-9 w-9 rounded-[18px] bg-transparent shadow-none hover:bg-black/4 hover:shadow-none'
            : 'h-10 w-10 bg-[radial-gradient(circle_at_30%_25%,#fff_0%,#f8fafc_60%,#eef2ff_100%)] shadow-[0_3px_8px_-2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.85)] hover:-translate-y-px hover:scale-[1.02] hover:shadow-[0_8px_16px_-8px_rgba(88,204,2,0.45),inset_0_1px_0_rgba(255,255,255,0.9)]',
        ].join(' ')}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label="Daily health"
        style={{
          borderColor: healthColor,
          color: healthColor,
        }}
      >
        <HealthBatteryIcon color={healthColor} level={iconLevel} />
      </button>
      {isDropdownOpen && dropdownContent}
    </div>
  );
}
