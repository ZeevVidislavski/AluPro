import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyHeaderService } from "@/services";

// company_headers.logo_url is an internal Storage path, not a
// displayable URL (see docs/PHASE_6_IMPLEMENTATION_PLAN.md section 3) —
// this resolves it to a signed URL on demand. This bug (rendering the
// raw path as <img src>) predated Phase 11; it existed since Phase 6
// because this file wasn't in that phase's scope — see
// docs/PHASE_11_IMPLEMENTATION_PLAN.md section 5.1.
function HeaderThumbnail({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    CompanyHeaderService.getLogoUrl(path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!path) return null;
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-slate-300 shrink-0" />;
  return <img src={url} alt="" className="h-10 w-auto object-contain rounded" />;
}

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
            <Printer className="w-5 h-5 text-primary" />
            בחר כותרת להדפסה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => setSelectedId(null)}
            className={cn(
              "w-full text-right px-4 py-3 rounded-xl border transition-colors",
              selectedId === null
                ? "border-blue-300 bg-secondary"
                : "border-border hover:bg-background"
            )}
          >
            <p className="font-medium text-foreground">ללא כותרת</p>
          </button>
          {headers.map(h => (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              className={cn(
                "w-full text-right px-4 py-3 rounded-xl border transition-colors flex items-center gap-3",
                selectedId === h.id
                  ? "border-blue-300 bg-secondary"
                  : "border-border hover:bg-background"
              )}
            >
              <HeaderThumbnail path={h.logo_url} />
              <div>
                <p className="font-medium text-foreground">{h.name}</p>
                {h.company_name && <p className="text-xs text-muted-foreground">{h.company_name}</p>}
                {h.subtitle && <p className="text-xs text-muted-foreground">{h.subtitle}</p>}
              </div>
              {h.is_default && <span className="mr-auto text-xs text-blue-500">ברירת מחדל</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1 bg-primary hover:bg-primary-hover" onClick={handleConfirm}>
            הדפס PDF
          </Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}