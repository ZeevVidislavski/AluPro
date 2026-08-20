import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PlatformAdminService } from "@/services/platformAdminService";
import { PLAN_LIMITS, isApproachingLimit } from "@/lib/planLimits";
import { Loader2, AlertTriangle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  active: "פעילה",
  suspended: "מושעית",
  cancelled: "בוטלה",
};

const PLAN_LABELS = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PAYMENT_STATUS_LABELS = {
  active: "משולם",
  past_due: "באיחור",
  suspended: "מושעה",
  cancelled: "בוטל",
};

const BILLING_TYPE_LABELS = {
  rental: "השכרה",
  purchase: "רכישה",
};

function TenantUsageBadge({ tenantId, plan }) {
  const { data: usage } = useQuery({
    queryKey: ["platform-tenant-usage", tenantId],
    queryFn: () => PlatformAdminService.getTenantUsage(tenantId),
  });

  if (!usage) return <span className="text-slate-400 text-sm">טוען...</span>;

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  const usersNearLimit = isApproachingLimit(usage.user_count, limits.users);
  const projectsNearLimit = isApproachingLimit(usage.project_count, limits.projects);
  const warning = usersNearLimit || projectsNearLimit;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn(usersNearLimit && "text-amber-600 font-semibold")}>
        {usage.user_count} משתמשים
      </span>
      <span className="text-slate-300">·</span>
      <span className={cn(projectsNearLimit && "text-amber-600 font-semibold")}>
        {usage.project_count} פרויקטים
      </span>
      {warning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
    </div>
  );
}

export default function PlatformTenantList() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () => PlatformAdminService.listTenants(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">חברות במערכת</h1>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-right">
              <th className="px-4 py-3 font-medium">שם חברה</th>
              <th className="px-4 py-3 font-medium">סטטוס</th>
              <th className="px-4 py-3 font-medium">תוכנית</th>
              <th className="px-4 py-3 font-medium">סוג חיוב</th>
              <th className="px-4 py-3 font-medium">תשלום</th>
              <th className="px-4 py-3 font-medium">שימוש</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((tenant) => {
              const subscription = tenant.tenant_subscriptions?.[0];
              return (
                <tr key={tenant.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{tenant.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        tenant.status === "active" && "bg-green-100 text-green-700",
                        tenant.status === "suspended" && "bg-amber-100 text-amber-700",
                        tenant.status === "cancelled" && "bg-red-100 text-red-700"
                      )}
                    >
                      {STATUS_LABELS[tenant.status] ?? tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{PLAN_LABELS[subscription?.plan] ?? "—"}</td>
                  <td className="px-4 py-3">{BILLING_TYPE_LABELS[subscription?.billing_type] ?? "—"}</td>
                  <td className="px-4 py-3">
                    {PAYMENT_STATUS_LABELS[subscription?.payment_status] ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TenantUsageBadge tenantId={tenant.id} plan={subscription?.plan} />
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link
                      to={`/admin/tenants/${tenant.id}`}
                      className="text-slate-400 hover:text-slate-700 inline-flex items-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(tenants ?? []).length === 0 && (
          <p className="text-center text-slate-400 py-10">אין עדיין חברות רשומות במערכת</p>
        )}
      </div>
    </div>
  );
}
