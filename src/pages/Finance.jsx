import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import PageHeader from "@/components/shared/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { ProjectService, CustomerService, ClientPaymentService, SupplierOrderService, ProjectQuoteService } from "@/services";
import { format, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter,
  Users
} from "lucide-react";


import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import StatsCard from "@/components/dashboard/StatsCard";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { cn } from "@/lib/utils";
import PartnerSettlement from "@/components/finance/PartnerSettlement";
const COLORS = ['#456A87', '#66869E', '#273444', '#9DB4C4', '#1E7B4F', '#9A5B00'];

export default function Finance() {
  const [activeTab, setActiveTab] = useState("finance"); // finance | settlement
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 11), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerFilter, setCustomerFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => ProjectService.list()
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['all-payments'],
    queryFn: () => ClientPaymentService.list()
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => SupplierOrderService.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => CustomerService.list()
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['all-quotes'],
    queryFn: () => ProjectQuoteService.list()
  });

  const isLoading = loadingProjects || loadingPayments || loadingOrders;

  // Filter data by date range
  const filteredPayments = payments.filter(p => {
    const date = new Date(p.payment_date);
    return date >= new Date(dateFrom) && date <= new Date(dateTo);
  });

  const filteredOrders = orders.filter(o => {
    const date = new Date(o.order_date);
    return date >= new Date(dateFrom) && date <= new Date(dateTo);
  });

  // Calculate totals
  const totalIncome = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalExpenses = filteredOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  // Outstanding balances - using centralized calculation
  const outstandingFromClients = projects.reduce((sum, p) => {
    const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments: payments, allOrders: orders });
    return sum + Math.max(0, financials.balance_to_collect);
  }, 0);

  const outstandingToSuppliers = projects.reduce((sum, p) => {
    const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments: payments, allOrders: orders });
    return sum + Math.max(0, financials.balance_to_suppliers);
  }, 0);

  // Monthly data for charts
  const getMonthlyData = () => {
    const months = {};
    
    filteredPayments.forEach(p => {
      const month = format(new Date(p.payment_date), 'yyyy-MM');
      if (!months[month]) months[month] = { income: 0, expenses: 0, month };
      months[month].income += p.amount || 0;
    });

    filteredOrders.forEach(o => {
      const month = format(new Date(o.order_date), 'yyyy-MM');
      if (!months[month]) months[month] = { income: 0, expenses: 0, month };
      months[month].expenses += o.order_amount || 0;
    });

    return Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        monthLabel: format(new Date(m.month + '-01'), 'MMM yy', { locale: he }),
        profit: m.income - m.expenses
      }));
  };

  // Expenses by type
  const getExpensesByType = () => {
    const types = {};
    const typeLabels = { aluminum: 'אלומיניום', hardware: 'פרזול', glass: 'זכוכית', extras: 'תוספות' };
    
    filteredOrders.forEach(o => {
      const type = o.order_type || 'extras';
      if (!types[type]) types[type] = { name: typeLabels[type] || type, value: 0 };
      types[type].value += o.order_amount || 0;
    });

    return Object.values(types);
  };

  // Client debts - using centralized calculation
  const getClientDebts = () => {
    return projects
      .map(p => {
        const financials = calculateProjectFinancials(p.id, { allQuotes, allPayments: payments, allOrders: orders });
        return {
          name: p.name,
          customer: p.customer_name,
          debt: financials.balance_to_collect,
          quote: financials.total_sale,
          paid: financials.total_received
        };
      })
      .filter(p => p.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);
  };

  // Supplier debts
  const getSupplierDebts = () => {
    const suppliers = {};
    
    orders.forEach(o => {
      const name = o.supplier_name || 'לא ידוע';
      if (!suppliers[name]) suppliers[name] = { name, total: 0, paid: 0 };
      suppliers[name].total += o.order_amount || 0;
      suppliers[name].paid += o.paid_amount || 0;
    });

    return Object.values(suppliers)
      .map(s => ({ ...s, debt: s.total - s.paid }))
      .filter(s => s.debt > 0)
      .sort((a, b) => b.debt - a.debt);
  };


  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-4 rounded-xl shadow-lg border border-border">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthlyData = getMonthlyData();
  const expensesByType = getExpensesByType();
  const clientDebts = getClientDebts();
  const supplierDebts = getSupplierDebts();

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="פיננסים"
          description="ניתוח הכנסות, הוצאות ורווחיות"
          actions={
            <div className="flex flex-wrap items-center gap-3" role="group" aria-label="טווח תאריכים">
              <Filter className="w-4 h-4 text-primary/70" aria-hidden="true" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                מתאריך
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                עד
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
              </label>
            </div>
          }
        />

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("finance")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === "finance" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <Wallet className="w-4 h-4" /> סקירה פיננסית
          </button>
          <button
            onClick={() => setActiveTab("settlement")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === "settlement" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <Users className="w-4 h-4" /> התחשבנות שותפים
          </button>
        </div>

        {activeTab === "settlement" && (
          <PartnerSettlement
            allPayments={payments}
            allOrders={orders}
            allQuotes={allQuotes}
            projects={projects}
          />
        )}

        {activeTab === "finance" && (
        <div className="space-y-6">

        {/* Main Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="סה״כ הכנסות"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            variant="success"
          />
          <StatsCard
            title="סה״כ הוצאות"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            variant="default"
          />
          <StatsCard
            title="רווח תפעולי (לפי תאריך)"
            value={formatCurrency(netProfit)}
            icon={Wallet}
            variant={netProfit >= 0 ? "success" : "danger"}
            subtitle="הכנסות פחות הוצאות בתקופה"
          />
          <StatsCard
            title="תזרים צפוי"
            value={formatCurrency(outstandingFromClients - outstandingToSuppliers)}
            subtitle={`לגבייה: ${formatCurrency(outstandingFromClients)} | לתשלום: ${formatCurrency(outstandingToSuppliers)}`}
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses Chart */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">הכנסות והוצאות לפי חודש</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D5DEE5" />
                  <XAxis dataKey="monthLabel" />
                  <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="income" name="הכנסות" fill="#1E7B4F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="הוצאות" fill="#66869E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </div>

          {/* Expenses by Type */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">הוצאות לפי סוג</h3>
            {expensesByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensesByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expensesByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </div>
        </div>

        {/* Profit Trend */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">מגמת רווח</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D5DEE5" />
                <XAxis dataKey="monthLabel" />
                <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  name="רווח" 
                  stroke="#1E7B4F" 
                  strokeWidth={2}
                  dot={{ fill: '#1E7B4F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              אין נתונים להצגה
            </div>
          )}
        </div>

        {/* Debts Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Debts */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">חובות לקוחות פתוחים</h3>
              <span className="text-sm text-muted-foreground">{formatCurrency(outstandingFromClients)}</span>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {clientDebts.map((item, index) => (
                <div key={index} className="p-4 hover:bg-background">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="font-semibold text-warning">{formatCurrency(item.debt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.customer}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>הצעה: {formatCurrency(item.quote)}</span>
                    <span>שולם: {formatCurrency(item.paid)}</span>
                  </div>
                </div>
              ))}
              {clientDebts.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  אין חובות פתוחים
                </div>
              )}
            </div>
          </div>

          {/* Supplier Debts */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">חובות לספקים</h3>
              <span className="text-sm text-muted-foreground">{formatCurrency(outstandingToSuppliers)}</span>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {supplierDebts.map((item, index) => (
                <div key={index} className="p-4 hover:bg-background">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="font-semibold text-destructive">{formatCurrency(item.debt)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>סה״כ: {formatCurrency(item.total)}</span>
                    <span>שולם: {formatCurrency(item.paid)}</span>
                  </div>
                </div>
              ))}
              {supplierDebts.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  אין חובות לספקים
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}