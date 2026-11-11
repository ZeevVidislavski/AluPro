import { calculateProjectFinancials } from "./projectFinancials";

/**
 * Calculate dynamic base metrics for all active projects
 */
export function calculateBaseMetrics(activeProjects, allQuotes, allPayments, allOrders) {
  if (activeProjects.length === 0) {
    return { avgTotalSale: 0, avgProfitPercent: 0, maxBalanceToCollect: 0, maxTotalSale: 0 };
  }

  const projectsData = activeProjects.map(p => {
    const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments, allOrders });
    return { project: p, financials };
  });

  const avgTotalSale = projectsData.reduce((sum, p) => sum + p.financials.total_sale, 0) / projectsData.length;
  const avgProfitPercent = projectsData.reduce((sum, p) => sum + (p.financials.profit_percent || 0), 0) / projectsData.length;
  const maxBalanceToCollect = Math.max(...projectsData.map(p => p.financials.balance_to_collect), 0);
  const maxTotalSale = Math.max(...projectsData.map(p => p.financials.total_sale), 0);

  return { avgTotalSale, avgProfitPercent, maxBalanceToCollect, maxTotalSale };
}

/**
 * Calculate dynamic priority score for a project
 */
export function calculateProjectPriorityScore(project, customer, financials, alerts, settings, baseMetrics) {
  let score = 0;

  // 1. Profitability Score (0-30)
  if (financials.profit_percent !== null && financials.profit_percent >= 0 && baseMetrics.avgProfitPercent > 0) {
    const ratio = financials.profit_percent / baseMetrics.avgProfitPercent;
    if (ratio >= 1.5) score += 30;
    else if (ratio >= 1.0) score += 15 + (ratio - 1) * 30;
    else if (ratio >= 0.5) score += ratio * 15;
    else score += ratio * 7.5;
  }

  // 2. Size Score (0-25)
  if (baseMetrics.avgTotalSale > 0) {
    const ratio = financials.total_sale / baseMetrics.avgTotalSale;
    if (ratio >= 2.0) score += 25;
    else if (ratio >= 1.0) score += 12.5 + (ratio - 1) * 12.5;
    else if (ratio >= 0.5) score += ratio * 12.5;
    else score += ratio * 6.25;
  }

  // 3. Urgency Score (0-20)
  if (baseMetrics.maxBalanceToCollect > 0) {
    const ratio = financials.balance_to_collect / baseMetrics.maxBalanceToCollect;
    score += ratio * 20;
  }

  // 4. Customer Score (0-20)
  const customer_score = customer?.customer_type === 'contractor'
    ? Math.min(15 * settings.contractor_priority_weight, 20)
    : 7.5;
  score += customer_score;

  // 5. Status Score (0-10)
  const statusScores = {
    'draft': 3,
    'approved': 8,
    'completed': 0
  };
  score += statusScores[project.status] || 0;

  // 6. Risk Penalty (0 to -25)
  let risk_penalty = 0;
  
  const criticalAlerts = alerts.filter(a => 
    a.project_id === project.id && a.severity === 'critical' && !a.is_handled
  );
  risk_penalty += criticalAlerts.length * 10;

  const highAlerts = alerts.filter(a => 
    a.project_id === project.id && a.severity === 'high' && !a.is_handled
  );
  risk_penalty += highAlerts.length * 5;

  if (project.target_date && new Date(project.target_date) < new Date()) {
    const daysOverdue = Math.floor(
      (new Date() - new Date(project.target_date)) / (1000 * 60 * 60 * 24)
    );
    risk_penalty += Math.min(daysOverdue * 0.5, 10);
  }

  risk_penalty = Math.min(risk_penalty, 25);
  score -= risk_penalty;

  return Math.max(0, score);
}

// Defaults for the time-based rules. A tenant can override any of them by
// adding the same key to its agent settings (no UI/DB column for that yet).
export const AGENT_RULES = {
  deposit_missing_days: 7,
  payment_stalled_days: 30,
  stale_draft_quote_days: 14,
  deadline_warning_days: 7
};

const DAY_MS = 1000 * 60 * 60 * 24;
const daysSince = (date, now) => (date ? Math.floor((now - new Date(date)) / DAY_MS) : null);
const SEVERITY_SCORE = { critical: 90, high: 70, medium: 45, low: 20 };

// alert_key = `${project_id}|${rule}`: the key is what stops a rule from
// creating a duplicate alert on every run, and what resolves it once the rule
// stops firing. The first three rules keep their original keys.
function makeAlert(project, rule, alert_type, severity, message, details, action_type) {
  return {
    alert_key: `${project.id}|${rule}`,
    project_id: project.id,
    project_name: project.name,
    alert_type,
    severity,
    message,
    details: JSON.stringify(details),
    priority_score: SEVERITY_SCORE[severity],
    action_type,
    action_link: `/ProjectDetails?id=${project.id}`
  };
}

/**
 * Analyze project and return the alerts that currently apply to it.
 * `data` = { allQuotes, allPayments, allOrders, now } — the time-based rules
 * need the raw rows (dates), not just the aggregated financials.
 */
