import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PlatformAdminService } from "@/services/platformAdminService";
import { PLAN_LIMITS, isApproachingLimit } from "@/lib/planLimits";
import { Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS = { active: "פעילה", suspended: "מושעית", cancelled: "בוטלה" };
const PLAN_LABELS = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const PAYMENT_STATUS_LABELS = { active: "משולם", past_due: "באיחור", suspended: "מושעה", cancelled: "בוטל" };
const BILLING_TYPE_LABELS = { rental: "השכרה", purchase: "רכישה" };
const ROLE_LABELS = { owner: "בעלים", admin: "מנהל", member: "חבר צוות", viewer: "צופה" };

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default function PlatformTenantDetail() {
  const { tenantId } = useParams();

  const { data: tenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ["platform-tenant", tenantId],
    queryFn: () => PlatformAdminService.getTenant(tenantId),
  });

  const { data: usage } = useQuery({
    queryKey: ["platform-tenant-usage", tenantId],
    queryFn: () => PlatformAdminService.getTenantUsage(tenantId),
  });

  const { data: members } = useQuery({
    queryKey: ["platform-tenant-members", tenantId],
    queryFn: () => PlatformAdminService.listTenantMembers(tenantId),
  });

  if (isLoadingTenant) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!tenant) {
    return <p className="text-center text-slate-400 py-20">חברה לא נמצאה</p>;
  }

  const subscription = tenant.tenant_subscriptions?.[0];
  const limits = PLAN_LIMITS[subscription?.plan] ?? PLAN_LIMITS.starter;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/admin/tenants" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ChevronRight className="w-4 h-4" />
        חזרה לרשימת החברות
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">{tenant.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">פרטי חברה</h2>
          <InfoRow label="סטטוס" value={STATUS_LABELS[tenant.status] ?? tenant.status} />
          <InfoRow label="נוצרה בתאריך" value={new Date(tenant.created_at).toLocaleDateString("he-IL")} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">תשלום ותוכנית</h2>
          <InfoRow label="תוכנית" value={PLAN_LABELS[subscription?.plan] ?? "—"} />
          <InfoRow label="סוג חיוב" value={BILLING_TYPE_LABELS[subscription?.billing_type] ?? "—"} />
          <InfoRow label="סטטוס תשלום" value={PAYMENT_STATUS_LABELS[subscription?.payment_status] ?? "—"} />
          <InfoRow
            label="מחיר"
            value={subscription?.price_amount ? `${subscription.price_amount} ${subscription.currency}` : "—"}
          />
          <InfoRow label="הערות" value={subscription?.notes} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">שימוש</h2>
          {usage ? (
            <>
              <InfoRow
                label="משתמשים"
                value={
                  <span className={cn(isApproachingLimit(usage.user_count, limits.users) && "text-amber-600")}>
                    {usage.user_count} מתוך {Number.isFinite(limits.users) ? limits.users : "∞"}
                    {isApproachingLimit(usage.user_count, limits.users) && (
                      <AlertTriangle className="inline w-4 h-4 mr-1" />
                    )}
                  </span>
                }
              />
              <InfoRow
                label="פרויקטים פעילים"
                value={
                  <span className={cn(isApproachingLimit(usage.project_count, limits.projects) && "text-amber-600")}>
                    {usage.project_count} מתוך {Number.isFinite(limits.projects) ? limits.projects : "∞"}
                    {isApproachingLimit(usage.project_count, limits.projects) && (
                      <AlertTriangle className="inline w-4 h-4 mr-1" />
                    )}
                  </span>
                }
              />
              <InfoRow label="לקוחות" value={usage.customer_count} />
            </>
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">חברי צוות</h2>
          {(members ?? []).length === 0 && <p className="text-slate-400 text-sm">אין חברי צוות</p>}
          {(members ?? []).map((member) => (
            <div key={member.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
              <span>{member.profiles?.full_name ?? "—"}</span>
              <span className="text-slate-500">{ROLE_LABELS[member.role] ?? member.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
