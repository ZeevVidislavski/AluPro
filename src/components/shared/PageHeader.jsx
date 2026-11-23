import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Page header: optional breadcrumbs, one H1, optional description,
 * and the page's primary action(s) at the end side.
 * breadcrumbs: [{ label, to? }] - the last item is the current page.
 */
export default function PageHeader({ title, description, breadcrumbs, actions, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Breadcrumbs items={breadcrumbs} />
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
