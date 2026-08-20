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

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default function PlatformTenantCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState(generatePassword());
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
      const { tenantId } = await PlatformAdminService.createTenantWithNewUser({
        name,
        slug,
        ownerEmail,
        ownerPassword,
        ownerFullName,
      });
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

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <p className="text-sm font-medium text-slate-700">משתמש הבעלים הראשון של החברה</p>

          <div className="space-y-2">
            <Label htmlFor="ownerFullName">שם מלא</Label>
            <Input id="ownerFullName" value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">אימייל</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerPassword">סיסמה זמנית</Label>
            <div className="flex gap-2">
              <Input
                id="ownerPassword"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                dir="ltr"
              />
              <Button type="button" variant="outline" onClick={() => setOwnerPassword(generatePassword())}>
                חדש
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              יש למסור סיסמה זו ללקוח — הוא יוכל להחליף אותה מאוחר יותר דרך "שכחתי סיסמה" או האזור האישי שלו.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור חברה ומשתמש"}
        </Button>
      </form>
    </div>
  );
}
