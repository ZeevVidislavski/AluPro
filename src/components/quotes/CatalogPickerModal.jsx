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
 */
export default function CatalogPickerModal({ open, onClose, catalogItems, onConfirm, mode = "quote", isSaving = false }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(ALL);
  const [selected, setSelected] = useState([]);
  // Per-item price overrides before confirming
  const [priceOverrides, setPriceOverrides] = useState({});

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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Pick items ── */}
        {step === "pick" && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="חיפוש רכיב..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            {/* Category filter */}
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-colors",
                    filterCat === cat
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {cat === ALL ? "הכל" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {filtered.length === 0 && (
                <p className="text-center text-slate-400 py-8">אין רכיבים</p>
              )}
              {filtered.map(item => {
                const isSelected = !!selected.find(s => s.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors",
                      isSelected ? "border-blue-300 bg-blue-50" : "border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <button
                      onClick={() => toggle(item)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{item.model_name}</p>
                        {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", CATEGORY_COLORS[item.category])}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {/* Editable price */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">₪</span>
                        <Input
                          type="number"
                          value={priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : item.base_price ?? ""}
                          onChange={e => setPriceOverrides(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          onClick={e => e.stopPropagation()}
                          className="w-20 h-7 text-xs text-blue-700 font-semibold"
                        />
                        <span className="text-xs text-slate-500">{PRICING_METHOD_LABELS[item.pricing_method]}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                {selected.length > 0 ? `${selected.length} רכיבים נבחרו` : "לא נבחרו רכיבים"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>ביטול</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
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
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 w-fit"
            >
              <ArrowRight className="w-4 h-4" /> חזור לבחירת רכיבים
            </button>
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
              {selected.length} רכיבים נבחרו: {selected.map(s => s.model_name).join("، ")}
            </div>
            <div className="space-y-1">
              <Label>שם תבנית <span className="text-red-500">*</span></Label>
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
            <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
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