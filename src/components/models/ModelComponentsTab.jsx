import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModelComponentService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Pencil, Calculator } from "lucide-react";
import { calculateComponents } from "@/lib/formulaEngine";

const COMPONENT_TYPES = { profile: "פרופיל", glass: "זכוכית", hardware: "פרזול", accessory: "אביזר" };
const TYPE_COLORS = { profile: "bg-blue-100 text-blue-700", glass: "bg-cyan-100 text-cyan-700", hardware: "bg-orange-100 text-orange-700", accessory: "bg-purple-100 text-purple-700" };
const BASE_OPTIONS = [
  { value: "opening_width", label: "רוחב פתיחה" },
  { value: "opening_height", label: "גובה פתיחה" },
  { value: "fixed", label: "ערך קבוע" }
];
const OP_OPTIONS = [
  { value: "none", label: "ללא" },
  { value: "add", label: "חיבור +" },
  { value: "subtract", label: "חיסור −" },
  { value: "multiply", label: "כפל ×" },
  { value: "divide", label: "חילוק ÷" }
];

const emptyForm = {
  component_type: "profile",
  item_code: "",
  quantity: 1,
  length_base: "",
  length_op1: "none",
  length_val1: "",
  length_op2: "none",
  length_val2: "",
  width_base: "",
  width_op1: "none",
  width_val1: "",
  width_op2: "none",
  width_val2: "",
  notes: ""
};

function DimSummary({ base, op1, val1, op2, val2 }) {
  if (!base) return <span className="text-slate-400">—</span>;
  const baseLabel = BASE_OPTIONS.find(o => o.value === base)?.label || base;
  if (base === "fixed") return <span className="font-mono text-xs">{val1 ?? 0} ס"מ</span>;
  const parts = [baseLabel];
  if (op1 && op1 !== "none") parts.push(`${OP_OPTIONS.find(o=>o.value===op1)?.label} ${val1??0}`);
  if (op2 && op2 !== "none") parts.push(`${OP_OPTIONS.find(o=>o.value===op2)?.label} ${val2??0}`);
  return <span className="font-mono text-xs">{parts.join(" → ")}</span>;
}

