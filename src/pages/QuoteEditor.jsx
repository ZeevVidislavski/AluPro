import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Loader2, Printer, Save, FileDown } from "lucide-react";
import { generateDescription, calcItemTotal } from "@/lib/quoteCalculations";
import QuoteItemCard from "@/components/quotes/QuoteItemCard";
import CatalogPickerModal from "@/components/quotes/CatalogPickerModal";
import SaveTemplateModal from "@/components/quotes/TemplateModal";
import LoadTemplateModal from "@/components/quotes/LoadTemplateModal";
import SelectHeaderModal from "@/components/quotes/SelectHeaderModal";
import QuotePrintView from "@/components/quotes/QuotePrintView";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function calcQuoteTotals(items, itemComponentsMap, discountPercent, vatPercent) {
  const linesTotal = items.reduce((sum, item) => {
    const comps = itemComponentsMap[item.id || item._tempId] || [];
    const itemQty = item.quantity || 1;
    return sum + calcItemTotal(comps, item.width_cm, item.height_cm, itemQty);
  }, 0);
  const afterDiscount = linesTotal * (1 - (discountPercent || 0) / 100);
  const vatAmount = afterDiscount * (vatPercent || 17) / 100;
  const totalWithVat = afterDiscount + vatAmount;
  return { linesTotal, subtotal: afterDiscount, vatAmount, totalWithVat };
}

