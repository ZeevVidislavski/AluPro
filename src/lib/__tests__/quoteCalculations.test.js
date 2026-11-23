import { describe, it, expect } from 'vitest';
import {
  calcComponentValue,
  calcItemTotal,
  calcQuoteTotals,
  generateDescription,
} from '../quoteCalculations';

// Characterization tests: they pin the CURRENT behavior of the quote math so
// the UI redesign can be verified not to change any amount.

const comp = (method, price, quantity) => ({
  pricing_method_snapshot: method,
  price_snapshot: price,
  quantity,
  name_snapshot: method,
});

describe('calcComponentValue', () => {
  it('prices per sqm using width x height in cm', () => {
    // 120 x 210 cm = 2.52 sqm, 200 per sqm
    expect(calcComponentValue(comp('sqm', 200, 1), 120, 210, 1)).toBeCloseTo(504, 6);
  });

  it('prices per running meter of width (meter and meter_width are the same)', () => {
    expect(calcComponentValue(comp('meter', 80, 1), 120, 210, 1)).toBeCloseTo(96, 6);
    expect(calcComponentValue(comp('meter_width', 80, 1), 120, 210, 1)).toBeCloseTo(96, 6);
  });

  it('prices per running meter of height', () => {
    expect(calcComponentValue(comp('meter_height', 80, 1), 120, 210, 1)).toBeCloseTo(168, 6);
  });

  it('prices per unit regardless of size', () => {
    expect(calcComponentValue(comp('unit', 140, 1), 120, 210, 1)).toBe(140);
  });

  it('multiplies by component quantity and item quantity', () => {
    expect(calcComponentValue(comp('unit', 100, 3), 0, 0, 2)).toBe(600);
  });

  it('treats a missing component quantity as 1', () => {
    expect(calcComponentValue(comp('unit', 100, undefined), 0, 0, 1)).toBe(100);
    expect(calcComponentValue(comp('unit', 100, null), 0, 0, 1)).toBe(100);
    expect(calcComponentValue(comp('unit', 100, ''), 0, 0, 1)).toBe(100);
  });

  it('keeps an explicit component quantity of 0 (price becomes 0)', () => {
    expect(calcComponentValue(comp('unit', 100, 0), 0, 0, 1)).toBe(0);
  });

  it('treats an invalid or zero item quantity as 1', () => {
    expect(calcComponentValue(comp('unit', 100, 1), 0, 0, 0)).toBe(100);
    expect(calcComponentValue(comp('unit', 100, 1), 0, 0, 'abc')).toBe(100);
  });

  it('returns 0 for an unknown pricing method', () => {
    expect(calcComponentValue(comp('weird', 100, 1), 100, 100, 1)).toBe(0);
  });

  it('treats empty or non-numeric size and price as 0', () => {
    expect(calcComponentValue(comp('sqm', 200, 1), '', '', 1)).toBe(0);
    expect(calcComponentValue(comp('unit', 'x', 1), 0, 0, 1)).toBe(0);
  });

  it('accepts numeric strings (values typed in inputs)', () => {
    expect(calcComponentValue(comp('sqm', '200', '1'), '120', '210', '1')).toBeCloseTo(504, 6);
  });
});

describe('calcItemTotal', () => {
  it('sums all components', () => {
    const comps = [comp('meter', 80, 1), comp('sqm', 200, 1), comp('unit', 140, 1)];
    // 96 + 504 + 140
    expect(calcItemTotal(comps, 120, 210, 1)).toBeCloseTo(740, 6);
  });

  it('applies the item quantity to every component', () => {
    const comps = [comp('unit', 100, 1), comp('unit', 50, 1)];
    expect(calcItemTotal(comps, 0, 0, 3)).toBe(450);
  });

  it('returns 0 for no components', () => {
    expect(calcItemTotal([], 100, 100, 1)).toBe(0);
  });
});

describe('calcQuoteTotals', () => {
  const items = [
    { id: 'a', width_cm: 120, height_cm: 210, quantity: 2 },
    { _tempId: 'tmp1', width_cm: 0, height_cm: 0, quantity: 1 },
  ];
  const map = {
    a: [comp('unit', 1230.2, 1)],
    tmp1: [comp('unit', 3900, 1)],
  };

  it('computes lines, discount, VAT and total (matches the design mockup)', () => {
    const t = calcQuoteTotals(items, map, 5, 18);
    expect(t.linesTotal).toBeCloseTo(6360.4, 6);
    expect(t.subtotal).toBeCloseTo(6042.38, 6);
    expect(t.vatAmount).toBeCloseTo(1087.6284, 4);
    expect(t.totalWithVat).toBeCloseTo(7130.0084, 4);
  });

  it('finds components by _tempId for unsaved items', () => {
    const t = calcQuoteTotals([items[1]], map, 0, 18);
    expect(t.linesTotal).toBe(3900);
  });

  it('treats a missing components entry as no components', () => {
    const t = calcQuoteTotals([{ id: 'zzz', quantity: 1 }], {}, 0, 18);
    expect(t.linesTotal).toBe(0);
    expect(t.totalWithVat).toBe(0);
  });

  it('treats a missing item quantity as 1', () => {
    const t = calcQuoteTotals([{ id: 'q', width_cm: 0, height_cm: 0 }], { q: [comp('unit', 100, 1)] }, 0, 18);
    expect(t.linesTotal).toBe(100);
  });

  it('returns zeros for an empty quote', () => {
    const t = calcQuoteTotals([], {}, 0, 18);
    expect(t).toEqual({ linesTotal: 0, subtotal: 0, vatAmount: 0, totalWithVat: 0 });
  });

  it('treats empty discount as 0', () => {
    const t = calcQuoteTotals(items, map, '', 18);
    expect(t.subtotal).toBeCloseTo(t.linesTotal, 6);
  });

  // KNOWN QUIRK, documented only (see DESIGN_SYSTEM_PROPOSAL section 10.5):
  // a VAT of 0, empty or missing falls back to 17, so a quote cannot be priced
  // without VAT in the editor. Not changed in the UI redesign.
  it('falls back to 17% when VAT is 0, empty or missing (current behavior)', () => {
    const base = [{ id: 'v', width_cm: 0, height_cm: 0, quantity: 1 }];
    const m = { v: [comp('unit', 1000, 1)] };
    expect(calcQuoteTotals(base, m, 0, 0).vatAmount).toBeCloseTo(170, 6);
    expect(calcQuoteTotals(base, m, 0, '').vatAmount).toBeCloseTo(170, 6);
    expect(calcQuoteTotals(base, m, 0, undefined).vatAmount).toBeCloseTo(170, 6);
  });

  it('does not clamp a discount above 100% (current behavior)', () => {
    const base = [{ id: 'd', quantity: 1 }];
    const m = { d: [comp('unit', 1000, 1)] };
    expect(calcQuoteTotals(base, m, 120, 18).subtotal).toBeCloseTo(-200, 6);
  });
});

describe('generateDescription', () => {
  it('joins component names with " + " in order', () => {
    expect(generateDescription([{ name_snapshot: 'א' }, { name_snapshot: 'ב' }])).toBe('א + ב');
  });
  it('returns an empty string for no components', () => {
    expect(generateDescription([])).toBe('');
  });
});
