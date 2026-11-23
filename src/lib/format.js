// Shared number/currency formatting (he-IL, ILS, no fractional digits).
// Replaces ~20 identical inline copies. Missing/NaN-ish input renders as 0.
const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount) {
  return currencyFormatter.format(amount || 0);
}