export default function QuoteEditor() {
  const [quoteId, setQuoteId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    vat_percent: 17,
    discount_percent: 0,
    notes: "",
    valid_until: "",
    status: "draft",
    quote_date: new Date().toISOString().split("T")[0]
  });

  // items: array of QuoteItem objects (with _tempId for unsaved)
  const [items, setItems] = useState([]);
  // components map: { [itemKey]: QuoteItemComponent[] }
  const [componentsMap, setComponentsMap] = useState({});
  // which item cards are expanded
  const [expandedItems, setExpandedItems] = useState({});

  // catalog picker
  const [catalogPickerFor, setCatalogPickerFor] = useState(null); // itemKey or null
  // save template
  const [saveTemplateFor, setSaveTemplateFor] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  // load template
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [showSelectHeader, setShowSelectHeader] = useState(false);
  const [selectedHeader, setSelectedHeader] = useState(null);

  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const printRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuoteId(params.get("quote_id"));
  }, []);

  // ─── Data queries ────────────────────────────────────────────────────────────
  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => base44.entities.ProjectQuote.filter({ id: quoteId }),
    enabled: !!quoteId,
    select: d => d[0]
  });

  useEffect(() => {
    if (quote) {
      setQuoteForm({
        vat_percent: quote.vat_percent ?? 17,
        discount_percent: quote.discount_percent ?? 0,
        notes: quote.notes || "",
        valid_until: quote.valid_until || "",
        status: quote.status || "draft",
        quote_date: quote.quote_date || new Date().toISOString().split("T")[0]
      });
    }
  }, [quote]);

  const { data: savedItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["quote-items", quoteId],
    queryFn: () => base44.entities.QuoteItem.filter({ quote_id: quoteId }),
    enabled: !!quoteId
  });

  const { data: allComponents = [], isLoading: loadingComponents } = useQuery({
    queryKey: ["quote-item-components", quoteId],
    queryFn: async () => {
      const itemIds = savedItems.map(i => i.id);
      if (itemIds.length === 0) return [];
      // fetch all components for all items of this quote
      const results = await Promise.all(
        itemIds.map(id => base44.entities.QuoteItemComponent.filter({ quote_item_id: id }))
      );
      return results.flat();
    },
    enabled: savedItems.length > 0
  });

  // Populate local state from DB — only on initial load (when no local items exist yet)
  useEffect(() => {
    if (savedItems.length > 0 && items.length === 0) {
      setItems(savedItems);
      const expanded = {};
      savedItems.forEach(i => { expanded[i.id] = true; });
      setExpandedItems(prev => ({ ...expanded, ...prev }));
    }
  }, [savedItems]);

  useEffect(() => {
    if (allComponents.length > 0) {
      const map = {};
      allComponents.forEach(c => {
        if (!map[c.quote_item_id]) map[c.quote_item_id] = [];
        map[c.quote_item_id].push(c);
      });
      setComponentsMap(map);
    }
  }, [allComponents]);

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: () => base44.entities.ModelPricing.list()
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => base44.entities.QuoteTemplate.list()
  });

  const { data: companyHeaders = [] } = useQuery({
    queryKey: ["company-headers"],
    queryFn: () => base44.entities.CompanyHeader.list()
  });

  const { data: project } = useQuery({
    queryKey: ["project", quote?.project_id],
    queryFn: () => base44.entities.Project.filter({ id: quote?.project_id }),
    enabled: !!quote?.project_id,
    select: d => d[0]
  });

  // ─── Item helpers ─────────────────────────────────────────────────────────────
  const getItemKey = (item) => item.id || item._tempId;

  const getComponents = (item) => componentsMap[getItemKey(item)] || [];

  const addNewItem = () => {
    const tempId = `_tmp_${Date.now()}`;
    const newItem = { _tempId: tempId, quote_id: quoteId, width_cm: 0, height_cm: 0, quantity: 1, description: "", total_price: 0 };
    setItems(prev => [...prev, newItem]);
    setComponentsMap(prev => ({ ...prev, [tempId]: [] }));
    setExpandedItems(prev => ({ ...prev, [tempId]: true }));
  };

  const updateItem = (key, changes) => {
    setItems(prev => prev.map(i => getItemKey(i) === key ? { ...i, ...changes } : i));
  };

  const deleteItem = async (key) => {
    const item = items.find(i => getItemKey(i) === key);
    if (item?.id) {
      // delete all components first
      const comps = componentsMap[key] || [];
      await Promise.all(comps.filter(c => c.id).map(c => base44.entities.QuoteItemComponent.delete(c.id)));
      await base44.entities.QuoteItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ["quote-items", quoteId] });
    }
    setItems(prev => prev.filter(i => getItemKey(i) !== key));
    setComponentsMap(prev => { const m = { ...prev }; delete m[key]; return m; });
  };

  // ─── Component helpers ────────────────────────────────────────────────────────
  const addComponentsToItem = (itemKey, selectedCatalogItems) => {
    const item = items.find(i => getItemKey(i) === itemKey);
    const newComps = selectedCatalogItems.map((cat, idx) => ({
      _tempId: `_ctmp_${Date.now()}_${idx}`,
      quote_item_id: itemKey, // will be replaced with real ID on save
      catalog_item_id: cat.id,
      name_snapshot: cat.model_name,
      category_snapshot: cat.category,
      pricing_method_snapshot: cat.pricing_method,
      price_snapshot: cat.base_price,
      sort_order: (componentsMap[itemKey]?.length || 0) + idx
    }));

    const updatedComps = [...(componentsMap[itemKey] || []), ...newComps];
    setComponentsMap(prev => ({ ...prev, [itemKey]: updatedComps }));

    // Auto-generate description
    const newDesc = generateDescription(updatedComps);
    updateItem(itemKey, { description: newDesc });
  };

  const removeComponent = (itemKey, compKey) => {
    setComponentsMap(prev => {
      const updated = (prev[itemKey] || []).filter(c => (c.id || c._tempId) !== compKey);
      const item = items.find(i => getItemKey(i) === itemKey);
      // update description
      const newDesc = generateDescription(updated);
      updateItem(itemKey, { description: newDesc });
      return { ...prev, [itemKey]: updated };
    });
  };

  const updateComponentPrice = (itemKey, compKey, newPrice) => {
    setComponentsMap(prev => ({
      ...prev,
      [itemKey]: (prev[itemKey] || []).map(c =>
        (c.id || c._tempId) === compKey ? { ...c, price_snapshot: newPrice } : c
      )
    }));
  };

  const updateComponentQuantity = (itemKey, compKey, newQty) => {
    setComponentsMap(prev => ({
      ...prev,
      [itemKey]: (prev[itemKey] || []).map(c =>
        (c.id || c._tempId) === compKey ? { ...c, quantity: newQty } : c
      )
    }));
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const savedItemsMap = {};

      for (const item of items) {
        const key = getItemKey(item);
        const comps = componentsMap[key] || [];
        const itemQty = item.quantity || 1;
        const totalPrice = calcItemTotal(comps, item.width_cm, item.height_cm, itemQty);

        let savedItem;
        const itemData = {
          quote_id: quoteId,
          width_cm: item.width_cm || 0,
          height_cm: item.height_cm || 0,
          quantity: item.quantity || 1,
          description: item.description || "",
          total_price: totalPrice
        };

        if (item.id) {
          savedItem = await base44.entities.QuoteItem.update(item.id, itemData);
          savedItem = { ...item, ...itemData };
        } else {
          savedItem = await base44.entities.QuoteItem.create(itemData);
        }

        savedItemsMap[key] = savedItem.id;

        // Save components
        for (const comp of comps) {
          const compData = {
            quote_item_id: savedItem.id,
            catalog_item_id: comp.catalog_item_id || null,
            name_snapshot: comp.name_snapshot,
            category_snapshot: comp.category_snapshot || "",
            pricing_method_snapshot: comp.pricing_method_snapshot,
            price_snapshot: comp.price_snapshot,
            quantity: comp.quantity ?? null,
            calculated_value: calcItemTotal([comp], item.width_cm, item.height_cm, item.quantity || 1),
            sort_order: comp.sort_order || 0
          };
          if (comp.id) {
            await base44.entities.QuoteItemComponent.update(comp.id, compData);
          } else {
            const saved = await base44.entities.QuoteItemComponent.create(compData);
            // update local map with real id
            setComponentsMap(prev => ({
              ...prev,
              [key]: (prev[key] || []).map(c => c._tempId === comp._tempId ? { ...c, id: saved.id } : c)
            }));
          }
        }
      }

      // Update items with real ids — build updatedItems locally for accurate totals
      const updatedItems = items.map(i => {
        const realId = savedItemsMap[getItemKey(i)];
        return realId ? { ...i, id: realId, _tempId: undefined } : i;
      });
      setItems(updatedItems);

      // Recalculate totals using updatedItems (not stale state)
      const t = calcQuoteTotals(updatedItems, componentsMap, quoteForm.discount_percent, quoteForm.vat_percent);
      await base44.entities.ProjectQuote.update(quoteId, {
        ...quoteForm,
        subtotal: t.subtotal,
        vat_amount: t.vatAmount,
        total_with_vat: t.totalWithVat,
        amount: t.subtotal,
        is_detailed: true
      });

      queryClient.invalidateQueries({ queryKey: ["quote-items", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-item-components", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["all-quotes"] });
    } finally {
      setSaving(false);
    }
  };

  // ─── Save as template ─────────────────────────────────────────────────────────
  const handleSaveTemplate = async (itemKey, { name, description }) => {
    setSavingTemplate(true);
    try {
      const tmpl = await base44.entities.QuoteTemplate.create({ name, description });
      const comps = componentsMap[itemKey] || [];
      await Promise.all(comps.map((comp, idx) =>
        base44.entities.QuoteTemplateComponent.create({
          template_id: tmpl.id,
          catalog_item_id: comp.catalog_item_id || null,
          name_snapshot: comp.name_snapshot,
          category_snapshot: comp.category_snapshot || "",
          pricing_method_snapshot: comp.pricing_method_snapshot,
          price_snapshot: comp.price_snapshot,
          sort_order: idx
        })
      ));
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      setSaveTemplateFor(null);
    } finally {
      setSavingTemplate(false);
    }
  };

  // ─── Load template ────────────────────────────────────────────────────────────
  const handleLoadTemplate = async (templateId, priceMode) => {
    const templateComps = await base44.entities.QuoteTemplateComponent.filter({ template_id: templateId });
    const template = templates.find(t => t.id === templateId);

    const tempItemId = `_tmp_${Date.now()}`;
    const newComps = templateComps.map((tc, idx) => {
      let price = tc.price_snapshot;
      if (priceMode === "catalog" && tc.catalog_item_id) {
        const cat = catalogItems.find(c => c.id === tc.catalog_item_id);
        if (cat) price = cat.base_price;
      }
      return {
        _tempId: `_ctmp_${Date.now()}_${idx}`,
        quote_item_id: tempItemId,
        catalog_item_id: tc.catalog_item_id,
        name_snapshot: tc.name_snapshot,
        category_snapshot: tc.category_snapshot || "",
        pricing_method_snapshot: tc.pricing_method_snapshot,
        price_snapshot: price,
        sort_order: idx
      };
    });

    const newItem = {
      _tempId: tempItemId,
      quote_id: quoteId,
      width_cm: 0,
      height_cm: 0,
      quantity: 1,
      description: template?.name || generateDescription(newComps),
      total_price: 0
    };

    setItems(prev => [...prev, newItem]);
    setComponentsMap(prev => ({ ...prev, [tempItemId]: newComps }));
    setExpandedItems(prev => ({ ...prev, [tempItemId]: true }));
    setShowLoadTemplate(false);
  };

  // ─── PDF ──────────────────────────────────────────────────────────────────────
  const handlePDFClick = () => {
    if (companyHeaders.length > 0) {
      setShowSelectHeader(true);
    } else {
      startPDF(null);
    }
  };

  const startPDF = async (header) => {
    setSelectedHeader(header);
    await handleSave();
    setShowPrint(true);
    setTimeout(async () => {
      const el = printRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`הצעת-מחיר-${quote?.project_name || ""}.pdf`);
      setShowPrint(false);
    }, 500);
  };

  // ─── Totals ───────────────────────────────────────────────────────────────────
  const totals = calcQuoteTotals(items, componentsMap, quoteForm.discount_percent, quoteForm.vat_percent);
  const formatCurrency = (n) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loadingQuote || loadingItems) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (!quote) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">הצעה לא נמצאה</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/Quotes" className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">עריכת הצעת מחיר — {quote.project_name}</h1>
            <p className="text-slate-500 text-sm">{quote.customer_name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePDFClick} disabled={saving}>
              <Printer className="w-4 h-4 ml-2" /> PDF
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              שמור
            </Button>
          </div>
        </div>

        {/* Quote meta */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">פרטי הצעה</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>תאריך הצעה</Label>
              <Input type="date" value={quoteForm.quote_date} onChange={e => setQuoteForm({ ...quoteForm, quote_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>בתוקף עד</Label>
              <Input type="date" value={quoteForm.valid_until} onChange={e => setQuoteForm({ ...quoteForm, valid_until: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>סטטוס</Label>
              <Select value={quoteForm.status} onValueChange={v => setQuoteForm({ ...quoteForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">טיוטה</SelectItem>
                  <SelectItem value="sent">נשלח</SelectItem>
                  <SelectItem value="approved">אושר</SelectItem>
                  <SelectItem value="rejected">נדחה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>מע"מ (%)</Label>
              <Input type="number" value={quoteForm.vat_percent} onChange={e => setQuoteForm({ ...quoteForm, vat_percent: parseFloat(e.target.value) || 17 })} />
            </div>
          </div>
        </div>

        {/* Items section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">פריטי ההצעה</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowLoadTemplate(true)}>
                <FileDown className="w-4 h-4 ml-1" /> טען תבנית
              </Button>
              <Button size="sm" onClick={addNewItem} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 ml-1" /> פריט חדש
              </Button>
            </div>
          </div>

          {items.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
              <p className="text-lg mb-2">אין פריטים בהצעה</p>
              <p className="text-sm">לחץ "פריט חדש" או "טען תבנית" להתחלה</p>
            </div>
          )}

          {items.map(item => {
            const key = getItemKey(item);
            return (
              <QuoteItemCard
                key={key}
                item={item}
                components={getComponents(item)}
                isExpanded={expandedItems[key] !== false}
                onToggleExpand={() => setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }))}
                onUpdateItem={(k, changes) => updateItem(k, changes)}
                onDeleteItem={() => deleteItem(key)}
                onAddComponents={() => setCatalogPickerFor(key)}
                onRemoveComponent={(compKey) => removeComponent(key, compKey)}
                onUpdateComponentPrice={(compKey, price) => updateComponentPrice(key, compKey, price)}
                onUpdateComponentQuantity={(compKey, qty) => updateComponentQuantity(key, compKey, qty)}
                onSaveAsTemplate={() => setSaveTemplateFor(key)}
              />
            );
          })}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-col items-end gap-2 max-w-xs mr-0 ml-auto w-full">
              <div className="flex justify-between w-full text-sm">
                <span className="text-slate-600">סכום לפני הנחה</span>
                <span>{formatCurrency(totals.linesTotal)}</span>
              </div>
              <div className="flex items-center justify-between w-full text-sm gap-2">
                <span className="text-slate-600">הנחה (%)</span>
                <Input
                  type="number"
                  value={quoteForm.discount_percent}
                  onChange={e => setQuoteForm({ ...quoteForm, discount_percent: parseFloat(e.target.value) || 0 })}
                  className="w-16 h-7 text-sm"
                />
                <span className="text-red-500">-{formatCurrency(totals.linesTotal - totals.subtotal)}</span>
              </div>
              <div className="flex justify-between w-full text-sm">
                <span className="text-slate-600">לפני מע"מ</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between w-full text-sm">
                <span className="text-slate-600">מע"מ {quoteForm.vat_percent}%</span>
                <span>{formatCurrency(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between w-full text-base font-bold border-t border-slate-200 pt-2">
                <span>סה"כ כולל מע"מ</span>
                <span className="text-blue-700">{formatCurrency(totals.totalWithVat)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <Label className="mb-2 block">הערות</Label>
          <Textarea
            value={quoteForm.notes}
            onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })}
            rows={3}
            placeholder="הערות ותנאים..."
          />
        </div>
      </div>

      {/* Catalog picker modal */}
      <CatalogPickerModal
        open={!!catalogPickerFor}
        onClose={() => setCatalogPickerFor(null)}
        catalogItems={catalogItems}
        onConfirm={(selected) => {
          addComponentsToItem(catalogPickerFor, selected);
          setCatalogPickerFor(null);
        }}
      />

      {/* Save template modal */}
      <SaveTemplateModal
        open={!!saveTemplateFor}
        onClose={() => setSaveTemplateFor(null)}
        isSaving={savingTemplate}
        onSave={({ name, description }) => handleSaveTemplate(saveTemplateFor, { name, description })}
      />

      {/* Select header modal */}
      <SelectHeaderModal
        open={showSelectHeader}
        onClose={() => setShowSelectHeader(false)}
        headers={companyHeaders}
        onConfirm={(header) => { setShowSelectHeader(false); startPDF(header); }}
      />

      {/* Load template modal */}
      <LoadTemplateModal
        open={showLoadTemplate}
        onClose={() => setShowLoadTemplate(false)}
        templates={templates}
        onLoad={handleLoadTemplate}
      />

      {/* Hidden print view */}
      {showPrint && (
        <div className="fixed top-0 left-0 opacity-0 pointer-events-none z-[-1]">
          <div ref={printRef}>
            <QuotePrintView
              quote={quote}
              items={items}
              componentsMap={componentsMap}
              quoteForm={quoteForm}
              totals={totals}
              project={project}
              companyHeader={selectedHeader}
            />
          </div>
        </div>
      )}
    </div>
  );
}