// Platform fee model for Paystack payment splits.
//
// The customer pays the ACTUAL amount (item price or shipping cost) — no
// visible surcharge. Behind the scenes the payment is split:
//   • Platform (main Paystack account) keeps a commission of ₦150 + 8.5%.
//   • The merchant subaccount (Raneems) keeps the remainder.
//   • Paystack's own transaction fee is borne by the main account (us), so it
//     comes out of the platform commission — the merchant's share is unaffected.
//
// All amounts here are whole Naira (the app never deals in kobo except right at
// the Paystack boundary, where we multiply by 100).

export const PLATFORM_FEE_FLAT_NAIRA = 150;
export const PLATFORM_FEE_PERCENT = 0.085; // 8.5%

// Minimum shipping fee. Below this the flat ₦150 + 8.5% commission would eat
// most/all of the payment and leave the merchant nothing, so we reject it.
export const MIN_SHIPPING_NAIRA = 500;

export interface FeeBreakdown {
  /** What the customer pays (unchanged — the actual item/shipping amount). */
  totalNaira: number;
  /** Platform commission kept by the main account (₦150 + 8.5%, nearest ₦). */
  platformCommissionNaira: number;
  /** What the merchant subaccount receives (total − commission). */
  merchantAmountNaira: number;
}

/**
 * Platform commission for a given transaction amount: ₦150 + 8.5%, rounded to
 * the nearest whole Naira. Never exceeds the amount itself (guards tiny
 * amounts, though those shouldn't occur in practice).
 */
export function platformCommissionNaira(amountNaira: number): number {
  const raw = PLATFORM_FEE_FLAT_NAIRA + PLATFORM_FEE_PERCENT * amountNaira;
  const commission = Math.round(raw);
  return Math.min(commission, Math.max(0, Math.floor(amountNaira)));
}

/** Full split breakdown for an amount the customer pays. */
export function computeFeeBreakdown(amountNaira: number): FeeBreakdown {
  const platformCommissionNairaValue = platformCommissionNaira(amountNaira);
  return {
    totalNaira: amountNaira,
    platformCommissionNaira: platformCommissionNairaValue,
    merchantAmountNaira: amountNaira - platformCommissionNairaValue,
  };
}

// --- GafiaPay -------------------------------------------------------------
// GafiaPay charges 1% and the split is a flat percentage configured in their
// dashboard. We take a flat 4% platform commission; Raneems keeps 96% (net of
// GafiaPay's 1%, which comes off before the split). The 4% here is recorded
// for our own bookkeeping — the actual split is enforced by GafiaPay.
export const GAFIAPAY_PLATFORM_PERCENT = 0.04; // 4%

export function computeGafiaFeeBreakdown(amountNaira: number): FeeBreakdown {
  const commission = Math.round(GAFIAPAY_PLATFORM_PERCENT * amountNaira);
  return {
    totalNaira: amountNaira,
    platformCommissionNaira: commission,
    merchantAmountNaira: amountNaira - commission,
  };
}
