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
    'quote': 3, 'negotiation': 3,
    'approved': 5,
    'ordering': 10, 'production': 10,
    'installation': 8,
    'completed': 0, 'invoiced': 0
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

/**
 * Analyze project and return alerts to create/update
 */
export function analyzeProjectAlerts(project, financials, settings) {
  const alerts = [];

  // 1. Low profitability
  if (financials.hasApprovedQuote && financials.profit_percent < settings.minimum_profit_percent) {
    alerts.push({
      alert_key: `${project.id}|profitability`,
      project_id: project.id,
      project_name: project.name,
      alert_type: 'profitability',
      severity: financials.profit_percent < 5 ? 'critical' : 'high',
      message: `רווחיות נמוכה: ${financials.profit_percent?.toFixed(1)}% (יעד: ${settings.minimum_profit_percent}%)`,
      details: JSON.stringify({ profit_percent: financials.profit_percent, target: settings.minimum_profit_percent })
    });
  }

  // 2. High debt from client
  if (financials.balance_to_collect > settings.high_debt_threshold) {
    alerts.push({
      alert_key: `${project.id}|collection`,
      project_id: project.id,
      project_name: project.name,
      alert_type: 'collection',
      severity: financials.balance_to_collect > settings.high_debt_threshold * 2 ? 'critical' : 'high',
      message: `חוב גבוה לגבייה: ₪${financials.balance_to_collect.toLocaleString()}`,
      details: JSON.stringify({ balance: financials.balance_to_collect, threshold: settings.high_debt_threshold })
    });
  }

  // 3. Negative cash flow
  if (financials.cash_flow < settings.cash_flow_warning_threshold) {
    alerts.push({
      alert_key: `${project.id}|cash_flow`,
      project_id: project.id,
      project_name: project.name,
      alert_type: 'cash_flow',
      severity: 'critical',
      message: `תזרים מזומנים שלילי: ₪${financials.cash_flow.toLocaleString()}`,
      details: JSON.stringify({ cash_flow: financials.cash_flow, threshold: settings.cash_flow_warning_threshold })
    });
  }

  return alerts;
}

/**
 * Check if alert conditions are resolved and mark as handled
 */
export function shouldResolveAlert(alert, financials, settings, activeProjectsCount) {
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