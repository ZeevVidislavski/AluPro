import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../format';

// The previous inline implementation, kept here to prove the shared one is identical.
const legacy = (amount) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);

describe('formatCurrency', () => {
  it.each([0, 1, 99.5, 1234, 56876.4, 1000000, -250, -0.4, 7130.01])('matches the legacy output for %s', (n) => {
    expect(formatCurrency(n)).toBe(legacy(n));
  });

  it('renders missing values as 0', () => {
    expect(formatCurrency(undefined)).toBe(legacy(0));
    expect(formatCurrency(null)).toBe(legacy(0));
    expect(formatCurrency(NaN)).toBe(legacy(0));
  });

  it('rounds to whole shekels', () => {
    expect(formatCurrency(1234.56)).toBe(legacy(1235));
  });
});
