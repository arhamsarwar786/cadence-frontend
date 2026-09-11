/**
 * Money is always a decimal STRING from the API (ARCHITECTURE.md §2.3/§10)
 * — pay rates, invoice totals, pay-statement totals, YTD. This module only
 * ever touches that string as a string (regex digit-grouping), never
 * Number()/parseFloat() — a rate or amount round-tripped through a JS
 * float is exactly the class of bug the API contract exists to prevent.
 * Display only. No arithmetic lives here or anywhere in the client.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  CAD: "$",
  USD: "US$",
};

export function formatMoney(value: string | null | undefined, currency = "CAD"): string {
  if (value == null || value === "") return "—";
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, decimalPart = ""] = unsigned.split(".");
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = decimalPart.padEnd(2, "0").slice(0, 2);
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  return `${negative ? "-" : ""}${symbol}${grouped}.${cents}`;
}
