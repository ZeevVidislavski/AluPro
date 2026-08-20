import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { ProfileService } from "@/services/profileService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function Profile() {
  const { user, updatePassword } = useAuth();

  const [fullName, setFullName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState(null);
  const [nameError, setNameError] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    ProfileService.getSelf()
      .then((profile) => setFullName(profile.full_name ?? ""))
      .finally(() => setIsLoadingProfile(false));
  }, []);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameError(null);
    setNameMessage(null);
    setIsSavingName(true);
    try {
      await ProfileService.updateSelf({ full_name: fullName });
      setNameMessage("השם עודכן בהצלחה");
    } catch (err) {
      setNameError(err.message || "שגיאה בעדכון השם");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("הסיסמאות אינן תואמות");
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("הסיסמה עודכנה בהצלחה");
    } catch (err) {
      setPasswordError(err.message || "שגיאה בעדכון הסיסמה");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">אזור אישי</h1>
      <p className="text-slate-500 text-sm mb-6">{user?.email}</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
        <h2 className="font-semibold text-slate-900 mb-4">פרטים אישיים</h2>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">שם מלא</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoadingProfile}
            />
          </div>
          {nameError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{nameError}</p>
          )}
          {nameMessage && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{nameMessage}</p>
          )}
          <Button type="submit" disabled={isSavingName || isLoadingProfile}>
            {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור שם"}
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">החלפת סיסמה</h2>
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">סיסמה חדשה</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">אימות סיסמה</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{passwordError}</p>
          )}
          {passwordMessage && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{passwordMessage}</p>
          )}
          <Button type="submit" disabled={isSavingPassword}>
            {isSavingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "עדכן סיסמה"}
          </Button>
        </form>
      </div>
    </div>
  );
}
