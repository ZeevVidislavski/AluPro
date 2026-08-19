import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login, isAuthenticated, resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleForgotPassword = async () => {
    setError(null);
    setResetMessage(null);
    if (!email) {
      setError("יש להזין קודם כתובת אימייל");
      return;
    }
    setIsSendingReset(true);
    try {
      await resetPasswordForEmail(email);
      setResetMessage("נשלח מייל לאיפוס סיסמה, אנא בדקי את תיבת הדואר שלך");
    } catch (err) {
      if (err.message?.toLowerCase().includes("rate limit")) {
        setError("נעשו יותר מדי ניסיונות, יש לנסות שוב בעוד כמה דקות");
      } else {
        setError(err.message || "שגיאה בשליחת מייל איפוס");
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "שגיאה בהתחברות");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">התחברות</h1>
        <p className="text-slate-500 text-sm mb-6">ProjectFlow Pro</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">סיסמה</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {resetMessage && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{resetMessage}</p>
          )}

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "התחבר"}
          </Button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isSendingReset}
            className="w-full text-sm text-blue-600 hover:underline text-center"
          >
            {isSendingReset ? "שולח..." : "שכחתי סיסמה"}
          </button>
        </form>
      </div>
    </div>
  );
}
