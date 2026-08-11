import React from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Zap, X, Coffee, AlertCircle, ShieldCheck } from 'lucide-react';
import { UserTracker } from '../utils/userTracking';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../services/checkout';
import './CreditLimitBlockPopup.animations.css';

interface CreditLimitBlockPopupProps {
  isOpen: boolean;
  onClose: () => void;
  popupId: number; // 1 to 5
}

const visualBox =
  'mb-[22px] box-border flex min-h-[116px] w-full flex-col justify-center rounded-[18px] border border-black/10 bg-slate-50 px-[22px] py-[18px] max-md:mb-4 max-md:min-h-0 max-md:px-4 max-md:py-3.5';

export const CreditLimitBlockPopup: React.FC<CreditLimitBlockPopupProps> = ({
  isOpen,
  onClose,
  popupId,
}) => {
  const navigate = useNavigate();
  const level = UserTracker.getGermanLevel();

  const getLevelStats = (lvl: string) => {
    const l = (lvl || 'A1').toUpperCase();
    if (l === 'A2') {
      return { minDays: 40, limitDays: 200 };
    } else if (l === 'B1') {
      return { minDays: 60, limitDays: 300 };
    }
    return { minDays: 20, limitDays: 100 };
  };

  const { minDays, limitDays } = getLevelStats(level);

  if (!isOpen) return null;

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
      onClose();
      navigate('/settings');
    }
  };

  const handleContinueClick = () => {
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCloseIconClick = () => {
    onClose();
  };

  const renderVisualGraphic = () => {
    switch (popupId) {
      case 1:
        return (
          <div className={`${visualBox} relative gap-3.5 max-md:gap-2.5`}>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px] text-gray-600 max-md:text-[11.5px]">
                <span className="font-semibold">Free Plan (Limited)</span>
                <span className="font-bold text-gray-500 max-md:text-xs">{limitDays} Days</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 max-md:h-1.5">
                <div className="h-full rounded-full bg-gray-400 transition-[width] duration-[800ms] ease-out" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px] text-gray-600 max-md:text-[11.5px]">
                <span className="font-medium">Pro Plan (Unlimited)</span>
                <span className="font-bold text-black max-md:text-xs">{minDays} Days</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 max-md:h-1.5">
                <div
                  className="h-full rounded-full bg-black transition-[width] duration-[800ms] ease-out"
                  style={{ width: `${(minDays / limitDays) * 100}%` }}
                />
              </div>
            </div>
            <div className="absolute top-3 right-3.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-[0_3px_8px_rgba(239,68,68,0.25)]">
              5x Slower
            </div>
          </div>
        );
      case 2:
        return (
          <div className={`${visualBox} gap-2.5 max-md:gap-2`}>
            <div className="flex items-center gap-3.5 rounded-xl bg-white px-3.5 py-2.5 transition-all duration-200 max-md:gap-2.5 max-md:px-2.5 max-md:py-1.5">
              <span className="text-[22px] max-md:text-lg">🐢</span>
              <div className="flex flex-col gap-px">
                <span className="text-[13px] text-gray-800 max-md:text-xs">Free Plan</span>
                <span className="text-[11px] text-gray-500 max-md:text-[10px]">5x Slower (Daily Limit)</span>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-xl bg-black/[0.06] px-3.5 py-2.5 transition-all duration-200 max-md:gap-2.5 max-md:px-2.5 max-md:py-1.5">
              <span className="animate-bounce text-[22px] max-md:text-lg">🚀</span>
              <div className="flex flex-col gap-px">
                <span className="text-[13px] font-semibold text-black max-md:text-xs">Pro Plan</span>
                <span className="text-[11px] text-gray-500 max-md:text-[10px]">5x Faster (Unlimited)</span>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className={`${visualBox} gap-3 max-md:gap-2`}>
            <div className="flex flex-col gap-3 max-md:gap-2">
              <div className="box-border flex items-center justify-between rounded-xl border-none bg-white px-3.5 py-2.5 max-md:px-2.5 max-md:py-2">
                <span className="text-[13px] text-gray-800 max-md:text-xs">Free Plan (Interrupted)</span>
                <div className="flex gap-1.5 max-md:gap-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-green-500 bg-green-500 text-[11px] font-bold text-white max-md:h-5 max-md:w-5 max-md:text-[9px]">✓</div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-green-500 bg-green-500 text-[11px] font-bold text-white max-md:h-5 max-md:w-5 max-md:text-[9px]">✓</div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-red-500 bg-red-100 text-[9px] font-bold text-red-500 max-md:h-5 max-md:w-5">🔒</div>
                  <div className="box-border h-6 w-6 rounded-full border border-gray-200 bg-gray-100 max-md:h-5 max-md:w-5" />
                  <div className="box-border h-6 w-6 rounded-full border border-gray-200 bg-gray-100 max-md:h-5 max-md:w-5" />
                </div>
              </div>
              <div className="box-border flex items-center justify-between rounded-xl border-none bg-black/[0.06] px-3.5 py-2.5 max-md:px-2.5 max-md:py-2">
                <span className="text-[13px] font-semibold text-gray-800 max-md:text-xs">Pro Plan (Uninterrupted)</span>
                <div className="flex gap-1.5 max-md:gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-green-500 bg-green-500 text-[11px] font-bold text-white max-md:h-5 max-md:w-5 max-md:text-[9px]"
                    >
                      ✓
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className={`${visualBox} box-border`}>
            <div className="box-border flex w-full items-center justify-center gap-[18px] rounded-xl bg-white px-3 py-2 max-md:gap-3 max-md:px-1.5 max-md:py-1">
              <div className="flex shrink-0 items-center justify-center text-yellow-500">
                <ShieldCheck size={44} className="drop-shadow-[0_2px_6px_rgba(234,179,8,0.25)] max-md:h-9 max-md:w-9" />
              </div>
              <div className="flex flex-col items-center gap-[3px] text-center">
                <span className="text-base font-extrabold tracking-tight text-black max-md:text-sm">
                  14-Day Money-Back Guarantee
                </span>
                <span className="text-[13px] font-medium text-gray-600 max-md:text-[11px]">
                  Try Pro 100% risk-free. No questions asked.
                </span>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className={visualBox}>
            <div className="flex w-full flex-col overflow-hidden rounded-xl border-none bg-white">
              <div className="grid grid-cols-[1.5fr_1fr_1.3fr] items-center border-b border-gray-100 px-3.5 py-3 text-[13px] text-gray-600 max-md:px-2.5 max-md:py-2 max-md:text-[11.5px]">
                <div className="flex items-center gap-2 text-gray-800">
                  <Coffee size={18} className="text-amber-700" />
                  <span>1 Cup of Coffee</span>
                </div>
                <span className="font-semibold text-gray-800">$5.00</span>
                <span className="text-right text-[11px] text-gray-500 max-md:text-[10px]">Lasts 15 mins</span>
              </div>
              <div className="my-0.5 grid grid-cols-[1.5fr_1fr_1.3fr] items-center rounded-lg border-none bg-black/[0.06] px-3.5 py-3 text-[13px] text-gray-600 max-md:px-2.5 max-md:py-2 max-md:text-[11.5px]">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                  <Zap size={18} className="text-yellow-500" />
                  <span>Langey Pro</span>
                </div>
                <span className="font-bold text-black">$4.99/mo</span>
                <span className="text-right text-[11px] font-semibold text-black max-md:text-[10px]">Unlimited Practice</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderMessageContent = () => {
    const desc = 'm-0 text-center text-[15px] leading-[1.6] text-gray-700 max-md:text-[13.5px] max-md:leading-normal [&_strong]:font-bold [&_strong]:text-black';
    switch (popupId) {
      case 1:
        return (
          <p className={desc}>
            Students on the Pro plan can complete <strong>{level} German in just {minDays} days</strong>. With the free daily limit, it will take you <strong>{limitDays} days</strong> to reach the exact same level!
          </p>
        );
      case 2:
        return (
          <p className={desc}>
            Langey students learn <strong>{level} German 5x faster</strong> on the Pro plan compared to the free version. Don't let daily limits slow down your learning progress!
          </p>
        );
      case 3:
        return (
          <p className={desc}>
            Consistency builds habits. Students who practice without daily limit interruptions show <strong>78% higher commitment</strong> and are <strong>3x more likely to reach fluency</strong> in <strong>{level} German</strong>.
          </p>
        );
      case 4:
        return (
          <p className={desc}>
            Try Langey Pro entirely risk-free. We offer a <strong>14-day money-back guarantee, no questions asked</strong>. If you aren't learning faster, simply let us know for a full refund.
          </p>
        );
      case 5:
        return (
          <p className={desc}>
            Mastering <strong>{level} German</strong> opens doors to career and study opportunities. At just $4.99/month, Langey Pro gives you <strong>unlimited practice</strong> for less than the price of a single cup of coffee.
          </p>
        );
      default:
        return null;
    }
  };

  return ReactDOM.createPortal(
    <>
      <div
        className="gg-credit-block-overlay-animate fixed inset-0 z-[1500] bg-black/32"
        onClick={handleOverlayClick}
        style={{ pointerEvents: 'auto' }}
      />

      <div className="gg-credit-block-sheet-animate fixed inset-x-0 bottom-0 z-[1501] mx-auto box-border flex max-h-[min(85vh,680px)] w-[min(560px,calc(100vw-24px))] flex-col rounded-t-[22px] bg-white px-10 pt-[34px] pb-[calc(28px+env(safe-area-inset-bottom,0px))] text-langey-ink shadow-[0_-18px_60px_rgba(0,0,0,0.18)] max-md:w-full max-md:max-h-[86vh] max-md:rounded-t-[20px] max-md:px-5 max-md:pt-7 max-md:pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-black/[0.06] text-langey-ink transition-[background,transform] duration-200 hover:scale-105 hover:bg-black/12"
          onClick={handleCloseIconClick}
          aria-label="Dismiss limit notification"
        >
          <X size={18} />
        </button>

        <div className="flex w-full flex-col items-center">
          <div className="mb-[22px] flex flex-col items-center gap-2.5 text-center max-md:mb-4 max-md:gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-gray-800">
              <AlertCircle size={14} className="text-gray-600" />
              <span>DID YOU KNOW?</span>
            </div>
            <h2 className="m-0 text-2xl font-extrabold tracking-tight text-black max-md:text-xl">
              Daily Practice Limit Reached
            </h2>
          </div>

          {renderVisualGraphic()}

          <div className="mb-6 w-full text-center max-md:mb-5">
            {renderMessageContent()}
          </div>

          <div className="flex w-full flex-col gap-3 max-md:gap-2.5">
            <button
              type="button"
              className="box-border flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-black bg-black px-6 py-4 text-base font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-gray-800 hover:bg-gray-800 hover:shadow-[0_6px_16px_rgba(0,0,0,0.22)] active:translate-y-px max-md:rounded-[14px] max-md:px-5 max-md:py-3.5 max-md:text-sm"
              onClick={handleUpgradeClick}
            >
              <Zap size={18} className="fill-current" />
              <span>Get Unlimited Usage</span>
            </button>
            <button
              type="button"
              className="box-border flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-base font-bold text-gray-600 shadow-[0_2px_4px_rgba(0,0,0,0.04)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-400 hover:bg-slate-50 hover:text-gray-800 active:bg-slate-200 max-md:rounded-[14px] max-md:px-5 max-md:py-3 max-md:text-sm"
              onClick={handleContinueClick}
            >
              Continue with limits
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
