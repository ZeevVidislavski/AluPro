import { useQuery } from "@tanstack/react-query";
import { ProjectService, ClientPaymentService, SupplierOrderService, ReminderService, ProjectQuoteService } from "@/services";
import {
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Building2, 
  Receipt, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import ActiveProjectsTable from "@/components/dashboard/ActiveProjectsTable";
import RemindersWidget from "@/components/dashboard/RemindersWidget";
import ProfitabilityChart from "@/components/dashboard/ProfitabilityChart";
import MorningSummary from "@/components/dashboard/MorningSummary";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { useMemo } from "react";

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => ProjectService.list()
  });

  const { data: allPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['all-payments'],
    queryFn: () => ClientPaymentService.list()
  });

  const { data: allOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => SupplierOrderService.list()
  });

  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => ReminderService.list()
  });

  const { data: allQuotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ['all-quotes'],
    queryFn: () => ProjectQuoteService.list()
  });

  const isLoading = loadingProjects || loadingPayments || loadingOrders || loadingReminders || loadingQuotes;

  // Calculate stats
  const currentYear = new Date().getFullYear();
  
  const yearPayments = allPayments.filter(p => 
    new Date(p.payment_date).getFullYear() === currentYear
  );
  const totalIncome = yearPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const yearOrders = allOrders.filter(o => 
    new Date(o.order_date).getFullYear() === currentYear
  );
  const totalExpenses = yearOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);

  const netProfit = totalIncome - totalExpenses;

  // Active projects (not completed or invoiced)
  const activeProjects = projects.filter(p => 
    !['completed', 'invoiced'].includes(p.status)
  );

  // Memoized financials map — calculate once per project, reuse everywhere
  const projectFinancialsMap = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      map[p.id] = calculateProjectFinancials(p.id, { allQuotes, allPayments, allOrders });
    });
    return map;
  }, [projects, allQuotes, allPayments, allOrders]);

  const outstandingBalance = projects.reduce((sum, p) =>
    sum + Math.max(0, projectFinancialsMap[p.id]?.balance_to_collect || 0), 0);

  const outstandingToSuppliers = projects.reduce((sum, p) =>
    sum + Math.max(0, projectFinancialsMap[p.id]?.balance_to_suppliers || 0), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS', 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">דשבורד</h1>
          <p className="text-slate-500 mt-1">סקירה כללית של העסק</p>
        </div>

        {/* Morning Summary */}
        <MorningSummary />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="הכנסות השנה"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            variant="success"
          />
          <StatsCard
            title="הוצאות השנה"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            variant="warning"
          />
          <StatsCard
            title="רווח נקי"
            value={formatCurrency(netProfit)}
            icon={Wallet}
            variant={netProfit >= 0 ? "success" : "danger"}
          />
          <StatsCard
            title="פרויקטים פעילים"
            value={activeProjects.length}
            icon={Building2}
            variant="primary"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatsCard
            title="יתרת לקוחות לגבייה"
            value={formatCurrency(outstandingBalance)}
            icon={Receipt}
            variant={outstandingBalance > 0 ? "warning" : "default"}
            subtitle={`${projects.filter(p => (projectFinancialsMap[p.id]?.balance_to_collect || 0) > 0).length} פרויקטים עם יתרה`}
          />
          <StatsCard
            title="חוב לספקים"
            value={formatCurrency(outstandingToSuppliers)}
            icon={AlertTriangle}
            variant={outstandingToSuppliers > 0 ? "danger" : "default"}
            subtitle={`${projects.filter(p => (projectFinancialsMap[p.id]?.balance_to_suppliers || 0) > 0).length} פרויקטים עם חוב לספקים`}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Projects - Takes 2 columns */}
          <div className="lg:col-span-2">
            <ActiveProjectsTable projects={activeProjects} allPayments={allPayments} allQuotes={allQuotes} allOrders={allOrders} />
          </div>

          {/* Reminders */}
          <div className="lg:col-span-1">
            <RemindersWidget reminders={reminders} />
          </div>
        </div>

        {/* Profitability Chart */}
        <ProfitabilityChart projects={projects} allOrders={allOrders} allQuotes={allQuotes} allPayments={allPayments} />
      </div>
    </div>
  );
}