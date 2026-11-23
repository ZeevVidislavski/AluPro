import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PartnerService, GeneralExpenseService } from "@/services";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  Users, TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2,
  Loader2, Filter, AlertCircle, CheckCircle2, Settings, ArrowLeftRight,
  Lock, Unlock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { calculateFullPartnerSettlement } from "@/components/lib/partnerSettlement";

const fmt = (n) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

const categoryLabels = { rent: "שכירות", salary: "שכר", equipment: "ציוד", marketing: "שיווק", other: "אחר" };

export default function PartnerSettlement({ allPayments, allOrders, allQuotes, projects }) {
  const queryClient = useQueryClient();
  const [untilDate, setUntilDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeTab, setActiveTab] = useState("summary"); // summary | closed | open | expenses

  const { data: partners = [], isLoading: loadingPartners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => PartnerService.list()
  });

  const { data: generalExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["general-expenses"],
    queryFn: () => GeneralExpenseService.list()
  });

  const isLoading = loadingPartners || loadingExpenses;

  const settlement = calculateFullPartnerSettlement({
    partners, projects, allPayments, allOrders, allQuotes, generalExpenses, untilDate
  });

  const {
    total_income, total_project_costs, total_general_expenses, net_business_profit,
    total_projected_profit, closed_projects_detail, open_projects_detail,
    partners: partnerDetails, transfers
  } = settlement;

  // Collect open-project cash position per partner (display only, no effect on settlement)
  const openProjectIds = new Set((projects || []).filter(p => p.settlement_status !== "closed").map(p => p.id));
  const openCollectedByPartner = {};
  const openPaidByPartner = {};
  (allPayments || []).forEach(pay => {
    if (openProjectIds.has(pay.project_id) && pay.received_by_partner_id) {
      const pid = pay.received_by_partner_id;
      openCollectedByPartner[pid] = (openCollectedByPartner[pid] || 0) + (pay.amount || 0);
    }
  });
  (allOrders || []).forEach(ord => {
    if (openProjectIds.has(ord.project_id) && ord.paid_by_partner_id) {
      const pid = ord.paid_by_partner_id;
      openPaidByPartner[pid] = (openPaidByPartner[pid] || 0) + (ord.order_amount || 0);
    }
  });

  // --- Partner CRUD ---
  const [partnerForm, setPartnerForm] = useState({ name: "", profit_share_percent: 50, active: true });

  const createPartner = useMutation({
    mutationFn: (data) => PartnerService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["partners"] }); setPartnerDialogOpen(false); }
  });
  const updatePartner = useMutation({
    mutationFn: ({ id, data }) => PartnerService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["partners"] }); setPartnerDialogOpen(false); setEditingPartner(null); }
  });
  const deletePartner = useMutation({
    mutationFn: (id) => PartnerService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partners"] })
  });

  // --- Expense CRUD ---
  const [expenseForm, setExpenseForm] = useState({
    description: "", category: "other", amount: 0,
    expense_date: format(new Date(), "yyyy-MM-dd"),
    paid_by_partner_id: "", paid_by_partner_name: "", notes: ""
  });

  const createExpense = useMutation({
    mutationFn: (data) => GeneralExpenseService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["general-expenses"] }); setExpenseDialogOpen(false); }
  });
  const updateExpense = useMutation({
    mutationFn: ({ id, data }) => GeneralExpenseService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["general-expenses"] }); setExpenseDialogOpen(false); setEditingExpense(null); }
  });
  const deleteExpense = useMutation({
    mutationFn: (id) => GeneralExpenseService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["general-expenses"] })
  });

  const totalSharePercent = partners.reduce((s, p) => s + (p.profit_share_percent || 0), 0);
  const shareWarning = Math.abs(totalSharePercent - 100) > 0.1 && partners.length > 0;

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const tabs = [
    { id: "summary", label: "סיכום" },
    { id: "closed", label: `פרויקטים סגורים (${closed_projects_detail.length})` },
    { id: "open", label: `פרויקטים פתוחים (${open_projects_detail.length})` },
    { id: "expenses", label: "הוצאות כלליות" },
  ];

  return (
    <div className="space-y-6">

      {/* TOP CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Label className="text-muted-foreground text-sm">חשב עד תאריך:</Label>
          <Input type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            setEditingPartner(null);
            setPartnerForm({ name: "", profit_share_percent: 50, active: true });
            setPartnerDialogOpen(true);
          }}>
            <Settings className="w-4 h-4 ml-1" /> ניהול שותפים
          </Button>
        </div>
      </div>

      {/* SHARE WARNING */}
      {shareWarning && (
        <div className="bg-warning-subtle border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-warning">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm">סה״כ אחוזי השותפות = <strong>{totalSharePercent}%</strong> (אמור להיות 100%)</span>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === t.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* ===== SUMMARY TAB ===== */}
      {activeTab === "summary" && (
        <div className="space-y-6">

          {/* Business totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "סה״כ הכנסות (פרויקטים סגורים)", value: fmt(total_income), color: "text-success", bg: "bg-success-subtle border-emerald-200", icon: TrendingUp },
              { label: "עלויות פרויקטים", value: fmt(total_project_costs), color: "text-foreground", bg: "bg-background border-border", icon: TrendingDown },
              { label: "הוצאות כלליות", value: fmt(total_general_expenses), color: "text-warning", bg: "bg-warning-subtle border-amber-200", icon: Wallet },
              { label: "רווח לחלוקת שותפים (פרויקטים סגורים)", value: fmt(net_business_profit), color: net_business_profit >= 0 ? "text-success" : "text-destructive", bg: net_business_profit >= 0 ? "bg-success-subtle border-emerald-200" : "bg-destructive-subtle border-red-200", icon: net_business_profit >= 0 ? TrendingUp : TrendingDown },
            ].map((card, i) => (
              <div key={i} className={cn("rounded-xl border p-4", card.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={cn("w-4 h-4", card.color)} />
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
                <p className={cn("text-xl font-bold", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Projected banner */}
          {total_projected_profit !== 0 && (
            <div className="bg-secondary border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Unlock className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-sm text-primary">
                רווח תיאורטי צפוי מ-<strong>{open_projects_detail.length}</strong> פרויקטים פתוחים: <strong>{fmt(total_projected_profit)}</strong>
                <span className="text-blue-400 mr-2">(לא נכנס לחלוקה)</span>
              </p>
            </div>
          )}

          {/* Partner cards */}
          {partners.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium mb-2">אין שותפים מוגדרים</p>
              <Button size="sm" onClick={() => { setPartnerForm({ name: "", profit_share_percent: 50, active: true }); setPartnerDialogOpen(true); }}>
                <Plus className="w-4 h-4 ml-1" /> הוסף שותף
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {partnerDetails.map((p) => {
                const isPositive = p.settlement_balance >= 0;
                const isBalanced = Math.abs(p.settlement_balance) < 1;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                          {p.name?.[0] || "?"}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.share_percent}% שותפות</p>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold",
                        isBalanced ? "bg-secondary text-muted-foreground" :
                        isPositive ? "bg-success-subtle text-success" : "bg-destructive-subtle text-destructive"
                      )}>
                        {isBalanced ? "מאוזן" : isPositive ? <><CheckCircle2 className="w-4 h-4" /> זכאי</> : <><AlertCircle className="w-4 h-4" /> חייב</>}
                        {!isBalanced && <span className="mr-1">{fmt(Math.abs(p.settlement_balance))}</span>}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 grid grid-cols-3 gap-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">כסף שגבה (פרויקטים סגורים)</p>
                        <p className="font-semibold text-primary">{fmt(p.collected)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">עלויות ספקים ששילם</p>
                        <p className="font-semibold text-foreground">{fmt(p.project_costs_paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">הוצאות כלליות ששילם</p>
                        <p className="font-semibold text-warning">{fmt(p.general_expenses_paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">יתרה בפועל</p>
                        <p className={cn("font-semibold", p.cash_position >= 0 ? "text-success" : "text-destructive")}>{fmt(p.cash_position)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">רווח שמגיע לו</p>
                        <p className="font-semibold text-foreground">{fmt(p.profit_due)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">מאזן התחשבנות</p>
                        <p className={cn("font-bold", isBalanced ? "text-muted-foreground" : isPositive ? "text-success" : "text-destructive")}>
                          {isPositive ? "+" : ""}{fmt(p.settlement_balance)}
                        </p>
                      </div>
                    </div>
                    {/* Open projects net cash position */}
                    {(() => {
                      const collected = openCollectedByPartner[p.id] || 0;
                      const paid = openPaidByPartner[p.id] || 0;
                      const net = collected - paid;
                      if (collected === 0 && paid === 0) return null;
                      return (
                        <div className="mx-6 mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm space-y-1.5">
                          <p className="text-orange-700 font-medium flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5" />
                            פרויקטים פתוחים (לתצוגה בלבד)
                          </p>
                          <div className="flex justify-between text-orange-700/80 text-xs">
                            <span>גבה מלקוחות</span>
                            <span>{fmt(collected)}</span>
                          </div>
                          <div className="flex justify-between text-orange-700/80 text-xs">
                            <span>שילם לספקים</span>
                            <span>- {fmt(paid)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-orange-800 border-t border-orange-200 pt-1.5">
                            <span>יתרה נטו אצלו</span>
                            <span className={net >= 0 ? "text-orange-800" : "text-destructive"}>{fmt(net)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Transfer summary */}
          {transfers.length > 0 && (
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-background">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                  העברות נדרשות בין שותפים
                </h3>
              </div>
              <div className="divide-y divide-border">
                {transfers.map((t, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-destructive">{t.from_partner_name}</span>
                      <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-success">{t.to_partner_name}</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CLOSED PROJECTS TAB ===== */}
      {activeTab === "closed" && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {closed_projects_detail.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              אין פרויקטים שנסגרו להתחשבנות
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border text-right">
                  <th className="p-3 text-muted-foreground">פרויקט</th>
                  <th className="p-3 text-muted-foreground">לקוח</th>
                  <th className="p-3 text-muted-foreground">נגבה</th>
                  <th className="p-3 text-muted-foreground">עלויות</th>
                  <th className="p-3 text-muted-foreground">רווח נקי</th>
                  <th className="p-3 text-muted-foreground">נסגר ע״י</th>
                  <th className="p-3 text-muted-foreground">תאריך סגירה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closed_projects_detail.map((proj) => (
                  <tr key={proj.id} className="hover:bg-background">
                    <td className="p-3 font-medium text-foreground">{proj.name}</td>
                    <td className="p-3 text-muted-foreground">{proj.customer_name}</td>
                    <td className="p-3 text-success font-semibold">{fmt(proj.total_received)}</td>
                    <td className="p-3 text-foreground">{fmt(proj.total_costs)}</td>
                    <td className={cn("p-3 font-bold", proj.net_cash >= 0 ? "text-success" : "text-destructive")}>{fmt(proj.net_cash)}</td>
                    <td className="p-3 text-muted-foreground">{proj.closed_by || "—"}</td>
                    <td className="p-3 text-muted-foreground">{proj.closed_at ? format(new Date(proj.closed_at), "dd/MM/yyyy", { locale: he }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== OPEN PROJECTS TAB (projected) ===== */}
      {activeTab === "open" && (
        <div className="space-y-3">
          <div className="bg-secondary border border-blue-200 rounded-xl p-4 text-sm text-primary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            פרויקטים אלה מוצגים כרווח תיאורטי בלבד ולא משפיעים על חלוקת הרווחים
          </div>
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {open_projects_detail.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">אין פרויקטים פתוחים</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-background border-b border-border text-right">
                    <th className="p-3 text-muted-foreground">פרויקט</th>
                    <th className="p-3 text-muted-foreground">לקוח</th>
                    <th className="p-3 text-muted-foreground">נגבה עד כה</th>
                    <th className="p-3 text-muted-foreground">יתרה לגבייה</th>
                    <th className="p-3 text-muted-foreground">עלויות</th>
                    <th className="p-3 text-muted-foreground">יתרה לספקים</th>
                    <th className="p-3 text-muted-foreground">רווח תיאורטי</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {open_projects_detail.map((proj) => (
                    <tr key={proj.id} className="hover:bg-background">
                      <td className="p-3 font-medium text-foreground">{proj.name}</td>
                      <td className="p-3 text-muted-foreground">{proj.customer_name}</td>
                      <td className="p-3 text-success">{fmt(proj.total_received)}</td>
                      <td className="p-3 text-warning">{fmt(proj.balance_to_collect)}</td>
                      <td className="p-3 text-foreground">{fmt(proj.total_costs)}</td>
                      <td className="p-3 text-destructive">{fmt(proj.balance_to_suppliers)}</td>
                      <td className={cn("p-3 font-bold", proj.projected_net >= 0 ? "text-primary" : "text-destructive")}>{fmt(proj.projected_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== EXPENSES TAB ===== */}
      {activeTab === "expenses" && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">הוצאות כלליות עסקיות</h3>
            <Button size="sm" onClick={() => {
              setEditingExpense(null);
              setExpenseForm({ description: "", category: "other", amount: 0, expense_date: format(new Date(), "yyyy-MM-dd"), paid_by_partner_id: "", paid_by_partner_name: "", notes: "" });
              setExpenseDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-1" /> הוצאה חדשה
            </Button>
          </div>
          {generalExpenses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">אין הוצאות כלליות רשומות</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="text-right p-3 text-muted-foreground">תאריך</th>
                  <th className="text-right p-3 text-muted-foreground">תיאור</th>
                  <th className="text-right p-3 text-muted-foreground">קטגוריה</th>
                  <th className="text-right p-3 text-muted-foreground">שילם</th>
                  <th className="text-left p-3 text-muted-foreground">סכום</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {generalExpenses.map((exp, idx) => (
                  <tr key={exp.id} className={idx % 2 === 0 ? "" : "bg-slate-50/50"}>
                    <td className="p-3 text-muted-foreground">{exp.expense_date ? format(new Date(exp.expense_date), "dd/MM/yyyy", { locale: he }) : "—"}</td>
                    <td className="p-3 font-medium text-foreground">{exp.description}</td>
                    <td className="p-3">
                      <span className="bg-secondary text-muted-foreground text-xs px-2 py-0.5 rounded-full">{categoryLabels[exp.category] || exp.category}</span>
                    </td>
                    <td className="p-3 text-foreground">{exp.paid_by_partner_name || "—"}</td>
                    <td className="p-3 text-left font-bold text-destructive">{fmt(exp.amount)}</td>
                    <td className="p-3 text-left">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingExpense(exp);
                          setExpenseForm({ description: exp.description, category: exp.category, amount: exp.amount, expense_date: exp.expense_date, paid_by_partner_id: exp.paid_by_partner_id, paid_by_partner_name: exp.paid_by_partner_name, notes: exp.notes || "" });
                          setExpenseDialogOpen(true);
                        }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-destructive" onClick={() => { if (window.confirm("למחוק הוצאה זו?")) deleteExpense.mutate(exp.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PARTNER DIALOG */}
      <Dialog open={partnerDialogOpen} onOpenChange={(o) => { setPartnerDialogOpen(o); if (!o) setEditingPartner(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> ניהול שותפים</DialogTitle>
          </DialogHeader>
          {partners.length > 0 && (
            <div className="border rounded-lg divide-y mb-4">
              {partners.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.profit_share_percent}%</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingPartner(p); setPartnerForm({ name: p.name, profit_share_percent: p.profit_share_percent, active: p.active }); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (window.confirm("למחוק שותף זה?")) deletePartner.mutate(p.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingPartner) updatePartner.mutate({ id: editingPartner.id, data: partnerForm });
            else createPartner.mutate(partnerForm);
          }} className="space-y-3">
            <p className="text-sm font-medium text-foreground">{editingPartner ? "עריכת שותף" : "הוספת שותף"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>שם</Label>
                <Input value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>אחוז שותפות (%)</Label>
                <Input type="number" min="0" max="100" value={partnerForm.profit_share_percent} onChange={(e) => setPartnerForm({ ...partnerForm, profit_share_percent: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary-hover">
                {(createPartner.isPending || updatePartner.isPending) && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                {editingPartner ? "עדכון" : "הוספה"}
              </Button>
              {editingPartner && <Button type="button" variant="outline" onClick={() => { setEditingPartner(null); setPartnerForm({ name: "", profit_share_percent: 50, active: true }); }}>ביטול</Button>}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EXPENSE DIALOG */}
      <Dialog open={expenseDialogOpen} onOpenChange={(o) => { setExpenseDialogOpen(o); if (!o) setEditingExpense(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? "עריכת הוצאה" : "הוצאה כללית חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingExpense) updateExpense.mutate({ id: editingExpense.id, data: expenseForm });
            else createExpense.mutate(expenseForm);
          }} className="space-y-4">
            <div className="space-y-1">
              <Label>תיאור</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>קטגוריה</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>סכום</Label>
                <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>תאריך</Label>
                <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>שולם ע״י</Label>
                <Select value={expenseForm.paid_by_partner_id} onValueChange={(v) => {
                  const p = partners.find((p) => p.id === v);
                  setExpenseForm({ ...expenseForm, paid_by_partner_id: v, paid_by_partner_name: p?.name || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="בחר שותף" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>הערות</Label>
              <Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary-hover">
                {(createExpense.isPending || updateExpense.isPending) && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                {editingExpense ? "עדכון" : "הוספה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}