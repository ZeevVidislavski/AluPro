import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Plus, 
  Search, 
  Filter,
  Loader2,
  ChevronLeft,
  Building2,
  Calendar,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProjectStatusBadge from "@/components/dashboard/ProjectStatusBadge";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { cn } from "@/lib/utils";

const emptyProject = {
  name: '',
  customer_id: '',
  customer_name: '',
  address: '',
  aluminum_color: '',
  start_date: '',
  target_date: '',
  status: 'quote',
  notes: ''
};

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

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyProject);
  

  const queryClient = useQueryClient();

  // Check URL params for customer filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('customer');
    if (customerId) {
      setCustomerFilter(customerId);
    }
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['all-payments'],
    queryFn: () => base44.entities.ClientPayment.list()
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.SupplierOrder.list()
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['all-quotes'],
    queryFn: () => base44.entities.ProjectQuote.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate project number
      const projectNumber = `P${Date.now().toString().slice(-6)}`;
      return base44.entities.Project.create({ 
        ...data, 
        project_number: projectNumber
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeDialog();
    }
  });

  const openCreateDialog = () => {
    setFormData(emptyProject);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData(emptyProject);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS', 
      maximumFractionDigits: 0 
    }).format(amount || 0);
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name?.toLowerCase().includes(search.toLowerCase()) ||
                         project.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                         project.project_number?.includes(search);
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || project.customer_id === customerFilter;
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">פרויקטים</h1>
            <p className="text-slate-500 mt-1">{projects.length} פרויקטים במערכת</p>
          </div>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-5 h-5 ml-2" />
            פרויקט חדש
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="חיפוש לפי שם פרויקט, לקוח או מספר..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="לקוח" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הלקוחות</SelectItem>
              {customers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            // Calculate financials using centralized function
            const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
            
            return (
              <div key={project.id} className="relative bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all hover:border-blue-200 group">
              <Link
                to={createPageUrl("ProjectDetails") + `?id=${project.id}`}
                className="block p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {project.project_number && (
                        <span className="text-xs text-slate-400">#{project.project_number}</span>
                      )}
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{project.customer_name}</span>
                  </div>
                  {project.target_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{format(new Date(project.target_date), 'dd/MM/yyyy', { locale: he })}</span>
                    </div>
                  )}
                  {project.aluminum_color && (
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-slate-400" />
                      <span>{project.aluminum_color}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">סכום הצעה</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(financials.total_sale)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">יתרה לגבייה</p>
                    <p className={cn(
                      "font-semibold",
                      financials.balance_to_collect > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {formatCurrency(financials.balance_to_collect)}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">לא נמצאו פרויקטים</h3>
            <p className="text-slate-500">נסה לשנות את פרמטרי החיפוש</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>פרויקט חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם פרויקט *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">לקוח *</Label>
              <Select 
                value={formData.customer_id} 
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">כתובת פרויקט</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aluminum_color">צבע אלומיניום</Label>
              <Input
                id="aluminum_color"
                value={formData.aluminum_color}
                onChange={(e) => setFormData({ ...formData, aluminum_color: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">תאריך פתיחה</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_date">תאריך יעד</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">סטטוס</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
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



            <div className="space-y-2">
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                )}
                יצירה
              </Button>
              <Button type="button" variant="outline" onClick={closeDialog}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}