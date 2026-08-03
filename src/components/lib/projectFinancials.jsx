/**
 * Financial calculations for projects using cumulative quote model
 * 
 * Quote Model:
 * - initial_quote (addition_number = 0, approved)
 * - additions (addition_number > 0, approved)
 * - total_sale = initial_quote + sum(additions)
 */

/**
 * Calculate all financial metrics for a project
 * @param {string} projectId - The project ID
 * @param {Object} data - Object containing allQuotes, allPayments, allOrders arrays
 * @returns {Object} Financial metrics
 */
export function calculateProjectFinancials(projectId, { allQuotes = [], allPayments = [], allOrders = [] }) {
  // Filter data for this project
  const projectQuotes = (allQuotes || []).filter(q => q.project_id === projectId);
  const projectPayments = (allPayments || []).filter(p => p.project_id === projectId);
  const projectOrders = (allOrders || []).filter(o => o.project_id === projectId);

  // === QUOTE CALCULATIONS (CUMULATIVE MODEL) ===
  const approvedQuotes = projectQuotes.filter(q => q.status === 'approved');
  
  // Initial quote: addition_number = 0, approved
  const initialQuote = approvedQuotes.find(q => q.addition_number === 0);
  const initial_quote = initialQuote?.amount || 0;
  
  // Additions: addition_number > 0, approved
  const additions = approvedQuotes.filter(q => q.addition_number > 0);
  const additions_total = additions.reduce((sum, q) => sum + (q.amount || 0), 0);
  
  // Total sale = initial + additions
  const total_sale = initial_quote + additions_total;

  // === PAYMENT CALCULATIONS ===
  const total_received = projectPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance_to_collect = total_sale - total_received;

  // === COST CALCULATIONS ===
  const total_costs = projectOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);
  const total_paid_to_suppliers = projectOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
  const balance_to_suppliers = total_costs - total_paid_to_suppliers;

  // === PROFITABILITY CALCULATIONS ===
  const hasApprovedQuote = approvedQuotes.length > 0;
  const gross_profit = hasApprovedQuote ? (total_sale - total_costs) : null;
  const profit_percent = hasApprovedQuote && total_sale > 0
    ? ((gross_profit / total_sale) * 100)
    : null;

  // === CASH FLOW CALCULATIONS ===
  const cash_flow = total_received - total_paid_to_suppliers;

  return {
    // Quotes
    initial_quote,
    additions_total,
    additions_count: additions.length,
    total_sale,
    hasApprovedQuote,
    
    // Payments
    total_received,
    balance_to_collect,
    
    // Costs
    total_costs,
    total_paid_to_suppliers,
    balance_to_suppliers,
    
    // Profitability
    gross_profit,
    profit_percent,
    
    // Cash flow
    cash_flow
  };
}

/**
 * Calculate aggregated financials for multiple projects
 * @param {Array} projects - Array of project objects
 * @param {Object} data - Object containing allQuotes, allPayments, allOrders arrays
 * @returns {Object} Aggregated metrics
 */
export function calculateAggregatedFinancials(projects, { allQuotes = [], allPayments = [], allOrders = [] }) {
  return projects.reduce((acc, project) => {
    const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
    
    return {
      total_sale: acc.total_sale + financials.total_sale,
      total_received: acc.total_received + financials.total_received,
      total_costs: acc.total_costs + financials.total_costs,
      balance_to_collect: acc.balance_to_collect + Math.max(0, financials.balance_to_collect),
      balance_to_suppliers: acc.balance_to_suppliers + Math.max(0, financials.balance_to_suppliers),
      gross_profit: acc.gross_profit + (financials.gross_profit || 0),
      cash_flow: acc.cash_flow + financials.cash_flow
    };
  }, {
    total_sale: 0,
    total_received: 0,
    total_costs: 0,
    balance_to_collect: 0,
    balance_to_suppliers: 0,
    gross_profit: 0,
    cash_flow: 0
  });
}