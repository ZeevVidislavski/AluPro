import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown, DollarSign, PackageCheck, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const actionConfig = {
  collect: {
    icon: DollarSign,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700"
  },
  fix_profit: {
    icon: TrendingDown,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700"
  },
  supplier_payment: {
    icon: PackageCheck,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-700"
  },
  follow_up: {
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700"
  },
  general: {
    icon: RefreshCw,
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700"
  }
};

const urgencyLabels = {
  high: { label: "דחוף", cls: "bg-red-100 text-red-700" },
  medium: { label: "בינוני", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "נמוך", cls: "bg-slate-100 text-slate-500" }
};

export default function SmartFocusCard({ tasks, summary, isLoading, onRefresh, maxItems = 5 }) {
  const topTasks = tasks.slice(0, maxItems);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-600 to-blue-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">🎯 מה הכי חשוב עכשיו</h2>
            <p className="text-blue-100 text-sm mt-0.5">מנוע החלטות עסקי חכם</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Daily Summary */}
        {summary && (
          <div className="bg-white/10 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap gap-4 text-sm text-white">
              <span>💰 <strong>{formatCurrency(summary.totalToCollect)}</strong> ממתין לגבייה</span>
              <span>⚠️ <strong>{summary.projectsNeedingAttention}</strong> פרויקטים דורשים טיפול</span>
              {summary.criticalAlerts > 0 && (
                <span>🚨 <strong>{summary.criticalAlerts}</strong> התראות קריטיות</span>
              )}
            </div>
            {summary.topTask && (
              <div className="text-white/90 text-sm font-medium pt-1 border-t border-white/20">
                🎯 היום הכי חשוב: {summary.topTask.message} — {summary.topTask.project_name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="divide-y divide-slate-100">
        {isLoading && (
          <div className="p-8 text-center text-slate-500 text-sm">טוען...</div>
        )}

        {!isLoading && topTasks.length === 0 && (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-600 font-medium">אין משימות דחופות כרגע</p>
            <p className="text-slate-400 text-sm mt-1">כל הפרויקטים במצב תקין</p>
          </div>
        )}

        {topTasks.map((task, idx) => {
          const cfg = actionConfig[task.action_type] || actionConfig.general;
          const Icon = cfg.icon;
          const urgency = urgencyLabels[task.urgency_level] || urgencyLabels.low;

          return (
            <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                  {idx + 1}
                </div>

                {/* Icon */}
                <div className={cn("flex-shrink-0 p-2 rounded-xl", cfg.bg)}>
                  <Icon className={cn("w-4 h-4", cfg.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{task.project_name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", urgency.cls)}>
                      {urgency.label}
                    </span>
                  </div>
                  <p className="text-slate-700 text-sm">{task.message}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{task.reason}</p>
                  {task.impact_label && (
                    <span className={cn("inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full", cfg.badge)}>
                      {task.impact_label}
                    </span>
                  )}
                </div>

                {/* Score + Link */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-xs font-bold text-slate-400">{task.priority_score} נק'</span>
                  <Link to={`/ProjectDetails?id=${task.project_id}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      פתח
                      <ArrowLeft className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}