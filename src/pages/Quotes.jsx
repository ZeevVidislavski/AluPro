import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Search, Loader2, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusLabels = { draft: "טיוטה", sent: "נשלח", approved: "אושר", rejected: "נדחה" };
const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700"
};

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newQuoteDialog, setNewQuoteDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["all-quotes"],
    queryFn: () => base44.entities.ProjectQuote.list("-created_date")
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list()
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectQuote.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-quotes"] })
  });

  const createQuoteMutation = useMutation({
    mutationFn: (projectId) => {
      const project = projects.find(p => p.id === projectId);
      const projectQuotes = quotes.filter(q => q.project_id === projectId);
      return base44.entities.ProjectQuote.create({
        project_id: projectId,
        project_name: project?.name || "",
        customer_name: project?.customer_name || "",
        addition_number: projectQuotes.length,
        quote_date: new Date().toISOString().split("T")[0],
        amount: 0,
        subtotal: 0,
        vat_percent: 17,
        vat_amount: 0,
        total_with_vat: 0,
        discount_percent: 0,
        status: "draft",
        is_detailed: true
      });
    },
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ["all-quotes"] });
      setNewQuoteDialog(false);
      window.location.href = `/QuoteEditor?quote_id=${newQuote.id}`;
    }
  });

  const filteredQuotes = quotes.filter(q => {
    const matchSearch =
      !search ||
      q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number?.includes(search);
    const matchStatus = filterStatus === "all" || q.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(amount || 0);

  const activeProjects = projects.filter(p => !["completed", "invoiced"].includes(p.status));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">הצעות מחיר</h1>
            <p className="text-slate-500">{quotes.length} הצעות סה"כ</p>
          </div>
          <Button onClick={() => setNewQuoteDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 ml-2" />
            הצעה חדשה
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              placeholder="חיפוש לפי לקוח / פרויקט..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="draft">טיוטה</SelectItem>
              <SelectItem value="sent">נשלח</SelectItem>
              <SelectItem value="approved">אושר</SelectItem>
              <SelectItem value="rejected">נדחה</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">מס' הצעה</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">לקוח</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">פרויקט</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">סכום</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">כולל מע"מ</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">סטטוס</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">תאריך</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map(quote => (
                  <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      {quote.quote_number || (quote.addition_number === 0 ? "ראשונית" : `תוספת ${quote.addition_number}`)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{quote.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{quote.project_name}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(quote.subtotal || quote.amount)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(quote.total_with_vat || quote.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-1 rounded-full font-medium", statusColors[quote.status])}>
                        {statusLabels[quote.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {quote.quote_date ? format(new Date(quote.quote_date), "dd/MM/yy", { locale: he }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                     <div className="flex items-center gap-2">
                       <Link to={`/QuoteEditor?quote_id=${quote.id}`}>
                         <Button size="sm" variant="outline" className="gap-1">
                           <Pencil className="w-3.5 h-3.5" />
                           ערוך
                         </Button>
                       </Link>
                       <Button
                         size="sm"
                         variant="ghost"
                         className="text-red-600 hover:text-red-700 hover:bg-red-50"
                         onClick={() => {
                           if (window.confirm("האם אתה בטוח שברצונך למחוק הצעה זו?")) {
                             deleteQuoteMutation.mutate(quote.id);
                           }
                         }}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                     </div>
                    </td>
                  </tr>
                ))}
                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      אין הצעות מחיר
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Quote Dialog */}
      <Dialog open={newQuoteDialog} onOpenChange={setNewQuoteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הצעה חדשה – בחר פרויקט</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>פרויקט</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר פרויקט..." />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!selectedProjectId || createQuoteMutation.isPending}
                onClick={() => createQuoteMutation.mutate(selectedProjectId)}
              >
                {createQuoteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                צור הצעה
              </Button>
              <Button variant="outline" onClick={() => setNewQuoteDialog(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}