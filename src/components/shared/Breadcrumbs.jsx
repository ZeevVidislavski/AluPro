import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/** items: [{ label, to? }] - the last item is the current page. */
export default function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="מיקום" className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
      {items.map((b, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {b.to && !last ? (
              <Link to={b.to} className="hover:text-primary hover:underline">{b.label}</Link>
            ) : (
              <span className={last ? "font-medium text-foreground" : undefined} aria-current={last ? "page" : undefined}>{b.label}</span>
            )}
            {!last && <ChevronLeft className="h-3 w-3 text-primary/55" aria-hidden="true" />}
          </span>
        );
      })}
    </nav>
  );
}
