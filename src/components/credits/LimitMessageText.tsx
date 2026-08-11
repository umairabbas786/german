import { useNavigate } from 'react-router-dom';
import { CHECKOUT_PLAN_OPTIONS, createCheckoutLink } from '../../services/checkout';
import { UserTracker } from '../../utils/userTracking';

interface LimitMessageTextProps {
  message: string;
  /** Show the Upgrade to Pro button (main blocked area). Hint bars should pass false. */
  showButton?: boolean;
}

export function LimitMessageText({ message, showButton = true }: LimitMessageTextProps) {
  const navigate = useNavigate();

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

  return (
    <div className="gg-limit-message flex w-full flex-col items-center gap-4 text-center">
      <p className="gg-limit-message-text m-0 text-base font-normal leading-normal text-[#333] opacity-85">
        {message}
      </p>
      {showButton && (
        <button
          type="button"
          className="gg-limit-upgrade-btn cursor-pointer self-center rounded-[30px] border-none bg-black px-7.5 py-3.5 text-base font-semibold text-white transition-[opacity,transform] duration-150 ease-in-out hover:opacity-90 active:scale-[0.98]"
          onClick={handleUpgradeClick}
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
