import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SupplierService } from "@/services";
import { Plus, Pencil, Trash2, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMPTY = { name: "", contact_name: "", phone: "", email: "" };

function useSuppliers() {
  return useQuery({ queryKey: ["suppliers"], queryFn: () => SupplierService.list() });
}

// Add / edit one supplier.
function SupplierFormDialog({ open, onClose, supplier, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(supplier ?? EMPTY);
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () => (supplier ? SupplierService.update(supplier.id, form) : SupplierService.create(form)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onSaved?.(saved);
      onClose();
    },
    onError: (err) => setError(err?.message || "שגיאה בשמירת הספק"),
  });

  const field = (key, label, props = {}) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{supplier ? "עריכת ספק" : "ספק חדש"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (form.name.trim()) mutation.mutate();
          }}
          className="space-y-3"
        >
          {field("name", "שם", { required: true, autoFocus: true })}
          {field("contact_name", "איש קשר")}
          {field("phone", "טלפון", { type: "tel", dir: "ltr" })}
          {field("email", "מייל", { type: "email", dir: "ltr" })}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {supplier ? "עדכון" : "הוספה"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Supplier field of the order form: a list to pick from, plus a "+" that
// adds a new supplier on the spot and selects it.
export function SupplierPicker({ supplierId, supplierName, onChange }) {
  const { data: suppliers = [] } = useSuppliers();
  const [adding, setAdding] = useState(false);

  const select = (s) => onChange({ supplier_id: s.id, supplier_name: s.name });

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select
          value={supplierId || ""}
          onValueChange={(id) => {
            const s = suppliers.find((x) => x.id === id);
            if (s) select(s);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={supplierName || "בחר ספק"} />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" title="הוספת ספק חדש" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {!supplierId && supplierName && (
        <p className="text-xs text-slate-500">ספק נוכחי: {supplierName} (בחר מהרשימה כדי לקשר)</p>
      )}
      {adding && (
        <SupplierFormDialog open onClose={() => setAdding(false)} supplier={null} onSaved={select} />
      )}
    </div>
  );
}

// Table of the company's suppliers (name, contact, phone, e-mail).
export function SuppliersManagerButton() {
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new

  const deleteMutation = useMutation({
    mutationFn: (id) => SupplierService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Truck className="w-4 h-4 ml-2" />
        ספקים
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>ספקים</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="w-4 h-4 ml-2" />
              ספק חדש
            </Button>
          </div>
          {suppliers.length === 0 ? (
            <p className="text-center text-slate-400 py-6">אין ספקים עדיין</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">שם</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">איש קשר</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">טלפון</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">מייל</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.contact_name || "—"}</td>
                      <td className="px-3 py-2" dir="ltr">{s.phone || "—"}</td>
                      <td className="px-3 py-2" dir="ltr">{s.email || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            onClick={() => {
                              if (window.confirm(`למחוק את הספק ${s.name}?`)) deleteMutation.mutate(s.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {editing !== undefined && (
        <SupplierFormDialog open onClose={() => setEditing(undefined)} supplier={editing} />
      )}
    </>
  );
}
