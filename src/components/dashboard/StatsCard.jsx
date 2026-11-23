import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, variant = "default" }) {
  const variants = {
    default: "bg-white border-border",
    success: "bg-success-subtle border-emerald-200",
    warning: "bg-warning-subtle border-amber-200",
    danger: "bg-destructive-subtle border-red-200",
    primary: "bg-secondary border-blue-200"
  };

  const iconVariants = {
    default: "bg-secondary text-muted-foreground",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-destructive-subtle text-destructive",
    primary: "bg-blue-100 text-primary"
  };

  return (
    <div className={cn(
      "rounded-2xl border p-6 transition-all hover:shadow-lg",
      variants[variant],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trendUp ? "text-success" : "text-destructive"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-3 rounded-xl",
            iconVariants[variant]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}