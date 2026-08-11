import React from 'react';
import { LimitMessageText } from './credits/LimitMessageText';

interface CreditLimitBlockProps {
  message: string;
}

/**
 * Standard daily-limit blocked screen used by all practice features.
 * Fills the main content area with centered message + Upgrade to Pro button.
 * Hook class `gg-credit-limit-block` kept for parent selectors in migrated modules.
 */
export const CreditLimitBlock: React.FC<CreditLimitBlockProps> = ({ message }) => (
  <div
    className="gg-credit-limit-block box-border flex h-full min-h-70 w-full items-center justify-center px-6 py-8 text-center"
    role="status"
    aria-live="polite"
  >
    <div className="gg-credit-limit-block-inner flex w-full max-w-105 flex-col items-center justify-center">
      <LimitMessageText message={message} />
    </div>
  </div>
);
