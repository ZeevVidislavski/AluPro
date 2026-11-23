import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectService, ProjectQuoteService } from "@/services";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Search, Loader2, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { QUOTE_STATUS } from "@/lib/statuses";
import { format } from "date-fns";
import { he } from "date-fns/locale";

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newQuoteDialog, setNewQuoteDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [quoteToDelete, setQuoteToDelete] = useState(null);

  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["all-quotes"],
    queryFn: () => ProjectQuoteService.list()
  });

  // Feeds the "new quote" project picker AND is the source create() uses
  // for project_id. Used to be deliberately Base44-sourced (see git
  // history / PHASE_4_IMPLEMENTATION_PLAN.md section 9) because
  // QuoteEditor.jsx hadn't migrated — a Supabase-created quote would hand
  // it a UUID Base44 couldn't find. Now that QuoteEditor.jsx is fully on
  // Supabase (Phase 11), that risk no longer applies: both this screen's
  // create() and QuoteEditor.jsx's navigation now agree on Supabase
  // UUIDs throughout. Switched to ProjectService in Phase 11's cleanup.
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => ProjectService.list()
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => ProjectQuoteService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-quotes"] })
  });

  const createQuoteMutation = useMutation({
    mutationFn: (projectId) => {
      const project = projects.find(p => p.id === projectId);
      const projectQuotes = quotes.filter(q => q.project_id === projectId);
      return ProjectQuoteService.create({
        project_id: projectId,
        project_name: project?.name || "",
        customer_name: project?.customer_name || "",
        addition_number: projectQuotes.length,
        quote_date: new Date().toISOString().split("T")[0],
        amount: 0,
        subtotal: 0,
        vat_percent: 18,
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

  const activeProjects = projects.filter(p => !["completed"].includes(p.status));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="טוען">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFilters = search !== "" || filterStatus !== "all";
  const th = "px-4 h-10 text-[13px] font-semibold whitespace-nowrap";

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="הצעות מחיר"
          description={`${quotes.length} הצעות סה"כ`}
          actions={
            <Button onClick={() => setNewQuoteDialog(true)}>
              <Plus className="w-4 h-4" />
              הצעה חדשה
            </Button>
          }
        />

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center p-4 border-b" role="search">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-3 w-4 h-4 text-primary/70" aria-hidden="true" />
              <Input
                aria-label="חיפוש הצעות"
                placeholder="חיפוש לפי לקוח / פרויקט..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-10" aria-label="סינון לפי סטטוס">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary">
                <tr>
                  <th scope="col" className={`text-start ${th}`}>מס' הצעה</th>
                  <th scope="col" className={`text-start ${th}`}>לקוח</th>
                  <th scope="col" className={`text-start ${th}`}>פרויקט</th>
                  <th scope="col" className={`text-end ${th}`}>סכום</th>
                  <th scope="col" className={`text-end ${th}`}>כולל מע"מ</th>
                  <th scope="col" className={`text-start ${th}`}>סטטוס</th>
                  <th scope="col" className={`text-start ${th}`}>תאריך</th>
                  <th scope="col" className="px-4 h-10"><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredQuotes.map(quote => {
                  const status = QUOTE_STATUS[quote.status];
                  return (
                    <tr key={quote.id} className="hover:bg-background transition-colors">
                      <td className="px-4 h-[52px] text-sm whitespace-nowrap tabular-nums">
                        {quote.quote_number || (quote.addition_number === 0 ? "ראשונית" : `תוספת ${quote.addition_number}`)}
                      </td>
                      <td className="px-4 h-[52px] text-sm font-medium">{quote.customer_name || "—"}</td>
                      <td className="px-4 h-[52px] text-sm text-muted-foreground">{quote.project_name}</td>
                      <td className="px-4 h-[52px] text-sm text-end tabular-nums whitespace-nowrap">{formatCurrency(quote.subtotal || quote.amount)}</td>
                      <td className="px-4 h-[52px] text-sm font-semibold text-end tabular-nums whitespace-nowrap">{formatCurrency(quote.total_with_vat || quote.amount)}</td>
                      <td className="px-4">
                        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                      </td>
                      <td className="px-4 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                        {quote.quote_date ? format(new Date(quote.quote_date), "dd/MM/yy", { locale: he }) : "—"}
                      </td>
                      <td className="px-4">
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
                            aria-label="מחק הצעה"
                            className="text-destructive hover:text-destructive hover:bg-destructive-subtle"
                            onClick={() => setQuoteToDelete(quote)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredQuotes.length === 0 && (
            hasFilters ? (
              <EmptyState
                icon={Search}
                title="לא נמצאו הצעות"
                description="נסו חיפוש אחר או נקו את הסינון."
                action={<Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); }}>נקה סינון</Button>}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="אין הצעות מחיר"
                description="צרו הצעה ראשונה ושלחו אותה ללקוח."
                action={<Button size="sm" onClick={() => setNewQuoteDialog(true)}><Plus className="w-4 h-4" />הצעה חדשה</Button>}
              />
            )
          )}
          {filteredQuotes.length > 0 && (
            <div className="px-4 py-3 border-t text-[13px] text-muted-foreground">
              מוצגות {filteredQuotes.length} מתוך {quotes.length} הצעות
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!quoteToDelete}
        onOpenChange={(o) => { if (!o) setQuoteToDelete(null); }}
        title="למחוק את ההצעה?"
        description={quoteToDelete ? `ההצעה${quoteToDelete.project_name ? ` "${quoteToDelete.project_name}"` : ""} וכל הפריטים שבה יימחקו. אי אפשר לשחזר.` : ""}
        confirmLabel="מחק הצעה"
        destructive
        onConfirm={() => {
          if (quoteToDelete) deleteQuoteMutation.mutate(quoteToDelete.id);
          setQuoteToDelete(null);
        }}
      />

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
                className="flex-1"
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
