import { cn } from "@/lib/utils";

// Status pill: semantic tone + a dot, so state is never conveyed by color alone.
const TONES = {
  neutral: "bg-secondary text-muted-foreground",
  info: "bg-info-subtle text-info",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-destructive-subtle text-destructive",
};

export default function StatusBadge({ tone = "neutral", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-4 whitespace-nowrap",
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
