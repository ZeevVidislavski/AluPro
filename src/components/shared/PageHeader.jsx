import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page header: optional breadcrumbs, one H1, optional description,
 * and the page's primary action(s) at the end side.
 * breadcrumbs: [{ label, to? }] - the last item is the current page.
 */
export default function PageHeader({ title, description, breadcrumbs, actions, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {breadcrumbs?.length > 0 && (
        <nav aria-label="מיקום" className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
          {breadcrumbs.map((b, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                {b.to && !last ? (
                  <Link to={b.to} className="hover:text-primary hover:underline">{b.label}</Link>
                ) : (
                  <span className={last ? "font-medium text-foreground" : undefined} aria-current={last ? "page" : undefined}>{b.label}</span>
                )}
                {!last && <ChevronLeft className="h-3 w-3 text-[hsl(var(--primary)/0.55)]" aria-hidden="true" />}
              </span>
            );
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-9 text-foreground">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {(actions || children) && <div className="flex flex-wrap items-center gap-2">{actions}{children}</div>}
      </div>
    </div>
  );
}