export function analyzeProjectAlerts(project, financials, settings, data = {}) {
  const alerts = [];
  const now = data.now ? new Date(data.now) : new Date();
  const rule = (key) => settings[key] ?? AGENT_RULES[key];
  const quotes = (data.allQuotes || []).filter(q => q.project_id === project.id);
  const payments = (data.allPayments || []).filter(p => p.project_id === project.id);
  const orders = (data.allOrders || []).filter(o => o.project_id === project.id);

  // 1. Low profitability
  if (financials.hasApprovedQuote && financials.profit_percent < settings.minimum_profit_percent) {
    alerts.push(makeAlert(project, 'profitability', 'profitability',
      financials.profit_percent < 5 ? 'critical' : 'high',
      `רווחיות נמוכה: ${financials.profit_percent?.toFixed(1)}% (יעד: ${settings.minimum_profit_percent}%)`,
      { profit_percent: financials.profit_percent, target: settings.minimum_profit_percent },
      'fix_profit'));
  }

  // 2. High debt from client
  if (financials.balance_to_collect > settings.high_debt_threshold) {
    alerts.push(makeAlert(project, 'collection', 'collection',
      financials.balance_to_collect > settings.high_debt_threshold * 2 ? 'critical' : 'high',
      `חוב גבוה לגבייה: ₪${financials.balance_to_collect.toLocaleString()}`,
      { balance: financials.balance_to_collect, threshold: settings.high_debt_threshold },
      'collect'));
  }

  // 3. Negative cash flow
  if (financials.cash_flow < settings.cash_flow_warning_threshold) {
    alerts.push(makeAlert(project, 'cash_flow', 'cash_flow', 'critical',
      `תזרים מזומנים שלילי: ₪${financials.cash_flow.toLocaleString()}`,
      { cash_flow: financials.cash_flow, threshold: settings.cash_flow_warning_threshold },
      'supplier_payment'));
  }

  // 4. Deposit missing: a quote was approved a while ago and nothing was paid.
  if (financials.hasApprovedQuote && financials.total_sale > 0 && financials.total_received === 0) {
    const approvedDates = quotes
      .filter(q => q.status === 'approved')
      .map(q => q.updated_at || q.created_at)
      .filter(Boolean)
      .sort();
    const days = daysSince(approvedDates[0], now);
    if (days !== null && days > rule('deposit_missing_days')) {
      alerts.push(makeAlert(project, 'deposit_missing', 'collection',
        days > rule('deposit_missing_days') * 3 ? 'high' : 'medium',
        `הצעה אושרה לפני ${days} ימים ולא התקבלה מקדמה`,
        { days, total_sale: financials.total_sale },
        'collect'));
    }
  }

  // 5. Payments stalled: some money came in, a balance remains, and the last
  // payment is old.
  if (financials.total_received > 0 && financials.balance_to_collect > 0) {
    const lastPayment = payments.map(p => p.payment_date).filter(Boolean).sort().pop();
    const days = daysSince(lastPayment, now);
    if (days !== null && days > rule('payment_stalled_days')) {
      alerts.push(makeAlert(project, 'payment_stalled', 'collection', 'medium',
        `לא התקבל תשלום ${days} ימים, יתרה לגבייה: ₪${financials.balance_to_collect.toLocaleString()}`,
        { days, balance: financials.balance_to_collect },
        'collect'));
    }
  }

  // 6. Deadline close (or passed) and no supplier order was placed.
  if (financials.hasApprovedQuote && project.target_date && orders.length === 0) {
    const daysLeft = -daysSince(project.target_date, now);
    if (daysLeft <= rule('deadline_warning_days')) {
      alerts.push(makeAlert(project, 'deadline_no_orders', 'strategic',
        daysLeft < 0 ? 'high' : 'medium',
        daysLeft < 0
          ? `תאריך היעד עבר לפני ${-daysLeft} ימים ואין הזמנות ספקים`
          : `נשארו ${daysLeft} ימים ליעד ואין הזמנות ספקים`,
        { days_left: daysLeft },
        'order_material'));
    }
  }

  // 7. Draft quotes left open for too long.
  const staleDrafts = quotes.filter(q => q.status === 'draft' && daysSince(q.created_at, now) > rule('stale_draft_quote_days'));
  if (staleDrafts.length > 0) {
    const oldest = Math.max(...staleDrafts.map(q => daysSince(q.created_at, now)));
    alerts.push(makeAlert(project, 'stale_draft_quote', 'strategic', 'low',
      `${staleDrafts.length} הצעות בטיוטה פתוחות עד ${oldest} ימים`,
      { count: staleDrafts.length, oldest_days: oldest },
      'follow_up'));
  }

  return alerts;
}

/**
 * Check if alert conditions are resolved and mark as handled.
 * With `activeKeys` (the alert_keys that currently apply to the project) an
 * alert is resolved as soon as its rule stops firing; without it, the
 * original per-type checks are used.
 */
export function shouldResolveAlert(alert, financials, settings, activeProjectsCount, activeKeys) {
  if (activeKeys && alert.project_id) {
    return !activeKeys.has(alert.alert_key);
  }

  switch (alert.alert_type) {
    case 'profitability':
      return financials.profit_percent >= settings.minimum_profit_percent;

    case 'collection':
      return financials.balance_to_collect < settings.high_debt_threshold;

    case 'cash_flow':
      return financials.cash_flow >= settings.cash_flow_warning_threshold;

    case 'workload':
      return activeProjectsCount < settings.max_open_projects;

    default:
      return false;
  }
}
