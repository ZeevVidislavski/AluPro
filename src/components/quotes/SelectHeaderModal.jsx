import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SelectHeaderModal({ open, onClose, headers, onConfirm }) {
  const defaultHeader = headers.find(h => h.is_default);
  const [selectedId, setSelectedId] = useState(defaultHeader?.id || null);

  const handleConfirm = () => {
    const selected = headers.find(h => h.id === selectedId) || null;
    onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            בחר כותרת להדפסה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => setSelectedId(null)}
            className={cn(
              "w-full text-right px-4 py-3 rounded-xl border transition-colors",
              selectedId === null
                ? "border-blue-300 bg-blue-50"
                : "border-slate-100 hover:bg-slate-50"
            )}
          >
            <p className="font-medium text-slate-700">ללא כותרת</p>
          </button>
          {headers.map(h => (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              className={cn(
                "w-full text-right px-4 py-3 rounded-xl border transition-colors flex items-center gap-3",
                selectedId === h.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-100 hover:bg-slate-50"
              )}
            >
              {h.logo_url && (
                <img src={h.logo_url} alt="" className="h-10 w-auto object-contain rounded" />
              )}
              <div>
                <p className="font-medium text-slate-800">{h.name}</p>
                {h.company_name && <p className="text-xs text-slate-500">{h.company_name}</p>}
                {h.subtitle && <p className="text-xs text-slate-400">{h.subtitle}</p>}
              </div>
              {h.is_default && <span className="mr-auto text-xs text-blue-500">ברירת מחדל</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleConfirm}>
            הדפס PDF
          </Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}