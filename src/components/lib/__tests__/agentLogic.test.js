import { describe, it, expect } from 'vitest';
import { analyzeProjectAlerts, shouldResolveAlert } from '../agentLogic';
import { calculateProjectFinancials } from '../projectFinancials';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const dayStr = (n) => daysAgo(n).split('T')[0];

const settings = {
  minimum_profit_percent: 15,
  cash_flow_warning_threshold: -50000,
  high_debt_threshold: 100000,
  max_open_projects: 10,
};

const project = { id: 'p1', name: 'פרויקט', status: 'approved', target_date: null };

const approvedQuote = (over = {}) => ({
  id: 'q1', project_id: 'p1', status: 'approved', addition_number: 0,
  amount: 50000, created_at: daysAgo(30), updated_at: daysAgo(10), ...over,
});

function run(data, proj = project) {
  const full = { allQuotes: [], allPayments: [], allOrders: [], now: NOW, ...data };
  const financials = calculateProjectFinancials(proj.id, full);
  return analyzeProjectAlerts(proj, financials, settings, full);
}
const keys = (alerts) => alerts.map(a => a.alert_key).sort();

describe('analyzeProjectAlerts — time based rules', () => {
  it('deposit_missing: approved for more than 7 days and nothing paid', () => {
    const alerts = run({ allQuotes: [approvedQuote()] });
    const a = alerts.find(x => x.alert_key === 'p1|deposit_missing');
    expect(a).toBeTruthy();
    expect(a.alert_type).toBe('collection');
    expect(a.action_type).toBe('collect');
    expect(a.action_link).toBe('/ProjectDetails?id=p1');
  });

  it('deposit_missing: not raised for a recently approved quote or once a payment exists', () => {
    expect(keys(run({ allQuotes: [approvedQuote({ updated_at: daysAgo(3) })] }))).not.toContain('p1|deposit_missing');
    expect(keys(run({
      allQuotes: [approvedQuote()],
      allPayments: [{ project_id: 'p1', amount: 5000, payment_date: dayStr(2) }],
    }))).not.toContain('p1|deposit_missing');
  });

  it('payment_stalled: balance remains and the last payment is older than 30 days', () => {
    const alerts = run({
      allQuotes: [approvedQuote()],
      allPayments: [{ project_id: 'p1', amount: 5000, payment_date: dayStr(45) }],
    });
    expect(keys(alerts)).toContain('p1|payment_stalled');
  });

  it('payment_stalled: not raised when the last payment is recent', () => {
    const alerts = run({
      allQuotes: [approvedQuote()],
      allPayments: [{ project_id: 'p1', amount: 5000, payment_date: dayStr(5) }],
    });
    expect(keys(alerts)).not.toContain('p1|payment_stalled');
  });

  it('deadline_no_orders: deadline within 7 days (or passed) with no supplier orders', () => {
    const soon = run({ allQuotes: [approvedQuote()] }, { ...project, target_date: dayStr(-3) });
    expect(soon.find(a => a.alert_key === 'p1|deadline_no_orders').severity).toBe('medium');
    const late = run({ allQuotes: [approvedQuote()] }, { ...project, target_date: dayStr(4) });
    expect(late.find(a => a.alert_key === 'p1|deadline_no_orders').severity).toBe('high');
  });

  it('deadline_no_orders: not raised when an order exists or the deadline is far', () => {
    const withOrder = run(
      { allQuotes: [approvedQuote()], allOrders: [{ project_id: 'p1', order_amount: 1000, paid_amount: 0 }] },
      { ...project, target_date: dayStr(-3) }
    );
    expect(keys(withOrder)).not.toContain('p1|deadline_no_orders');
    const far = run({ allQuotes: [approvedQuote()] }, { ...project, target_date: dayStr(-60) });
    expect(keys(far)).not.toContain('p1|deadline_no_orders');
  });

  it('stale_draft_quote: draft quote open for more than 14 days', () => {
    const alerts = run({ allQuotes: [{ id: 'q2', project_id: 'p1', status: 'draft', created_at: daysAgo(20) }] });
    const a = alerts.find(x => x.alert_key === 'p1|stale_draft_quote');
    expect(a).toBeTruthy();
    expect(a.alert_type).toBe('strategic');
    expect(keys(run({ allQuotes: [{ id: 'q2', project_id: 'p1', status: 'draft', created_at: daysAgo(5) }] })))
      .not.toContain('p1|stale_draft_quote');
  });

  it('a tenant can override a threshold through its settings', () => {
    const full = { allQuotes: [approvedQuote({ updated_at: daysAgo(3) })], allPayments: [], allOrders: [], now: NOW };
    const financials = calculateProjectFinancials('p1', full);
    const alerts = analyzeProjectAlerts(project, financials, { ...settings, deposit_missing_days: 2 }, full);
    expect(keys(alerts)).toContain('p1|deposit_missing');
  });

  it('every alert carries the fields the agent_alerts table accepts', () => {
    const alerts = run({ allQuotes: [approvedQuote()] });
    const types = ['profitability', 'collection', 'cash_flow', 'workload', 'strategic'];
    const actions = ['collect', 'follow_up', 'fix_profit', 'order_material', 'supplier_payment', 'general'];
    for (const a of alerts) {
      expect(types).toContain(a.alert_type);
      expect(actions).toContain(a.action_type);
      expect(typeof a.priority_score).toBe('number');
      expect(() => JSON.parse(a.details)).not.toThrow();
    }
  });
});

describe('shouldResolveAlert', () => {
  it('resolves an alert whose rule no longer fires, keeps one that still does', () => {
    const alert = { alert_key: 'p1|deposit_missing', alert_type: 'collection', project_id: 'p1' };
    expect(shouldResolveAlert(alert, {}, settings, 1, new Set())).toBe(true);
    expect(shouldResolveAlert(alert, {}, settings, 1, new Set(['p1|deposit_missing']))).toBe(false);
  });

  it('keeps the original per-type behaviour when no activeKeys are given (workload)', () => {
    const alert = { alert_key: 'global|workload', alert_type: 'workload' };
    expect(shouldResolveAlert(alert, {}, settings, 3)).toBe(true);
    expect(shouldResolveAlert(alert, {}, settings, 12)).toBe(false);
  });
});