function DimForm({ prefix, formData, setFormData }) {
  const base = formData[`${prefix}_base`];
  const op1  = formData[`${prefix}_op1`];

  return (
    <div className="space-y-2">
      {/* Base */}
      <div className="space-y-1">
        <Label className="text-xs">בסיס</Label>
        <Select value={base} onValueChange={v => setFormData({ ...formData, [`${prefix}_base`]: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="בחר בסיס..." /></SelectTrigger>
          <SelectContent>{BASE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Fixed value */}
      {base === "fixed" && (
        <div className="space-y-1">
          <Label className="text-xs">ערך קבוע (ס"מ)</Label>
          <Input className="h-8 text-xs" type="number" value={formData[`${prefix}_val1`]}
            onChange={e => setFormData({ ...formData, [`${prefix}_val1`]: e.target.value })} placeholder="0" />
        </div>
      )}

      {/* Op1 + Val1 */}
      {base && base !== "fixed" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">פעולה 1</Label>
            <Select value={op1} onValueChange={v => setFormData({ ...formData, [`${prefix}_op1`]: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{OP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {op1 && op1 !== "none" && (
            <div className="space-y-1">
              <Label className="text-xs">ערך 1 (ס"מ)</Label>
              <Input className="h-8 text-xs" type="number" value={formData[`${prefix}_val1`]}
                onChange={e => setFormData({ ...formData, [`${prefix}_val1`]: e.target.value })} placeholder="0" />
            </div>
          )}
        </div>
      )}

      {/* Op2 + Val2 — only if base is not fixed and op1 is set */}
      {base && base !== "fixed" && op1 && op1 !== "none" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">פעולה 2</Label>
            <Select value={formData[`${prefix}_op2`]} onValueChange={v => setFormData({ ...formData, [`${prefix}_op2`]: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{OP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {formData[`${prefix}_op2`] && formData[`${prefix}_op2`] !== "none" && (
            <div className="space-y-1">
              <Label className="text-xs">ערך 2 (ס"מ)</Label>
              <Input className="h-8 text-xs" type="number" value={formData[`${prefix}_val2`]}
                onChange={e => setFormData({ ...formData, [`${prefix}_val2`]: e.target.value })} placeholder="0" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModelComponentsTab({ modelId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [openingWidth, setOpeningWidth] = useState("");
  const [openingHeight, setOpeningHeight] = useState("");
  const [calcResults, setCalcResults] = useState(null);
  const [calcSaving, setCalcSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["model-components", modelId],
    queryFn: () => ModelComponentService.listByModel(modelId),
    enabled: !!modelId
  });

  const createMutation = useMutation({
    mutationFn: (data) => ModelComponentService.create(modelId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["model-components", modelId] }); setDialogOpen(false); setFormData(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ModelComponentService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["model-components", modelId] }); setDialogOpen(false); setEditingId(null); setFormData(emptyForm); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ModelComponentService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["model-components", modelId] })
  });

  const parseNum = (v) => (v !== "" && v !== undefined && v !== null) ? parseFloat(v) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      quantity: parseFloat(formData.quantity) || 1,
      length_val1: parseNum(formData.length_val1),
      length_val2: parseNum(formData.length_val2),
      width_val1: parseNum(formData.width_val1),
      width_val2: parseNum(formData.width_val2),
    };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const openEdit = (comp) => {
    setEditingId(comp.id);
    setFormData({
      component_type: comp.component_type || "profile",
      item_code: comp.item_code || "",
      quantity: comp.quantity || 1,
      length_base: comp.length_base || "",
      length_op1: comp.length_op1 || "none",
      length_val1: comp.length_val1 ?? "",
      length_op2: comp.length_op2 || "none",
      length_val2: comp.length_val2 ?? "",
      width_base: comp.width_base || "",
      width_op1: comp.width_op1 || "none",
      width_val1: comp.width_val1 ?? "",
      width_op2: comp.width_op2 || "none",
      width_val2: comp.width_val2 ?? "",
      notes: comp.notes || ""
    });
    setDialogOpen(true);
  };

  const handleCalculate = () => {
    const w = parseFloat(openingWidth);
    const h = parseFloat(openingHeight);
    if (!w || !h) return;
    setCalcResults(calculateComponents(components, w, h));
  };

  const handleSaveCalcResults = async () => {
    if (!calcResults) return;
    setCalcSaving(true);
    await ModelComponentService.updateMany(calcResults.map(comp => ({
      id: comp.id,
      data: {
        calculated_length: comp.calculated_length,
        calculated_width: comp.calculated_width
      }
    })));
    queryClient.invalidateQueries({ queryKey: ["model-components", modelId] });
    setCalcSaving(false);
    setCalcOpen(false);
    setCalcResults(null);
    setOpeningWidth("");
    setOpeningHeight("");
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{components.length} רכיבי ייצור</p>
        <div className="flex gap-2">
          {components.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setCalcOpen(true)}>
              <Calculator className="w-4 h-4 ml-1" /> חשב רכיבים
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditingId(null); setFormData(emptyForm); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 ml-1" /> הוסף רכיב
          </Button>
        </div>
      </div>

      {components.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm">אין רכיבי ייצור לדגם זה</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">סוג</th>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">קוד פריט</th>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">כמות</th>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">חישוב אורך</th>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">אורך מחושב (ס"מ)</th>
                <th className="text-right px-3 py-2 text-slate-600 font-medium">רוחב מחושב (ס"מ)</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map(comp => (
                <tr key={comp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[comp.component_type]}`}>
                      {COMPONENT_TYPES[comp.component_type]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-800">{comp.item_code}</td>
                  <td className="px-3 py-2 text-slate-700">{comp.quantity}</td>
                  <td className="px-3 py-2">
                    <DimSummary base={comp.length_base} op1={comp.length_op1} val1={comp.length_val1} op2={comp.length_op2} val2={comp.length_val2} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-blue-700">{comp.calculated_length != null ? `${comp.calculated_length} ס"מ` : "—"}</td>
                  <td className="px-3 py-2 font-semibold text-blue-700">{comp.calculated_width != null ? `${comp.calculated_width} ס"מ` : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(comp)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => { if (window.confirm("למחוק?")) deleteMutation.mutate(comp.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "עריכת רכיב" : "רכיב חדש"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>סוג רכיב</Label>
                <Select value={formData.component_type} onValueChange={v => setFormData({ ...formData, component_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(COMPONENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>קוד פריט</Label>
                <Input value={formData.item_code} onChange={e => setFormData({ ...formData, item_code: e.target.value })} required placeholder="ALU-9001" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>כמות</Label>
              <Input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required min="0.01" step="0.01" />
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-slate-700">חישוב אורך</p>
              <DimForm prefix="length" formData={formData} setFormData={setFormData} />
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-slate-700">חישוב רוחב <span className="text-slate-400 text-xs font-normal">(אופציונלי)</span></p>
              <DimForm prefix="width" formData={formData} setFormData={setFormData} />
            </div>

            <div className="space-y-1">
              <Label>הערות</Label>
              <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingId ? "עדכון" : "הוספה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Calculate Dialog */}
      <Dialog open={calcOpen} onOpenChange={(o) => { setCalcOpen(o); if (!o) setCalcResults(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>חישוב רכיבי ייצור</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label>רוחב פתיחה (ס"מ)</Label>
                <Input type="number" value={openingWidth} onChange={e => { setOpeningWidth(e.target.value); setCalcResults(null); }} placeholder="120" />
              </div>
              <div className="flex-1 space-y-1">
                <Label>גובה פתיחה (ס"מ)</Label>
                <Input type="number" value={openingHeight} onChange={e => { setOpeningHeight(e.target.value); setCalcResults(null); }} placeholder="90" />
              </div>
            </div>
            <Button onClick={handleCalculate} disabled={!openingWidth || !openingHeight} className="w-full bg-blue-600 hover:bg-blue-700">
              <Calculator className="w-4 h-4 ml-2" /> חשב
            </Button>

            {calcResults && (
              <div className="space-y-2">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-right px-3 py-2 text-slate-600 font-medium">קוד פריט</th>
                        <th className="text-right px-3 py-2 text-slate-600 font-medium">חישוב</th>
                        <th className="text-right px-3 py-2 text-slate-600 font-medium">אורך</th>
                        <th className="text-right px-3 py-2 text-slate-600 font-medium">רוחב</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calcResults.map(comp => (
                        <tr key={comp.id}>
                          <td className="px-3 py-2 font-mono text-slate-800">{comp.item_code}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            <DimSummary base={comp.length_base} op1={comp.length_op1} val1={comp.length_val1} op2={comp.length_op2} val2={comp.length_val2} />
                          </td>
                          <td className="px-3 py-2 font-semibold text-green-700">{comp.calculated_length != null ? `${comp.calculated_length} ס"מ` : "—"}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{comp.calculated_width != null ? `${comp.calculated_width} ס"מ` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={handleSaveCalcResults} disabled={calcSaving} className="w-full bg-green-600 hover:bg-green-700">
                  {calcSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  שמור תוצאות
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}