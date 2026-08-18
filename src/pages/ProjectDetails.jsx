import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ProjectService,
  ClientPaymentService,
  SupplierOrderService,
  ProjectQuoteService,
  DocumentService,
  ReminderService,
  PartnerService,
} from "@/services";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  ArrowRight,
  Pencil,
  Loader2,
  Building2,
  Calendar,
  Palette,
  MapPin,
  FileText,
  Receipt,
  Package,
  Bell,
  Plus,
  Trash2,
  Upload,
  Download,
  ExternalLink,
  Printer,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ProjectStatusBadge from "@/components/dashboard/ProjectStatusBadge";
import ProfitabilityReport from "@/components/project/ProfitabilityReport";
import MaterialOrdersTab from "@/components/project/MaterialOrdersTab";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { validateProjectCanClose } from "@/components/lib/partnerSettlement";
import { cn } from "@/lib/utils";

const statusOptions = [
  { value: 'quote', label: 'בהצעה' },
  { value: 'negotiation', label: 'מו״מ' },
  { value: 'approved', label: 'מאושר' },
  { value: 'ordering', label: 'בהזמנת חומר' },
  { value: 'production', label: 'בייצור' },
  { value: 'installation', label: 'בהתקנה' },
  { value: 'completed', label: 'הושלם' },
  { value: 'invoiced', label: 'סגור חשבונית' }
];

