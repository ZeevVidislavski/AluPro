import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp, AlertTriangle, DollarSign, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export default function MorningSummary() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if summary was already shown today
    const lastShown = localStorage.getItem('morning_summary_date');
    const today = new Date().toDateString();
    if (lastShown === today) {
      setDismissed(true);
    }
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: () => base44.entities.AgentSettings.list()
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.ProjectQuote.list()
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.ClientPayment.list()
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.SupplierOrder.list()
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['agent-alerts'],
    queryFn: () => base44.entities.AgentAlert.list()
  });

  const currentSettings = settings[0] || { enable_morning_summary: true };

  if (!currentSettings.enable_morning_summary || dismissed) {
    return null;
  }

  const activeProjects = projects.filter(p => !['completed', 'invoiced'].includes(p.status));
  
  // Calculate aggregate metrics
  let totalProfit = 0;
  let totalSale = 0;
  let totalReceived = 0;
  let totalPaid = 0;
  let projectsNeedAttention = 0;

  activeProjects.forEach(p => {
    const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments, allOrders });
    if (financials.gross_profit !== null) {
      totalProfit += financials.gross_profit;
      totalSale += financials.total_sale;
    }
    totalReceived += financials.total_received;
    totalPaid += financials.total_paid_to_suppliers;
    
    const projectAlerts = alerts.filter(a => a.project_id === p.id && !a.is_handled);
    if (projectAlerts.length > 0) projectsNeedAttention++;
  });

  const avgProfitPercent = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;
  const cashFlow = totalReceived - totalPaid;
  const pendingCollection = activeProjects.reduce((sum, p) => {
    const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments, allOrders });
    return sum + Math.max(0, financials.balance_to_collect);
  }, 0);

  const criticalAlerts = alerts.filter(a => !a.is_handled && a.severity === 'critical').length;

  const handleDismiss = () => {
    localStorage.setItem('morning_summary_date', new Date().toDateString());
    setDismissed(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">📊 סיכום עסקי יומי</h2>
          <p className="text-sm text-slate-600">{new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/70 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-600">רווחיות ממוצעת</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            avgProfitPercent >= 15 ? "text-emerald-600" : "text-amber-600"
          )}>
            {avgProfitPercent.toFixed(1)}%
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-slate-600">דורשים טיפול</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            projectsNeedAttention > 0 ? "text-amber-600" : "text-emerald-600"
          )}>
            {projectsNeedAttention} פרויקטים
          </p>
          {criticalAlerts > 0 && (
            <p className="text-xs text-red-600 mt-1">{criticalAlerts} קריטי</p>
          )}
        </div>

        <div className="bg-white/70 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-600">תזרים מזומנים</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            cashFlow >= 0 ? "text-emerald-600" : "text-red-600"
          )}>
            {cashFlow >= 0 ? 'חיובי' : 'שלילי'}
          </p>
          <p className="text-xs text-slate-600 mt-1">{formatCurrency(Math.abs(cashFlow))}</p>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-slate-600">ממתינים לגבייה</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(pendingCollection)}
          </p>
        </div>
      </div>
    </div>
  );
}