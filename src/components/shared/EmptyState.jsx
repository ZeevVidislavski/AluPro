import { cn } from "@/lib/utils";

// Icon + one sentence + at most one action. Use `action` for the CTA node.
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      {Icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-secondary">
          <Icon className="h-5 w-5 text-[hsl(var(--primary)/0.7)]" aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
