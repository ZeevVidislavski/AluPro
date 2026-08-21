import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { PlatformAdminService } from "@/services/platformAdminService";
import { TeamService } from "@/services/teamService";
import { planHasFeature } from "@/lib/planLimits";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  Bell,
  Brain,
  Menu,
  X,
  ChevronLeft,
  FileText,
  Tag,
  Stamp,
  ShieldCheck,
  LogOut,
  UserCircle,
  UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "דשבורד", href: "Dashboard", icon: LayoutDashboard },
  { name: "לקוחות", href: "Customers", icon: Users },
  { name: "פרויקטים", href: "Projects", icon: Building2 },
  { name: "הצעות מחיר", href: "Quotes", icon: FileText },
  { name: "קטלוג דגמים", href: "ModelPricing", icon: Tag },
  { name: "פיננסים", href: "Finance", icon: Wallet },
  { name: "תזכורות", href: "Reminders", icon: Bell },
  { name: "כותרות הדפסה", href: "CompanyHeaders", icon: Stamp },
  { name: "🤖 ניהול חכם", href: "BusinessAgent", icon: Brain },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Shown only to Zeev — see PlatformAdminGuard.jsx for the actual
  // enforcement (this is just so he has a visible link; hiding it here is
  // not the security boundary, RLS is).
  const { data: isPlatformAdmin } = useQuery({
    queryKey: ["platform-admin-self"],
    queryFn: () => PlatformAdminService.checkSelf(),
    staleTime: 5 * 60 * 1000,
  });

  // Tenant-scoped (not platform-scoped) — separate from isPlatformAdmin
  // above. Shows the "צוות" nav link only to the owner/admin of the
  // CURRENT tenant, so they can invite teammates. Convenience gate only;
  // the real boundary is is_tenant_admin() inside the tenant-invite-member
  // Edge Function.
  const { data: tenantContext } = useQuery({
    queryKey: ["active-tenant-context"],
    queryFn: () => TeamService.getActiveTenantContext(),
    staleTime: 5 * 60 * 1000,
  });
  const canManageTeam = tenantContext?.role === "owner" || tenantContext?.role === "admin";
  const hasBusinessAgent = planHasFeature(tenantContext?.plan, "businessAgent");
  const visibleNavigation = navigation.filter(
    (item) => item.href !== "BusinessAgent" || hasBusinessAgent
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 z-50 h-full w-64 bg-white border-l border-slate-200 transform transition-transform duration-300 lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100 shrink-0">
          <h1 className="text-xl font-bold text-slate-900">ניהול פרויקטים</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {visibleNavigation.map((item) => {
            const isActive = currentPageName === item.href;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-blue-600" : "text-slate-400"
                )} />
                {item.name}
                {isActive && <ChevronLeft className="w-4 h-4 mr-auto" />}
              </Link>
            );
          })}

          {canManageTeam && (
            <Link
              to={createPageUrl("Team")}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                currentPageName === "Team"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <UserPlus className={cn("w-5 h-5", currentPageName === "Team" ? "text-blue-600" : "text-slate-400")} />
              צוות
              {currentPageName === "Team" && <ChevronLeft className="w-4 h-4 mr-auto" />}
            </Link>
          )}

          {isPlatformAdmin && (
            <>
              <div className="my-2 border-t border-slate-100" />
              <Link
                to="/admin/tenants"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  currentPageName === "admin/tenants"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <ShieldCheck className="w-5 h-5 text-slate-400" />
                מסוף ניהול פלטפורמה
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 shrink-0 space-y-1">
          <Link
            to={createPageUrl("Profile")}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              currentPageName === "Profile"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <UserCircle className="w-5 h-5 text-slate-400" />
            <span className="truncate">{user?.email ?? "אזור אישי"}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-5 h-5" />
            יציאה
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:mr-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">ניהול פרויקטים</h1>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}