// file_url on both ProjectQuote and Document is now an internal Storage
// path, not a displayable/public URL — these resolve a path to a
// time-limited signed URL on demand. Same pattern as
// CompanyHeaders.jsx's useLogoSignedUrl/HeaderLogo (Phase 6), duplicated
// here (not imported cross-page) since each caller uses a different
// Service (ProjectQuoteService vs DocumentService) for the signed-URL
// lookup.
function QuoteFileLink({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    ProjectQuoteService.getFileUrl(path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!url) {
    return <span className="p-2"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 rounded-lg text-blue-600 hover:text-blue-700">
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}

function DocumentFileLink({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    DocumentService.getFileUrl(path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!url) {
    return <span className="p-2"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900">
      <Download className="w-4 h-4" />
    </a>
  );
}

export default function ProjectDetails() {
  const [projectId, setProjectId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [closeBlockReasons, setCloseBlockReasons] = useState([]);
  const [closeBlockDialogOpen, setCloseBlockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form dialogs
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [showPrintReport, setShowPrintReport] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('id'));
  }, [window.location.search]);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => ProjectService.get(projectId),
    enabled: !!projectId
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['project-payments', projectId],
    queryFn: () => ClientPaymentService.listByProject(projectId),
    enabled: !!projectId
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['project-orders', projectId],
    queryFn: () => SupplierOrderService.listByProject(projectId),
    enabled: !!projectId
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: () => DocumentService.listByProject(projectId),
    enabled: !!projectId
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['project-reminders', projectId],
    queryFn: () => ReminderService.list().then(all => all.filter(r => r.project_id === projectId)),
    enabled: !!projectId
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['project-quotes', projectId],
    queryFn: () => ProjectQuoteService.listByProject(projectId),
    enabled: !!projectId
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => PartnerService.list()
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => ProjectService.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditDialogOpen(false);
    }
  });

  const closeSettlementMutation = useMutation({
    mutationFn: () => ProjectService.closeSettlement(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => ProjectService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      window.location.href = createPageUrl("Projects");
    }
  });

  const reopenSettlementMutation = useMutation({
    mutationFn: () => ProjectService.reopenSettlement(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const handleCloseSettlement = () => {
    const { canClose, reasons } = validateProjectCanClose(projectId, {
      allQuotes: quotes,
      allPayments: payments,
      allOrders: orders
    });
    if (!canClose) {
      setCloseBlockReasons(reasons);
      setCloseBlockDialogOpen(true);
      return;
    }
    if (window.confirm("לסגור פרויקט זה להתחשבנות? הוא ייכנס לחלוקת הרווחים בין השותפים.")) {
      closeSettlementMutation.mutate();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS', 
      maximumFractionDigits: 0 
    }).format(amount || 0);
  };

  // Calculate financials using centralized function — memoized to avoid recalculation on every render
  // Must be before any early return (Rules of Hooks)
  const financials = useMemo(
    () => calculateProjectFinancials(projectId, { allQuotes: quotes, allPayments: payments, allOrders: orders }),
    [projectId, quotes, payments, orders]
  );

  if (isLoading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  // Destructure for easier access
  const {
    initial_quote,
    additions_total,
    additions_count,
    total_sale,
    total_received,
    balance_to_collect,
    total_costs,
    gross_profit,
    profit_percent
  } = financials;

  const handlePrintReport = () => {
    setShowPrintReport(true);
    setTimeout(() => {
      window.print();
      setShowPrintReport(false);
    }, 100);
  };

  if (showPrintReport) {
    return (
      <ProfitabilityReport 
        project={project}
        payments={payments}
        orders={orders}
        quotes={quotes}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            to={createPageUrl("Projects")}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            {project.project_number && (
              <p className="text-slate-500">#{project.project_number}</p>
            )}
          </div>
          {project.settlement_status === "closed" ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <Lock className="w-4 h-4" /> סגור להתחשבנות
              </span>
              <Button variant="outline" size="sm" onClick={() => { if (window.confirm("לפתוח פרויקט זה מחדש?")) reopenSettlementMutation.mutate(); }}>
                <Unlock className="w-4 h-4 ml-1" /> פתח מחדש
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleCloseSettlement} className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              {closeSettlementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              סגור להתחשבנות
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handlePrintReport}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            דוח רווחיות פנימי
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setEditFormData(project);
              setEditDialogOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 ml-2" />
            עריכה
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 ml-2" />
            מחיקה
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500 mb-1">סכום הצעה</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(total_sale)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500 mb-1">סה״כ התקבל</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(total_received)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500 mb-1">יתרה לגבייה</p>
            <p className={cn(
              "text-2xl font-bold",
              balance_to_collect > 0 ? "text-amber-600" : "text-emerald-600"
            )}>
              {formatCurrency(balance_to_collect)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500 mb-1">רווח צפוי</p>
            <p className={cn(
              "text-2xl font-bold",
              (gross_profit || 0) >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {formatCurrency(gross_profit || 0)}
              {profit_percent !== null && (
                <span className="text-sm font-normal text-slate-500 mr-2">({profit_percent.toFixed(1)}%)</span>
              )}
            </p>
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">פרטי פרויקט</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">לקוח</p>
                <p className="font-medium">{project.customer_name}</p>
              </div>
            </div>
            {project.address && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">כתובת</p>
                  <p className="font-medium">{project.address}</p>
                </div>
              </div>
            )}
            {project.aluminum_color && (
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">צבע אלומיניום</p>
                  <p className="font-medium">{project.aluminum_color}</p>
                </div>
              </div>
            )}
            {project.target_date && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">תאריך יעד</p>
                  <p className="font-medium">{format(new Date(project.target_date), 'dd/MM/yyyy', { locale: he })}</p>
                </div>
              </div>
            )}
          </div>
          {project.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">הערות</p>
              <p className="text-slate-600">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="payments" className="space-y-6">
          <div className="overflow-x-auto">
          <TabsList className="bg-white border border-slate-200 p-1 min-w-max">
            <TabsTrigger value="payments" className="gap-2">
              <Receipt className="w-4 h-4" />
              תשלומים ({payments.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="w-4 h-4" />
              הזמנות ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2">
              <FileText className="w-4 h-4" />
              הצעות מחיר ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="w-4 h-4" />
              מסמכים ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-2">
              <Bell className="w-4 h-4" />
              תזכורות ({reminders.filter(r => r.status === 'open').length})
            </TabsTrigger>
            <TabsTrigger value="material-orders" className="gap-2">
              <Package className="w-4 h-4" />
              הזמנות חומר
            </TabsTrigger>
          </TabsList>
          </div>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <PaymentsSection 
              payments={payments} 
              projectId={projectId}
              projectName={project.name}
              dialogOpen={paymentDialogOpen}
              setDialogOpen={setPaymentDialogOpen}
              partners={partners}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersSection 
              orders={orders} 
              projectId={projectId}
              projectName={project.name}
              dialogOpen={orderDialogOpen}
              setDialogOpen={setOrderDialogOpen}
              partners={partners}
            />
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <QuotesSection 
              quotes={quotes} 
              projectId={projectId}
              projectName={project.name}
              dialogOpen={quoteDialogOpen}
              setDialogOpen={setQuoteDialogOpen}
            />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <DocumentsSection 
              documents={documents} 
              projectId={projectId}
              projectName={project.name}
              dialogOpen={documentDialogOpen}
              setDialogOpen={setDocumentDialogOpen}
            />
          </TabsContent>

          {/* Material Orders Tab */}
          <TabsContent value="material-orders">
            <MaterialOrdersTab projectId={projectId} projectName={project.name} />
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders">
            <RemindersSection 
              reminders={reminders} 
              projectId={projectId}
              projectName={project.name}
              dialogOpen={reminderDialogOpen}
              setDialogOpen={setReminderDialogOpen}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Project Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> מחיקת פרויקט
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 text-sm py-2">
            האם אתה בטוח שברצונך למחוק את הפרויקט <strong>"{project.name}"</strong>?
            <br />
            <span className="text-red-500 text-sm mt-1 block">פעולה זו אינה ניתנת לביטול.</span>
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              variant="destructive"
              onClick={() => deleteProjectMutation.mutate()}
              disabled={deleteProjectMutation.isPending}
              className="flex-1"
            >
              {deleteProjectMutation.isPending && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              כן, מחק
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1">
              ביטול
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block dialog */}
      <Dialog open={closeBlockDialogOpen} onOpenChange={setCloseBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" /> לא ניתן לסגור פרויקט
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">נמצאו יתרות פתוחות – יש לסגור אותן לפני סגירת ההתחשבנות:</p>
            <ul className="space-y-2">
              {closeBlockReasons.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={() => setCloseBlockDialogOpen(false)}>הבנתי</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת פרויקט</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            updateProjectMutation.mutate(editFormData);
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>שם פרויקט</Label>
              <Input
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select 
                value={editFormData.status} 
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>הצעה ראשונית מאושרת</Label>
                <Input
                  type="text"
                  value={formatCurrency(initial_quote)}
                  disabled
                  className="bg-slate-100 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500">addition_number = 0</p>
              </div>
              <div className="space-y-2">
                <Label>סכום תוספות מאושרות</Label>
                <Input
                  type="text"
                  value={formatCurrency(additions_total)}
                  disabled
                  className="bg-slate-100 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500">{additions_count} תוספות</p>
              </div>
              <div className="space-y-2">
                <Label>סה״כ מכירה</Label>
                <Input
                  type="text"
                  value={formatCurrency(total_sale)}
                  disabled
                  className="bg-blue-100 cursor-not-allowed font-bold"
                />
                <p className="text-xs text-slate-500">ראשונית + תוספות</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input
                value={editFormData.address || ''}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>צבע אלומיניום</Label>
              <Input
                value={editFormData.aluminum_color || ''}
                onChange={(e) => setEditFormData({ ...editFormData, aluminum_color: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>תאריך פתיחה</Label>
                <Input
                  type="date"
                  value={editFormData.start_date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>תאריך יעד</Label>
                <Input
                  type="date"
                  value={editFormData.target_date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, target_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={editFormData.notes || ''}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {updateProjectMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                עדכון
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Payments Section Component
function PaymentsSection({ payments, projectId, projectName, dialogOpen, setDialogOpen, partners = [] }) {
  const [formData, setFormData] = useState({
    payment_type: 'advance',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer',
    reference: '',
    notes: '',
    received_by_partner_id: '',
    received_by_partner_name: ''
  });
  const [editingPayment, setEditingPayment] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => ClientPaymentService.create({
      ...data,
      project_id: projectId,
      project_name: projectName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-payments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingPayment(null);
      setFormData({
        payment_type: 'advance',
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'transfer',
        reference: '',
        notes: '',
        received_by_partner_id: '',
        received_by_partner_name: ''
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ClientPaymentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-payments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingPayment(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ClientPaymentService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-payments', projectId] })
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const paymentTypeLabels = {
    advance: 'מקדמה',
    interim: 'תשלום ביניים',
    final: 'תשלום סופי'
  };

  const paymentMethodLabels = {
    cash: 'מזומן',
    check: "צ'ק",
    transfer: 'העברה בנקאית',
    credit: 'אשראי'
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">תשלומים מלקוח</h3>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          תשלום חדש
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {payments.map(payment => (
          <div key={payment.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {paymentTypeLabels[payment.payment_type]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: he })} • {paymentMethodLabels[payment.payment_method]}
                {payment.reference && ` • ${payment.reference}`}
                {payment.received_by_partner_name && (
                  <span className="mr-1 text-blue-600 font-medium"> • קיבל: {payment.received_by_partner_name}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingPayment(payment);
                  setFormData({
                    payment_type: payment.payment_type,
                    amount: payment.amount,
                    payment_date: payment.payment_date,
                    payment_method: payment.payment_method,
                    reference: payment.reference || '',
                    notes: payment.notes || '',
                    received_by_partner_id: payment.received_by_partner_id || '',
                    received_by_partner_name: payment.received_by_partner_name || ''
                  });
                  setDialogOpen(true);
                }}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) {
                    deleteMutation.mutate(payment.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            אין תשלומים עדיין
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingPayment(null);
          setFormData({
            payment_type: 'advance',
            amount: 0,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'transfer',
            reference: '',
            notes: '',
            received_by_partner_id: '',
            received_by_partner_name: ''
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'עריכת תשלום' : 'תשלום חדש'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (editingPayment) {
              updateMutation.mutate({ id: editingPayment.id, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>סוג תשלום</Label>
              <Select value={formData.payment_type} onValueChange={(v) => setFormData({ ...formData, payment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">מקדמה</SelectItem>
                  <SelectItem value="interim">תשלום ביניים</SelectItem>
                  <SelectItem value="final">תשלום סופי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סכום</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>תאריך</Label>
              <Input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>אמצעי תשלום</Label>
              <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">מזומן</SelectItem>
                  <SelectItem value="check">צ'ק</SelectItem>
                  <SelectItem value="transfer">העברה בנקאית</SelectItem>
                  <SelectItem value="credit">אשראי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>אסמכתא</Label>
              <Input value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} />
            </div>
            {partners.length > 0 && (
              <div className="space-y-2">
                <Label>מי קיבל את התשלום</Label>
                <Select value={formData.received_by_partner_id || "__none__"} onValueChange={(v) => {
                  if (v === "__none__") {
                    setFormData({ ...formData, received_by_partner_id: '', received_by_partner_name: '' });
                  } else {
                    const p = partners.find((p) => p.id === v);
                    setFormData({ ...formData, received_by_partner_id: v, received_by_partner_name: p?.name || '' });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="בחר שותף" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">לא צוין</SelectItem>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingPayment ? 'עדכון' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingPayment(null);
              }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Orders Section Component
function OrdersSection({ orders, projectId, projectName, dialogOpen, setDialogOpen, partners = [] }) {
  const [formData, setFormData] = useState({
    order_type: 'aluminum',
    supplier_name: '',
    description: '',
    order_amount: 0,
    paid_amount: 0,
    order_date: new Date().toISOString().split('T')[0],
    status: 'ordered',
    paid_by_partner_id: '',
    paid_by_partner_name: ''
  });
  const [editingOrder, setEditingOrder] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => SupplierOrderService.create({
      ...data,
      project_id: projectId,
      project_name: projectName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-orders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingOrder(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => SupplierOrderService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-orders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingOrder(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => SupplierOrderService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-orders', projectId] })
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const orderTypeLabels = { aluminum: 'אלומיניום', hardware: 'פרזול', glass: 'זכוכית', extras: 'תוספות' };
  const statusLabels = { ordered: 'הוזמן', partial: 'שולם חלקית', paid: 'שולם מלא', received: 'התקבל' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">הזמנות ספקים</h3>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          הזמנה חדשה
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {orders.map(order => (
          <div key={order.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{order.supplier_name}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  order.order_type === 'aluminum' ? "bg-blue-100 text-blue-700" :
                  order.order_type === 'hardware' ? "bg-purple-100 text-purple-700" :
                  order.order_type === 'glass' ? "bg-cyan-100 text-cyan-700" :
                  "bg-slate-100 text-slate-700"
                )}>
                  {orderTypeLabels[order.order_type]}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {formatCurrency(order.order_amount)} • שולם: {formatCurrency(order.paid_amount)}
                {order.paid_by_partner_name && (
                  <span className="text-purple-600 font-medium"> • שילם: {order.paid_by_partner_name}</span>
                )}
              </p>
              {order.description && <p className="text-sm text-slate-500">{order.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingOrder(order);
                  setFormData({
                    order_type: order.order_type,
                    supplier_name: order.supplier_name,
                    description: order.description || '',
                    order_amount: order.order_amount,
                    paid_amount: order.paid_amount || 0,
                    order_date: order.order_date || new Date().toISOString().split('T')[0],
                    status: order.status,
                    paid_by_partner_id: order.paid_by_partner_id || '',
                    paid_by_partner_name: order.paid_by_partner_name || ''
                  });
                  setDialogOpen(true);
                }}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) {
                    deleteMutation.mutate(order.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            אין הזמנות עדיין
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingOrder(null);
          setFormData({
            order_type: 'aluminum',
            supplier_name: '',
            description: '',
            order_amount: 0,
            paid_amount: 0,
            order_date: new Date().toISOString().split('T')[0],
            status: 'ordered',
            paid_by_partner_id: '',
            paid_by_partner_name: ''
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'עריכת הזמנה' : 'הזמנה חדשה'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (editingOrder) {
              updateMutation.mutate({ id: editingOrder.id, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>סוג הזמנה</Label>
              <Select value={formData.order_type} onValueChange={(v) => setFormData({ ...formData, order_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aluminum">אלומיניום</SelectItem>
                  <SelectItem value="hardware">פרזול</SelectItem>
                  <SelectItem value="glass">זכוכית</SelectItem>
                  <SelectItem value="extras">תוספות</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ספק</Label>
              <Input value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום הזמנה</Label>
                <Input type="number" value={formData.order_amount} onChange={(e) => setFormData({ ...formData, order_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>סכום ששולם</Label>
                <Input type="number" value={formData.paid_amount} onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>תאריך הזמנה</Label>
              <Input type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} />
            </div>
            {partners.length > 0 && (
              <div className="space-y-2">
                <Label>מי שילם לספק</Label>
                <Select value={formData.paid_by_partner_id || "__none__"} onValueChange={(v) => {
                  if (v === "__none__") {
                    setFormData({ ...formData, paid_by_partner_id: '', paid_by_partner_name: '' });
                  } else {
                    const p = partners.find((p) => p.id === v);
                    setFormData({ ...formData, paid_by_partner_id: v, paid_by_partner_name: p?.name || '' });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="בחר שותף" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">לא צוין</SelectItem>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingOrder ? 'עדכון' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingOrder(null);
              }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quotes Section Component
function QuotesSection({ quotes, projectId, projectName, dialogOpen, setDialogOpen }) {
  const [formData, setFormData] = useState({
    addition_number: quotes.length,
    quote_date: new Date().toISOString().split('T')[0],
    amount: 0,
    changes_description: '',
    status: 'draft'
  });
  const [uploading, setUploading] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => ProjectQuoteService.create({
      ...data,
      project_id: projectId,
      project_name: projectName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingQuote(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ProjectQuoteService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setDialogOpen(false);
      setEditingQuote(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ProjectQuoteService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  // file_url now stores an internal Storage path, not a public URL.
  // Uploading requires a real quote id first — for a brand-new quote
  // (editingQuote === null), create the record (without a file) to get
  // an id, then upload under it. Same "create first, then upload"
  // sequencing as CompanyHeaders.jsx's handleUpload (Phase 6). This is a
  // real behavior change from Base44 (an extra round-trip on first
  // upload for a brand-new quote), not just a rename.
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      let quoteId = editingQuote?.id;
      if (!quoteId) {
        const created = await createMutation.mutateAsync({ ...formData, file_url: null });
        quoteId = created.id;
        setEditingQuote(created);
      }
      const path = await ProjectQuoteService.uploadFile(file, quoteId);
      setFormData(f => ({ ...f, file_url: path }));
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const statusLabels = { draft: 'טיוטה', sent: 'נשלח', approved: 'אושר', rejected: 'נדחה' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">הצעה ראשונית ותוספות</h3>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          {quotes.length === 0 ? 'הצעה ראשונית' : 'תוספת חדשה'}
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {quotes.map(quote => (
          <div key={quote.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">
                  {quote.addition_number === 0 ? 'הצעה ראשונית' : `תוספת ${quote.addition_number}`}
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  quote.status === 'approved' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                )}>
                  {statusLabels[quote.status]}
                </span>
              </div>
              <p className="text-sm text-slate-600">{formatCurrency(quote.amount)}</p>
              {quote.changes_description && <p className="text-sm text-slate-500">{quote.changes_description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {quote.file_url && <QuoteFileLink path={quote.file_url} />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingQuote(quote);
                  setFormData({
                    addition_number: quote.addition_number,
                    quote_date: quote.quote_date || new Date().toISOString().split('T')[0],
                    amount: quote.amount,
                    changes_description: quote.changes_description || '',
                    status: quote.status,
                    file_url: quote.file_url
                  });
                  setDialogOpen(true);
                }}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק הצעת מחיר זו?')) {
                    deleteMutation.mutate(quote.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {quotes.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            אין הצעות מחיר עדיין
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingQuote(null);
          setFormData({
            addition_number: quotes.length,
            quote_date: new Date().toISOString().split('T')[0],
            amount: 0,
            changes_description: '',
            status: 'draft'
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuote ? 'עריכת הצעה/תוספת' : (quotes.length === 0 ? 'הצעה ראשונית' : 'תוספת להצעה')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (editingQuote) {
              updateMutation.mutate({ id: editingQuote.id, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>מספר תוספת</Label>
                <Input 
                  type="number" 
                  value={formData.addition_number} 
                  onChange={(e) => setFormData({ ...formData, addition_number: parseInt(e.target.value) || 0 })} 
                />
                <p className="text-xs text-slate-500">0 = הצעה ראשונית, 1+ = תוספות</p>
              </div>
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input type="date" value={formData.quote_date} onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>סכום</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>תיאור שינויים</Label>
              <Textarea value={formData.changes_description} onChange={(e) => setFormData({ ...formData, changes_description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>קובץ PDF</Label>
              <Input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
              {uploading && <p className="text-sm text-slate-500">מעלה...</p>}
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">טיוטה</SelectItem>
                  <SelectItem value="sent">נשלח</SelectItem>
                  <SelectItem value="approved">אושר</SelectItem>
                  <SelectItem value="rejected">נדחה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingQuote ? 'עדכון' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingQuote(null);
              }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Documents Section Component
function DocumentsSection({ documents, projectId, projectName, dialogOpen, setDialogOpen }) {
  const [formData, setFormData] = useState({
    document_type: 'contract',
    name: '',
    notes: ''
  });
  const [uploading, setUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => DocumentService.create({
      ...data,
      project_id: projectId,
      project_name: projectName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      setDialogOpen(false);
      setEditingDocument(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => DocumentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      setDialogOpen(false);
      setEditingDocument(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => DocumentService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] })
  });

  // file_url on documents is required at insert time (same as Base44's
  // original schema), so a document can't be created with a null file
  // first the way ProjectQuoteService's flow does. Instead, uploads for
  // a not-yet-created document use a client-generated random id as the
  // Storage path segment — the real document row (created on submit)
  // never needs to "know" about this id, it just stores the resulting
  // path as file_url like any other field.
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const scopeId = editingDocument?.id || `pending_${Date.now()}`;
      const path = await DocumentService.uploadFile(file, scopeId);
      setFormData(f => ({ ...f, file_url: path, name: f.name || file.name }));
    } finally {
      setUploading(false);
    }
  };

  const docTypeLabels = { contract: 'חוזה', plan: 'תוכנית', invoice: 'חשבונית', photo: 'תמונה', delivery: 'תעודת משלוח' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">מסמכים</h3>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          מסמך חדש
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {documents.map(doc => (
          <div key={doc.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-slate-400" />
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-sm text-slate-500">{docTypeLabels[doc.document_type]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DocumentFileLink path={doc.file_url} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingDocument(doc);
                  setFormData({
                    document_type: doc.document_type,
                    name: doc.name,
                    notes: doc.notes || '',
                    file_url: doc.file_url
                  });
                  setDialogOpen(true);
                }}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק מסמך זה?')) {
                    deleteMutation.mutate(doc.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            אין מסמכים עדיין
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingDocument(null);
          setFormData({
            document_type: 'contract',
            name: '',
            notes: ''
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'עריכת מסמך' : 'מסמך חדש'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (editingDocument) {
              updateMutation.mutate({ id: editingDocument.id, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>סוג מסמך</Label>
              <Select value={formData.document_type} onValueChange={(v) => setFormData({ ...formData, document_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">חוזה</SelectItem>
                  <SelectItem value="plan">תוכנית</SelectItem>
                  <SelectItem value="invoice">חשבונית</SelectItem>
                  <SelectItem value="photo">תמונה</SelectItem>
                  <SelectItem value="delivery">תעודת משלוח</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שם המסמך</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>קובץ</Label>
              <Input type="file" onChange={handleFileUpload} disabled={uploading} />
              {uploading && <p className="text-sm text-slate-500">מעלה...</p>}
              {formData.file_url && !editingDocument && <p className="text-sm text-green-600">✓ קובץ הועלה</p>}
              {editingDocument && <p className="text-sm text-slate-500">להשאיר ריק כדי לשמור את הקובץ הקיים</p>}
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!editingDocument && !formData.file_url}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingDocument ? 'עדכון' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingDocument(null);
              }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reminders Section Component
function RemindersSection({ reminders, projectId, projectName, dialogOpen, setDialogOpen }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    status: 'open'
  });
  const [editingReminder, setEditingReminder] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => ReminderService.create({
      ...data,
      project_id: projectId,
      project_name: projectName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-reminders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDialogOpen(false);
      setEditingReminder(null);
    }
  });

  const updateReminder = useMutation({
    mutationFn: ({ id, data }) => ReminderService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-reminders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDialogOpen(false);
      setEditingReminder(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ReminderService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-reminders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ReminderService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-reminders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  const priorityLabels = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה' };
  const statusLabels = { open: 'פתוח', done: 'בוצע', postponed: 'נדחה' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">תזכורות</h3>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          תזכורת חדשה
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {reminders.map(reminder => (
          <div key={reminder.id} className={cn(
            "p-4 hover:bg-slate-50 flex items-center justify-between gap-4",
            reminder.status === 'done' && "opacity-50"
          )}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{reminder.title}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  reminder.priority === 'high' ? "bg-red-100 text-red-700" :
                  reminder.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-700"
                )}>
                  {priorityLabels[reminder.priority]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {format(new Date(reminder.due_date), 'dd/MM/yyyy', { locale: he })}
              </p>
              {reminder.description && <p className="text-sm text-slate-600 mt-1">{reminder.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Select 
                value={reminder.status} 
                onValueChange={(v) => updateMutation.mutate({ id: reminder.id, data: { status: v } })}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">פתוח</SelectItem>
                  <SelectItem value="done">בוצע</SelectItem>
                  <SelectItem value="postponed">נדחה</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingReminder(reminder);
                  setFormData({
                    title: reminder.title,
                    description: reminder.description || '',
                    due_date: reminder.due_date,
                    priority: reminder.priority,
                    status: reminder.status
                  });
                  setDialogOpen(true);
                }}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק תזכורת זו?')) {
                    deleteMutation.mutate(reminder.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {reminders.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            אין תזכורות עדיין
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingReminder(null);
          setFormData({
            title: '',
            description: '',
            due_date: new Date().toISOString().split('T')[0],
            priority: 'medium',
            status: 'open'
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'עריכת תזכורת' : 'תזכורת חדשה'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (editingReminder) {
              updateReminder.mutate({ id: editingReminder.id, data: formData });
            } else {
              createMutation.mutate(formData);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>כותרת</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>תאריך יעד</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>דחיפות</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">נמוכה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="high">גבוהה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateReminder.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingReminder ? 'עדכון' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingReminder(null);
              }}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}