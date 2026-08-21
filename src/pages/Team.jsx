import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { TeamService } from "@/services/teamService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

const ROLE_LABELS = { owner: "בעלים", admin: "מנהל", member: "חבר צוות", viewer: "צופה" };
const INVITE_ROLE_LABELS = { admin: "מנהל", member: "חבר צוות", viewer: "צופה" };

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function InviteForm({ tenantId, onInvited }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () => TeamService.inviteMember({ tenantId, email, password, fullName, role }),
    onSuccess: () => {
      setError(null);
      setFullName("");
      setEmail("");
      setRole("member");
      setPassword(generatePassword());
      onInvited();
    },
    onError: (err) => setError(err.message || "שגיאה בהזמנת העובד"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
    >
      <h2 className="font-semibold text-slate-900 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-slate-400" />
        הזמנת עובד חדש
      </h2>

      <div className="space-y-2">
        <Label htmlFor="fullName">שם מלא</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">אימייל</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label>תפקיד</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(INVITE_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">סיסמה זמנית</Label>
        <div className="flex gap-2">
          <Input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
          />
          <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
            חדש
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          יש למסור סיסמה זו לעובד — הוא יוכל להחליף אותה מאוחר יותר דרך "שכחתי סיסמה" או האזור האישי שלו.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "הוסף עובד"}
      </Button>
    </form>
  );
}

export default function Team() {
  const queryClient = useQueryClient();

  const { data: context, isLoading: isLoadingContext } = useQuery({
    queryKey: ["active-tenant-context"],
    queryFn: () => TeamService.getActiveTenantContext(),
  });

  const tenantId = context?.tenant_id;

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["team-members", tenantId],
    queryFn: () => TeamService.listMembers(tenantId),
    enabled: !!tenantId,
  });

  const canManageTeam = context?.role === "owner" || context?.role === "admin";

  if (isLoadingContext) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">צוות</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-3">חברי צוות</h2>
          {isLoadingMembers ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <>
              {(members ?? []).length === 0 && <p className="text-slate-400 text-sm">אין חברי צוות</p>}
              {(members ?? []).map((member) => (
                <div key={member.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                  <span>{member.profiles?.full_name ?? "—"}</span>
                  <span className="text-slate-500">{ROLE_LABELS[member.role] ?? member.role}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {canManageTeam && tenantId && (
          <InviteForm
            tenantId={tenantId}
            onInvited={() => queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] })}
          />
        )}
      </div>
    </div>
  );
}
