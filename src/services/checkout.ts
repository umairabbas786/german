export const CHECKOUT_PLAN_OPTIONS = {
  BOTH: 'both',
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const;

export type CheckoutPlanOption = typeof CHECKOUT_PLAN_OPTIONS[keyof typeof CHECKOUT_PLAN_OPTIONS];

interface CreateCheckoutLinkArgs {
  planOption: CheckoutPlanOption;
  consumerId: string;
  email: string;
  paidFromOnboarding?: boolean;
}

const CHECKOUT_LINK = import.meta.env.VITE_CHECKOUT_LINK || '';
const MONTHLY_VARIANT_ID = import.meta.env.VITE_MONTHLY_VARIANT_ID || '';
const ANNUAL_VARIANT_ID = import.meta.env.VITE_ANNUAL_VARIANT_ID || '';
const MONTHLY_ENABLED_VARIANT_ID = import.meta.env.VITE_LEMON_SQUEEZY_MONTHLY_VARIANT_ID || '';
const ANNUAL_ENABLED_VARIANT_ID = import.meta.env.VITE_LEMON_SQUEEZY_ANNUAL_VARIANT_ID || '';

function getCheckoutVariantId(planOption: CheckoutPlanOption): string {
  return planOption === CHECKOUT_PLAN_OPTIONS.ANNUAL ? ANNUAL_VARIANT_ID : MONTHLY_VARIANT_ID;
}

function getEnabledVariantIds(planOption: CheckoutPlanOption): string[] {
  if (planOption === CHECKOUT_PLAN_OPTIONS.MONTHLY) return [MONTHLY_ENABLED_VARIANT_ID];
  if (planOption === CHECKOUT_PLAN_OPTIONS.ANNUAL) return [ANNUAL_ENABLED_VARIANT_ID];
  return [MONTHLY_ENABLED_VARIANT_ID, ANNUAL_ENABLED_VARIANT_ID];
}

export function createCheckoutLink({ planOption, consumerId, email, paidFromOnboarding = false }: CreateCheckoutLinkArgs): string | null {
  const checkoutVariantId = getCheckoutVariantId(planOption);
  const enabledVariantIds = getEnabledVariantIds(planOption).filter(Boolean);

  if (!CHECKOUT_LINK || !checkoutVariantId || enabledVariantIds.length === 0) {
    return null;
  }

  const checkoutUrl = new URL(CHECKOUT_LINK);
  checkoutUrl.pathname = `/checkout/buy/${checkoutVariantId}`;
  checkoutUrl.searchParams.set('enabled', enabledVariantIds.join(','));
  checkoutUrl.searchParams.set('checkout[custom][consumer_id]', consumerId);
  checkoutUrl.searchParams.set('checkout[custom][paid_from_onboarding]', String(paidFromOnboarding));
  checkoutUrl.searchParams.set('checkout[email]', email);
  return checkoutUrl.toString();
}
