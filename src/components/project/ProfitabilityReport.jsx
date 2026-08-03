import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";

const statusLabels = {
  quote: 'בהצעה', negotiation: 'מו״מ', approved: 'מאושר',
  ordering: 'בהזמנת חומר', production: 'בייצור',
  installation: 'בהתקנה', completed: 'הושלם', invoiced: 'סגור חשבונית'
};

const paymentTypeLabels = { advance: 'מקדמה', interim: 'תשלום ביניים', final: 'תשלום סופי' };
const paymentMethodLabels = { cash: 'מזומן', check: "צ'ק", transfer: 'העברה בנקאית', credit: 'אשראי' };
const orderTypeLabels = { aluminum: 'אלומיניום', hardware: 'פרזול', glass: 'זכוכית', extras: 'תוספות' };

export default function ProfitabilityReport({ project, payments, orders, quotes }) {
  const financials = calculateProjectFinancials(project.id, {
    allQuotes: quotes, allPayments: payments, allOrders: orders
  });

  const {
    initial_quote, additions_total, additions_count, total_sale, hasApprovedQuote,
    total_received, balance_to_collect, total_costs, total_paid_to_suppliers,
    balance_to_suppliers, gross_profit, profit_percent, cash_flow
  } = financials;

  const fmt = (amount) => new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS', maximumFractionDigits: 0
  }).format(amount || 0);

  const profitColor = (profit_percent || 0) >= 20
    ? 'text-emerald-700' : (profit_percent || 0) >= 10
    ? 'text-amber-600' : 'text-red-600';

  const profitBg = (profit_percent || 0) >= 20
    ? 'bg-emerald-50 border-emerald-200' : (profit_percent || 0) >= 10
    ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const profitBarColor = (profit_percent || 0) >= 20
    ? 'bg-emerald-500' : (profit_percent || 0) >= 10
    ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-white min-h-screen" dir="rtl">
      <div className="max-w-[800px] mx-auto">

        {/* ======= HEADER ======= */}
        <div className="bg-gradient-to-l from-slate-800 to-slate-900 text-white p-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">דוח רווחיות פנימי</p>
              <h1 className="text-3xl font-bold mb-1">{project.name}</h1>
              {project.project_number && (
                <p className="text-slate-400 text-sm">פרויקט #{project.project_number}</p>
              )}
            </div>
            <div className="text-left flex flex-col items-end gap-2">
              <span className="bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full">
                {statusLabels[project.status]}
              </span>
              <p className="text-slate-400 text-sm">
                {format(new Date(), 'dd/MM/yyyy', { locale: he })}
              </p>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-slate-300 pt-4 border-t border-white/10">
            <span>👤 {project.customer_name}</span>
            {project.address && <span>📍 {project.address}</span>}
            {project.target_date && (
              <span>📅 יעד: {format(new Date(project.target_date), 'dd/MM/yyyy', { locale: he })}</span>
            )}
          </div>
        </div>

        {/* ======= SUMMARY CARDS ======= */}
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-200 border-b border-slate-200">
          {[
            { label: 'סה״כ מכירה', value: fmt(total_sale), sub: `הצעה + ${additions_count} תוספות`, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'רווח גולמי', value: hasApprovedQuote ? fmt(gross_profit) : '—', sub: 'מכירה פחות עלויות', color: gross_profit >= 0 ? 'text-emerald-700' : 'text-red-600', bg: gross_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
            { label: 'יתרה לגבייה', value: fmt(balance_to_collect), sub: balance_to_collect <= 0 ? 'גביית כל הסכום ✓' : 'טרם התקבל', color: balance_to_collect > 0 ? 'text-amber-700' : 'text-emerald-700', bg: balance_to_collect > 0 ? 'bg-amber-50' : 'bg-emerald-50' },
            { label: 'תזרים נטו', value: fmt(cash_flow), sub: cash_flow >= 0 ? 'חיובי ✓' : 'שלילי ⚠', color: cash_flow >= 0 ? 'text-emerald-700' : 'text-red-600', bg: cash_flow >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          ].map((card, i) => (
            <div key={i} className={cn("p-5 text-center", card.bg)}>
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className={cn("text-xl font-bold mb-1", card.color)}>{card.value}</p>
              <p className="text-xs text-slate-400">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="p-8 space-y-10">

          {/* ======= PROFITABILITY GAUGE ======= */}
          {hasApprovedQuote && (
            <section>
              <SectionTitle>📊 רווחיות גולמית</SectionTitle>
              <div className={cn("rounded-xl border p-6", profitBg)}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">אחוז רווחיות</p>
                    <p className={cn("text-3xl font-black", profitColor)}>
                      {(profit_percent || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-left flex gap-6">
                    {[
                      { label: 'מכירה', value: fmt(total_sale) },
                      { label: 'עלויות', value: fmt(total_costs) },
                      { label: 'רווח', value: fmt(gross_profit), cls: gross_profit >= 0 ? "text-emerald-700" : "text-red-600" }
                    ].map((item, i) => (
                      <div key={i}>
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className={cn("font-bold text-sm", item.cls || "text-slate-900")}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full bg-white/60 rounded-full h-2 mt-1">
                  <div
                    className={cn("h-2 rounded-full transition-all", profitBarColor)}
                    style={{ width: `${Math.min(Math.max(profit_percent || 0, 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0%</span>
                  <span className="text-amber-500">10%</span>
                  <span className="text-emerald-500">20%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </section>
          )}

          {/* ======= QUOTES ======= */}
          <section>
            <SectionTitle>📋 הצעות מחיר</SectionTitle>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100">
                <InfoBox label="הצעה ראשונית" value={initial_quote > 0 ? fmt(initial_quote) : '—'} />
                <InfoBox label={`תוספות (${additions_count})`} value={fmt(additions_total)} valueClass={additions_total > 0 ? 'text-blue-600' : ''} />
                <InfoBox label="סה״כ מכירה" value={fmt(total_sale)} valueClass="text-blue-700 text-2xl" bg="bg-blue-50" />
              </div>
            </div>
          </section>

          {/* ======= PAYMENTS ======= */}
          <section>
            <SectionTitle>💰 תקבולים מלקוח</SectionTitle>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-right p-3">תאריך</th>
                    <th className="text-right p-3">סוג</th>
                    <th className="text-right p-3">אמצעי</th>
                    <th className="text-left p-3">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments || []).length === 0 ? (
                    <tr><td colSpan="4" className="p-6 text-center text-slate-400">אין תשלומים רשומים</td></tr>
                  ) : (payments || []).map((payment, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 text-slate-700">{format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: he })}</td>
                      <td className="p-3"><span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{paymentTypeLabels[payment.payment_type]}</span></td>
                      <td className="p-3 text-slate-600">{paymentMethodLabels[payment.payment_method]}</td>
                      <td className="p-3 text-left font-bold text-slate-900">{fmt(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan="3" className="p-3 font-bold text-slate-800">סך התקבל</td>
                    <td className="p-3 text-left font-bold text-lg text-emerald-700">{fmt(total_received)}</td>
                  </tr>
                  <tr className={balance_to_collect > 0 ? 'bg-amber-50' : 'bg-emerald-50'}>
                    <td colSpan="3" className="p-3 font-bold text-slate-800">יתרה לגבייה</td>
                    <td className={cn("p-3 text-left font-bold text-lg", balance_to_collect > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                      {fmt(balance_to_collect)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ======= ORDERS ======= */}
          <section>
            <SectionTitle>🏭 עלויות ספקים</SectionTitle>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-right p-3">תאריך</th>
                    <th className="text-right p-3">סוג</th>
                    <th className="text-right p-3">ספק</th>
                    <th className="text-left p-3">הזמנה</th>
                    <th className="text-left p-3">שולם</th>
                    <th className="text-left p-3">יתרה</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders || []).length === 0 ? (
                    <tr><td colSpan="6" className="p-6 text-center text-slate-400">אין הזמנות רשומות</td></tr>
                  ) : (orders || []).map((order, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 text-slate-600">{order.order_date ? format(new Date(order.order_date), 'dd/MM/yyyy', { locale: he }) : '—'}</td>
                      <td className="p-3"><span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{orderTypeLabels[order.order_type]}</span></td>
                      <td className="p-3 text-slate-700 font-medium">{order.supplier_name}</td>
                      <td className="p-3 text-left font-bold text-slate-900">{fmt(order.order_amount)}</td>
                      <td className="p-3 text-left text-emerald-700">{fmt(order.paid_amount)}</td>
                      <td className="p-3 text-left text-amber-700">{fmt((order.order_amount || 0) - (order.paid_amount || 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <td colSpan="3" className="p-3 text-slate-800">סך עלויות</td>
                    <td className="p-3 text-left text-lg text-slate-900">{fmt(total_costs)}</td>
                    <td className="p-3 text-left text-emerald-700">{fmt(total_paid_to_suppliers)}</td>
                    <td className="p-3 text-left text-amber-700">{fmt(balance_to_suppliers)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ======= CASH FLOW ======= */}
          <section>
            <SectionTitle>💸 תזרים מזומנים בפועל</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
                <p className="text-xs text-slate-500 mb-2">התקבל מלקוחות</p>
                <p className="text-2xl font-bold text-blue-700">{fmt(total_received)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                <p className="text-xs text-slate-500 mb-2">שולם לספקים</p>
                <p className="text-2xl font-bold text-red-700">{fmt(total_paid_to_suppliers)}</p>
              </div>
              <div className={cn(
                "rounded-xl p-5 text-center border",
                cash_flow >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
              )}>
                <p className="text-xs text-slate-500 mb-2">תזרים נטו</p>
                <p className={cn("text-2xl font-bold", cash_flow >= 0 ? "text-emerald-700" : "text-red-700")}>{fmt(cash_flow)}</p>
              </div>
            </div>
          </section>

        </div>

        {/* ======= FOOTER ======= */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between text-xs text-slate-400">
          <span>לשימוש פנימי בלבד</span>
          <span>הופק: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: he })}</span>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function InfoBox({ label, value, valueClass = '', bg = 'bg-white' }) {
  return (
    <div className={cn("p-5 text-center", bg)}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={cn("text-xl font-bold text-slate-900", valueClass)}>{value}</p>
    </div>
  );
}