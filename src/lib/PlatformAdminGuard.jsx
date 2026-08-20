import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { PlatformAdminService } from "@/services/platformAdminService";

// Route-level convenience gate, not the real security boundary — that's
// the RLS bypass in supabase/migrations/0018_platform_admin_rls_bypass.sql.
// Even if a tenant user guessed a /admin/* URL, every data call underneath
// would return empty results because of RLS, not because of this check.
export default function PlatformAdminGuard({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    PlatformAdminService.checkSelf()
      .then((result) => {
        if (!cancelled) setIsAdmin(result);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
