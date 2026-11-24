import { useState, useEffect, useRef } from "react";
import FormField from "@/components/shared/FormField";
import NumberInput from "@/components/shared/NumberInput";
import { formatCurrency } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Printer, Save, FileDown, GripVertical, Check } from "lucide-react";
import { generateDescription, calcItemTotal, calcQuoteTotals } from "@/lib/quoteCalculations";
import QuoteItemCard from "@/components/quotes/QuoteItemCard";
import PageHeader from "@/components/shared/PageHeader";
import CatalogPickerModal from "@/components/quotes/CatalogPickerModal";
import SaveTemplateModal from "@/components/quotes/TemplateModal";
import LoadTemplateModal from "@/components/quotes/LoadTemplateModal";
import SelectHeaderModal from "@/components/quotes/SelectHeaderModal";
import QuotePrintView from "@/components/quotes/QuotePrintView";
import QuoteSpecPrintView from "@/components/quotes/QuoteSpecPrintView";
import { specPayload } from "@/lib/quoteSpec";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
  // "quote" = regular price quote, "contractor" = spec PDF with prices, "customer" = spec PDF without prices
  const [pdfMode, setPdfMode] = useState("quote");

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
  const pendingCompDeletes = useRef([]);
  const lastSaved = useRef({}); // "i:<id>" / "c:<id>" -> JSON of last saved payload
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
    const current = componentsMap[itemKey] || [];
    const removed = current.find(c => (c.id || c._tempId) === compKey);
    // Components already in the DB are soft-deleted on the next save;
    // otherwise they'd come back after reload.
    if (removed?.id) pendingCompDeletes.current.push(removed.id);
    const updated = current.filter(c => (c.id || c._tempId) !== compKey);
    setComponentsMap(prev => ({ ...prev, [itemKey]: updated }));
    updateItem(itemKey, { description: generateDescription(updated) });
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

    // Persist component removals first.
    while (pendingCompDeletes.current.length > 0) {
      const id = pendingCompDeletes.current[0];
      await QuoteItemComponentService.delete(id);
      pendingCompDeletes.current.shift();
    }

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
        sort_order: index,
        ...specPayload(item)
      };

      let itemId = item.id;
      if (itemId) {
        // Only hit the DB for rows that actually changed since the last save.
        const sig = JSON.stringify(itemData);
        if (lastSaved.current[`i:${itemId}`] !== sig) {
          await QuoteItemService.update(itemId, itemData);
          lastSaved.current[`i:${itemId}`] = sig;
        }
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
          const sig = JSON.stringify(compData);
          if (lastSaved.current[`c:${comp.id}`] !== sig) {
            await QuoteItemComponentService.update(comp.id, compData);
            lastSaved.current[`c:${comp.id}`] = sig;
          }
        } else {
          const saved = await QuoteItemComponentService.create(compData);
          savedCompIds[comp._tempId] = saved.id;
          lastSaved.current[`c:${saved.id}`] = JSON.stringify(compData);
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
  const handlePDFClick = (mode = "quote") => {
    setPdfMode(mode);
    if (companyHeaders.length > 0) {
      setShowSelectHeader(true);
    } else {
      startPDF(null, mode);
    }
  };

  const startPDF = async (header, mode = pdfMode) => {
    setPdfMode(mode);
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
      const scale = 2;
      const canvas = await html2canvas(el, { scale, useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      // Multi-page: cut the screenshot into A4-sized slices, preferring to
      // break between table rows / top-level blocks so text isn't sliced.
      const pagePx = Math.floor((canvas.width * pdfPageHeight) / pdfWidth);
      const root = el.firstElementChild || el;
      const elTop = el.getBoundingClientRect().top;
      const breakPoints = [...root.querySelectorAll("tr"), ...root.children]
        .map(n => Math.round((n.getBoundingClientRect().bottom - elTop) * scale))
        .filter(y => y > 0 && y < canvas.height)
        .sort((a, b) => a - b);

      let start = 0;
      let pageIndex = 0;
      while (start < canvas.height) {
        let end = start + pagePx;
        if (end >= canvas.height) {
          end = canvas.height;
        } else {
          const fit = breakPoints.filter(y => y > start + pagePx * 0.5 && y <= end);
          if (fit.length) end = fit[fit.length - 1];
        }
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = end - start;
        const ctx = slice.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, (slice.height * pdfWidth) / slice.width);
        start = end;
        pageIndex++;
      }
      const fileLabel = mode === "contractor" ? "מפרט-קבלן" : mode === "customer" ? "מפרט-לקוח" : "הצעת-מחיר";
      pdf.save(`${fileLabel}-${quote?.project_name || ""}.pdf`);
      setShowPrint(false);
    }, 500);
  };

  // ─── Totals ───────────────────────────────────────────────────────────────────
  const totals = calcQuoteTotals(items, componentsMap, quoteForm.discount_percent, quoteForm.vat_percent);
  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loadingQuote || loadingItems) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!quote) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">הצעה לא נמצאה</div>;
  }

  return (
    <div className="p-4 pb-24 md:p-6 md:pb-24 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          breadcrumbs={[
            { label: quote.project_id ? "פרויקטים" : "דשבורד", to: quote.project_id ? "/Projects" : "/Dashboard" },
            ...(quote.project_id ? [{ label: quote.project_name || "פרויקט", to: `/ProjectDetails?id=${quote.project_id}` }] : []),
            { label: "הצעת מחיר" },
          ]}
          title={`עריכת הצעת מחיר — ${quote.project_name}`}
          description={quote.customer_name}
          actions={
            <>
              <span className="text-[13px] text-muted-foreground min-w-24 text-end" role="status" aria-live="polite">
                {saving ? "שומר..." : savedAt ? (<span className="inline-flex items-center gap-1 text-success font-medium"><Check className="w-3.5 h-3.5" /> נשמר אוטומטית</span>) : null}
              </span>
              <Button variant="outline" onClick={() => handlePDFClick("quote")} disabled={saving}>
                <Printer className="w-4 h-4" /> PDF
              </Button>
              <Button variant="outline" onClick={() => handlePDFClick("contractor")} disabled={saving}>
                <Printer className="w-4 h-4" /> מפרט לקבלן
              </Button>
              <Button variant="outline" onClick={() => handlePDFClick("customer")} disabled={saving}>
                <Printer className="w-4 h-4" /> מפרט ללקוח
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                שמור
              </Button>
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-6 min-w-0">
        {/* Quote meta */}
        <div className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-foreground mb-4">פרטי הצעה</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField label="תאריך הצעה">
              <Input type="date" value={quoteForm.quote_date} onChange={e => editForm({ quote_date: e.target.value })} />
            </FormField>
            <FormField label="בתוקף עד">
              <Input type="date" value={quoteForm.valid_until} onChange={e => editForm({ valid_until: e.target.value })} />
            </FormField>
            <FormField label="מע&quot;מ">
              <NumberInput suffix="%" value={quoteForm.vat_percent} onChange={e => editForm({ vat_percent: parseFloat(e.target.value) || 18 })} />
            </FormField>
          </div>
        </div>

        {/* Items section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">פריטי ההצעה</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowLoadTemplate(true)}>
                <FileDown className="w-4 h-4 ml-1" /> טען תבנית
              </Button>
              <Button size="sm" onClick={addNewItem}>
                <Plus className="w-4 h-4 ml-1" /> פריט חדש
              </Button>
            </div>
          </div>

          {items.length === 0 && (
            <div className="bg-card rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground">
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
                                className="pt-5 text-muted-foreground/60 hover:text-muted-foreground cursor-grab"
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

          {items.length > 0 && (
            <button
              type="button"
              onClick={addNewItem}
              className="w-full flex items-center justify-center gap-1 py-3 rounded-xl border border-dashed border-input text-muted-foreground hover:border-primary hover:text-primary hover:bg-secondary transition-colors"
            >
              <Plus className="w-5 h-5" /> פריט חדש
            </button>
          )}
        </div>

        </div>
        {/* Totals: sticky side panel on desktop (left in RTL), below the form on mobile */}
        <div className="space-y-6 min-w-0 lg:sticky lg:top-4">
      <aside aria-label="סיכום הצעה" className="bg-card rounded-xl border shadow-sm p-5 space-y-2.5 tabular-nums">
          <h2 className="font-semibold text-foreground">סיכום</h2>
          <div className="flex justify-between w-full text-sm">
            <span className="text-muted-foreground">סכום לפני הנחה</span>
            <span>{formatCurrency(totals.linesTotal)}</span>
          </div>
          <div className="flex items-center justify-between w-full text-sm gap-2">
            <span className="text-muted-foreground">הנחה (%)</span>
            <Input
              type="number"
              value={quoteForm.discount_percent}
              onChange={e => editForm({ discount_percent: parseFloat(e.target.value) || 0 })}
              className="w-16 h-8 text-sm"
            />
            <span className="text-destructive">-{formatCurrency(totals.linesTotal - totals.subtotal)}</span>
          </div>
          <div className="flex justify-between w-full text-sm">
            <span className="text-muted-foreground">לפני מע"מ</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between w-full text-sm">
            <span className="text-muted-foreground">מע"מ {quoteForm.vat_percent}%</span>
            <span>{formatCurrency(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between items-baseline w-full text-2xl font-bold border-t border-border pt-3" aria-live="polite">
            <span className="text-base">סה"כ כולל מע"מ</span>
            <span className="text-foreground">{formatCurrency(totals.totalWithVat)}</span>
          </div>
        </aside>
        {/* Notes */}
        <div className="bg-card rounded-xl border shadow-sm p-6">
          <Label className="mb-2 block">הערות</Label>
          <Textarea
            value={quoteForm.notes}
            onChange={e => editForm({ notes: e.target.value })}
            rows={3}
            placeholder="הערות ותנאים..."
          />
        </div>
        </div>
        </div>
      </div>

      {/* Mobile: sticky total bar (the full summary is above the notes) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-baseline justify-between gap-3 border-t bg-card px-4 py-3 shadow-[0_-2px_8px_rgba(39,52,68,0.08)] tabular-nums">
        <span className="text-sm text-muted-foreground">סה"כ כולל מע"מ</span>
        <span className="text-xl font-bold text-foreground">{formatCurrency(totals.totalWithVat)}</span>
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
            {pdfMode === "quote" ? (
              <QuotePrintView
                quote={quote}
                items={items}
                componentsMap={componentsMap}
                quoteForm={quoteForm}
                totals={totals}
                project={project}
                companyHeader={selectedHeader}
              />
            ) : (
              <QuoteSpecPrintView
                quote={quote}
                items={items}
                componentsMap={componentsMap}
                quoteForm={quoteForm}
                project={project}
                companyHeader={selectedHeader}
                showPrices={pdfMode === "contractor"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}