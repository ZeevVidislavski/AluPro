import { useState, useEffect } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CompanyHeaderService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Loader2, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const empty = { name: "", company_name: "", logo_url: "", subtitle: "", is_default: false };

// logo_url now stores an internal Storage path, not a displayable URL —
// this resolves it to a time-limited signed URL for <img src>. Returns
// null while resolving/if there's no path, so callers can fall back to
// the "no logo" placeholder without a broken image flash. See
// docs/PHASE_6_IMPLEMENTATION_PLAN.md section 3 for why this changed
// from Base44's permanent public URL.
function useLogoSignedUrl(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    CompanyHeaderService.getLogoUrl(path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function HeaderLogo({ path, className }) {
  const url = useLogoSignedUrl(path);
  if (!path) {
    return <div className={className + " border-dashed flex items-center justify-center text-slate-300 text-xs"}>אין לוגו</div>;
  }
  if (!url) {
    return <div className={className + " flex items-center justify-center"}><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>;
  }
  return <img src={url} alt="" className={className + " object-contain"} />;
}

export default function CompanyHeaders() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const { data: headers = [], isLoading } = useQuery({
    queryKey: ["company-headers"],
    queryFn: () => CompanyHeaderService.list()
  });

  const save = useMutation({
    mutationFn: async (data) => {
      if (editId) return CompanyHeaderService.update(editId, data);
      return CompanyHeaderService.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-headers"] }); closeDialog(); }
  });

  const remove = useMutation({
    mutationFn: (id) => CompanyHeaderService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-headers"] })
  });

  const setDefault = useMutation({
    mutationFn: (id) => CompanyHeaderService.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-headers"] })
  });

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (h) => { setForm({ name: h.name, company_name: h.company_name || "", logo_url: h.logo_url || "", subtitle: h.subtitle || "", is_default: h.is_default || false }); setEditId(h.id); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditId(null); setForm(empty); };

  // uploadLogo(file, headerId) needs a headerId — Base44's flow uploaded
  // first and got a permanent URL back with nothing else required.
  // Storage paths here are scoped under {tenant}/company-headers/
  // {headerId}/..., so a NEW header (editId === null) is saved once
  // (without a logo) to get an id, then updated with the uploaded path.
  // Editing an existing header uploads directly under its known id. This
  // is a real behavior change from Base44 (an extra round-trip on first
  // upload for brand-new headers), not just a rename.
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let headerId = editId;
      if (!headerId) {
        const created = await CompanyHeaderService.create({ ...form, logo_url: null });
        headerId = created.id;
        setEditId(headerId);
      }
      const path = await CompanyHeaderService.uploadLogo(file, headerId);
      setForm(f => ({ ...f, logo_url: path }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <PageHeader
          className="mb-6"
          title="כותרות הדפסה"
          description="לוגו / שם חברה שיופיע בראש הצעות המחיר"
          actions={
            <Button onClick={openNew}>
              <Plus className="w-4 h-4" /> כותרת חדשה
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : headers.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-input p-12 text-center text-muted-foreground">
            <p>אין כותרות עדיין</p>
            <p className="text-sm mt-1">הוסף כותרת חדשה עם שם חברה / לוגו</p>
          </div>
        ) : (
          <div className="space-y-3">
            {headers.map(h => (
              <div key={h.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
                <HeaderLogo path={h.logo_url} className="h-14 w-24 rounded border border-border" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{h.name}</p>
                  {h.company_name && <p className="text-sm text-muted-foreground">{h.company_name}</p>}
                  {h.subtitle && <p className="text-xs text-muted-foreground">{h.subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {h.is_default && <span className="flex items-center gap-1 text-xs text-warning bg-warning-subtle px-2 py-1 rounded-full"><Star className="w-3 h-3" />ברירת מחדל</span>}
                  {!h.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(h.id)} title="הגדר כברירת מחדל">
                      <Star className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(h.id)} className="text-red-500 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editId ? "עריכת כותרת" : "כותרת חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>שם פנימי (לזיהוי)</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="לדוגמה: לוגו ראשי" />
            </div>
            <div className="space-y-1">
              <Label>שם חברה (יוצג בכותרת)</Label>
              <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="לדוגמה: עסק אלומיניום בע״מ" />
            </div>
            <div className="space-y-1">
              <Label>כיתוב נוסף (טלפון / כתובת)</Label>
              <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="לדוגמה: 050-0000000 | תל אביב" />
            </div>
            <div className="space-y-2">
              <Label>לוגו</Label>
              {form.logo_url && (
                <HeaderLogo path={form.logo_url} className="h-16 rounded border border-border" />
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:text-primary">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "מעלה..." : "העלה תמונת לוגו"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              {form.logo_url && (
                <button className="text-xs text-red-500 hover:underline" onClick={() => setForm(f => ({ ...f, logo_url: "" }))}>הסר לוגו</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
              <Label>ברירת מחדל</Label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-primary hover:bg-primary-hover" disabled={!form.name || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור"}
            </Button>
            <Button variant="outline" onClick={closeDialog}>ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}