import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlatformAdminService } from "@/services/platformAdminService";
import { Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function AddModelsForm({ targetTenantId, onDone }) {
  const queryClient = useQueryClient();
  const [sourceTenantId, setSourceTenantId] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);

  const { data: tenants } = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () => PlatformAdminService.listTenants(),
  });
  const sourceOptions = (tenants ?? []).filter((t) => t.id !== targetTenantId);

  const { data: sourceModels, isLoading: loadingSource } = useQuery({
    queryKey: ["platform-tenant-models", sourceTenantId],
    queryFn: () => PlatformAdminService.listTenantModels(sourceTenantId),
    enabled: !!sourceTenantId,
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

  const allSelected = available.length > 0 && available.every((m) => selected.has(m.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(available.map((m) => m.id)));

  const mutation = useMutation({
    mutationFn: () =>
      PlatformAdminService.copyModelsToTenant(sourceTenantId, targetTenantId, [...selected]),
    onSuccess: (count) => {
      setResult(count);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-models", targetTenantId] });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        בחר חברת מקור וסמן את הדגמים להעתקה. הדגמים (כולל רכיבי הייצור שלהם) יועתקו לחברה
        כעותק עצמאי. דגמים שכבר קיימים אצלה בשם זהה לא יופיעו ברשימה.
      </p>

      <div className="space-y-1">
        <Label>העתק מתוך חברה</Label>
        <Select
          value={sourceTenantId}
          onValueChange={(value) => {
            setSourceTenantId(value);
            setSelected(new Set());
            setResult(null);
          }}
        >
          <SelectTrigger><SelectValue placeholder="בחר חברת מקור" /></SelectTrigger>
          <SelectContent>
            {sourceOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sourceTenantId && loadingSource && (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      )}

      {sourceTenantId && !loadingSource && (
        available.length === 0 ? (
          <p className="text-sm text-slate-400">אין דגמים להוספה מחברה זו.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg">
            <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 text-sm font-medium cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              בחר הכל ({available.length})
            </label>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {available.map((m) => (
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
