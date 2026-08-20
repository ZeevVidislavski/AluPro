import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PlatformAdminService } from "@/services/platformAdminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight } from "lucide-react";

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PlatformTenantCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (value) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const tenantId = await PlatformAdminService.createTenant({ name, slug, ownerEmail });
      navigate(`/admin/tenants/${tenantId}`, { replace: true });
    } catch (err) {
      setError(err.message || "שגיאה ביצירת החברה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/admin/tenants" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ChevronRight className="w-4 h-4" />
        חזרה לרשימת החברות
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">חברה חדשה</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">שם החברה</Label>
          <Input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">מזהה (slug)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            required
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerEmail">אימייל של בעל החברה</Label>
          <Input
            id="ownerEmail"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            required
            dir="ltr"
          />
          <p className="text-xs text-slate-400">
            יש ליצור את המשתמש תחילה ב-Supabase Authentication לפני יצירת החברה כאן.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור חברה"}
        </Button>
      </form>
    </div>
  );
}
