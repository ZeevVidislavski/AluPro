import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Check, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/quoteCalculations";

const ALL = "all";

const PRICING_METHOD_LABELS = {
  sqm: '/מ"ר',
  meter: "/מ' רץ",
  meter_width: "/מ' רץ",
  meter_height: "/מ' גובה",
  unit: "/יח'"
};

/**
 * CatalogPickerModal
 *
 * mode="quote"    → onConfirm(selectedItems)           [saves to QuoteItemComponent externally]
 * mode="template" → onConfirm(selectedItems, {name, description}) [saves to QuoteTemplate + QuoteTemplateComponent externally]
 *
 * Keyboard flow (no mouse needed): the search box is focused on open. Type
 * to filter, Left/Right switch the category (empty search box), ArrowUp/ArrowDown move the highlight (works with an empty
 * search too), Enter ticks/unticks the highlighted row, Ctrl+Enter confirms
 * the ticked rows, Escape closes.
 */
export default function CatalogPickerModal({ open, onClose, catalogItems, onConfirm, mode = "quote", isSaving = false }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(ALL);
  const [selected, setSelected] = useState([]);
  // Per-item price overrides before confirming
  const [priceOverrides, setPriceOverrides] = useState({});
  const [active, setActive] = useState(0); // highlighted row (keyboard)

  // template name step (only for mode="template")
  const [step, setStep] = useState("pick"); // "pick" | "name"
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  const categories = [ALL, ...Object.keys(CATEGORY_LABELS)];

  const filtered = catalogItems.filter(item => {
    if (!item.is_active) return false;
    const matchCat = filterCat === ALL || item.category === filterCat;
    const matchSearch = !search || item.model_name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const safeActive = Math.min(active, Math.max(filtered.length - 1, 0));

  const moveActive = (delta) => {
    if (filtered.length === 0) return;
    const next = (safeActive + delta + filtered.length) % filtered.length;
    setActive(next);
    document.getElementById(`catalog-row-${filtered[next].id}`)?.scrollIntoView({ block: "nearest" });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !search) {
      // The page is RTL: the category chips run right-to-left, so Left = next
      // category and Right = previous. Only with an empty search box, so the
      // arrows still move the text cursor while typing.
      e.preventDefault();
      const i = categories.indexOf(filterCat);
      const next = Math.min(Math.max(i + (e.key === "ArrowLeft" ? 1 : -1), 0), categories.length - 1);
      setFilterCat(categories[next]);
      setActive(0);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (selected.length > 0) handleConfirmPick();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[safeActive];
      if (!item) return;
      toggle(item);
      e.target.select(); // next search replaces the current text
      return;
    }
  };

  const toggle = (item) => {
    setSelected(prev =>
      prev.find(s => s.id === item.id)
        ? prev.filter(s => s.id !== item.id)
        : [...prev, { ...item }]
    );
  };

  const formatPrice = (item) => {
    const override = priceOverrides[item.id];
    const price = override !== undefined ? override : item.base_price;
    return `₪${Number(price || 0).toLocaleString("he-IL")}${PRICING_METHOD_LABELS[item.pricing_method] || ""}`;
  };

  const getEffectivePrice = (item) => {
    const override = priceOverrides[item.id];
    return override !== undefined ? override : item.base_price;
  };

  const handleConfirmPick = () => {
    if (mode === "template") {
      setStep("name");
    } else {
      const itemsWithPrices = selected.map(item => ({
        ...item,
        base_price: getEffectivePrice(item)
      }));
      onConfirm(itemsWithPrices);
      reset();
    }
  };

  const handleConfirmTemplate = () => {
    if (!templateName.trim()) return;
    const itemsWithPrices = selected.map(item => ({
      ...item,
      base_price: getEffectivePrice(item)
    }));
    onConfirm(itemsWithPrices, { name: templateName.trim(), description: templateDesc.trim() });
    reset();
  };

  const reset = () => {
    setSelected([]);
    setSearch("");
    setFilterCat(ALL);
    setPriceOverrides({});
    setActive(0);
    setStep("pick");
    setTemplateName("");
    setTemplateDesc("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const title = mode === "template"
    ? (step === "pick" ? "בחר רכיבים לתבנית חדשה" : "שם התבנית")
    : "בחר רכיבים מהקטלוג";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Pick items ── */}
        {step === "pick" && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש רכיב..."
                value={search}
                onChange={e => { setSearch(e.target.value); setActive(0); }}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                className="pr-9"
              />
            </div>

            {/* Category filter */}
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setFilterCat(cat); setActive(0); }}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-colors",
                    filterCat === cat
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:bg-background"
                  )}
                >
                  {cat === ALL ? "הכל" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">אין רכיבים</p>
              )}
              {filtered.map((item, index) => {
                const isSelected = !!selected.find(s => s.id === item.id);
                const isActive = index === safeActive;
                return (
                  <div
                    key={item.id}
                    id={`catalog-row-${item.id}`}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors",
                      isSelected ? "border-primary/40 bg-secondary" : "border-border hover:bg-background",
                      isActive && "ring-2 ring-blue-400"
                    )}
                  >
                    <button
                      onClick={() => toggle(item)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-blue-500 bg-blue-500" : "border-input"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.model_name}</p>
                        {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", CATEGORY_COLORS[item.category])}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {/* Editable price */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">₪</span>
                        <Input
                          type="number"
                          value={priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : item.base_price ?? ""}
                          onChange={e => setPriceOverrides(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          onClick={e => e.stopPropagation()}
                          className="w-20 h-7 text-xs text-primary font-semibold"
                        />
                        <span className="text-xs text-muted-foreground">{PRICING_METHOD_LABELS[item.pricing_method]}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {selected.length > 0
                  ? `${selected.length} רכיבים נבחרו · Ctrl+Enter להוספה`
                  : "←→ קטגוריה, ↑↓ לבחירה, Enter לסימון"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  ביטול
                </Button>
                <Button
                  className="bg-primary hover:bg-primary-hover"
                  disabled={selected.length === 0}
                  onClick={handleConfirmPick}
                >
                  {mode === "template" ? `המשך (${selected.length})` : `הוסף ${selected.length > 0 ? `(${selected.length})` : ""}`}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2 (template only): Template name ── */}
        {step === "name" && (
          <div className="flex flex-col gap-4 py-2 flex-1">
            <button
              onClick={() => setStep("pick")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
            >
              <ArrowRight className="w-4 h-4" /> חזור לבחירת רכיבים
            </button>
            <div className="bg-background rounded-xl p-3 text-sm text-muted-foreground">
              {selected.length} רכיבים נבחרו: {selected.map(s => s.model_name).join("، ")}
            </div>
            <div className="space-y-1">
              <Label>שם תבנית <span className="text-destructive">*</span></Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder='לדוגמה: "חלון 2 כנפיים סטנדרטי"'
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>תיאור (אופציונלי)</Label>
              <Input
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                placeholder="תיאור קצר..."
              />
            </div>
            <div className="flex gap-2 mt-auto pt-4 border-t border-border">
              <Button
                className="flex-1 bg-primary hover:bg-primary-hover"
                disabled={!templateName.trim() || isSaving}
                onClick={handleConfirmTemplate}
              >
                {isSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                צור תבנית
              </Button>
              <Button variant="outline" onClick={handleClose}>ביטול</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}