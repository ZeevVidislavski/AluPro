import { cn } from "@/lib/utils";

// KPI tile: white card, semantic color only on the icon chip and (for warning/danger) the figure.
const VALUE_TONE = {
  default: "text-foreground",
  primary: "text-foreground",
  success: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
};

const ICON_TONE = {
  default: "bg-secondary text-muted-foreground",
  primary: "bg-secondary text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-destructive-subtle text-destructive",
};

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, variant = "default" }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("text-[28px] font-bold leading-9 tabular-nums", VALUE_TONE[variant])}>{value}</p>
          {subtitle && <p className="text-[13px] leading-[18px] text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", trendUp ? "text-success" : "text-destructive")}>
              <span aria-hidden="true">{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("shrink-0 rounded-lg p-2.5", ICON_TONE[variant])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
