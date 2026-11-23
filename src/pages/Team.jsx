import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { confirmAction } from "@/components/shared/confirm";
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
import { Loader2, UserPlus, Pencil } from "lucide-react";

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
      className="bg-card rounded-xl border border-border p-6 space-y-4"
    >
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-muted-foreground" />
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
        <p className="text-xs text-muted-foreground">
          יש למסור סיסמה זו לעובד — הוא יוכל להחליף אותה מאוחר יותר דרך "שכחתי סיסמה" או האזור האישי שלו.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive-subtle rounded-md px-3 py-2">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "הוסף עובד"}
      </Button>
    </form>
  );
}

function EditMemberForm({ tenantId, member, onClose, onSaved }) {
  const isOwner = member.role === "owner";
  const [fullName, setFullName] = useState(member.profiles?.full_name ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(member.role);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      TeamService.updateMember({
        tenantId,
        memberId: member.id,
        fullName,
        email: email.trim() || undefined,
        role: isOwner ? undefined : role,
      }),
    onSuccess: () => {
      setError(null);
      setMessage("הפרטים נשמרו");
      onSaved();
    },
    onError: (err) => { setMessage(null); setError(err.message || "שגיאה בשמירה"); },
  });

  const resetMutation = useMutation({
    mutationFn: () => TeamService.resetMemberPassword({ tenantId, memberId: member.id, password: newPassword }),
    onSuccess: () => {
      setError(null);
      setMessage(`הסיסמה אופסה. יש למסור לעובד את הסיסמה: ${newPassword}`);
    },
    onError: (err) => { setMessage(null); setError(err.message || "שגיאה באיפוס הסיסמה"); },
  });

  const removeMutation = useMutation({
    mutationFn: () => TeamService.removeMember({ tenantId, memberId: member.id }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err) => { setMessage(null); setError(err.message || "שגיאה במחיקה"); },
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <Pencil className="w-5 h-5 text-muted-foreground" />
        עריכת עובד
      </h2>

      <div className="space-y-2">
        <Label htmlFor="editFullName">שם מלא</Label>
        <Input id="editFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="editEmail">אימייל חדש (אופציונלי)</Label>
        <Input id="editEmail" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="להשאיר ריק ללא שינוי" />
      </div>

      {!isOwner && (
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
      )}

      <Button className="w-full" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור שינויים"}
      </Button>

      <div className="border-t border-border pt-4 space-y-2">
        <Label htmlFor="resetPassword">איפוס סיסמה</Label>
        <div className="flex gap-2">
          <Input id="resetPassword" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Button type="button" variant="outline" onClick={() => setNewPassword(generatePassword())}>חדש</Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={resetMutation.isPending || newPassword.length < 6}
          onClick={() => resetMutation.mutate()}
        >
          {resetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "אפס סיסמה"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive-subtle rounded-md px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-success bg-success-subtle rounded-md px-3 py-2">{message}</p>}

      {!isOwner && (
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive-subtle"
          disabled={removeMutation.isPending}
          onClick={async () => {
            if (await confirmAction(`למחוק את ${member.profiles?.full_name || "העובד"} מהצוות?`)) removeMutation.mutate();
          }}
        >
          {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "מחק עובד"}
        </Button>
      )}

      <Button type="button" variant="ghost" className="w-full" onClick={onClose}>חזרה להזמנת עובד חדש</Button>
    </div>
  );
}

export default function Team() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);

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
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <PageHeader className="mb-6" title="צוות" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">חברי צוות</h2>
            {canManageTeam && editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                <UserPlus className="w-4 h-4 ml-1" /> עובד חדש
              </Button>
            )}
          </div>
          {isLoadingMembers ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {(members ?? []).length === 0 && <p className="text-muted-foreground text-sm">אין חברי צוות</p>}
              {(members ?? []).map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm gap-2">
                  <span>{member.profiles?.full_name ?? "—"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</span>
                    {canManageTeam && (member.role !== "owner" || context?.role === "owner") && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(member)} title="עריכה / איפוס סיסמה">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {canManageTeam && tenantId && editing && (
          <EditMemberForm
            key={editing.id}
            tenantId={tenantId}
            member={editing}
            onClose={() => setEditing(null)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] })}
          />
        )}

        {canManageTeam && tenantId && !editing && (
          <InviteForm
            tenantId={tenantId}
            onInvited={() => queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] })}
          />
        )}
      </div>
    </div>
  );
}
