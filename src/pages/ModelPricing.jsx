import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, BookmarkPlus, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import ModelComponentsTab from "@/components/models/ModelComponentsTab";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/quoteCalculations";
import TemplateComponentsManager from "@/components/templates/TemplateComponentsManager";
import CatalogPickerModal from "@/components/quotes/CatalogPickerModal";

const PRICING_METHOD_LABELS = {
  sqm: 'מ"ר',
  meter: "מ' רץ רוחב",
  meter_width: "מ' רץ רוחב",
  meter_height: "מ' רץ גובה",
  unit: "יחידה"
};

const emptyForm = {
  model_name: "",
  category: "product",
  pricing_method: "sqm",
  base_price: "",
  notes: "",
  is_active: true
};

const PRICING_METHOD_OPTIONS = [
  { value: "sqm",          label: 'מחיר לפי מ"ר — (רוחב × גובה / 10,000) × מחיר' },
  { value: "meter_width",  label: "מחיר לפי מ' רץ רוחב — (רוחב / 100) × מחיר" },
  { value: "meter_height", label: "מחיר לפי מ' רץ גובה — (גובה / 100) × מחיר" },
  { value: "unit",         label: "מחיר לפי יחידה — כמות × מחיר" },
];

export default function ModelPricing() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterCat, setFilterCat] = useState("all");

  // Templates state
  const [editTemplateDialog, setEditTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [expandedTemplates, setExpandedTemplates] = useState({});
  const [newTemplatePicker, setNewTemplatePicker] = useState(false);
  const [savingNewTemplate, setSavingNewTemplate] = useState(false);

  const queryClient = useQueryClient();

  // ── Catalog queries ──────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: () => base44.entities.ModelPricing.list()
  });

  const { data: allModelComponents = [] } = useQuery({
    queryKey: ["all-model-components"],
    queryFn: () => base44.entities.ModelComponent.list(),
    enabled: items.length > 0
  });

  const modelComponentCountMap = allModelComponents.reduce((acc, c) => {
    acc[c.model_id] = (acc[c.model_id] || 0) + 1;
    return acc;
  }, {});

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ModelPricing.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      queryClient.invalidateQueries({ queryKey: ["model-pricing"] });
      setDialogOpen(false);
      setFormData(emptyForm);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ModelPricing.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      queryClient.invalidateQueries({ queryKey: ["model-pricing"] });
      setDialogOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ModelPricing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      queryClient.invalidateQueries({ queryKey: ["model-pricing"] });
    }
  });

  // ── Template queries ─────────────────────────────────────────────────────────
  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => base44.entities.QuoteTemplate.list()
  });

  const { data: allTemplateComps = [] } = useQuery({
    queryKey: ["all-template-components"],
    queryFn: async () => {
      if (templates.length === 0) return [];
      const results = await Promise.all(
        templates.map(t => base44.entities.QuoteTemplateComponent.filter({ template_id: t.id }))
      );
      return results.flat();
    },
    enabled: templates.length > 0
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteTemplate.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quote-templates"] })
  });

  const handleCreateNewTemplate = async (selectedItems, { name, description }) => {
    setSavingNewTemplate(true);
    try {
      const tmpl = await base44.entities.QuoteTemplate.create({ name, description });
      await Promise.all(selectedItems.map((item, idx) =>
        base44.entities.QuoteTemplateComponent.create({
          template_id: tmpl.id,
          catalog_item_id: item.id,
          name_snapshot: item.model_name,
          pricing_method_snapshot: item.pricing_method,
          price_snapshot: item.base_price,
          sort_order: idx
        })
      ));
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      queryClient.invalidateQueries({ queryKey: ["all-template-components"] });
      setNewTemplatePicker(false);
    } finally {
      setSavingNewTemplate(false);
    }
  };

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      setEditTemplateDialog(false);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quote-templates"] })
  });


  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, base_price: parseFloat(formData.base_price) || 0 };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      model_name: item.model_name,
      category: item.category || "product",
      pricing_method: item.pricing_method || "sqm",
      base_price: item.base_price ?? "",
      notes: item.notes || "",
      is_active: item.is_active !== false
    });
    setDialogOpen(true);
  };

  const openEditTemplate = (t) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateDesc(t.description || "");
    setEditTemplateDialog(true);
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

  const filtered = filterCat === "all" ? items : items.filter(i => i.category === filterCat);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">קטלוג רכיבים ותבניות</h1>
          <p className="text-slate-500">בסיס לבניית הצעות מחיר חופשית</p>
        </div>

        <Tabs defaultValue="catalog">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="catalog">קטלוג רכיבים ({items.length})</TabsTrigger>
            <TabsTrigger value="templates">תבניות ({templates.length})</TabsTrigger>
          </TabsList>

          {/* ── Catalog tab ── */}
          <TabsContent value="catalog" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterCat("all")}
                  className={cn("text-sm px-3 py-1.5 rounded-full border transition-colors", filterCat === "all" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50")}
                >
                  הכל ({items.length})
                </button>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const count = items.filter(i => i.category === key).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterCat(key)}
                      className={cn("text-sm px-3 py-1.5 rounded-full border transition-colors", filterCat === key ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50")}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => { setFormData(emptyForm); setEditingId(null); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 ml-2" /> רכיב חדש
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">שם רכיב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">קטגוריה</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">שיטת חישוב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">מחיר בסיס</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">סטטוס</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(item => (
                    <tr key={item.id} className={cn("hover:bg-slate-50", !item.is_active && "opacity-50")}>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.model_name}
                        {item.notes && <p className="text-xs text-slate-400 font-normal">{item.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium", CATEGORY_COLORS[item.category])}>
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{PRICING_METHOD_LABELS[item.pricing_method]}</td>
                      <td className="px-4 py-3 font-semibold text-blue-700">
                        {formatCurrency(item.base_price)}/{PRICING_METHOD_LABELS[item.pricing_method]}
                      </td>
                      <td className="px-4 py-3">
                        {modelComponentCountMap[item.id] > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">פעיל</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { if (window.confirm("למחוק רכיב זה?")) deleteMutation.mutate(item.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      {items.length === 0 ? "אין רכיבים — הוסף את הרכיב הראשון" : "אין רכיבים בקטגוריה זו"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Templates tab ── */}
          <TabsContent value="templates" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setNewTemplatePicker(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 ml-2" /> תבנית חדשה
              </Button>
            </div>
            {templates.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
                <BookmarkPlus className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>אין תבניות שמורות עדיין</p>
                <p className="text-sm mt-1">לחץ "תבנית חדשה" כדי ליצור תבנית מהקטלוג</p>
              </div>
            )}
            {templates.map(t => {
              const comps = allTemplateComps.filter(c => c.template_id === t.id);
              const isExpanded = expandedTemplates[t.id];
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Template header */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => setExpandedTemplates(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{t.name}</p>
                      {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                      <p className="text-xs text-slate-400">{comps.length} רכיבים</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditTemplate(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm("למחוק תבנית זו?")) deleteTemplateMutation.mutate(t.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Components list */}
                  {isExpanded && (
                    <TemplateComponentsManager
                      templateId={t.id}
                      comps={comps}
                      catalogItems={items}
                    />
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Catalog item dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "עריכת דגם" : "דגם חדש"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="pricing">
            <TabsList className="w-full bg-slate-100">
              <TabsTrigger value="pricing" className="flex-1">תמחור</TabsTrigger>
              <TabsTrigger value="components" className="flex-1" disabled={!editingId}>
                <Settings2 className="w-3 h-3 ml-1" /> רכיבי ייצור {!editingId && <span className="text-xs text-slate-400 mr-1">(שמור תחילה)</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pricing">
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>שם רכיב</Label>
                  <Input value={formData.model_name} onChange={e => setFormData({ ...formData, model_name: e.target.value })} required placeholder='לדוגמה: "חלון 9000 2 כנפיים"' />
                </div>
                <div className="space-y-1">
                  <Label>קטגוריה</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>שיטת חישוב</Label>
                  <Select value={formData.pricing_method} onValueChange={v => setFormData({ ...formData, pricing_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_METHOD_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>מחיר בסיס (₪ ל{PRICING_METHOD_LABELS[formData.pricing_method]})</Label>
                  <Input type="number" value={formData.base_price} onChange={e => setFormData({ ...formData, base_price: e.target.value })} required placeholder="לדוגמה: 1200" />
                </div>
                <div className="space-y-1">
                  <Label>הערות</Label>
                  <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                  <Label htmlFor="is_active">פעיל</Label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {editingId ? "עדכון" : "הוספה"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="components" className="pt-2">
              {editingId && <ModelComponentsTab modelId={editingId} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* New template — CatalogPickerModal in template mode */}
      <CatalogPickerModal
        open={newTemplatePicker}
        onClose={() => setNewTemplatePicker(false)}
        catalogItems={items}
        mode="template"
        isSaving={savingNewTemplate}
        onConfirm={handleCreateNewTemplate}
      />

      {/* Edit template name dialog */}
      <Dialog open={editTemplateDialog} onOpenChange={setEditTemplateDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>עריכת תבנית</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>שם תבנית</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>תיאור</Label>
              <Input value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={updateTemplateMutation.isPending}
                onClick={() => updateTemplateMutation.mutate({ id: editingTemplate.id, data: { name: templateName, description: templateDesc } })}
              >
                {updateTemplateMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                שמור
              </Button>
              <Button variant="outline" onClick={() => setEditTemplateDialog(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}