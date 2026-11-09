import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ProjectQuoteService,
  QuoteItemService,
  QuoteItemComponentService,
  ModelPricingService,
  QuoteTemplateService,
  QuoteTemplateComponentService,
  CompanyHeaderService,
  ProjectService,
} from "@/services";
import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Loader2, Printer, Save, FileDown, GripVertical, Check } from "lucide-react";
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
    vat_percent: 18,
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
  const [savedAt, setSavedAt] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  // Autosave plumbing: saveOnce always reads the freshest state through
  // `latest`, saves are serialized (a second request while one is running
  // just schedules one more pass), and `dirtyRef` is set only by user edits
  // so loading data from the DB never triggers a save.
  const latest = useRef({});
  const savingRef = useRef(false);
  const rerunRef = useRef(false);
  const dirtyRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; };
  const editForm = (changes) => { markDirty(); setQuoteForm(f => ({ ...f, ...changes })); };
  const printRef = useRef(null);
  const queryClient = useQueryClient();

  latest.current = { quoteId, items, componentsMap, quoteForm };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuoteId(params.get("quote_id"));
  }, []);

  // ─── Data queries ────────────────────────────────────────────────────────────
  const { data: quote, isLoading: loadingQuote, isFetchedAfterMount: quoteFresh } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => ProjectQuoteService.get(quoteId),
    enabled: !!quoteId,
    refetchOnMount: "always"
  });

  useEffect(() => {
    if (quote && quoteFresh) {
      setQuoteForm({
        vat_percent: quote.vat_percent ?? 17,
        discount_percent: quote.discount_percent ?? 0,
        notes: quote.notes || "",
        valid_until: quote.valid_until || "",
        status: quote.status || "draft",
        quote_date: quote.quote_date || new Date().toISOString().split("T")[0]
      });
    }
  }, [quote, quoteFresh]);

  const { data: savedItems = [], isLoading: loadingItems, isFetchedAfterMount: itemsFresh } = useQuery({
    queryKey: ["quote-items", quoteId],
    queryFn: () => QuoteItemService.listByQuote(quoteId),
    enabled: !!quoteId,
    refetchOnMount: "always"
  });

  const { data: allComponents = [], isLoading: loadingComponents, isFetchedAfterMount: compsFresh } = useQuery({
    queryKey: ["quote-item-components", quoteId],
    queryFn: () => QuoteItemComponentService.listByQuoteItems(savedItems.map(i => i.id)),
    enabled: savedItems.length > 0,
    refetchOnMount: "always"
  });
  const hydratedComps = useRef(false);

  // Populate local state from DB — only on initial load (when no local items exist yet)
  useEffect(() => {
    if (itemsFresh && savedItems.length > 0 && items.length === 0) {
      setItems(savedItems.map(i => ({ ...i, _clientKey: i.id })));
      const expanded = {};
      savedItems.forEach(i => { expanded[i.id] = true; });
      setExpandedItems(prev => ({ ...expanded, ...prev }));
    }
  }, [savedItems, itemsFresh]);

  useEffect(() => {
    // Hydrate once: after that the local state is the source of truth (a
    // re-fetch must not overwrite what was typed since).
    if (compsFresh && !hydratedComps.current && allComponents.length > 0) {
      hydratedComps.current = true;
      const map = {};
      allComponents.forEach(c => {
        if (!map[c.quote_item_id]) map[c.quote_item_id] = [];
        map[c.quote_item_id].push(c);
      });
      setComponentsMap(map);
    }
  }, [allComponents, compsFresh]);

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: () => ModelPricingService.list()
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => QuoteTemplateService.list()
  });

  const { data: companyHeaders = [] } = useQuery({
    queryKey: ["company-headers"],
    queryFn: () => CompanyHeaderService.list()
  });

  const { data: project } = useQuery({
    queryKey: ["project", quote?.project_id],
    queryFn: () => ProjectService.get(quote?.project_id),
    enabled: !!quote?.project_id
  });

  // ─── Item helpers ─────────────────────────────────────────────────────────────
  const getItemKey = (item) => item.id || item._tempId;

  const getComponents = (item) => componentsMap[getItemKey(item)] || [];

  const addNewItem = () => {
    const tempId = `_tmp_${Date.now()}`;
    markDirty();
    const newItem = { _tempId: tempId, _clientKey: tempId, quote_id: quoteId, width_cm: 0, height_cm: 0, quantity: 1, description: "", total_price: 0 };
    setItems(prev => [...prev, newItem]);
    setComponentsMap(prev => ({ ...prev, [tempId]: [] }));
    setExpandedItems(prev => ({ ...prev, [tempId]: true }));
  };

  const updateItem = (key, changes) => {
    markDirty();
    setItems(prev => prev.map(i => getItemKey(i) === key ? { ...i, ...changes } : i));
  };

  const deleteItem = async (key) => {
    markDirty();
    const item = items.find(i => getItemKey(i) === key);
    if (item?.id) {
      // delete all components first
      const comps = componentsMap[key] || [];
      await Promise.all(comps.filter(c => c.id).map(c => QuoteItemComponentService.delete(c.id)));
      await QuoteItemService.delete(item.id);
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

    markDirty();
    const updatedComps = [...(componentsMap[itemKey] || []), ...newComps];
    setComponentsMap(prev => ({ ...prev, [itemKey]: updatedComps }));

    // Auto-generate description
    const newDesc = generateDescription(updatedComps);
    updateItem(itemKey, { description: newDesc });
  };

  const removeComponent = (itemKey, compKey) => {
    markDirty();
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
    markDirty();
    setComponentsMap(prev => ({
      ...prev,
      [itemKey]: (prev[itemKey] || []).map(c =>
        (c.id || c._tempId) === compKey ? { ...c, price_snapshot: newPrice } : c
      )
    }));
  };

  const updateComponentQuantity = (itemKey, compKey, newQty) => {
    markDirty();
    setComponentsMap(prev => ({
      ...prev,
      [itemKey]: (prev[itemKey] || []).map(c =>
        (c.id || c._tempId) === compKey ? { ...c, quantity: newQty } : c
      )
    }));
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────
  // Serialized: if a save is running, ask it to do one more pass instead of
  // starting a parallel one (which would create duplicate rows for items that
  // don't have an id yet).
  const handleSave = async () => {
    if (savingRef.current) {
      rerunRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      do {
        rerunRef.current = false;
        await saveOnce();
      } while (rerunRef.current);
      setSavedAt(new Date());
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveOnce = async () => {
    const { quoteId, items, componentsMap, quoteForm } = latest.current;
    if (!quoteId) return;
    const savedItemsMap = {}; // item key -> real id
    const savedCompIds = {}; // component _tempId -> real id

    for (const [index, item] of items.entries()) {
      const key = getItemKey(item);
      const comps = componentsMap[key] || [];
      const itemQty = item.quantity || 1;
      const totalPrice = calcItemTotal(comps, item.width_cm, item.height_cm, itemQty);

      const itemData = {
        quote_id: quoteId,
        width_cm: item.width_cm || 0,
        height_cm: item.height_cm || 0,
        quantity: item.quantity || 1,
        description: item.description || "",
        total_price: totalPrice,
        sort_order: index
      };

      let itemId = item.id;
      if (itemId) {
        await QuoteItemService.update(itemId, itemData);
      } else {
        itemId = (await QuoteItemService.create(itemData)).id;
      }
      savedItemsMap[key] = itemId;

      for (const [compIndex, comp] of comps.entries()) {
        const compData = {
          quote_item_id: itemId,
          catalog_item_id: comp.catalog_item_id || null,
          name_snapshot: comp.name_snapshot,
          category_snapshot: comp.category_snapshot || "",
          pricing_method_snapshot: comp.pricing_method_snapshot,
          price_snapshot: comp.price_snapshot,
          quantity: comp.quantity ?? null,
          calculated_value: calcItemTotal([comp], item.width_cm, item.height_cm, item.quantity || 1),
          sort_order: compIndex
        };
        if (comp.id) {
          await QuoteItemComponentService.update(comp.id, compData);
        } else {
          const saved = await QuoteItemComponentService.create(compData);
          savedCompIds[comp._tempId] = saved.id;
        }
      }
    }

    // Give newly created rows their real ids. Functional updates, so edits
    // typed while this save was running are kept. React keys use
    // _clientKey / _tempId, which stay stable, so inputs keep their focus.
    setItems(prev => prev.map(i => {
      const realId = savedItemsMap[getItemKey(i)];
      return realId && !i.id ? { ...i, id: realId } : i;
    }));
    setComponentsMap(prev => {
      const next = {};
      for (const [k, list] of Object.entries(prev)) {
        const realKey = savedItemsMap[k] ?? k;
        next[realKey] = list.map(c => {
          const withId = !c.id && savedCompIds[c._tempId] ? { ...c, id: savedCompIds[c._tempId] } : c;
          return realKey !== k ? { ...withId, quote_item_id: realKey } : withId;
        });
      }
      return next;
    });
    setExpandedItems(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) next[savedItemsMap[k] ?? k] = v;
      return next;
    });

    const t = calcQuoteTotals(items, componentsMap, quoteForm.discount_percent, quoteForm.vat_percent);
    await ProjectQuoteService.update(quoteId, {
      ...quoteForm,
      subtotal: t.subtotal,
      vat_amount: t.vatAmount,
      total_with_vat: t.totalWithVat,
      amount: t.subtotal,
      is_detailed: true
    });

    queryClient.invalidateQueries({ queryKey: ["all-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["project-quotes"] });
  };

  // Autosave: ~1s after the last edit. A pending edit is also flushed if the
  // user leaves the page.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      dirtyRef.current = false;
      handleSave();
    }, 1000);
    return () => clearTimeout(t);
  }, [items, componentsMap, quoteForm]);

  useEffect(() => () => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      handleSave();
    }
  }, []);

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    markDirty();
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  // ─── Save as template ─────────────────────────────────────────────────────────
  const handleSaveTemplate = async (itemKey, { name, description }) => {
    setSavingTemplate(true);
    try {
      const tmpl = await QuoteTemplateService.create({ name, description });
      const comps = componentsMap[itemKey] || [];
      await Promise.all(comps.map((comp, idx) =>
        QuoteTemplateComponentService.create({
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
    const templateComps = await QuoteTemplateComponentService.listByTemplate(templateId);
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

    markDirty();
    const newItem = {
      _tempId: tempItemId,
      _clientKey: tempItemId,
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
    // company_headers.logo_url is a Storage path, not a displayable URL
    // (Phase 6) — resolve it to a signed URL BEFORE rendering
    // QuotePrintView, since html2canvas screenshots the DOM synchronously
    // and can't wait for an <img> to finish loading asynchronously.
    const logoUrl = header?.logo_url ? await CompanyHeaderService.getLogoUrl(header.logo_url) : null;
    setSelectedHeader(header ? { ...header, resolvedLogoUrl: logoUrl } : null);
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
          <Link to={quote.project_id ? `/ProjectDetails?id=${quote.project_id}` : "/Dashboard"} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">עריכת הצעת מחיר — {quote.project_name}</h1>
            <p className="text-slate-500 text-sm">{quote.customer_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 min-w-20 text-left">
              {saving ? "שומר..." : savedAt ? (<span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> נשמר אוטומטית</span>) : null}
            </span>
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
              <Input type="date" value={quoteForm.quote_date} onChange={e => editForm({ quote_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>בתוקף עד</Label>
              <Input type="date" value={quoteForm.valid_until} onChange={e => editForm({ valid_until: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>סטטוס</Label>
              <Select value={quoteForm.status} onValueChange={v => editForm({ status: v })}>
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
              <Input type="number" value={quoteForm.vat_percent} onChange={e => editForm({ vat_percent: parseFloat(e.target.value) || 18 })} />
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

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="quote-items">
              {(dropProvided) => (
                <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-3">
                  {items.map((item, index) => {
                    const key = getItemKey(item);
                    const dragId = String(item._clientKey || key);
                    return (
                      <Draggable key={dragId} draggableId={dragId} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={snapshot.isDragging ? "shadow-lg" : ""}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                {...dragProvided.dragHandleProps}
                                title="גרור לשינוי סדר"
                                className="pt-5 text-slate-300 hover:text-slate-500 cursor-grab"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <QuoteItemCard
                                  item={item}
                                  components={getComponents(item)}
                                  isExpanded={expandedItems[key] !== false}
                                  onToggleExpand={() => setExpandedItems(prev => ({ ...prev, [key]: prev[key] === false }))}
                                  onUpdateItem={(k, changes) => updateItem(k, changes)}
                                  onDeleteItem={() => deleteItem(key)}
                                  onAddComponents={() => setCatalogPickerFor(key)}
                                  onRemoveComponent={(compKey) => removeComponent(key, compKey)}
                                  onUpdateComponentPrice={(compKey, price) => updateComponentPrice(key, compKey, price)}
                                  onUpdateComponentQuantity={(compKey, qty) => updateComponentQuantity(key, compKey, qty)}
                                  onSaveAsTemplate={() => setSaveTemplateFor(key)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
                  onChange={e => editForm({ discount_percent: parseFloat(e.target.value) || 0 })}
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
            onChange={e => editForm({ notes: e.target.value })}
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
        onQuickAdd={(item) => addComponentsToItem(catalogPickerFor, [item])}
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