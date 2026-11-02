import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlatformAdminService } from "@/services/platformAdminService";
import { Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORY_LABELS = {
  product: "מוצר",
  series: "סדרה",
  structure: "מבנה",
  shutter: "תריס",
  motor: "מנוע",
  mesh: "רשת",
  addon: "תוספת",
  glass: "זכוכית",
  other: "אחר",
};

// The base catalog: models are always copied from AluPro Demo, never from
// another customer's company (whose names/prices they have edited).
export const BASE_CATALOG_TENANT_ID = "0fb62128-e262-4541-90e0-144e1820d0a1";

function AddModelsForm({ targetTenantId, onDone }) {
  const queryClient = useQueryClient();
  const sourceTenantId = BASE_CATALOG_TENANT_ID;
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);
  const [category, setCategory] = useState("all");

  const { data: sourceModels, isLoading: loadingSource } = useQuery({
    queryKey: ["platform-tenant-models", sourceTenantId],
    queryFn: () => PlatformAdminService.listTenantModels(sourceTenantId),
  });

  const { data: targetModels } = useQuery({
    queryKey: ["platform-tenant-models", targetTenantId],
    queryFn: () => PlatformAdminService.listTenantModels(targetTenantId),
  });

  const existingNames = useMemo(
    () => new Set((targetModels ?? []).map((m) => m.model_name)),
    [targetModels]
  );
  const available = (sourceModels ?? []).filter((m) => !existingNames.has(m.model_name));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const categories = [...new Set(available.map((m) => m.category))];
  const visible = category === "all" ? available : available.filter((m) => m.category === category);

  // "Select all" acts on what the filter currently shows, so picking
  // "glass" then "select all" adds only the glass models; selections made
  // under another filter are kept.
  const allSelected = visible.length > 0 && visible.every((m) => selected.has(m.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((m) => (allSelected ? next.delete(m.id) : next.add(m.id)));
      return next;
    });

  const mutation = useMutation({
    mutationFn: () =>
      PlatformAdminService.copyModelsToTenant(sourceTenantId, targetTenantId, [...selected]),
    onSuccess: (count) => {
      setResult(count);
      setSelected(new Set());
      setCategory("all");
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-models", targetTenantId] });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        בחר דגמים מהקטלוג הבסיסי (AluPro Demo). הדגמים, כולל רכיבי הייצור שלהם, יועתקו
        לחברה כעותק עצמאי. דגמים שכבר קיימים אצלה בשם זהה לא יופיעו ברשימה.
      </p>

      {loadingSource && (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      )}

      {!loadingSource && (
        available.length === 0 ? (
          <p className="text-sm text-slate-400">אין דגמים נוספים להוספה מהקטלוג הבסיסי.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>סינון לפי קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקטגוריות</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <div className="border border-slate-200 rounded-lg">
            <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 text-sm font-medium cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              בחר הכל ({visible.length})
            </label>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {visible.map((m) => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                  <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <span className="flex-1">{m.model_name}</span>
                  <span className="text-xs text-slate-400">
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </span>
                </label>
              ))}
            </div>
          </div>
          </div>
        )
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
          {mutation.error?.message || "שגיאה בהעתקת הדגמים"}
        </p>
      )}
      {result !== null && (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
          הועתקו {result} דגמים
        </p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={selected.size === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            `הוסף ${selected.size || ""} דגמים`
          )}
        </Button>
        <Button variant="outline" onClick={onDone}>סגור</Button>
      </div>
    </div>
  );
}

export default function AddModelsDialog({ tenantId, tenantName, size = "sm" }) {
  const [open, setOpen] = useState(false);
  if (tenantId === BASE_CATALOG_TENANT_ID) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className="gap-2">
          <PackagePlus className="w-4 h-4" />
          הוסף דגמים
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת דגמים ל{tenantName}</DialogTitle>
        </DialogHeader>
        {open && <AddModelsForm targetTenantId={tenantId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
