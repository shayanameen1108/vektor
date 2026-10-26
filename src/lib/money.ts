/** Canonical ZAR money formatting — one formatter for UI, emails and admin. */
export function formatRand(amount: number, fractionDigits = 2): string {
  return `R${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
