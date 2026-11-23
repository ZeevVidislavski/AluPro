import { useState, useEffect } from "react";
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
  FileText,
  Tag,
  Stamp,
  ShieldCheck,
  LogOut,
  UserCircle,
  UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmHost } from "@/components/shared/confirm";

// Sidebar groups (docs/DESIGN_SYSTEM_PROPOSAL.md section 8.1).
// Deep pages highlight their parent item.
const navGroups = [
  {
    title: "עבודה יומית",
    items: [
      { name: "דשבורד", href: "Dashboard", icon: LayoutDashboard },
      { name: "לקוחות", href: "Customers", icon: Users },
      { name: "פרויקטים", href: "Projects", icon: Building2 },
      { name: "הצעות מחיר", href: "Quotes", icon: FileText },
    ],
  },
  {
    title: "קטלוג וכספים",
    items: [
      { name: "קטלוג דגמים", href: "ModelPricing", icon: Tag },
      { name: "פיננסים", href: "Finance", icon: Wallet },
      { name: "תזכורות", href: "Reminders", icon: Bell },
    ],
  },
  {
    title: "ניהול חכם",
    items: [{ name: "ניהול חכם", href: "BusinessAgent", icon: Brain }],
  },
  {
    title: "הגדרות",
    items: [{ name: "כותרות הדפסה", href: "CompanyHeaders", icon: Stamp }],
  },
];

const PARENT_PAGE = { ProjectDetails: "Projects", QuoteEditor: "Quotes" };

function NavItem({ to, icon: Icon, active, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 h-10 px-3 rounded-md text-sm font-medium border-s-2 transition-colors",
        active
          ? "bg-secondary text-primary border-primary"
          : "border-transparent text-foreground hover:bg-secondary"
      )}
    >
      <Icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-primary" : "text-primary/60")} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </Link>
  );
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activePage = PARENT_PAGE[currentPageName] || currentPageName;

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);
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
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => item.href !== "BusinessAgent" || hasBusinessAgent) }))
    .filter((g) => g.items.length > 0);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="ניווט ראשי"
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-64 bg-sidebar border-l transform transition-transform duration-300 lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground" aria-hidden="true">
              <span className="h-3 w-3 rounded-sm border-2 border-white" />
            </span>
            <span className="text-lg font-bold text-foreground">AluPro</span>
          </div>
          <button
            onClick={closeSidebar}
            aria-label="סגור תפריט"
            className="lg:hidden p-2 rounded-md hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <h2 className="px-3 pb-1 text-xs font-medium text-muted-foreground">{group.title}</h2>
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  to={createPageUrl(item.href)}
                  icon={item.icon}
                  active={activePage === item.href}
                  onClick={closeSidebar}
                >
                  {item.name}
                </NavItem>
              ))}
              {group.title === "הגדרות" && canManageTeam && (
                <NavItem to={createPageUrl("Team")} icon={UserPlus} active={activePage === "Team"} onClick={closeSidebar}>
                  צוות
                </NavItem>
              )}
            </div>
          ))}

          {isPlatformAdmin && (
            <div className="space-y-0.5">
              <h2 className="px-3 pb-1 text-xs font-medium text-muted-foreground">פלטפורמה</h2>
              <NavItem to="/admin/tenants" icon={ShieldCheck} active={activePage === "admin/tenants"} onClick={closeSidebar}>
                מסוף ניהול פלטפורמה
              </NavItem>
            </div>
          )}
        </nav>

        <div className="p-3 border-t shrink-0 space-y-0.5">
          <NavItem to={createPageUrl("Profile")} icon={UserCircle} active={activePage === "Profile"} onClick={closeSidebar}>
            {user?.email ?? "אזור אישי"}
          </NavItem>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 h-10 px-3 rounded-md border-s-2 border-transparent text-sm font-medium text-muted-foreground hover:bg-destructive-subtle hover:text-destructive transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
            יציאה
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:mr-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-card border-b lg:hidden">
          <div className="flex items-center justify-between h-14 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="פתח תפריט"
              aria-expanded={sidebarOpen}
              className="p-2 -mr-2 rounded-md hover:bg-secondary"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-foreground">AluPro</span>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Page content */}
        <ConfirmHost />
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
