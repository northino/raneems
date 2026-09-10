export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Normalizes a Nigerian phone number to the digits-only international
 * format wa.me requires (e.g. "0803 123 4567" -> "2348031234567").
 * Numbers already in another country's international format (not
 * starting with 0) are passed through digit-stripped, unchanged.
 */
function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

/** Builds a wa.me link with a pre-filled message. Real, functional — no backend needed. */
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`;
}
