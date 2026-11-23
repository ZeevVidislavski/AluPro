import { cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + optional hint/error, wired for accessibility:
 * the label's htmlFor, the control's id, aria-describedby and aria-invalid.
 * Pass exactly one control (Input, Textarea, SelectTrigger...) as the child.
 */
export default function FormField({ label, required, hint, error, className, children }) {
  const autoId = useId();
  const child = isValidElement(children) ? children : null;
  const id = child?.props.id || autoId;
  const descId = error || hint ? `${id}-desc` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive" aria-hidden="true"> *</span>}
        </Label>
      )}
      {child
        ? cloneElement(child, {
            id,
            "aria-describedby": descId,
            "aria-invalid": error ? true : child.props["aria-invalid"],
            ...(required ? { required: true } : null),
          })
        : children}
      {(error || hint) && (
        <p id={descId} className={cn("text-[13px] leading-[18px]", error ? "text-destructive" : "text-muted-foreground")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
