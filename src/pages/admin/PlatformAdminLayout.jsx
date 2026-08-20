import { Link } from "react-router-dom";
import { ChevronLeft, ShieldCheck } from "lucide-react";

// Deliberately not src/Layout.jsx — that component renders the
// tenant-facing sidebar navigation, which must never mention or link to
// the platform-admin console (see approved plan: gated by route + RLS,
// but also just kept out of the regular nav entirely).
export default function PlatformAdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-bold">מסוף ניהול פלטפורמה</span>
        </div>
        <Link to="/" className="flex items-center gap-1 text-sm text-slate-300 hover:text-white">
          <ChevronLeft className="w-4 h-4" />
          חזרה למערכת
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
