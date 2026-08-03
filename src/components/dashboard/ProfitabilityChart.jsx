import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";

export default function ProfitabilityChart({ projects, allOrders, allQuotes, allPayments = [] }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const data = projects
    .map(project => {
      // Calculate financials using centralized function
      const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
      
      return {
        name: project.name.length > 15 ? project.name.substring(0, 15) + '...' : project.name,
        fullName: project.name,
        revenue: financials.total_sale,
        costs: financials.total_costs,
        profit: financials.gross_profit || 0,
        profitPercent: financials.profit_percent || 0
      };
    })
    .filter(p => p.revenue > 0)
    .slice(0, 8);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
          <p className="font-medium text-slate-900 mb-2">{data.fullName}</p>
          <div className="space-y-1 text-sm">
            <p className="text-slate-600">הכנסה: {formatCurrency(data.revenue)}</p>
            <p className="text-slate-600">עלות: {formatCurrency(data.costs)}</p>
            <p className={data.profit >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
              רווח: {formatCurrency(data.profit)} ({data.profitPercent}%)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">רווחיות פר פרויקט</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" tickFormatter={(value) => `₪${(value/1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-slate-500">
          אין נתונים להצגה
        </div>
      )}
    </div>
  );
}