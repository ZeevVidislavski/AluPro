import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PlatformAdminService } from "@/services/platformAdminService";
import { PLAN_LIMITS, isApproachingLimit } from "@/lib/planLimits";
import { Loader2, ChevronRight, AlertTriangle, Ban, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS = { active: "פעילה", suspended: "מושעית", cancelled: "בוטלה" };
const PLAN_LABELS = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const PAYMENT_STATUS_LABELS = { active: "משולם", past_due: "באיחור", suspended: "מושעה", cancelled: "בוטל" };
const BILLING_TYPE_LABELS = { rental: "השכרה", purchase: "רכישה" };
const BILLING_CYCLE_LABELS = { monthly: "חודשי", annual: "שנתי" };
const ROLE_LABELS = { owner: "בעלים", admin: "מנהל", member: "חבר צוות", viewer: "צופה" };

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value ?? "—"}</span>
    </div>
  );
}

function BillingForm({ tenantId, subscription, onSaved }) {
  const [plan, setPlan] = useState(subscription?.plan ?? "starter");
  const [billingType, setBillingType] = useState(subscription?.billing_type ?? "rental");
  const [billingCycle, setBillingCycle] = useState(subscription?.billing_cycle ?? "monthly");
  const [paymentStatus, setPaymentStatus] = useState(subscription?.payment_status ?? "active");
  const [priceAmount, setPriceAmount] = useState(subscription?.price_amount ?? "");
  const [notes, setNotes] = useState(subscription?.notes ?? "");
  const [error, setError] = useState(null);

  useEffect(() => {
    setPlan(subscription?.plan ?? "starter");
    setBillingType(subscription?.billing_type ?? "rental");
    setBillingCycle(subscription?.billing_cycle ?? "monthly");
    setPaymentStatus(subscription?.payment_status ?? "active");
    setPriceAmount(subscription?.price_amount ?? "");
    setNotes(subscription?.notes ?? "");
  }, [subscription]);

  const mutation = useMutation({
    mutationFn: () =>
      PlatformAdminService.updateSubscription(tenantId, {
        plan,
        billing_type: billingType,
        billing_cycle: billingType === "rental" ? billingCycle : null,
        payment_status: paymentStatus,
        price_amount: priceAmount === "" ? null : Number(priceAmount),
        notes,
      }),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err) => setError(err.message || "שגיאה בשמירת פרטי החיוב"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-3"
    >
      <div className="space-y-1">
        <Label>תוכנית</Label>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PLAN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>סוג חיוב</Label>
        <Select value={billingType} onValueChange={setBillingType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(BILLING_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {billingType === "rental" && (
        <div className="space-y-1">
          <Label>מחזור חיוב</Label>
          <Select value={billingCycle} onValueChange={setBillingCycle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label>סטטוס תשלום</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>מחיר (₪)</Label>
        <Input
          type="number"
          step="0.01"
          value={priceAmount}
          onChange={(e) => setPriceAmount(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>הערות</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}
      {mutation.isSuccess && !mutation.isPending && (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">נשמר בהצלחה</p>
      )}

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור פרטי חיוב"}
      </Button>
    </form>
  );
}

export default function PlatformTenantDetail() {
  const { tenantId } = useParams();
  const queryClient = useQueryClient();

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

  const statusMutation = useMutation({
    mutationFn: (status) => PlatformAdminService.setTenantStatus(tenantId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
  };

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

          <div className="flex gap-2 mt-4">
            {tenant.status !== "suspended" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("suspended")}
              >
                <Ban className="w-4 h-4" />
                השעיית חברה
              </Button>
            )}
            {tenant.status !== "active" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("active")}
              >
                <PlayCircle className="w-4 h-4" />
                הפעלה מחדש
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">תשלום ותוכנית</h2>
          <BillingForm tenantId={tenantId} subscription={subscription} onSaved={invalidateAll} />
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
