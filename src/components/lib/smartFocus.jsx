import { calculateProjectFinancials } from "./projectFinancials";

/**
 * Smart Focus Engine
 * Generates a prioritized list of business tasks based on real project data.
 * This is a DECISION ENGINE — not an alert system.
 * Each task tells the user WHAT TO DO NOW, not just what's wrong.
 */

/**
 * Calculate days since last update for a project
 */
function daysSinceUpdate(project) {
  const lastUpdate = project.updated_date || project.created_date;
  if (!lastUpdate) return 0;
  return Math.floor((new Date() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24));
}

/**
 * Determine urgency level from score
 */
function scoreToUrgency(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);

/**
 * Generate Smart Focus tasks for all active projects
 * @param {Array} projects
 * @param {Object} financialsData - { allQuotes, allPayments, allOrders }
 * @param {Array} existingAlerts
 * @param {Array} customers
 * @param {Object} settings
 * @returns {Array} sorted tasks by priority_score desc
 */
export function generateSmartFocusTasks(projects, { allQuotes, allPayments, allOrders }, existingAlerts, customers, settings) {
  const currentSettings = settings || {};
  const minProfit = currentSettings.minimum_profit_percent ?? 15;
  const contractorWeight = currentSettings.contractor_priority_weight ?? 1.5;

  const activeProjects = projects.filter(p => !['completed', 'invoiced'].includes(p.status));
  const tasks = [];

  for (const project of activeProjects) {
    const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
    const customer = customers.find(c => c.id === project.customer_id);
    const isContractor = customer?.customer_type === 'contractor';
    const days = daysSinceUpdate(project);

    // Active alerts for this project
    const projectAlerts = existingAlerts.filter(a => a.project_id === project.id && !a.is_handled);
    const hasCritical = projectAlerts.some(a => a.severity === 'critical');
    const hasHigh = projectAlerts.some(a => a.severity === 'high');
    const alertBonus = hasCritical ? 15 : hasHigh ? 10 : 0;

    // ── TASK 1: Collection ──
    if (financials.balance_to_collect > 0 && financials.total_sale > 0) {
      const collectionRatio = financials.balance_to_collect / financials.total_sale;
      let score = 0;

      // Money weight (0-40)
      score += Math.min(collectionRatio * 40, 40);

      // Profitability weight (0-25): low profit + outstanding = urgent
      if (financials.profit_percent !== null && financials.profit_percent < minProfit) {
        score += Math.min((minProfit - financials.profit_percent) * 2, 25);
      }

      // Alert bonus (0-15)
      score += alertBonus;

      // Inactivity bonus (0-15)
      if (days >= 7) score += 15;
      else if (days >= 3) score += 10;

      // Contractor multiplier
      if (isContractor) score = Math.min(score * contractorWeight, 100);

      score = Math.min(Math.round(score), 100);

      tasks.push({
        id: `smartfocus|${project.id}|collect`,
        project_id: project.id,
        project_name: project.name,
        customer_name: project.customer_name,
        action_type: "collect",
        message: `לגבות תשלום מ${project.customer_name}`,
        reason: `יתרת גבייה פתוחה${financials.profit_percent !== null && financials.profit_percent < minProfit ? ` + רווחיות נמוכה (${financials.profit_percent?.toFixed(1)}%)` : ''}${isContractor ? ' + לקוח קבלן' : ''}`,
        impact_value: financials.balance_to_collect,
        impact_label: formatCurrency(financials.balance_to_collect),
        priority_score: score,
        urgency_level: scoreToUrgency(score)
      });
    }

    // ── TASK 2: Fix Profitability ──
    if (financials.hasApprovedQuote && financials.profit_percent !== null && financials.profit_percent < minProfit) {
      let score = 0;

      // Gap from minimum (0-25)
      score += Math.min((minProfit - financials.profit_percent) * 2, 25);

      // Project size bonus — bigger project = more urgent
      if (financials.total_sale > 0) {
        score += Math.min((financials.total_sale / 100000) * 15, 20);
      }

      // Alert bonus
      score += alertBonus;

      if (days >= 7) score += 15;
      else if (days >= 3) score += 10;

      if (isContractor) score = Math.min(score * contractorWeight, 100);

      score = Math.min(Math.round(score), 100);

      tasks.push({
        id: `smartfocus|${project.id}|fix_profit`,
        project_id: project.id,
        project_name: project.name,
        customer_name: project.customer_name,
        action_type: "fix_profit",
        message: `בדוק רווחיות — ${financials.profit_percent?.toFixed(1)}% בלבד`,
        reason: `רווחיות מתחת לסף ${minProfit}%${financials.total_costs > 0 ? `, עלויות: ${formatCurrency(financials.total_costs)}` : ''}`,
        impact_value: financials.total_sale,
        impact_label: `פרויקט ${formatCurrency(financials.total_sale)}`,
        priority_score: score,
        urgency_level: scoreToUrgency(score)
      });
    }

    // ── TASK 3: Supplier Payment ──
    if (financials.balance_to_suppliers > 0) {
      let score = 0;

      // Supplier debt vs total costs ratio (0-30)
      if (financials.total_costs > 0) {
        score += Math.min((financials.balance_to_suppliers / financials.total_costs) * 30, 30);
      }

      // Cash flow positive = can pay
      if (financials.cash_flow > 0) score += 10;

      score += alertBonus;

      if (days >= 7) score += 10;
      else if (days >= 3) score += 5;

      score = Math.min(Math.round(score), 100);

      tasks.push({
        id: `smartfocus|${project.id}|supplier_payment`,
        project_id: project.id,
        project_name: project.name,
        customer_name: project.customer_name,
        action_type: "supplier_payment",
        message: `שלם ספקים — יתרה פתוחה`,
        reason: `${formatCurrency(financials.balance_to_suppliers)} ממתינים לתשלום לספקים`,
        impact_value: financials.balance_to_suppliers,
        impact_label: formatCurrency(financials.balance_to_suppliers),
        priority_score: score,
        urgency_level: scoreToUrgency(score)
      });
    }

    // ── TASK 4: Follow Up (inactive project) ──
    if (days >= 7) {
      let score = 0;

      // Inactivity urgency (0-30)
      if (days >= 14) score += 30;
      else if (days >= 7) score += 20;

      // Has outstanding collection = more urgent
      if (financials.balance_to_collect > 0) {
        score += Math.min((financials.balance_to_collect / (financials.total_sale || 1)) * 20, 20);
      }

      score += alertBonus;

      if (isContractor) score = Math.min(score * contractorWeight, 100);

      score = Math.min(Math.round(score), 100);

      tasks.push({
        id: `smartfocus|${project.id}|follow_up`,
        project_id: project.id,
        project_name: project.name,
        customer_name: project.customer_name,
        action_type: "follow_up",
        message: `מעקב — אין עדכון ${days} ימים`,
        reason: `הפרויקט תקוע${financials.balance_to_collect > 0 ? ` + ${formatCurrency(financials.balance_to_collect)} פתוח לגבייה` : ''}`,
        impact_value: financials.balance_to_collect || 0,
        impact_label: days >= 14 ? `${days} ימים ללא עדכון` : `${days} ימים`,
        priority_score: score,
        urgency_level: scoreToUrgency(score)
      });
    }
  }

  // Sort by priority_score descending, remove duplicates per project (keep highest)
  tasks.sort((a, b) => b.priority_score - a.priority_score);

  return tasks;
}

/**
 * Calculate daily summary from tasks and financials
 */
export function calculateDailySummary(tasks, projects, { allQuotes, allPayments, allOrders }, existingAlerts) {
  const totalToCollect = tasks
    .filter(t => t.action_type === 'collect')
    .reduce((sum, t) => sum + (t.impact_value || 0), 0);

  const criticalAlerts = existingAlerts.filter(a => a.severity === 'critical' && !a.is_handled).length;

  const uniqueProjects = new Set(tasks.filter(t => t.urgency_level !== 'low').map(t => t.project_id));

  const topTask = tasks[0] || null;

  return {
    totalToCollect,
    criticalAlerts,
    projectsNeedingAttention: uniqueProjects.size,
    topTask
  };
}