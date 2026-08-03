import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoadTemplateModal({ open, onClose, templates, onLoad }) {
  const [selectedId, setSelectedId] = useState(null);
  const [priceMode, setPriceMode] = useState("snapshot"); // "snapshot" | "catalog"

  const handleLoad = () => {
    if (!selectedId) return;
    onLoad(selectedId, priceMode);
    setSelectedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" />
            טען תבנית
          </DialogTitle>
        </DialogHeader>

        {/* Template list */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-center text-slate-400 py-6">אין תבניות שמורות</p>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={cn(
                "w-full text-right px-4 py-3 rounded-xl border transition-colors",
                selectedId === t.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-100 hover:bg-slate-50"
              )}
            >
              <p className="font-medium text-slate-800">{t.name}</p>
              {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
            </button>
          ))}
        </div>

        {/* Price mode */}
        {selectedId && (
          <div className="pt-2 space-y-2 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700">שיטת מחירים:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPriceMode("snapshot")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                  priceMode === "snapshot" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                מחירים שמורים
              </button>
              <button
                onClick={() => setPriceMode("catalog")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                  priceMode === "catalog" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                מחירי קטלוג עדכניים
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={!selectedId}
            onClick={handleLoad}
          >
            טען
          </Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}