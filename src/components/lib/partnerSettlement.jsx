import { calculateProjectFinancials } from "./projectFinancials";

/**
 * calculateFullPartnerSettlement
 *
 * Cash-basis only.
 * Only CLOSED projects (settlement_status = "closed") enter the real settlement.
 * Open projects appear as "projected" (display only, no effect on profit sharing).
 */
export function calculateFullPartnerSettlement({
  partners,
  projects,
  allPayments,
  allOrders,
  allQuotes,
  generalExpenses,
  untilDate = null,
}) {
  const within = (dateStr) => {
    if (!untilDate || !dateStr) return true;
    return new Date(dateStr) <= new Date(untilDate);
  };

  const closedProjects = (projects || []).filter((p) => p.settlement_status === "closed");
  const openProjects   = (projects || []).filter((p) => p.settlement_status !== "closed");
  const closedIds = new Set(closedProjects.map((p) => p.id));

  const closedPayments = (allPayments || []).filter(
    (p) => closedIds.has(p.project_id) && within(p.payment_date)
  );
  const closedOrders = (allOrders || []).filter(
    (o) => closedIds.has(o.project_id) && within(o.order_date)
  );
  const filteredExpenses = (generalExpenses || []).filter((e) => within(e.expense_date));

  const total_income           = closedPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const total_project_costs    = closedOrders.reduce((s, o) => s + (o.order_amount || 0), 0);
  const total_general_expenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const net_business_profit    = total_income - total_project_costs - total_general_expenses;

  const closed_projects_detail = closedProjects.map((proj) => {
    const fin = calculateProjectFinancials(proj.id, {
      allQuotes,
      allPayments: closedPayments,
      allOrders: closedOrders,
    });
    return {
      id: proj.id,
      name: proj.name,
      customer_name: proj.customer_name,
      closed_at: proj.closed_at,
      closed_by: proj.closed_by,
      total_sale: fin.total_sale,
      total_received: fin.total_received,
      total_costs: fin.total_costs,
      net_cash: fin.total_received - fin.total_costs,
    };
  });

  const open_projects_detail = openProjects.map((proj) => {
    const fin = calculateProjectFinancials(proj.id, { allQuotes, allPayments, allOrders });
    return {
      id: proj.id,
      name: proj.name,
      customer_name: proj.customer_name,
      total_sale: fin.total_sale,
      total_received: fin.total_received,
      total_costs: fin.total_costs,
      balance_to_collect: Math.max(0, fin.balance_to_collect),
      balance_to_suppliers: Math.max(0, fin.balance_to_suppliers),
      projected_net: fin.gross_profit ?? 0,
    };
  });

  const total_projected_profit = open_projects_detail.reduce((s, p) => s + p.projected_net, 0);

  const partnersDetail = (partners || []).map((partner) => {
    const pid = partner.id;
    const share_percent = partner.profit_share_percent || 0;

    const collected = closedPayments
      .filter((p) => p.received_by_partner_id === pid)
      .reduce((s, p) => s + (p.amount || 0), 0);

    const project_costs_paid = closedOrders
      .filter((o) => o.paid_by_partner_id === pid)
      .reduce((s, o) => s + (o.paid_amount || 0), 0);

    const general_expenses_paid = filteredExpenses
      .filter((e) => e.paid_by_partner_id === pid)
      .reduce((s, e) => s + (e.amount || 0), 0);

    const cash_position = collected - project_costs_paid - general_expenses_paid;
    const profit_due = net_business_profit * (share_percent / 100);
    const settlement_balance = profit_due - cash_position;

    return {
      id: pid,
      name: partner.name,
      share_percent,
      collected,
      project_costs_paid,
      general_expenses_paid,
      cash_position,
      profit_due,
      settlement_balance,
    };
  });

  const creditors = partnersDetail
    .filter((p) => p.settlement_balance > 0)
    .sort((a, b) => b.settlement_balance - a.settlement_balance);
  const debtors = partnersDetail
    .filter((p) => p.settlement_balance < 0)
    .sort((a, b) => a.settlement_balance - b.settlement_balance);

  const transfers = [];
  const creditorBalances = creditors.map((c) => ({ ...c, remaining: c.settlement_balance }));
  const debtorBalances   = debtors.map((d) => ({ ...d, remaining: Math.abs(d.settlement_balance) }));

  let ci = 0, di = 0;
  while (ci < creditorBalances.length && di < debtorBalances.length) {
    const amount = Math.min(creditorBalances[ci].remaining, debtorBalances[di].remaining);
    if (amount > 0.5) {
      transfers.push({
        from_partner_id:   debtorBalances[di].id,
        from_partner_name: debtorBalances[di].name,
        to_partner_id:     creditorBalances[ci].id,
        to_partner_name:   creditorBalances[ci].name,
        amount: Math.round(amount),
      });
    }
    creditorBalances[ci].remaining -= amount;
    debtorBalances[di].remaining   -= amount;
    if (creditorBalances[ci].remaining < 0.5) ci++;
    if (debtorBalances[di].remaining   < 0.5) di++;
  }

  return {
    total_income,
    total_project_costs,
    total_general_expenses,
    net_business_profit,
    total_projected_profit,
    closed_projects_detail,
    open_projects_detail,
    partners: partnersDetail,
    transfers,
  };
}

/**
 * Validates whether a project can be closed for settlement.
 */
export function validateProjectCanClose(projectId, { allQuotes, allPayments, allOrders }) {
  const fin = calculateProjectFinancials(projectId, { allQuotes, allPayments, allOrders });
  const reasons = [];

  if (!fin.hasApprovedQuote || fin.total_sale === 0) {
    reasons.push("אין הצעת מחיר מאושרת לפרויקט זה");
  }

  if (fin.balance_to_collect > 0.5) {
    reasons.push(`יתרה לגבייה מלקוח: ${Math.round(fin.balance_to_collect).toLocaleString("he-IL")} ₪`);
  }
  if (fin.balance_to_suppliers > 0.5) {
    reasons.push(`יתרה לתשלום לספקים: ${Math.round(fin.balance_to_suppliers).toLocaleString("he-IL")} ₪`);
  }

  return { canClose: reasons.length === 0, reasons };
}