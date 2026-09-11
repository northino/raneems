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
